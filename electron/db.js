const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let dbData = null
let dbPath = ''

async function initDB() {
  dbPath = path.join(app.getPath('userData'), 'db.json')

  const defaultData = {
    works: [],
    progress: {},
    subtitles: {},
    settings: {},
    history: [],
    playlists: [],
    translateCache: {},
    favorites: [],
    folderGroups: [],
  }

  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8')
      dbData = JSON.parse(content)
    } else {
      dbData = defaultData
      saveDB()
    }
  } catch (e) {
    console.error('Init DB error:', e)
    dbData = defaultData
  }

  return dbData
}

function saveDB() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf-8')
  } catch (e) {
    console.error('Save DB error:', e)
  }
}

function getDB() {
  return dbData
}

async function getAllWorks() {
  return dbData.works || []
}

async function addWork(work) {
  const exists = dbData.works.find((w) => w.id === work.id)
  if (exists) {
    return exists
  }
  work.createdAt = Date.now()
  work.updatedAt = Date.now()
  dbData.works.push(work)
  saveDB()
  return work
}

async function updateWork(id, data) {
  const work = dbData.works.find((w) => w.id === id)
  if (work) {
    Object.assign(work, data, { updatedAt: Date.now() })
    saveDB()
    return work
  }
  return null
}

async function deleteWork(id) {
  const index = dbData.works.findIndex((w) => w.id === id)
  if (index > -1) {
    dbData.works.splice(index, 1)
    saveDB()
    return true
  }
  return false
}

async function getProgress(workId, audioFile) {
  const key = `${workId}::${audioFile}`
  return dbData.progress[key] || { currentTime: 0, duration: 0, lastPlayed: 0 }
}

// 获取指定作品的总播放进度
async function getWorkProgress(workId) {
  const progressMap = dbData.progress || {}
  let totalPlayed = 0
  let totalDuration = 0
  let lastPlayed = 0

  for (const [key, data] of Object.entries(progressMap)) {
    if (key.startsWith(`${workId}::`)) {
      totalPlayed += data.currentTime || 0
      totalDuration += data.duration || 0
      if (data.lastPlayed && data.lastPlayed > lastPlayed) {
        lastPlayed = data.lastPlayed
      }
    }
  }

  const percentage = totalDuration > 0 ? Math.min(100, Math.round((totalPlayed / totalDuration) * 100)) : 0

  return {
    totalPlayed,
    totalDuration,
    percentage,
    lastPlayed,
  }
}

async function saveProgress(workId, audioFile, progress) {
  const key = `${workId}::${audioFile}`
  dbData.progress[key] = {
    ...progress,
    lastPlayed: Date.now(),
  }
  saveDB()
  return true
}

async function getSubtitle(workId, audioFile) {
  const key = `${workId}::${audioFile}`
  return dbData.subtitles[key] || null
}

async function saveSubtitle(workId, audioFile, subtitleData) {
  const key = `${workId}::${audioFile}`
  dbData.subtitles[key] = {
    ...subtitleData,
    savedAt: Date.now(),
  }
  saveDB()
  return true
}

async function getSettings() {
  return dbData.settings || {}
}

async function saveSettings(settings) {
  dbData.settings = { ...dbData.settings, ...settings }
  saveDB()
  return dbData.settings
}

// ===== Listening history =====
// Each entry: { ts, workId, audioFile, seconds, title, cover, circle, cvs:[], tags:[] }
async function appendHistory(entry) {
  if (!dbData.history) dbData.history = []
  dbData.history.push({
    ts: entry.ts || Date.now(),
    workId: entry.workId || null,
    audioFile: entry.audioFile || '',
    seconds: Math.max(0, Math.min(3600, Number(entry.seconds) || 0)),
    title: entry.title || '',
    cover: entry.cover || '',
    circle: entry.circle || '',
    cvs: Array.isArray(entry.cvs) ? entry.cvs : [],
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  })
  // Cap history size to avoid unbounded growth (keep last 20000 entries)
  if (dbData.history.length > 20000) {
    dbData.history = dbData.history.slice(-20000)
  }
  saveDB()
  return true
}

