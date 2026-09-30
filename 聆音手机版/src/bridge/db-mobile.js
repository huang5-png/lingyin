import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

let dbData = null;
const DB_FILE = 'db.json';

export async function initDB() {
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
    tagMetadata: {},
  };

  try {
    const result = await Filesystem.readFile({
      path: DB_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    dbData = JSON.parse(result.data);
  } catch (e) {
    console.log('Init DB error (probably file not found):', e);
    dbData = defaultData;
    await saveDB();
  }

  return dbData;
}

export async function saveDB() {
  try {
    await Filesystem.writeFile({
      path: DB_FILE,
      data: JSON.stringify(dbData, null, 2),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true
    });
  } catch (e) {
    console.error('Save DB error:', e);
  }
}

export function getDB() {
  return dbData;
}

export async function getAllWorks() {
  return dbData.works || [];
}

export async function addWork(work) {
  const exists = dbData.works.find((w) => w.id === work.id);
  if (exists) return exists;
  work.createdAt = Date.now();
  work.updatedAt = Date.now();
  dbData.works.push(work);
  await saveDB();
  return work;
}

export async function updateWork(id, data) {
  const work = dbData.works.find((w) => w.id === id);
  if (work) {
    Object.assign(work, data, { updatedAt: Date.now() });
    await saveDB();
    return work;
  }
  return null;
}

export async function deleteWork(id) {
  const index = dbData.works.findIndex((w) => w.id === id);
  if (index > -1) {
    dbData.works.splice(index, 1);
    await saveDB();
    return true;
  }
  return false;
}

export async function getProgress(workId, audioFile) {
  const key = `${workId}::${audioFile}`;
  return dbData.progress[key] || { currentTime: 0, duration: 0, lastPlayed: 0 };
}

export async function getWorkProgress(workId) {
  const progressMap = dbData.progress || {};
  let totalPlayed = 0;
  let totalDuration = 0;
  let lastPlayed = 0;

  for (const [key, data] of Object.entries(progressMap)) {
    if (key.startsWith(`${workId}::`)) {
      totalPlayed += data.currentTime || 0;
      totalDuration += data.duration || 0;
      if (data.lastPlayed && data.lastPlayed > lastPlayed) {
        lastPlayed = data.lastPlayed;
      }
    }
  }

  const percentage = totalDuration > 0 ? Math.min(100, Math.round((totalPlayed / totalDuration) * 100)) : 0;
  return { totalPlayed, totalDuration, percentage, lastPlayed };
}

export async function saveProgress(workId, audioFile, progress) {
  const key = `${workId}::${audioFile}`;
  dbData.progress[key] = {
    ...progress,
    lastPlayed: Date.now(),
  };
  await saveDB();
  return true;
}

export async function getSubtitle(workId, audioFile) {
  const key = `${workId}::${audioFile}`;
  return dbData.subtitles[key] || null;
}

export async function saveSubtitle(workId, audioFile, subtitleData) {
  const key = `${workId}::${audioFile}`;
  dbData.subtitles[key] = {
    ...subtitleData,
    savedAt: Date.now(),
  };
  await saveDB();
  return true;
}

export async function getSettings() {
  return dbData.settings || {};
}

export async function saveSettings(settings) {
  dbData.settings = { ...dbData.settings, ...settings };
  await saveDB();
  return dbData.settings;
}

// ===== Listening history =====
export async function appendHistory(entry) {
  if (!dbData.history) dbData.history = [];
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
  });
  if (dbData.history.length > 20000) dbData.history = dbData.history.slice(-20000);
  await saveDB();
  return true;
}

function startOfRange(range, refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const start = new Date(d);
  if (range === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }
  return start.getTime();
}

