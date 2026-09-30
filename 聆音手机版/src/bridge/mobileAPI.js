import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { CapacitorHttp } from '@capacitor/core';
import * as cheerio from 'cheerio';
import * as db from './db-mobile';

// Simple Event Emitter for listeners like onDownloadProgress
const listeners = {};

export const mobileAPI = {
  // DB & Business Logic
  dbGetAllWorks: () => db.getAllWorks(),
  dbAddWork: (work) => db.addWork(work),
  dbUpdateWork: (id, data) => db.updateWork(id, data),
  dbDeleteWork: (id) => db.deleteWork(id),
  dbGetProgress: (workId, audioFile) => db.getProgress(workId, audioFile),
  dbGetWorkProgress: (workId) => db.getWorkProgress(workId),
  dbSaveProgress: (workId, audioFile, progress) => db.saveProgress(workId, audioFile, progress),
  dbGetSubtitle: (workId, audioFile) => db.getSubtitle(workId, audioFile),
  dbSaveSubtitle: (workId, audioFile, subtitleData) => db.saveSubtitle(workId, audioFile, subtitleData),
  dbGetSettings: () => db.getSettings(),
  dbSaveSettings: (settings) => db.saveSettings(settings),
  dbAppendHistory: (entry) => db.appendHistory(entry),
  dbGetUsageStats: (opts) => db.getUsageStats(opts),
  dbDeleteHistoryByWorkId: (workId) => db.deleteHistoryByWorkId(workId),
  dbClearAllHistory: () => db.clearAllHistory(),
  dbGetRecentWorks: (limit) => db.getRecentWorks(limit),
  dbGetLastPlayedAudio: () => db.getLastPlayedAudio(),

  favoritesGetAll: () => db.favoritesGetAll(),
  favoritesToggle: (workId, workInfo) => db.favoritesToggle(workId, workInfo),

  lastPlayStateGet: () => db.lastPlayStateGet(),
  lastPlayStateSave: (state) => db.lastPlayStateSave(state),

  playlistGetAll: () => db.getAllPlaylists(),
  playlistCreate: (name) => db.createPlaylist(name),
  playlistRename: (id, name) => db.renamePlaylist(id, name),
  playlistDelete: (id) => db.deletePlaylist(id),

  folderGroupsGetAll: () => db.getAllFolderGroups(),
  folderGroupsCreate: (name, color) => db.createFolderGroup(name, color),
  folderGroupsRename: (id, name) => db.renameFolderGroup(id, name),
  folderGroupsSetColor: (id, color) => db.setFolderGroupColor(id, color),
  folderGroupsDelete: (id, moveToGroupId) => db.deleteFolderGroup(id, moveToGroupId),
  folderGroupsReorder: (groupIds) => db.reorderFolderGroups(groupIds),
  folderGroupsSetWorkGroup: (workId, groupId) => db.setWorkFolderGroup(workId, groupId),
  folderGroupsGetWorks: (groupId) => db.getWorksByFolderGroup(groupId),

  bookmarksGetAll: () => db.getAllBookmarks(),
  bookmarksGetByWork: (workId) => db.getBookmarksByWork(workId),
  bookmarksGetByAudio: (workId, audioPath) => db.getBookmarksByAudio(workId, audioPath),
  bookmarksAdd: (bookmark) => db.addBookmark(bookmark),
  bookmarksUpdate: (id, data) => db.updateBookmark(id, data),
  bookmarksDelete: (id) => db.deleteBookmark(id),
  bookmarksDeleteByWork: (workId) => db.deleteBookmarksByWork(workId),
  bookmarksClearAll: () => db.clearAllBookmarks(),

  tagsGetAll: () => db.getAllTags(),
  tagsSetColor: (tagName, color) => db.setTagColor(tagName, color),
  tagsRename: (oldName, newName) => db.renameTag(oldName, newName),
  tagsMerge: (sourceNames, targetName) => db.mergeTags(sourceNames, targetName),
  tagsDelete: (tagName) => db.deleteTag(tagName),
  tagsAddToWork: (workId, tagName) => db.addTagToWork(workId, tagName),
  tagsRemoveFromWork: (workId, tagName) => db.removeTagFromWork(workId, tagName),
  tagsBatchAdd: (workIds, tagNames) => db.batchAddTags(workIds, tagNames),
  tagsBatchRemove: (workIds, tagNames) => db.batchRemoveTags(workIds, tagNames),

  backupGetStats: () => db.getDataStats(),
  backupExport: (keys) => db.exportData(keys),
  backupImport: (jsonString, mode) => db.importData(jsonString, mode),

  // Filesystem
  openDirectory: async () => 'Documents',
  readDir: async (path) => {
    try {
      const result = await Filesystem.readdir({ path, directory: Directory.Documents });
      return result.files.map(f => ({ name: f.name, path: f.uri, isDirectory: f.type === 'directory' }));
    } catch (e) { return []; }
  },
  readFile: async (path, encoding = 'utf-8') => {
    const result = await Filesystem.readFile({ path, encoding: encoding === 'utf-8' ? Encoding.UTF8 : undefined });
    return result.data;
  },
  fileExists: async (path) => {
    try { await Filesystem.stat({ path }); return true; } catch { return false; }
  },
  stat: async (path) => {
    try {
      const s = await Filesystem.stat({ path });
      return { size: s.size, mtime: s.mtime, isDirectory: s.type === 'directory' };
    } catch { return null; }
  },
  pathJoin: (...parts) => parts.join('/').replace(/\/+/g, '/'),
  pathBasename: (p) => p.split(/[\\/]/).pop(),
  pathDirname: (p) => p.split(/[\\/]/).slice(0, -1).join('/') || '.',

  // ASMR-One
  asmrOneGetWorks: async (params = {}) => {
    const { page = 1, pageSize = 20, order = 'create_date', sort = 'desc', subtitle = 0, keyword = '' } = params;
    const url = keyword
      ? `https://api.asmr-200.com/api/search/${encodeURIComponent(keyword)}?order=${order}&sort=${sort}&page=${page}&pageSize=${pageSize}&subtitle=${subtitle}&includeTranslationWorks=true`
      : `https://api.asmr-200.com/api/works?order=${order}&sort=${sort}&page=${page}&pageSize=${pageSize}&subtitle=${subtitle}`;
    const res = await CapacitorHttp.get({ url, headers: { 'Referer': 'https://asmr.one/', 'Origin': 'https://asmr.one' } });
    return { works: res.data.works || [], pagination: res.data.pagination || { currentPage: page, pageSize, totalCount: 0 } };
  },
  asmrOneGetWorkInfo: async (workId) => {
    const res = await CapacitorHttp.get({ url: `https://api.asmr-200.com/api/workInfo/${workId}`, headers: { 'Referer': 'https://asmr.one/' } });
    return res.data;
  },
  asmrOneGetTracks: async (workId) => {
    const res = await CapacitorHttp.get({ url: `https://api.asmr-200.com/api/tracks/${workId}?v=2`, headers: { 'Referer': 'https://asmr.one/' } });
    let data = res.data;
    if (!Array.isArray(data)) data = data.tracks || data.data || data.list || [];
    return data;
  },
  asmrOneGetTags: async () => {
    const res = await CapacitorHttp.get({ url: 'https://api.asmr-200.com/api/tags/', headers: { 'Referer': 'https://asmr.one/' } });
    return res.data;
  },

  // DLsite
  dlsiteSearch: async (query) => {
    const rjMatch = query.match(/[Rr][Jj]\s*(\d{3,8})/);
    if (rjMatch) {
      const detail = await mobileAPI.dlsiteGetDetail('RJ' + rjMatch[1]);
      if (detail) return [detail];
    }
    const url = `https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/${encodeURIComponent(query)}/.html`;
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const results = [];
    $('.search_result_img_box').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el), link = $el.find('a').attr('href') || '', img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      const rjMatch = link.match(/(RJ\d+)/), rj = rjMatch ? rjMatch[1] : '';
      if (rj) results.push({ rjCode: rj, title: $el.find('img').attr('alt') || '', cover: img.startsWith('//') ? 'https:' + img : img, url: link.startsWith('http') ? link : 'https://www.dlsite.com' + link });
    });
    return results;
  },
  dlsiteGetDetail: async (rjCode) => {
    const url = `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`;
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const tags = []; $('a[href*="/genre/"]').each((i, el) => { if (tags.length < 20) tags.push($(el).text().trim()); });
    const cvs = []; $('th:contains("声優"), th:contains("声优")').next('td').find('a').each((i, el) => cvs.push($(el).text().trim()));
    if (cvs.length === 0) $('.work_outline td a[href*="voice_by"]').each((i, el) => cvs.push($(el).text().trim()));
    return {
      rjCode, title: $('h1#work_name').text().trim(), cover: ($('meta[property="og:image"]').attr('content') || '').replace(/^\/\//, 'https://'),
      rating: parseFloat($('.rating_total strong').text()) || 0, tags, cvs, circle: $('span.maker_name a').first().text().trim(), url
    };
  },

  // Shell & Window
  openExternal: (url) => Browser.open({ url }),
  windowMinimize: () => {}, windowMaximize: () => {}, windowClose: () => {},
  logInfo: (msg) => console.log('[INFO]', msg), logError: (msg) => console.error('[ERROR]', msg),
  getAppPath: (name) => name,

  // Event Listeners
  onDownloadProgress: (callback) => {
    if (!listeners['download:progress']) listeners['download:progress'] = [];
    listeners['download:progress'].push(callback);
    return () => {
      listeners['download:progress'] = listeners['download:progress'].filter(cb => cb !== callback);
    };
  },
  // To trigger: mobileAPI._emit('download:progress', data)
  _emit: (event, data) => {
    if (listeners[event]) listeners[event].forEach(cb => cb(null, data));
  }
};

// Also expose to window.electronAPI to match desktop environment
if (typeof window !== 'undefined') {
  window.electronAPI = mobileAPI;
}