function startOfRange(range, refDate) {
  const d = refDate ? new Date(refDate) : new Date()
  const start = new Date(d)
  if (range === 'day') {
    start.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else if (range === 'year') {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setHours(0, 0, 0, 0)
  }
  return start.getTime()
}

function endOfRange(range, refDate) {
  const d = refDate ? new Date(refDate) : new Date()
  const end = new Date(d)
  if (range === 'day') {
    end.setHours(23, 59, 59, 999)
  } else if (range === 'month') {
    end.setMonth(end.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  } else if (range === 'year') {
    end.setMonth(11, 31)
    end.setHours(23, 59, 59, 999)
  } else {
    end.setHours(23, 59, 59, 999)
  }
  return end.getTime()
}

// Aggregate usage stats for a given range
async function getUsageStats(opts = {}) {
  const range = opts.range || 'month'
  const refDate = opts.date || null
  const startTs = startOfRange(range, refDate)
  const endTs = endOfRange(range, refDate)

  const history = (dbData.history || []).filter((h) => h.ts >= startTs && h.ts <= endTs)

  const totalSeconds = history.reduce((s, h) => s + (h.seconds || 0), 0)
  const playCount = history.length

  const workMap = new Map()
  const tagMap = new Map()
  const circleMap = new Map()
  const cvMap = new Map()

  for (const h of history) {
    const secs = h.seconds || 0
    if (h.workId) {
      const w = workMap.get(h.workId) || { id: h.workId, title: h.title, cover: h.cover, seconds: 0, count: 0 }
      w.seconds += secs
      w.count += 1
      workMap.set(h.workId, w)
    }
    if (h.circle) {
      const c = circleMap.get(h.circle) || { name: h.circle, seconds: 0, count: 0 }
      c.seconds += secs
      c.count += 1
      circleMap.set(h.circle, c)
    }
    for (const cv of h.cvs || []) {
      const c = cvMap.get(cv) || { name: cv, seconds: 0, count: 0 }
      c.seconds += secs
      c.count += 1
      cvMap.set(cv, c)
    }
    for (const tag of h.tags || []) {
      const t = tagMap.get(tag) || { name: tag, seconds: 0, count: 0 }
      t.seconds += secs
      t.count += 1
      tagMap.set(tag, t)
    }
  }

  const sortBySeconds = (a, b) => b.seconds - a.seconds
  const workRanking = [...workMap.values()].sort(sortBySeconds).slice(0, 10)
  const tagRanking = [...tagMap.values()].sort(sortBySeconds).slice(0, 10)
  const circleRanking = [...circleMap.values()].sort(sortBySeconds).slice(0, 10)
  const cvRanking = [...cvMap.values()].sort(sortBySeconds).slice(0, 10)

  // Build timeline buckets
  // day -> 24 hourly buckets
  // month -> days of month
  // year -> 12 monthly buckets
  let timeline = []
  if (range === 'day') {
    for (let i = 0; i < 24; i++) {
      timeline.push({ label: `${i}:00`, seconds: 0 })
    }
    for (const h of history) {
      const hr = new Date(h.ts).getHours()
      timeline[hr].seconds += h.seconds || 0
    }
  } else if (range === 'month') {
    const ref = refDate ? new Date(refDate) : new Date()
    const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      timeline.push({ label: `${i}`, seconds: 0 })
    }
    for (const h of history) {
      const d = new Date(h.ts)
      const day = d.getDate()
      if (day >= 1 && day <= daysInMonth) timeline[day - 1].seconds += h.seconds || 0
    }
  } else {
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    for (let i = 0; i < 12; i++) {
      timeline.push({ label: monthNames[i], seconds: 0 })
    }
    for (const h of history) {
      const m = new Date(h.ts).getMonth()
      timeline[m].seconds += h.seconds || 0
    }
  }

  return {
    range,
    startTs,
    endTs,
    totalSeconds,
    playCount,
    uniqueWorks: workMap.size,
    uniqueCircles: circleMap.size,
    uniqueCVs: cvMap.size,
    uniqueTags: tagMap.size,
    workRanking,
    tagRanking,
    circleRanking,
    cvRanking,
    timeline,
  }
}

async function getAllHistory() {
  return dbData.history || []
}

// 删除指定作品的所有播放历史
async function deleteHistoryByWorkId(workId) {
  if (!dbData.history || !workId) return 0
  const initialLen = dbData.history.length
  dbData.history = dbData.history.filter((h) => h.workId !== workId)
  const deleted = initialLen - dbData.history.length
  if (deleted > 0) saveDB()
  return deleted
}

// 清空全部播放历史
async function clearAllHistory() {
  if (!dbData.history) return 0
  const count = dbData.history.length
  dbData.history = []
  saveDB()
  return count
}

// 获取最近播放的作品（去重后按时间倒序），用于侧边栏快捷访问
async function getRecentWorks(limit = 8) {
  const history = dbData.history || []
  const progressMap = dbData.progress || {}
  const seen = new Set()
  const recent = []
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    if (!h || !h.workId) continue
    if (seen.has(h.workId)) continue
    seen.add(h.workId)
    const audioFile = h.audioFile || ''
    const progressKey = `${h.workId}::${audioFile}`
    const progress = progressMap[progressKey] || null
    let workProgress = 0
    let workDuration = 0
    let workLastPlayed = h.ts
    for (const [key, data] of Object.entries(progressMap)) {
      if (key.startsWith(`${h.workId}::`)) {
        workProgress += data.currentTime || 0
        workDuration += data.duration || 0
        if (data.lastPlayed && data.lastPlayed > workLastPlayed) {
          workLastPlayed = data.lastPlayed
        }
      }
    }
    const workPercentage = workDuration > 0 ? Math.min(100, Math.round((workProgress / workDuration) * 100)) : 0
    recent.push({
      workId: h.workId,
      title: h.title || '',
      cover: h.cover || '',
      circle: h.circle || '',
      cvs: h.cvs || [],
      tags: h.tags || [],
      lastPlayed: workLastPlayed,
      audioFile: audioFile,
      audioName: h.audioName || '',
      currentTime: progress?.currentTime || 0,
      duration: progress?.duration || 0,
      percentage: progress && progress.duration > 0 ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100)) : 0,
      workPercentage,
      isUnfinished: progress && progress.duration > 0 && progress.currentTime > 0 && progress.currentTime < progress.duration * 0.95,
    })
    if (recent.length >= limit) break
  }
  return recent
}