function endOfRange(range, refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const end = new Date(d);
  if (range === 'day') {
    end.setHours(23, 59, 59, 999);
  } else if (range === 'week') {
    const day = end.getDay();
    const diff = end.getDate() - day + (day === 0 ? 0 : 7);
    end.setDate(diff);
    end.setHours(23, 59, 59, 999);
  } else if (range === 'month') {
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (range === 'year') {
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  } else {
    end.setHours(23, 59, 59, 999);
  }
  return end.getTime();
}

export async function getUsageStats(opts = {}) {
  const range = opts.range || 'month';
  const refDate = opts.date || null;
  const startTs = startOfRange(range, refDate);
  const endTs = endOfRange(range, refDate);

  const history = (dbData.history || []).filter((h) => h.ts >= startTs && h.ts <= endTs);

  const totalSeconds = history.reduce((s, h) => s + (h.seconds || 0), 0);
  const playCount = history.length;

  const workMap = new Map();
  const tagMap = new Map();
  const circleMap = new Map();
  const cvMap = new Map();

  const timePeriods = {
    morning: { label: '早晨', seconds: 0, count: 0 },
    forenoon: { label: '上午', seconds: 0, count: 0 },
    afternoon: { label: '下午', seconds: 0, count: 0 },
    evening: { label: '晚上', seconds: 0, count: 0 },
    lateNight: { label: '深夜', seconds: 0, count: 0 },
  };

  const dailySet = new Set();
  const weekdayMap = new Map();

  for (const h of history) {
    const secs = h.seconds || 0;
    const date = new Date(h.ts);
    const hour = date.getHours();
    const dateStr = date.toDateString();
    const weekday = date.getDay();

    dailySet.add(dateStr);

    const wd = weekdayMap.get(weekday) || { seconds: 0, count: 0 };
    wd.seconds += secs;
    wd.count += 1;
    weekdayMap.set(weekday, wd);

    if (hour >= 6 && hour < 9) {
      timePeriods.morning.seconds += secs;
      timePeriods.morning.count += 1;
    } else if (hour >= 9 && hour < 12) {
      timePeriods.forenoon.seconds += secs;
      timePeriods.forenoon.count += 1;
    } else if (hour >= 12 && hour < 18) {
      timePeriods.afternoon.seconds += secs;
      timePeriods.afternoon.count += 1;
    } else if (hour >= 18 && hour < 23) {
      timePeriods.evening.seconds += secs;
      timePeriods.evening.count += 1;
    } else {
      timePeriods.lateNight.seconds += secs;
      timePeriods.lateNight.count += 1;
    }

    if (h.workId) {
      const w = workMap.get(h.workId) || { id: h.workId, title: h.title, cover: h.cover, seconds: 0, count: 0 };
      w.seconds += secs;
      w.count += 1;
      workMap.set(h.workId, w);
    }
    if (h.circle) {
      const c = circleMap.get(h.circle) || { name: h.circle, seconds: 0, count: 0 };
      c.seconds += secs;
      c.count += 1;
      circleMap.set(h.circle, c);
    }
    for (const cv of h.cvs || []) {
      const c = cvMap.get(cv) || { name: cv, seconds: 0, count: 0 };
      c.seconds += secs;
      c.count += 1;
      cvMap.set(cv, c);
    }
    for (const tag of h.tags || []) {
      const t = tagMap.get(tag) || { name: tag, seconds: 0, count: 0 };
      t.seconds += secs;
      t.count += 1;
      tagMap.set(tag, t);
    }
  }

  const sortBySeconds = (a, b) => b.seconds - a.seconds;
  const workRanking = [...workMap.values()].sort(sortBySeconds).slice(0, 10);
  const tagRanking = [...tagMap.values()].sort(sortBySeconds).slice(0, 10);
  const circleRanking = [...circleMap.values()].sort(sortBySeconds).slice(0, 10);
  const cvRanking = [...cvMap.values()].sort(sortBySeconds).slice(0, 10);

  let mostActivePeriod = 'evening';
  let maxPeriodSeconds = 0;
  for (const [key, val] of Object.entries(timePeriods)) {
    if (val.seconds > maxPeriodSeconds) {
      maxPeriodSeconds = val.seconds;
      mostActivePeriod = key;
    }
  }

  const sortedDays = [...dailySet].sort((a, b) => new Date(a) - new Date(b));
  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate = null;
  for (const d of sortedDays) {
    const cur = new Date(d);
    if (prevDate) {
      const diff = (cur - prevDate) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak += 1;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    prevDate = cur;
  }
  maxStreak = Math.max(maxStreak, currentStreak);

  const activeDays = dailySet.size;
  const avgDailySeconds = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0;

  let mostActiveWeekday = 0;
  let maxWeekdaySeconds = 0;
  for (const [day, val] of weekdayMap.entries()) {
    if (val.seconds > maxWeekdaySeconds) {
      maxWeekdaySeconds = val.seconds;
      mostActiveWeekday = Number(day);
    }
  }
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  let timeline = [];
  if (range === 'day') {
    for (let i = 0; i < 24; i++) timeline.push({ label: `${i}:00`, seconds: 0 });
    for (const h of history) timeline[new Date(h.ts).getHours()].seconds += h.seconds || 0;
  } else if (range === 'week') {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (let i = 0; i < 7; i++) timeline.push({ label: dayNames[i], seconds: 0 });
    for (const h of history) {
      let dayOfWeek = new Date(h.ts).getDay() - 1;
      if (dayOfWeek < 0) dayOfWeek = 6;
      if (dayOfWeek >= 0 && dayOfWeek < 7) timeline[dayOfWeek].seconds += h.seconds || 0;
    }
  } else if (range === 'month') {
    const ref = refDate ? new Date(refDate) : new Date();
    const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) timeline.push({ label: `${i}`, seconds: 0 });
    for (const h of history) {
      const day = new Date(h.ts).getDate();
      if (day >= 1 && day <= daysInMonth) timeline[day - 1].seconds += h.seconds || 0;
    }
  } else {
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    for (let i = 0; i < 12; i++) timeline.push({ label: monthNames[i], seconds: 0 });
    for (const h of history) timeline[new Date(h.ts).getMonth()].seconds += h.seconds || 0;
  }

  return {
    range, startTs, endTs, totalSeconds, playCount,
    uniqueWorks: workMap.size, uniqueCircles: circleMap.size, uniqueCVs: cvMap.size, uniqueTags: tagMap.size,
    workRanking, tagRanking, circleRanking, cvRanking, timeline,
    insights: {
      activeDays, avgDailySeconds, maxStreak, mostActivePeriod,
      mostActivePeriodLabel: timePeriods[mostActivePeriod]?.label || '晚上',
      mostActiveWeekday, mostActiveWeekdayLabel: weekdayNames[mostActiveWeekday],
      timePeriods: Object.entries(timePeriods).map(([key, val]) => ({ key, label: val.label, seconds: val.seconds, count: val.count })),
      weekdayStats: Array.from({ length: 7 }, (_, i) => {
        const wd = weekdayMap.get(i) || { seconds: 0, count: 0 };
        return { weekday: i, label: weekdayNames[i], seconds: wd.seconds, count: wd.count };
      }),
    }
  };
}

export async function exportHistoryCSV() {
  const allHistory = dbData.history || [];
  if (allHistory.length === 0) return '';
  const headers = ['时间', '作品ID', '作品标题', '音频文件', '时长(秒)', '社团', '声优', '标签'];
  const rows = [headers.join(',')];
  for (const h of allHistory) {
    const date = new Date(h.ts).toLocaleString('zh-CN');
    const cvs = (h.cvs || []).join(';');
    const tags = (h.tags || []).join(';');
    const row = [
      `"${date}"`, `"${h.workId || ''}"`, `"${(h.title || '').replace(/"/g, '""')}"`,
      `"${(h.audioFile || '').replace(/"/g, '""')}"`, h.seconds || 0,
      `"${(h.circle || '').replace(/"/g, '""')}"`, `"${cvs.replace(/"/g, '""')}"`, `"${tags.replace(/"/g, '""')}"`,
    ];
    rows.push(row.join(','));
  }
  return '\uFEFF' + rows.join('\n');
}

export async function exportHistoryJSON() {
  return JSON.stringify(dbData.history || [], null, 2);
}

export async function deleteHistoryByWorkId(workId) {
  if (!dbData.history || !workId) return 0;
  const initialLen = dbData.history.length;
  dbData.history = dbData.history.filter((h) => h.workId !== workId);
  const deleted = initialLen - dbData.history.length;
  if (deleted > 0) await saveDB();
  return deleted;
}

export async function clearAllHistory() {
  if (!dbData.history) return 0;
  const count = dbData.history.length;
  dbData.history = [];
  await saveDB();
  return count;
}

export async function getRecentWorks(limit = 8) {
  const history = dbData.history || [];
  const progressMap = dbData.progress || {};
  const seen = new Set();
  const recent = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h || !h.workId || seen.has(h.workId)) continue;
    seen.add(h.workId);
    let workProgress = 0, workDuration = 0, workLastPlayed = h.ts;
    for (const [key, data] of Object.entries(progressMap)) {
      if (key.startsWith(`${h.workId}::`)) {
        workProgress += data.currentTime || 0;
        workDuration += data.duration || 0;
        if (data.lastPlayed > workLastPlayed) workLastPlayed = data.lastPlayed;
      }
    }
    const audioFile = h.audioFile || '';
    const prog = progressMap[`${h.workId}::${audioFile}`];
    recent.push({
      workId: h.workId, title: h.title || '', cover: h.cover || '', circle: h.circle || '',
      cvs: h.cvs || [], tags: h.tags || [], lastPlayed: workLastPlayed, audioFile,
      currentTime: prog?.currentTime || 0, duration: prog?.duration || 0,
      percentage: prog?.duration > 0 ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100)) : 0,
      workPercentage: workDuration > 0 ? Math.min(100, Math.round((workProgress / workDuration) * 100)) : 0,
    });
    if (recent.length >= limit) break;
  }
  return recent;
}

