const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { app, shell } = require('electron')
const logger = require('./logger')

const DEFAULT_REPO = 'huang5-png/lingyin'
const DEFAULT_API_URL = `https://api.github.com/repos/${DEFAULT_REPO}/releases/latest`

let currentDownloadController = null

/**
 * 比较两个版本号字符串（支持 v1.50.0 或 1.50.0 格式）
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
function compareVersions(v1, v2) {
  if (!v1 && !v2) return 0
  if (!v1) return -1
  if (!v2) return 1
  const clean1 = String(v1).trim().replace(/^[vV]/, '')
  const clean2 = String(v2).trim().replace(/^[vV]/, '')

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0)
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0)

  const len = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

/**
 * 根据镜像配置拼接下载 URL
 * @param {string} rawUrl
 * @param {string} mirrorPrefix
 * @returns {string}
 */
function resolveDownloadUrl(rawUrl, mirrorPrefix) {
  if (!rawUrl) return ''
  if (!mirrorPrefix || mirrorPrefix === 'direct' || mirrorPrefix === 'none') {
    return rawUrl
  }
  const cleanPrefix = mirrorPrefix.trim().replace(/\/+$/, '')
  if (rawUrl.startsWith(cleanPrefix + '/') || rawUrl === cleanPrefix) {
    return rawUrl
  }
  const knownMirrors = ['https://ghfast.top', 'https://ghproxy.net', 'https://gh-proxy.com']
  for (const m of knownMirrors) {
    if (rawUrl.startsWith(m + '/')) {
      return rawUrl
    }
  }
  return `${cleanPrefix}/${rawUrl}`
}

/**
 * 格式化字节大小为易读字符串
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

/**
 * 检查最新版本
 * @param {object} options
 * @param {string} [options.currentVersion]
 * @param {string} [options.mirrorUrl]
 * @param {object} [options.proxy]
 * @returns {Promise<object>}
 */
async function checkForUpdates(options = {}) {
  const currentVersion = options.currentVersion || app.getVersion()
  const mirrorUrl = options.mirrorUrl || ''

  try {
    const axiosConfig = {
      timeout: 12000,
      headers: {
        'User-Agent': 'Lingyin-Player-Updater',
        Accept: 'application/vnd.github.v3+json',
      },
    }

    if (options.proxy && options.proxy.host) {
      axiosConfig.proxy = {
        host: options.proxy.host,
        port: options.proxy.port,
        protocol: options.proxy.protocol || 'http',
      }
    }

    logger.info('[Updater] 正在检查更新...', { currentVersion, api: DEFAULT_API_URL })
    const res = await axios.get(DEFAULT_API_URL, axiosConfig)
    const release = res.data

    if (!release || !release.tag_name) {
      return {
        hasUpdate: false,
        currentVersion,
        error: '未能解析远程发布版本信息',
      }
    }

    const remoteTag = release.tag_name
    const remoteVersion = remoteTag.replace(/^[vV]/, '')
    const hasUpdate = compareVersions(remoteVersion, currentVersion) > 0

    // 寻找便携版 zip 资产
    const assets = Array.isArray(release.assets) ? release.assets : []
    const targetAsset =
      assets.find((a) => a.name.includes('便携版') && a.name.endsWith('.zip')) ||
      assets.find((a) => a.name.endsWith('.zip')) ||
      assets.find((a) => a.name.endsWith('.exe')) ||
      assets[0]

    const rawDownloadUrl = targetAsset ? targetAsset.browser_download_url : release.html_url
    const finalDownloadUrl = resolveDownloadUrl(rawDownloadUrl, mirrorUrl)

    logger.info('[Updater] 检查完成:', {
      currentVersion,
      remoteVersion,
      hasUpdate,
      assetName: targetAsset ? targetAsset.name : 'none',
    })

    return {
      hasUpdate,
      currentVersion,
      remoteVersion,
      tagName: remoteTag,
      releaseName: release.name || remoteTag,
      releaseNotes: release.body || '无更新说明',
      publishedAt: release.published_at || '',
      releaseUrl: release.html_url || '',
      downloadUrl: finalDownloadUrl,
      rawDownloadUrl,
      assetName: targetAsset ? targetAsset.name : '',
      assetSize: targetAsset ? targetAsset.size : 0,
      assetSizeFormatted: targetAsset ? formatBytes(targetAsset.size) : '',
    }
  } catch (err) {
    logger.warn('[Updater] 检查更新失败:', err.message)
    return {
      hasUpdate: false,
      currentVersion,
      error: err.message || '网络连接超时或无法访问 GitHub',
    }
  }
}