// 获取最近播放的音频（用于继续听功能）
async function getLastPlayedAudio() {
  const history = dbData.history || []
  const progressMap = dbData.progress || {}
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    if (!h || !h.workId || !h.audioFile) continue
    const progressKey = `${h.workId}::${h.audioFile}`
    const progress = progressMap[progressKey]
    if (progress && progress.duration > 0 && progress.currentTime > 0 && progress.currentTime < progress.duration * 0.95) {
      return {
        workId: h.workId,
        title: h.title || '',
        cover: h.cover || '',
        circle: h.circle || '',
        cvs: h.cvs || [],
        tags: h.tags || [],
        audioFile: h.audioFile,
        audioName: h.audioName || '',
        currentTime: progress.currentTime,
        duration: progress.duration,
        percentage: Math.min(100, Math.round((progress.currentTime / progress.duration) * 100)),
        lastPlayed: progress.lastPlayed || h.ts,
      }
    }
  }
  if (history.length > 0) {
    const h = history[history.length - 1]
    const progressKey = `${h.workId}::${h.audioFile || ''}`
    const progress = progressMap[progressKey] || {}
    return {
      workId: h.workId,
      title: h.title || '',
      cover: h.cover || '',
      circle: h.circle || '',
      cvs: h.cvs || [],
      tags: h.tags || [],
      audioFile: h.audioFile || '',
      audioName: h.audioName || '',
      currentTime: progress.currentTime || 0,
      duration: progress.duration || 0,
      percentage: progress.duration > 0 ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100)) : 0,
      lastPlayed: progress.lastPlayed || h.ts,
    }
  }
  return null
}

// ===== Playlists =====
// Playlist 结构：{ id, name, createdAt, updatedAt, items: [PlaylistItem] }
// PlaylistItem 结构：{ id, workId, workTitle, workCover, audioPath, audioName, isOnline, addedAt }

function genId(prefix = 'pl') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function ensurePlaylists() {
  if (!Array.isArray(dbData.playlists)) dbData.playlists = []
  return dbData.playlists
}

async function getAllPlaylists() {
  return ensurePlaylists()
}

async function createPlaylist(name) {
  const playlists = ensurePlaylists()
  const now = Date.now()
  const safeName = (name && String(name).trim()) || '未命名播放列表'
  const playlist = {
    id: genId('pl'),
    name: safeName,
    createdAt: now,
    updatedAt: now,
    items: [],
  }
  playlists.push(playlist)
  saveDB()
  return playlist
}

async function renamePlaylist(id, name) {
  const playlists = ensurePlaylists()
  const pl = playlists.find((p) => p.id === id)
  if (!pl) return null
  const safeName = (name && String(name).trim()) || '未命名播放列表'
  pl.name = safeName
  pl.updatedAt = Date.now()
  saveDB()
  return pl
}

async function deletePlaylist(id) {
  const playlists = ensurePlaylists()
  const idx = playlists.findIndex((p) => p.id === id)
  if (idx < 0) return false
  playlists.splice(idx, 1)
  saveDB()
  return true
}

