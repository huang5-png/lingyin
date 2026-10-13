const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus'])

let isScrapingRunning = false
let abortScrapingController = null

/**
 * 提取作品名称或路径中的 RJ/VJ/BJ 码
 * @param {string} text
 * @returns {string|null}
 */
function extractRJCode(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/(?:RJ|VJ|BJ)\s*(\d{3,8})/i)
  if (match) {
    const prefix = match[0].slice(0, 2).toUpperCase()
    return prefix + match[1]
  }
  return null
}

/**
 * 自然比较字符串排序
 */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * 递归扫描文件夹中的音频文件
 * @param {string} rootDir
 * @param {string} currentDir
 * @returns {Array<{name: string, path: string, relativePath: string, displayName: string}>}
 */
function scanAudioRecursive(rootDir, currentDir = rootDir) {
  const results = []
  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        const sub = scanAudioRecursive(rootDir, fullPath)
        results.push(...sub)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (AUDIO_EXTENSIONS.has(ext)) {
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/')
          results.push({
            name: entry.name,
            path: fullPath,
            relativePath: relPath,
            displayName: relPath.replace(/\//g, ' / '),
          })
        }
      }
    }
  } catch (err) {
    logger.warn('[MediaSync] 读取目录失败:', currentDir, err.message)
  }
  return results
}

/**
 * 比较两份音频列表是否实质不同（包含相对路径、文件名与绝对路径变动）
 */
function isAudioListDifferent(listA, listB) {
  if (!Array.isArray(listA) || !Array.isArray(listB)) return true
  if (listA.length !== listB.length) return true
  for (let i = 0; i < listA.length; i++) {
    const a = listA[i]
    const b = listB[i]
    if (!a || !b) return true
    if ((a.relativePath || a.name) !== (b.relativePath || b.name)) return true
    if (a.path && b.path && a.path !== b.path) return true
  }
  return false
}

/**
 * 增量扫描并同步媒体库所有本地作品的音频索引与健康状态
 * @param {Array<object>} works
 * @param {object} dbOps
 * @param {Function} dbOps.setWorksAudioFiles
 * @param {Function} dbOps.updateWork
 * @returns {Promise<object>}
 */
async function syncLibraryAudio(works, { setWorksAudioFiles, updateWork }) {
  if (!Array.isArray(works) || works.length === 0) {
    return { totalWorks: 0, updatedCount: 0, missingCount: 0, totalAudios: 0 }
  }

  logger.info('[MediaSync] 开始全量媒体库音频索引与健康状态同步...')
  const entriesToUpdate = []
  let missingCount = 0
  let totalAudios = 0

  for (const work of works) {
    if (!work || work.isOnline) continue
    const targetPath = work.folderPath || work.path
    if (!targetPath) continue

    if (!fs.existsSync(targetPath)) {
      missingCount++
      if (!work.pathMissing) {
        await updateWork(work.id, { pathMissing: true })
      }
      continue
    }

    // 目录存在，如有旧的 missing 标记则清除
    if (work.pathMissing) {
      await updateWork(work.id, { pathMissing: false })
    }

    const scannedAudios = scanAudioRecursive(targetPath)
    scannedAudios.sort((a, b) => naturalCompare(a.relativePath || a.name, b.relativePath || b.name))
    totalAudios += scannedAudios.length

    const currentAudios = Array.isArray(work.audioFiles) ? work.audioFiles : []
    if (isAudioListDifferent(currentAudios, scannedAudios)) {
      entriesToUpdate.push({
        workId: work.id,
        audioFiles: scannedAudios,
        audioCount: scannedAudios.length,
      })
    }
  }

  if (entriesToUpdate.length > 0 && typeof setWorksAudioFiles === 'function') {
    await setWorksAudioFiles(entriesToUpdate)
  }

  logger.info('[MediaSync] 媒体库同步完成:', {
    totalWorks: works.length,
    updatedCount: entriesToUpdate.length,
    missingCount,
    totalAudios,
  })

  return {
    totalWorks: works.length,
    updatedCount: entriesToUpdate.length,
    missingCount,
    totalAudios,
  }
}

/**
 * 判断作品是否缺失元数据
 * @param {object} work
 * @returns {boolean}
 */
function needsScraping(work) {
  if (!work || work.isOnline) return false
  const rjCode = work.rjCode || extractRJCode(work.title || work.folderName || work.name || '')
  if (!rjCode) return false

  const hasCover = typeof work.cover === 'string' && work.cover.length > 0
  const hasCvs = Array.isArray(work.cvs) && work.cvs.length > 0
  const hasCircle = typeof work.circle === 'string' && work.circle.length > 0

  return !hasCover || !hasCvs || !hasCircle
}

