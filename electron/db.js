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
    bookmarks: [],
    playQueue: [],
    lastPlayState: null,
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
  } else if (range === 'week') {
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
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
  } else if (range === 'week') {
    const day = end.getDay()
    const diff = end.getDate() - day + (day === 0 ? 0 : 7)
    end.setDate(diff)
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

  // 时段分布统计
  const timePeriods = {
    morning: { label: '早晨', seconds: 0, count: 0 },   // 6:00 - 9:00
    forenoon: { label: '上午', seconds: 0, count: 0 },  // 9:00 - 12:00
    afternoon: { label: '下午', seconds: 0, count: 0 }, // 12:00 - 18:00
    evening: { label: '晚上', seconds: 0, count: 0 },   // 18:00 - 23:00
    lateNight: { label: '深夜', seconds: 0, count: 0 }, // 23:00 - 6:00
  }

  // 按日期分组（用于计算活跃天数和连续天数）
  const dailySet = new Set()
  const weekdayMap = new Map() // 周几的统计

  for (const h of history) {
    const secs = h.seconds || 0
    const hour = new Date(h.ts).getHours()
    const dateStr = new Date(h.ts).toDateString()
    const weekday = new Date(h.ts).getDay()

    dailySet.add(dateStr)

    // 周几统计
    const wd = weekdayMap.get(weekday) || { seconds: 0, count: 0 }
    wd.seconds += secs
    wd.count += 1
    weekdayMap.set(weekday, wd)

    // 时段统计
    if (hour >= 6 && hour < 9) {
      timePeriods.morning.seconds += secs
      timePeriods.morning.count += 1
    } else if (hour >= 9 && hour < 12) {
      timePeriods.forenoon.seconds += secs
      timePeriods.forenoon.count += 1
    } else if (hour >= 12 && hour < 18) {
      timePeriods.afternoon.seconds += secs
      timePeriods.afternoon.count += 1
    } else if (hour >= 18 && hour < 23) {
      timePeriods.evening.seconds += secs
      timePeriods.evening.count += 1
    } else {
      timePeriods.lateNight.seconds += secs
      timePeriods.lateNight.count += 1
    }

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

  // 找出最活跃时段
  let mostActivePeriod = 'evening'
  let maxPeriodSeconds = 0
  for (const [key, val] of Object.entries(timePeriods)) {
    if (val.seconds > maxPeriodSeconds) {
      maxPeriodSeconds = val.seconds
      mostActivePeriod = key
    }
  }

  // 计算最长连续聆听天数
  const sortedDays = [...dailySet].sort((a, b) => new Date(a) - new Date(b))
  let maxStreak = 0
  let currentStreak = 0
  let prevDate = null
  for (const d of sortedDays) {
    const cur = new Date(d)
    if (prevDate) {
      const diff = (cur - prevDate) / (1000 * 60 * 60 * 24)
      if (diff === 1) {
        currentStreak += 1
      } else {
        maxStreak = Math.max(maxStreak, currentStreak)
        currentStreak = 1
      }
    } else {
      currentStreak = 1
    }
    prevDate = cur
  }
  maxStreak = Math.max(maxStreak, currentStreak)

  // 计算平均每日时长
  const activeDays = dailySet.size
  const avgDailySeconds = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0

  // 找出最活跃的周几
  let mostActiveWeekday = 0
  let maxWeekdaySeconds = 0
  for (const [day, val] of weekdayMap.entries()) {
    if (val.seconds > maxWeekdaySeconds) {
      maxWeekdaySeconds = val.seconds
      mostActiveWeekday = Number(day)
    }
  }
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  // Build timeline buckets
  let timeline = []
  if (range === 'day') {
    for (let i = 0; i < 24; i++) {
      timeline.push({ label: `${i}:00`, seconds: 0 })
    }
    for (const h of history) {
      const hr = new Date(h.ts).getHours()
      timeline[hr].seconds += h.seconds || 0
    }
  } else if (range === 'week') {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    for (let i = 0; i < 7; i++) {
      timeline.push({ label: dayNames[i], seconds: 0 })
    }
    const weekStart = new Date(startTs)
    for (const h of history) {
      const d = new Date(h.ts)
      let dayOfWeek = d.getDay() - 1
      if (dayOfWeek < 0) dayOfWeek = 6
      if (dayOfWeek >= 0 && dayOfWeek < 7) {
        timeline[dayOfWeek].seconds += h.seconds || 0
      }
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

  // 洞察数据
  const insights = {
    activeDays,
    avgDailySeconds,
    maxStreak,
    mostActivePeriod,
    mostActivePeriodLabel: timePeriods[mostActivePeriod]?.label || '晚上',
    mostActiveWeekday,
    mostActiveWeekdayLabel: weekdayNames[mostActiveWeekday],
    timePeriods: Object.entries(timePeriods).map(([key, val]) => ({
      key,
      label: val.label,
      seconds: val.seconds,
      count: val.count,
    })),
    weekdayStats: Array.from({ length: 7 }, (_, i) => {
      const wd = weekdayMap.get(i) || { seconds: 0, count: 0 }
      return {
        weekday: i,
        label: weekdayNames[i],
        seconds: wd.seconds,
        count: wd.count,
      }
    }),
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
    insights,
  }
}

// 导出播放历史为 CSV 格式
async function exportHistoryCSV(opts = {}) {
  const allHistory = dbData.history || []
  if (allHistory.length === 0) return ''

  const headers = ['时间', '作品ID', '作品标题', '音频文件', '时长(秒)', '社团', '声优', '标签']
  const rows = [headers.join(',')]

  for (const h of allHistory) {
    const date = new Date(h.ts).toLocaleString('zh-CN')
    const cvs = (h.cvs || []).join(';')
    const tags = (h.tags || []).join(';')
    const row = [
      `"${date}"`,
      `"${h.workId || ''}"`,
      `"${(h.title || '').replace(/"/g, '""')}"`,
      `"${(h.audioFile || '').replace(/"/g, '""')}"`,
      h.seconds || 0,
      `"${(h.circle || '').replace(/"/g, '""')}"`,
      `"${cvs.replace(/"/g, '""')}"`,
      `"${tags.replace(/"/g, '""')}"`,
    ]
    rows.push(row.join(','))
  }

  return '\uFEFF' + rows.join('\n')
}

// 导出播放历史为 JSON 格式
async function exportHistoryJSON(opts = {}) {
  const allHistory = dbData.history || []
  return JSON.stringify(allHistory, null, 2)
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

// ===== 书签 =====
// Bookmark 结构：{ id, workId, audioPath, audioName, time, name, color, createdAt, updatedAt }
// 支持本地作品和在线作品，workId 为本地 id 或在线 id

function genBookmarkId() {
  return `bm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureBookmarks() {
  if (!Array.isArray(dbData.bookmarks)) dbData.bookmarks = []
  return dbData.bookmarks
}

async function getAllBookmarks() {
  const bookmarks = ensureBookmarks()
  return [...bookmarks].sort((a, b) => a.time - b.time)
}

async function getBookmarksByWork(workId) {
  const bookmarks = ensureBookmarks()
  return bookmarks
    .filter(b => b.workId === workId)
    .sort((a, b) => a.time - b.time)
}

async function getBookmarksByAudio(workId, audioPath) {
  const bookmarks = ensureBookmarks()
  return bookmarks
    .filter(b => b.workId === workId && b.audioPath === audioPath)
    .sort((a, b) => a.time - b.time)
}

async function addBookmark(bookmark) {
  const bookmarks = ensureBookmarks()
  const now = Date.now()
  const newBookmark = {
    id: genBookmarkId(),
    workId: bookmark.workId || '',
    audioPath: bookmark.audioPath || '',
    audioName: bookmark.audioName || '',
    time: Math.max(0, Number(bookmark.time) || 0),
    name: (bookmark.name && String(bookmark.name).trim()) || `书签 ${bookmarks.length + 1}`,
    color: bookmark.color || '',
    createdAt: now,
    updatedAt: now,
  }
  bookmarks.push(newBookmark)
  saveDB()
  return newBookmark
}

async function updateBookmark(id, data) {
  const bookmarks = ensureBookmarks()
  const bm = bookmarks.find(b => b.id === id)
  if (!bm) return null
  if (data.name !== undefined) bm.name = String(data.name).trim() || bm.name
  if (data.time !== undefined) bm.time = Math.max(0, Number(data.time) || 0)
  if (data.color !== undefined) bm.color = data.color || ''
  bm.updatedAt = Date.now()
  saveDB()
  return bm
}

async function deleteBookmark(id) {
  const bookmarks = ensureBookmarks()
  const idx = bookmarks.findIndex(b => b.id === id)
  if (idx < 0) return false
  bookmarks.splice(idx, 1)
  saveDB()
  return true
}

async function deleteBookmarksByWork(workId) {
  const bookmarks = ensureBookmarks()
  const initialLen = bookmarks.length
  dbData.bookmarks = bookmarks.filter(b => b.workId !== workId)
  const deleted = initialLen - dbData.bookmarks.length
  if (deleted > 0) saveDB()
  return deleted
}

async function clearAllBookmarks() {
  if (!dbData.bookmarks) return 0
  const count = dbData.bookmarks.length
  dbData.bookmarks = []
  saveDB()
  return count
}

// ===== 播放队列持久化 =====
// 队列项结构与前端 usePlayQueue 中的 QueueItem 一致

function ensurePlayQueue() {
  if (!Array.isArray(dbData.playQueue)) dbData.playQueue = []
  return dbData.playQueue
}

async function getPlayQueue() {
  return ensurePlayQueue()
}

async function savePlayQueue(queue) {
  dbData.playQueue = Array.isArray(queue) ? queue : []
  saveDB()
  return true
}

async function clearPlayQueue() {
  dbData.playQueue = []
  saveDB()
  return true
}

// ===== 上次播放状态 =====
// 结构：{ workId, audioPath, audioName, currentTime, duration, workTitle, workCover, isOnline, timestamp }

async function getLastPlayState() {
  return dbData.lastPlayState || null
}

async function saveLastPlayState(state) {
  dbData.lastPlayState = state ? { ...state, timestamp: Date.now() } : null
  saveDB()
  return true
}

// ===== 智能播放列表 =====
// 智能列表类型：recently_added / most_played / unfinished / recently_played / favorites / random

const SMART_PLAYLISTS = [
  { id: 'smart_recently_added', name: '最近添加', type: 'recently_added', icon: 'clock', description: '最近添加到媒体库的作品' },
  { id: 'smart_most_played', name: '最常听', type: 'most_played', icon: 'heart', description: '播放时长最长的曲目' },
  { id: 'smart_unfinished', name: '未听完', type: 'unfinished', icon: 'play-circle', description: '有播放进度但未完成的曲目' },
  { id: 'smart_recently_played', name: '最近播放', type: 'recently_played', icon: 'history', description: '最近播放过的曲目' },
  { id: 'smart_favorites', name: '我的收藏', type: 'favorites', icon: 'star', description: '收藏的作品曲目' },
  { id: 'smart_random', name: '随机精选', type: 'random', icon: 'shuffle', description: '随机选取的曲目' },
]

function genSmartItemId() {
  return `sm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

async function getSmartPlaylists() {
  return SMART_PLAYLISTS.map((sp) => ({
    ...sp,
    isSmart: true,
  }))
}

async function getSmartPlaylistItems(smartId, limit = 100) {
  const works = dbData.works || []
  const progressMap = dbData.progress || {}
  const history = dbData.history || []
  const favorites = dbData.favorites || []

  const smartPlaylist = SMART_PLAYLISTS.find((sp) => sp.id === smartId)
  if (!smartPlaylist) return []

  const items = []

  const buildAudioItem = (work, audio, extra = {}) => ({
    id: genSmartItemId(),
    workId: work.id,
    workTitle: work.title || work.folderName || '',
    workCover: work.cover || '',
    audioPath: audio.path || audio.relativePath || audio.name || '',
    audioName: audio.displayName || audio.name || '',
    isOnline: false,
    addedAt: extra.addedAt || Date.now(),
    ...extra,
  })

  switch (smartPlaylist.type) {
    case 'recently_added': {
      const sortedWorks = [...works].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      for (const work of sortedWorks) {
        const audios = work.audioFiles || []
        for (const audio of audios.slice(0, 3)) {
          items.push(buildAudioItem(work, audio, { addedAt: work.createdAt || 0 }))
          if (items.length >= limit) break
        }
        if (items.length >= limit) break
      }
      break
    }

    case 'most_played': {
      const audioPlayTime = new Map()
      for (const h of history) {
        if (!h.workId || !h.audioFile) continue
        const key = `${h.workId}::${h.audioFile}`
        const prev = audioPlayTime.get(key) || { seconds: 0, workId: h.workId, audioFile: h.audioFile, title: h.title, cover: h.cover }
        prev.seconds += h.seconds || 0
        audioPlayTime.set(key, prev)
      }
      const sorted = [...audioPlayTime.values()].sort((a, b) => b.seconds - a.seconds).slice(0, limit)
      for (const entry of sorted) {
        const work = works.find((w) => w.id === entry.workId)
        if (!work) continue
        const audio = (work.audioFiles || []).find((a) => (a.path || a.relativePath || a.name || '') === entry.audioFile)
        if (!audio) continue
        items.push(buildAudioItem(work, audio, { playSeconds: entry.seconds }))
      }
      break
    }

    case 'unfinished': {
      const unfinished = []
      for (const [key, prog] of Object.entries(progressMap)) {
        if (!prog || !prog.duration || prog.duration === 0) continue
        if (prog.currentTime <= 0) continue
        if (prog.currentTime >= prog.duration * 0.95) continue
        const [workId, ...audioParts] = key.split('::')
        const audioFile = audioParts.join('::')
        const work = works.find((w) => w.id === workId)
        if (!work) continue
        const audio = (work.audioFiles || []).find((a) => (a.path || a.relativePath || a.name || '') === audioFile)
        if (!audio) continue
        unfinished.push({
          work,
          audio,
          lastPlayed: prog.lastPlayed || 0,
          currentTime: prog.currentTime,
          duration: prog.duration,
        })
      }
      unfinished.sort((a, b) => b.lastPlayed - a.lastPlayed)
      for (const entry of unfinished.slice(0, limit)) {
        items.push(buildAudioItem(entry.work, entry.audio, {
          lastPlayed: entry.lastPlayed,
          currentTime: entry.currentTime,
          duration: entry.duration,
        }))
      }
      break
    }

    case 'recently_played': {
      const seen = new Set()
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i]
        if (!h.workId || !h.audioFile) continue
        const key = `${h.workId}::${h.audioFile}`
        if (seen.has(key)) continue
        seen.add(key)
        const work = works.find((w) => w.id === h.workId)
        if (!work) continue
        const audio = (work.audioFiles || []).find((a) => (a.path || a.relativePath || a.name || '') === h.audioFile)
        if (!audio) continue
        items.push(buildAudioItem(work, audio, { lastPlayed: h.ts }))
        if (items.length >= limit) break
      }
      break
    }

    case 'favorites': {
      const favWorkIds = new Set(favorites.map((f) => f.workId))
      for (const work of works) {
        if (!favWorkIds.has(work.id)) continue
        const audios = work.audioFiles || []
        for (const audio of audios) {
          items.push(buildAudioItem(work, audio))
          if (items.length >= limit) break
        }
        if (items.length >= limit) break
      }
      break
    }

    case 'random': {
      const allAudios = []
      for (const work of works) {
        const audios = work.audioFiles || []
        for (const audio of audios) {
          allAudios.push({ work, audio })
        }
      }
      const shuffled = allAudios.sort(() => Math.random() - 0.5).slice(0, Math.min(limit, 50))
      for (const entry of shuffled) {
        items.push(buildAudioItem(entry.work, entry.audio))
      }
      break
    }
  }

  return items
}

// ===== 数据备份与恢复 =====
// 可导出的数据类型
const EXPORTABLE_KEYS = [
  'works',
  'progress',
  'subtitles',
  'settings',
  'history',
  'playlists',
  'favorites',
  'folderGroups',
  'bookmarks',
  'playQueue',
  'lastPlayState',
  'translateCache',
]

const EXPORT_KEY_LABELS = {
  works: '作品库',
  progress: '播放进度',
  subtitles: '字幕选择',
  settings: '设置',
  history: '播放历史',
  playlists: '播放列表',
  favorites: '收藏',
  folderGroups: '文件夹分组',
  bookmarks: '书签',
  playQueue: '播放队列',
  lastPlayState: '上次播放状态',
  translateCache: '翻译缓存',
}

async function getDataStats() {
  const stats = {}
  for (const key of EXPORTABLE_KEYS) {
    const val = dbData[key]
    if (Array.isArray(val)) {
      stats[key] = { type: 'array', count: val.length, label: EXPORT_KEY_LABELS[key] }
    } else if (val && typeof val === 'object') {
      stats[key] = { type: 'object', count: Object.keys(val).length, label: EXPORT_KEY_LABELS[key] }
    } else {
      stats[key] = { type: typeof val, count: val ? 1 : 0, label: EXPORT_KEY_LABELS[key] }
    }
  }
  const totalSize = Buffer.byteLength(JSON.stringify(dbData), 'utf8')
  return { stats, totalSize, exportableKeys: EXPORTABLE_KEYS, keyLabels: EXPORT_KEY_LABELS }
}

async function exportData(keys = null) {
  const exportKeys = keys && Array.isArray(keys) && keys.length > 0
    ? keys.filter(k => EXPORTABLE_KEYS.includes(k))
    : EXPORTABLE_KEYS

  const data = {}
  for (const key of exportKeys) {
    data[key] = dbData[key]
  }

  const exportObj = {
    app: 'lingyin',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }

  return JSON.stringify(exportObj, null, 2)
}

async function importData(jsonString, mode = 'merge') {
  try {
    const importObj = JSON.parse(jsonString)

    if (!importObj || !importObj.data || typeof importObj.data !== 'object') {
      return { success: false, error: '无效的备份文件格式' }
    }

    if (importObj.app !== 'lingyin') {
      return { success: false, error: '不是聆音的备份文件' }
    }

    const importedKeys = []
    const skippedKeys = []

    for (const key of EXPORTABLE_KEYS) {
      if (!(key in importObj.data)) continue

      const imported = importObj.data[key]

      if (mode === 'overwrite') {
        dbData[key] = imported
        importedKeys.push(key)
      } else {
        if (Array.isArray(imported) && Array.isArray(dbData[key])) {
          const existingIds = new Set()
          const existingData = dbData[key] || []

          if (key === 'works') {
            for (const item of existingData) existingIds.add(item.id)
            for (const item of imported) {
              if (!existingIds.has(item.id)) {
                existingData.push(item)
                existingIds.add(item.id)
              }
            }
          } else if (key === 'playlists') {
            for (const item of existingData) existingIds.add(item.id)
            for (const item of imported) {
              if (!existingIds.has(item.id)) {
                existingData.push(item)
                existingIds.add(item.id)
              }
            }
          } else if (key === 'favorites') {
            for (const item of existingData) existingIds.add(item.workId)
            for (const item of imported) {
              if (!existingIds.has(item.workId)) {
                existingData.push(item)
                existingIds.add(item.workId)
              }
            }
          } else if (key === 'folderGroups') {
            for (const item of existingData) existingIds.add(item.id)
            for (const item of imported) {
              if (!existingIds.has(item.id)) {
                existingData.push(item)
                existingIds.add(item.id)
              }
            }
          } else if (key === 'bookmarks') {
            for (const item of existingData) existingIds.add(item.id)
            for (const item of imported) {
              if (!existingIds.has(item.id)) {
                existingData.push(item)
                existingIds.add(item.id)
              }
            }
          } else {
            for (const item of imported) {
              existingData.push(item)
            }
          }
          importedKeys.push(key)
        } else if (imported && typeof imported === 'object' && !Array.isArray(imported)) {
          if (!dbData[key] || typeof dbData[key] !== 'object') {
            dbData[key] = {}
          }
          Object.assign(dbData[key], imported)
          importedKeys.push(key)
        } else {
          if (dbData[key] === undefined || dbData[key] === null) {
            dbData[key] = imported
            importedKeys.push(key)
          } else {
            skippedKeys.push(key)
          }
        }
      }
    }

    saveDB()

    return {
      success: true,
      importedKeys,
      skippedKeys,
      mode,
    }
  } catch (e) {
    console.error('Import data error:', e)
    return { success: false, error: e.message || '导入失败' }
  }
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
  exportHistoryCSV,
  exportHistoryJSON,
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
  getAllBookmarks,
  getBookmarksByWork,
  getBookmarksByAudio,
  addBookmark,
  updateBookmark,
  deleteBookmark,
  deleteBookmarksByWork,
  clearAllBookmarks,
  getPlayQueue,
  savePlayQueue,
  clearPlayQueue,
  getLastPlayState,
  saveLastPlayState,
  getSmartPlaylists,
  getSmartPlaylistItems,

  // ===== 数据备份与恢复 =====
  exportData,
  importData,
  getDataStats,
}