async function addPlaylistItem(id, item) {
  const playlists = ensurePlaylists()
  const pl = playlists.find((p) => p.id === id)
  if (!pl) return null
  if (!item || !item.audioPath) return pl
  // 去重：相同 audioPath 不重复加入
  const exists = (pl.items || []).find((it) => it.audioPath === item.audioPath)
  if (exists) return pl
  if (!Array.isArray(pl.items)) pl.items = []
  const newItem = {
    id: genId('it'),
    workId: item.workId || '',
    workTitle: item.workTitle || '',
    workCover: item.workCover || '',
    audioPath: item.audioPath,
    audioName: item.audioName || '',
    isOnline: !!item.isOnline,
    addedAt: Date.now(),
  }
  pl.items.push(newItem)
  pl.updatedAt = Date.now()
  saveDB()
  return pl
}

async function removePlaylistItem(id, itemId) {
  const playlists = ensurePlaylists()
  const pl = playlists.find((p) => p.id === id)
  if (!pl) return null
  if (!Array.isArray(pl.items)) pl.items = []
  const idx = pl.items.findIndex((it) => it.id === itemId)
  if (idx < 0) return pl
  pl.items.splice(idx, 1)
  pl.updatedAt = Date.now()
  saveDB()
  return pl
}

async function reorderPlaylistItems(id, itemIds) {
  const playlists = ensurePlaylists()
  const pl = playlists.find((p) => p.id === id)
  if (!pl) return null
  if (!Array.isArray(pl.items)) pl.items = []
  if (!Array.isArray(itemIds)) return pl
  const map = new Map(pl.items.map((it) => [it.id, it]))
  const next = []
  for (const iid of itemIds) {
    const it = map.get(iid)
    if (it) {
      next.push(it)
      map.delete(iid)
    }
  }
  // 任何未在 itemIds 中的项目追加到末尾，避免数据丢失
  for (const remaining of map.values()) next.push(remaining)
  pl.items = next
  pl.updatedAt = Date.now()
  saveDB()
  return pl
}

async function clearPlaylist(id) {
  const playlists = ensurePlaylists()
  const pl = playlists.find((p) => p.id === id)
  if (!pl) return null
  pl.items = []
  pl.updatedAt = Date.now()
  saveDB()
  return pl
}

// ===== 翻译缓存 =====
// 缓存结构: { [key: `${workId}::${audioPath}`]: { cues: [{ time, text, translated }], updatedAt } }

function ensureTranslateCache() {
  if (!dbData.translateCache) dbData.translateCache = {}
  return dbData.translateCache
}

async function getTranslateCache(workId, audioPath) {
  const cache = ensureTranslateCache()
  const key = `${workId}::${audioPath}`
  const entry = cache[key]
  if (!entry) return null
  const expireDays = 30
  if (entry.updatedAt && Date.now() - entry.updatedAt > expireDays * 24 * 60 * 60 * 1000) {
    delete cache[key]
    saveDB()
    return null
  }
  return entry.cues || null
}

async function saveTranslateCache(workId, audioPath, cues) {
  const cache = ensureTranslateCache()
  const key = `${workId}::${audioPath}`
  cache[key] = {
    cues: cues,
    updatedAt: Date.now(),
  }
  saveDB()
  return true
}

async function clearTranslateCache() {
  dbData.translateCache = {}
  saveDB()
  return true
}

// ===== 收藏 =====
// 收藏结构：{ workId, addedAt }
// 同时支持本地作品和在线作品，workId 为本地 id 或在线 id

function ensureFavorites() {
  if (!Array.isArray(dbData.favorites)) dbData.favorites = []
  return dbData.favorites
}

async function getAllFavorites() {
  return ensureFavorites()
}

async function isFavorite(workId) {
  const favorites = ensureFavorites()
  return favorites.some(f => f.workId === workId)
}

async function addFavorite(workId, workInfo = {}) {
  const favorites = ensureFavorites()
  const exists = favorites.find(f => f.workId === workId)
  if (exists) return exists
  const fav = {
    workId,
    title: workInfo.title || '',
    cover: workInfo.cover || '',
    circle: workInfo.circle || '',
    isOnline: !!workInfo.isOnline,
    addedAt: Date.now(),
  }
  favorites.push(fav)
  saveDB()
  return fav
}

async function removeFavorite(workId) {
  const favorites = ensureFavorites()
  const idx = favorites.findIndex(f => f.workId === workId)
  if (idx < 0) return false
  favorites.splice(idx, 1)
  saveDB()
  return true
}