/**
 * 自动批量刮削缺少元数据的作品
 * @param {object} options
 * @param {Array<object>} options.works
 * @param {Function} options.getWorkDetail
 * @param {Function} options.updateWork
 * @param {Function} [options.onProgress]
 * @param {number} [options.intervalMs] 请求间隔，默认 1200ms
 * @returns {Promise<object>}
 */
async function autoScrapeDLsite(options = {}) {
  const { works = [], getWorkDetail, updateWork, onProgress, intervalMs = 1200 } = options

  if (isScrapingRunning) {
    return { running: true, message: '自动刮削任务已在进行中' }
  }

  const eligibleWorks = works.filter((w) => needsScraping(w))
  if (eligibleWorks.length === 0) {
    return { total: 0, updated: 0, failed: 0, aborted: false, message: '所有作品元数据均已完整' }
  }

  isScrapingRunning = true
  abortScrapingController = new AbortController()
  const { signal } = abortScrapingController

  logger.info(`[MediaSync] 发现 ${eligibleWorks.length} 个作品需要补全 DLsite 元数据，开始自动刮削...`)

  let successCount = 0
  let failedCount = 0

  for (let i = 0; i < eligibleWorks.length; i++) {
    if (signal.aborted) {
      logger.info('[MediaSync] 刮削任务已被用户手动终止')
      if (onProgress) {
        onProgress({
          current: i,
          total: eligibleWorks.length,
          status: 'aborted',
          message: '任务已被终止',
        })
      }
      break
    }

    const work = eligibleWorks[i]
    const rjCode = work.rjCode || extractRJCode(work.title || work.folderName || work.name || '')

    try {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: eligibleWorks.length,
          rjCode,
          workTitle: work.title || work.folderName || rjCode,
          status: 'fetching',
        })
      }

      const detail = await getWorkDetail(rjCode)
      if (detail) {
        const patch = {
          rjCode: detail.rjCode || rjCode,
        }
        if (!work.cover && detail.cover) patch.cover = detail.cover
        if ((!work.cvs || work.cvs.length === 0) && Array.isArray(detail.cvs) && detail.cvs.length > 0) {
          patch.cvs = detail.cvs
        }
        if (!work.circle && detail.circle) patch.circle = detail.circle
        if ((!work.tags || work.tags.length === 0) && Array.isArray(detail.tags)) {
          patch.tags = detail.tags
        }
        if (!work.description && detail.description) patch.description = detail.description
        if ((!work.rating || work.rating === 0) && detail.rating) patch.rating = detail.rating
        if (!work.release && detail.release) patch.release = detail.release
        if (!work.price && detail.price) patch.price = detail.price

        await updateWork(work.id, patch)
        successCount++

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: eligibleWorks.length,
            rjCode,
            workTitle: work.title || work.folderName || rjCode,
            status: 'success',
          })
        }
      } else {
        failedCount++
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: eligibleWorks.length,
            rjCode,
            workTitle: work.title || work.folderName || rjCode,
            status: 'failed',
            error: '未检索到作品详情',
          })
        }
      }
    } catch (err) {
      failedCount++
      logger.warn(`[MediaSync] 刮削 ${rjCode} 失败:`, err.message)
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: eligibleWorks.length,
          rjCode,
          workTitle: work.title || work.folderName || rjCode,
          status: 'failed',
          error: err.message,
        })
      }
    }

    // 防反爬延迟
    if (i < eligibleWorks.length - 1 && !signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  const wasAborted = signal.aborted
  isScrapingRunning = false
  abortScrapingController = null

  logger.info('[MediaSync] 自动刮削任务执行完毕:', {
    total: eligibleWorks.length,
    success: successCount,
    failed: failedCount,
    aborted: wasAborted,
  })

  return {
    total: eligibleWorks.length,
    updated: successCount,
    failed: failedCount,
    aborted: wasAborted,
  }
}

/**
 * 停止当前自动刮削任务
 */
function stopAutoScrape() {
  if (abortScrapingController) {
    abortScrapingController.abort()
    isScrapingRunning = false
    abortScrapingController = null
    return true
  }
  return false
}

module.exports = {
  extractRJCode,
  naturalCompare,
  scanAudioRecursive,
  isAudioListDifferent,
  needsScraping,
  syncLibraryAudio,
  autoScrapeDLsite,
  stopAutoScrape,
}
