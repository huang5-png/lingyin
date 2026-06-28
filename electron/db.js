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

module.exports = {
  initDB,
  getDB,
  getAllWorks,
  addWork,
  updateWork,
  deleteWork,
  getProgress,
  saveProgress,
  getSubtitle,
  saveSubtitle,
  getSettings,
  saveSettings,
  appendHistory,
  getUsageStats,
  getAllHistory,
  getAllPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addPlaylistItem,
  removePlaylistItem,
  reorderPlaylistItems,
  clearPlaylist,
}