/**
 * 下载更新包
 * @param {object} options
 * @param {string} options.downloadUrl
 * @param {string} [options.fileName]
 * @param {string} [options.saveDir]
 * @param {string} [options.mirrorUrl]
 * @param {object} [options.proxy]
 * @param {Function} [onProgress]
 * @returns {Promise<object>}
 */
async function downloadUpdate(options = {}, onProgress = null) {
  const { downloadUrl, fileName, saveDir, mirrorUrl, proxy } = options
  if (!downloadUrl) {
    throw new Error('未提供更新下载链接')
  }

  const finalUrl = resolveDownloadUrl(downloadUrl, mirrorUrl)
  const targetDir = saveDir || app.getPath('downloads')
  const outFileName = fileName || `Lingyin-Update-${Date.now()}.zip`
  const finalFilePath = path.join(targetDir, outFileName)
  const tempFilePath = finalFilePath + '.download'

  // 取消上一个进行中的下载
  cancelDownloadUpdate()

  const controller = new AbortController()
  currentDownloadController = controller

  const axiosConfig = {
    method: 'GET',
    url: finalUrl,
    responseType: 'stream',
    timeout: 30000,
    signal: controller.signal,
    headers: {
      'User-Agent': 'Lingyin-Player-Updater',
    },
  }

  if (proxy && proxy.host) {
    axiosConfig.proxy = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol || 'http',
    }
  }

  logger.info('[Updater] 开始下载更新:', { url: finalUrl, savePath: finalFilePath })

  try {
    const response = await axios(axiosConfig)
    const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
    let downloadedBytes = 0
    let lastTime = Date.now()
    let lastDownloaded = 0

    const writer = fs.createWriteStream(tempFilePath)

    return new Promise((resolve, reject) => {
      let isAborted = false

      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length
        const now = Date.now()
        const timeDiff = now - lastTime

        // 每 200ms 节流报告进度
        if (timeDiff >= 200 && onProgress) {
          const speed = Math.round(((downloadedBytes - lastDownloaded) / timeDiff) * 1000) // bytes/s
          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0
          onProgress({
            downloaded: downloadedBytes,
            total: totalBytes,
            percent,
            speed,
            speedFormatted: `${formatBytes(speed)}/s`,
            downloadedFormatted: formatBytes(downloadedBytes),
            totalFormatted: formatBytes(totalBytes),
          })
          lastTime = now
          lastDownloaded = downloadedBytes
        }
      })

      writer.on('finish', () => {
        currentDownloadController = null
        try {
          if (fs.existsSync(finalFilePath)) {
            fs.unlinkSync(finalFilePath)
          }
          fs.renameSync(tempFilePath, finalFilePath)

          if (onProgress) {
            onProgress({
              downloaded: downloadedBytes,
              total: totalBytes || downloadedBytes,
              percent: 100,
              speed: 0,
              speedFormatted: '0 B/s',
              downloadedFormatted: formatBytes(downloadedBytes),
              totalFormatted: formatBytes(totalBytes || downloadedBytes),
            })
          }

          logger.info('[Updater] 下载成功完成:', finalFilePath)
          resolve({
            success: true,
            filePath: finalFilePath,
            fileName: outFileName,
            fileSize: downloadedBytes,
            fileSizeFormatted: formatBytes(downloadedBytes),
          })
        } catch (renameErr) {
          reject(renameErr)
        }
      })

      writer.on('error', (err) => {
        currentDownloadController = null
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        } catch (_) {}
        reject(err)
      })

      response.data.on('error', (err) => {
        currentDownloadController = null
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        } catch (_) {}
        reject(err)
      })

      controller.signal.addEventListener('abort', () => {
        isAborted = true
        writer.destroy()
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        } catch (_) {}
        reject(new Error('下载已被用户取消'))
      })
    })
  } catch (err) {
    currentDownloadController = null
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
    } catch (_) {}
    throw err
  }
}

/**
 * 取消当前下载任务
 */
function cancelDownloadUpdate() {
  if (currentDownloadController) {
    try {
      currentDownloadController.abort()
      logger.info('[Updater] 下载任务已被取消')
    } catch (_) {}
    currentDownloadController = null
    return true
  }
  return false
}

/**
 * 在文件资源管理器中定位下载文件
 * @param {string} filePath
 */
function showUpdateInFolder(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return true
  }
  return false
}

module.exports = {
  compareVersions,
  resolveDownloadUrl,
  formatBytes,
  checkForUpdates,
  downloadUpdate,
  cancelDownloadUpdate,
  showUpdateInFolder,
}