export async function getLastPlayedAudio() {
  const history = dbData.history || [];
  const progressMap = dbData.progress || {};
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h || !h.workId || !h.audioFile) continue;
    const progress = progressMap[`${h.workId}::${h.audioFile}`];
    if (progress && progress.duration > 0 && progress.currentTime > 0 && progress.currentTime < progress.duration * 0.95) {
      return { ...h, currentTime: progress.currentTime, duration: progress.duration, lastPlayed: progress.lastPlayed || h.ts };
    }
  }
  if (history.length > 0) {
    const h = history[history.length - 1];
    const progress = progressMap[`${h.workId}::${h.audioFile || ''}`] || {};
    return { ...h, currentTime: progress.currentTime || 0, duration: progress.duration || 0, lastPlayed: progress.lastPlayed || h.ts };
  }
  return null;
}

// ===== Playlists =====
function genId(prefix = 'pl') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getAllPlaylists() {
  if (!Array.isArray(dbData.playlists)) dbData.playlists = [];
  return dbData.playlists;
}

export async function createPlaylist(name) {
  const playlist = { id: genId('pl'), name: name || '未命名播放列表', createdAt: Date.now(), updatedAt: Date.now(), items: [] };
  dbData.playlists = [...(dbData.playlists || []), playlist];
  await saveDB();
  return playlist;
}

