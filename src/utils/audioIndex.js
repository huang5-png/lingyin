import { naturalCompare } from './scanner'

// 作品音频索引工具（纯函数，无副作用）
//
// 背景：智能播放列表（electron/db.js getSmartPlaylistItems）在主进程读取
// `work.audioFiles` 生成曲目，但历史上作品记录只写入 `audioCount`，导致 6 个
// 智能播放列表恒为空。这里负责把扫描结果归一化后写入作品记录，并统一读取口径。

// 归一化单条音频，只保留播放与展示所需字段，避免 db.json 体积膨胀
export function normalizeAudioEntry(audio) {
  if (!audio) return null
  const path = audio.path || ''
  const name = audio.name || ''
  if (!path && !name) return null

  const relativePath = audio.relativePath || name || path
  return {
    name: name || relativePath,
    path: path || name,
    relativePath,
    displayName: audio.displayName || relativePath.replace(/\\/g, ' / '),
  }
}

// 批量归一化并过滤无效项
export function normalizeAudioList(audios) {
  if (!Array.isArray(audios)) return []
  const result = []
  for (const audio of audios) {
    const entry = normalizeAudioEntry(audio)
    if (entry) result.push(entry)
  }
  return result
}

// 按相对路径自然排序，保持与资源管理器一致的曲目顺序
export function sortAudioEntries(audios) {
  if (!Array.isArray(audios)) return []
  return [...audios].sort((a, b) =>
    naturalCompare(a.relativePath || a.name || '', b.relativePath || b.name || ''),
  )
}

// 作品是否已建立音频索引
export function isWorkIndexed(work) {
  return Array.isArray(work?.audioFiles) && work.audioFiles.length > 0
}

// 读取作品已索引的曲目（未索引返回空数组）
export function getWorkAudioFiles(work) {
  return isWorkIndexed(work) ? work.audioFiles : []
}

// 挑出待建立索引的本地作品：
// - 已索引（audioFiles 非空）的跳过，避免重复扫描
// - 在线作品、无 folderPath 的作品跳过
export function pickUnindexedWorks(works, attemptedIds) {
  if (!Array.isArray(works)) return []
  return works.filter((work) => {
    if (!work || !work.id) return false
    if (work.isOnline) return false
    if (!work.folderPath) return false
    if (isWorkIndexed(work)) return false
    if (attemptedIds && attemptedIds.has(work.id)) return false
    return true
  })
}

// 构建 { workId: audioFiles } 映射，供曲目搜索等场景使用
export function buildAudioFilesMap(works) {
  const map = {}
  if (!Array.isArray(works)) return map
  for (const work of works) {
    if (!work || !work.id) continue
    const audios = getWorkAudioFiles(work)
    if (audios.length > 0) {
      map[work.id] = audios
    }
  }
  return map
}

// 生成待落盘的索引条目（供 db:setWorksAudioFiles 使用）
export function buildIndexPayload(workId, scanResult) {
  if (!workId || !scanResult) return null
  const audioFiles = sortAudioEntries(normalizeAudioList(scanResult.audioFiles))
  if (audioFiles.length === 0) return null
  return { workId, audioFiles, audioCount: audioFiles.length }
}