async function toggleFavorite(workId, workInfo = {}) {
  const favorites = ensureFavorites()
  const idx = favorites.findIndex(f => f.workId === workId)
  if (idx >= 0) {
    favorites.splice(idx, 1)
    saveDB()
    return { isFavorite: false }
  } else {
    const fav = {
      workId,
      title: workInfo.title || '',
      cover: workInfo.cover || '',
      circle: workInfo.circle || '',
      isOnline: !!workInfo.isOnline,
      addedAt: Date.now(),
    }
    favorites.push(fav)
    saveDB()
    return { isFavorite: true, favorite: fav }
  }
}

// ===== 文件夹分组 =====
// FolderGroup 结构：{ id, name, color, order, createdAt, updatedAt }
// 作品通过 work.folderGroupId 关联到分组

function genGroupId() {
  return `fg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureFolderGroups() {
  if (!Array.isArray(dbData.folderGroups)) dbData.folderGroups = []
  return dbData.folderGroups
}

async function getAllFolderGroups() {
  const groups = ensureFolderGroups()
  return groups.sort((a, b) => (a.order || 0) - (b.order || 0))
}

async function createFolderGroup(name, color = '') {
  const groups = ensureFolderGroups()
  const now = Date.now()
  const safeName = (name && String(name).trim()) || '未命名分组'
  const maxOrder = groups.reduce((max, g) => Math.max(max, g.order || 0), 0)
  const group = {
    id: genGroupId(),
    name: safeName,
    color: color || '',
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  }
  groups.push(group)
  saveDB()
  return group
}

async function renameFolderGroup(id, name) {
  const groups = ensureFolderGroups()
  const group = groups.find(g => g.id === id)
  if (!group) return null
  const safeName = (name && String(name).trim()) || '未命名分组'
  group.name = safeName
  group.updatedAt = Date.now()
  saveDB()
  return group
}

async function setFolderGroupColor(id, color) {
  const groups = ensureFolderGroups()
  const group = groups.find(g => g.id === id)
  if (!group) return null
  group.color = color || ''
  group.updatedAt = Date.now()
  saveDB()
  return group
}

async function deleteFolderGroup(id, moveToGroupId = null) {
  const groups = ensureFolderGroups()
  const idx = groups.findIndex(g => g.id === id)
  if (idx < 0) return false

  // 将该分组下的作品移动到目标分组或移除分组
  if (dbData.works) {
    for (const work of dbData.works) {
      if (work.folderGroupId === id) {
        work.folderGroupId = moveToGroupId || null
        work.updatedAt = Date.now()
      }
    }
  }

  groups.splice(idx, 1)
  saveDB()
  return true
}

async function reorderFolderGroups(groupIds) {
  const groups = ensureFolderGroups()
  if (!Array.isArray(groupIds)) return groups
  const map = new Map(groups.map(g => [g.id, g]))
  let order = 0
  for (const gid of groupIds) {
    const g = map.get(gid)
    if (g) {
      g.order = order++
      map.delete(gid)
    }
  }
  // 未在列表中的追加到末尾
  for (const remaining of map.values()) {
    remaining.order = order++
  }
  saveDB()
  return getAllFolderGroups()
}

async function setWorkFolderGroup(workId, groupId) {
  if (!dbData.works) return null
  const work = dbData.works.find(w => w.id === workId)
  if (!work) return null
  work.folderGroupId = groupId || null
  work.updatedAt = Date.now()
  saveDB()
  return work
}

async function getWorksByFolderGroup(groupId) {
  if (!dbData.works) return []
  if (groupId === null || groupId === 'ungrouped') {
    return dbData.works.filter(w => !w.folderGroupId)
  }
  return dbData.works.filter(w => w.folderGroupId === groupId)
}

module.exports = {
  initDB,
  getDB,
  getAllWorks,
  addWork,
  updateWork,
  deleteWork,
  getProgress,
  getWorkProgress,
  saveProgress,
  getSubtitle,
  saveSubtitle,
  getSettings,
  saveSettings,
  appendHistory,
  getUsageStats,
  getAllHistory,
  deleteHistoryByWorkId,
  clearAllHistory,
  getRecentWorks,
  getLastPlayedAudio,
  getAllPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addPlaylistItem,
  removePlaylistItem,
  reorderPlaylistItems,
  clearPlaylist,
  getTranslateCache,
  saveTranslateCache,
  clearTranslateCache,
  getAllFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getAllFolderGroups,
  createFolderGroup,
  renameFolderGroup,
  setFolderGroupColor,
  deleteFolderGroup,
  reorderFolderGroups,
  setWorkFolderGroup,
  getWorksByFolderGroup,
}