export async function renamePlaylist(id, name) {
  const pl = (dbData.playlists || []).find(p => p.id === id);
  if (!pl) return null;
  pl.name = name || '未命名播放列表';
  pl.updatedAt = Date.now();
  await saveDB();
  return pl;
}

export async function deletePlaylist(id) {
  const idx = (dbData.playlists || []).findIndex(p => p.id === id);
  if (idx < 0) return false;
  dbData.playlists.splice(idx, 1);
  await saveDB();
  return true;
}

// ===== Favorites =====
export async function favoritesGetAll() {
  return dbData.favorites || [];
}

export async function favoritesToggle(workId, workInfo = {}) {
  if (!dbData.favorites) dbData.favorites = [];
  const idx = dbData.favorites.findIndex(f => f.workId === workId);
  if (idx >= 0) {
    dbData.favorites.splice(idx, 1);
    await saveDB();
    return { isFavorite: false };
  } else {
    const fav = { workId, title: workInfo.title || '', cover: workInfo.cover || '', circle: workInfo.circle || '', isOnline: !!workInfo.isOnline, addedAt: Date.now() };
    dbData.favorites.push(fav);
    await saveDB();
    return { isFavorite: true, favorite: fav };
  }
}

// ===== Folder Groups =====
export async function getAllFolderGroups() {
  if (!dbData.folderGroups) dbData.folderGroups = [];
  return [...dbData.folderGroups].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function createFolderGroup(name, color = '') {
  if (!dbData.folderGroups) dbData.folderGroups = [];
  const maxOrder = dbData.folderGroups.reduce((max, g) => Math.max(max, g.order || 0), 0);
  const group = { id: genId('fg'), name: name || '未命名分组', color, order: maxOrder + 1, createdAt: Date.now(), updatedAt: Date.now() };
  dbData.folderGroups.push(group);
  await saveDB();
  return group;
}

export async function renameFolderGroup(id, name) {
  const group = (dbData.folderGroups || []).find(g => g.id === id);
  if (!group) return null;
  group.name = name || '未命名分组';
  group.updatedAt = Date.now();
  await saveDB();
  return group;
}

export async function setFolderGroupColor(id, color) {
  const group = (dbData.folderGroups || []).find(g => g.id === id);
  if (!group) return null;
  group.color = color;
  group.updatedAt = Date.now();
  await saveDB();
  return group;
}

export async function deleteFolderGroup(id, moveToGroupId = null) {
  const idx = (dbData.folderGroups || []).findIndex(g => g.id === id);
  if (idx < 0) return false;
  for (const work of (dbData.works || [])) {
    if (work.folderGroupId === id) work.folderGroupId = moveToGroupId;
  }
  dbData.folderGroups.splice(idx, 1);
  await saveDB();
  return true;
}

export async function reorderFolderGroups(groupIds) {
  const groups = dbData.folderGroups || [];
  const map = new Map(groups.map(g => [g.id, g]));
  let order = 0;
  for (const gid of groupIds) {
    const g = map.get(gid);
    if (g) { g.order = order++; map.delete(gid); }
  }
  for (const g of map.values()) g.order = order++;
  await saveDB();
  return getAllFolderGroups();
}

export async function setWorkFolderGroup(workId, groupId) {
  const work = (dbData.works || []).find(w => w.id === workId);
  if (!work) return null;
  work.folderGroupId = groupId;
  work.updatedAt = Date.now();
  await saveDB();
  return work;
}

export async function getWorksByFolderGroup(groupId) {
  if (groupId === null || groupId === 'ungrouped') return (dbData.works || []).filter(w => !w.folderGroupId);
  return (dbData.works || []).filter(w => w.folderGroupId === groupId);
}

// ===== Bookmarks =====
export async function getAllBookmarks() {
  return [...(dbData.bookmarks || [])].sort((a, b) => a.time - b.time);
}

export async function getBookmarksByWork(workId) {
  return (dbData.bookmarks || []).filter(b => b.workId === workId).sort((a, b) => a.time - b.time);
}

export async function getBookmarksByAudio(workId, audioPath) {
  return (dbData.bookmarks || []).filter(b => b.workId === workId && b.audioPath === audioPath).sort((a, b) => a.time - b.time);
}

export async function addBookmark(bookmark) {
  if (!dbData.bookmarks) dbData.bookmarks = [];
  const bm = { id: genId('bm'), ...bookmark, createdAt: Date.now(), updatedAt: Date.now() };
  dbData.bookmarks.push(bm);
  await saveDB();
  return bm;
}

export async function updateBookmark(id, data) {
  const bm = (dbData.bookmarks || []).find(b => b.id === id);
  if (!bm) return null;
  Object.assign(bm, data, { updatedAt: Date.now() });
  await saveDB();
  return bm;
}

export async function deleteBookmark(id) {
  const idx = (dbData.bookmarks || []).findIndex(b => b.id === id);
  if (idx < 0) return false;
  dbData.bookmarks.splice(idx, 1);
  await saveDB();
  return true;
}

export async function deleteBookmarksByWork(workId) {
  const initialLen = (dbData.bookmarks || []).length;
  dbData.bookmarks = (dbData.bookmarks || []).filter(b => b.workId !== workId);
  if (dbData.bookmarks.length !== initialLen) await saveDB();
  return initialLen - dbData.bookmarks.length;
}

export async function clearAllBookmarks() {
  const count = (dbData.bookmarks || []).length;
  dbData.bookmarks = [];
  await saveDB();
  return count;
}

// ===== Tags Metadata =====
export async function getAllTags() {
  const tagMeta = dbData.tagMetadata || {};
  const tagCountMap = new Map();
  for (const work of (dbData.works || [])) {
    for (const tag of (work.tags || [])) tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
  }
  const tags = [];
  for (const [name, count] of tagCountMap.entries()) {
    const meta = tagMeta[name] || {};
    tags.push({ name, count, color: meta.color || '', createdAt: meta.createdAt || null });
  }
  return tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function setTagColor(tagName, color) {
  if (!dbData.tagMetadata) dbData.tagMetadata = {};
  const meta = dbData.tagMetadata[tagName] || { createdAt: Date.now() };
  meta.color = color;
  meta.updatedAt = Date.now();
  dbData.tagMetadata[tagName] = meta;
  await saveDB();
  return meta;
}

export async function renameTag(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return false;
  const tagMeta = dbData.tagMetadata || {};
  for (const work of (dbData.works || [])) {
    const idx = (work.tags || []).indexOf(oldName);
    if (idx > -1) {
      if (!work.tags.includes(newName)) work.tags[idx] = newName;
      else work.tags.splice(idx, 1);
      work.updatedAt = Date.now();
    }
  }
  if (tagMeta[oldName]) { tagMeta[newName] = { ...tagMeta[oldName], updatedAt: Date.now() }; delete tagMeta[oldName]; }
  await saveDB();
  return true;
}

export async function mergeTags(sourceNames, targetName) {
  const tagMeta = dbData.tagMetadata || {};
  const sourceSet = new Set(sourceNames.filter(n => n !== targetName));
  for (const work of (dbData.works || [])) {
    const tags = work.tags || [];
    let modified = false;
    for (const src of sourceSet) {
      const idx = tags.indexOf(src);
      if (idx > -1) { tags.splice(idx, 1); modified = true; }
    }
    if (modified && !tags.includes(targetName)) tags.push(targetName);
    if (modified) work.updatedAt = Date.now();
  }
  for (const src of sourceSet) delete tagMeta[src];
  await saveDB();
  return true;
}

export async function deleteTag(tagName) {
  for (const work of (dbData.works || [])) {
    const idx = (work.tags || []).indexOf(tagName);
    if (idx > -1) { work.tags.splice(idx, 1); work.updatedAt = Date.now(); }
  }
  if (dbData.tagMetadata) delete dbData.tagMetadata[tagName];
  await saveDB();
  return true;
}

export async function addTagToWork(workId, tagName) {
  const work = (dbData.works || []).find(w => w.id === workId);
  if (!work) return null;
  if (!work.tags) work.tags = [];
  if (!work.tags.includes(tagName)) { work.tags.push(tagName); work.updatedAt = Date.now(); await saveDB(); }
  return work;
}

export async function removeTagFromWork(workId, tagName) {
  const work = (dbData.works || []).find(w => w.id === workId);
  if (!work || !work.tags) return work;
  const idx = work.tags.indexOf(tagName);
  if (idx > -1) { work.tags.splice(idx, 1); work.updatedAt = Date.now(); await saveDB(); }
  return work;
}

export async function batchAddTags(workIds, tagNames) {
  const idSet = new Set(workIds);
  let updated = 0;
  for (const work of (dbData.works || [])) {
    if (!idSet.has(work.id)) continue;
    if (!work.tags) work.tags = [];
    let mod = false;
    for (const t of tagNames) { if (!work.tags.includes(t)) { work.tags.push(t); mod = true; } }
    if (mod) { work.updatedAt = Date.now(); updated++; }
  }
  if (updated > 0) await saveDB();
  return { success: true, updatedCount: updated };
}

export async function batchRemoveTags(workIds, tagNames) {
  const idSet = new Set(workIds), tagSet = new Set(tagNames);
  let updated = 0;
  for (const work of (dbData.works || [])) {
    if (!idSet.has(work.id) || !work.tags) continue;
    const len = work.tags.length;
    work.tags = work.tags.filter(t => !tagSet.has(t));
    if (work.tags.length !== len) { work.updatedAt = Date.now(); updated++; }
  }
  if (updated > 0) await saveDB();
  return { success: true, updatedCount: updated };
}

// ===== Data Backup & Stats =====
export async function getDataStats() {
  const keys = ['works', 'progress', 'subtitles', 'settings', 'history', 'playlists', 'favorites', 'folderGroups', 'bookmarks', 'tagMetadata'];
  const stats = {};
  for (const k of keys) {
    const val = dbData[k];
    stats[k] = { count: Array.isArray(val) ? val.length : (val ? Object.keys(val).length : 0) };
  }
  return { stats, totalSize: JSON.stringify(dbData).length };
}

export async function exportData(keys = null) {
  const data = {};
  const exportKeys = keys || ['works', 'progress', 'subtitles', 'settings', 'history', 'playlists', 'favorites', 'folderGroups', 'bookmarks', 'tagMetadata'];
  for (const k of exportKeys) data[k] = dbData[k];
  return JSON.stringify({ app: 'lingyin', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export async function importData(jsonString, mode = 'merge') {
  try {
    const imported = JSON.parse(jsonString).data;
    if (!imported) return { success: false, error: '无效格式' };
    if (mode === 'overwrite') Object.assign(dbData, imported);
    else {
      // Simple merge for critical keys
      for (const k of Object.keys(imported)) {
        if (Array.isArray(dbData[k]) && Array.isArray(imported[k])) {
          const idMap = new Set(dbData[k].map(i => i.id || i.workId));
          for (const item of imported[k]) {
            if (!idMap.has(item.id || item.workId)) dbData[k].push(item);
          }
        } else if (typeof dbData[k] === 'object' && dbData[k]) {
          Object.assign(dbData[k], imported[k]);
        }
      }
    }
    await saveDB();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function lastPlayStateGet() { return dbData.lastPlayState || null; }
export async function lastPlayStateSave(state) {
  dbData.lastPlayState = state ? { ...state, timestamp: Date.now() } : null;
  await saveDB();
  return true;
}
