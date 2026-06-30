const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath, encoding) => ipcRenderer.invoke('fs:readFile', filePath, encoding),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
  stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  pathJoin: (...parts) => ipcRenderer.invoke('path:join', ...parts),
  pathBasename: (p) => ipcRenderer.invoke('path:basename', p),
  pathDirname: (p) => ipcRenderer.invoke('path:dirname', p),
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  dlsiteSearch: (query) => ipcRenderer.invoke('dlsite:search', query),
  dlsiteGetDetail: (rjCode) => ipcRenderer.invoke('dlsite:detail', rjCode),
  dbGetAllWorks: () => ipcRenderer.invoke('db:getAllWorks'),
  dbAddWork: (work) => ipcRenderer.invoke('db:addWork', work),
  dbUpdateWork: (id, data) => ipcRenderer.invoke('db:updateWork', id, data),
  dbDeleteWork: (id) => ipcRenderer.invoke('db:deleteWork', id),
  dbGetProgress: (workId, audioFile) => ipcRenderer.invoke('db:getProgress', workId, audioFile),
  dbGetWorkProgress: (workId) => ipcRenderer.invoke('db:getWorkProgress', workId),
  dbSaveProgress: (workId, audioFile, progress) => ipcRenderer.invoke('db:saveProgress', workId, audioFile, progress),
  dbGetSubtitle: (workId, audioFile) => ipcRenderer.invoke('db:getSubtitle', workId, audioFile),
  dbSaveSubtitle: (workId, audioFile, subtitleData) => ipcRenderer.invoke('db:saveSubtitle', workId, audioFile, subtitleData),
  dbGetSettings: () => ipcRenderer.invoke('db:getSettings'),
  dbSaveSettings: (settings) => ipcRenderer.invoke('db:saveSettings', settings),
  dbAppendHistory: (entry) => ipcRenderer.invoke('db:appendHistory', entry),
  dbGetUsageStats: (opts) => ipcRenderer.invoke('db:getUsageStats', opts),
  dbGetAllHistory: () => ipcRenderer.invoke('db:getAllHistory'),
  dbGetRecentWorks: (limit) => ipcRenderer.invoke('db:getRecentWorks', limit),
  dbDeleteHistoryByWorkId: (workId) => ipcRenderer.invoke('db:deleteHistoryByWorkId', workId),
  dbClearAllHistory: () => ipcRenderer.invoke('db:clearAllHistory'),

  // 播放列表
  playlistGetAll: () => ipcRenderer.invoke('playlist:getAll'),
  playlistCreate: (name) => ipcRenderer.invoke('playlist:create', name),
  playlistRename: (id, name) => ipcRenderer.invoke('playlist:rename', id, name),
  playlistDelete: (id) => ipcRenderer.invoke('playlist:delete', id),
  playlistAddItem: (id, item) => ipcRenderer.invoke('playlist:addItem', id, item),
  playlistRemoveItem: (id, itemId) => ipcRenderer.invoke('playlist:removeItem', id, itemId),
  playlistReorderItems: (id, itemIds) => ipcRenderer.invoke('playlist:reorderItems', id, itemIds),
  playlistClear: (id) => ipcRenderer.invoke('playlist:clear', id),
  logInfo: (message, ...args) => ipcRenderer.invoke('log:info', message, ...args),
  logWarn: (message, ...args) => ipcRenderer.invoke('log:warn', message, ...args),
  logError: (message, ...args) => ipcRenderer.invoke('log:error', message, ...args),
  getLogPath: () => ipcRenderer.invoke('log:getPath'),
  getLogDir: () => ipcRenderer.invoke('log:getDir'),
  openLogFolder: () => ipcRenderer.invoke('log:openFolder'),
  readAudioBuffer: (filePath) => ipcRenderer.invoke('fs:readAudioBuffer', filePath),
  getAudioDuration: (filePath) => ipcRenderer.invoke('fs:getAudioDuration', filePath),
  openSubtitleFile: () => ipcRenderer.invoke('dialog:openSubtitleFile'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  asmrOneGetWorks: (params) => ipcRenderer.invoke('asmrOne:getWorks', params),
  asmrOneGetWorkInfo: (workId) => ipcRenderer.invoke('asmrOne:getWorkInfo', workId),
  asmrOneGetTracks: (workId) => ipcRenderer.invoke('asmrOne:getTracks', workId),
  asmrOneGetTags: () => ipcRenderer.invoke('asmrOne:getTags'),
  asmrOneDownloadFile: (opts) => ipcRenderer.invoke('asmrOne:downloadFile', opts),
  asmrOneCancelDownload: () => ipcRenderer.invoke('asmrOne:cancelDownload'),
  selectDownloadDir: () => ipcRenderer.invoke('dialog:selectDownloadDir'),
  onDownloadProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('download:progress', handler)
    return () => ipcRenderer.removeListener('download:progress', handler)
  },
  downloadAddTask: (data) => ipcRenderer.invoke('download:addTask', data),
  downloadGetState: () => ipcRenderer.invoke('download:getState'),
  downloadCancelTask: (taskId) => ipcRenderer.invoke('download:cancelTask', taskId),
  downloadRemoveTask: (taskId) => ipcRenderer.invoke('download:removeTask', taskId),
  downloadClearCompleted: () => ipcRenderer.invoke('download:clearCompleted'),
  downloadRetryTask: (taskId) => ipcRenderer.invoke('download:retryTask', taskId),
  downloadRetryFile: (taskId, fileIndex) => ipcRenderer.invoke('download:retryFile', taskId, fileIndex),
  onDownloadState: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('download:state', handler)
    return () => ipcRenderer.removeListener('download:state', handler)
  },
  onDownloadTaskComplete: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('download:taskComplete', handler)
    return () => ipcRenderer.removeListener('download:taskComplete', handler)
  },
  onDownloadTaskFailed: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('download:taskFailed', handler)
    return () => ipcRenderer.removeListener('download:taskFailed', handler)
  },
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // 翻译
  translateText: (text, targetLang) => ipcRenderer.invoke('translate:text', text, targetLang),
  translateBatch: (texts, targetLang) => ipcRenderer.invoke('translate:batch', texts, targetLang),
  // 翻译缓存
  translateGetCache: (workId, audioPath) => ipcRenderer.invoke('translate:getCache', workId, audioPath),
  translateSaveCache: (workId, audioPath, cues) => ipcRenderer.invoke('translate:saveCache', workId, audioPath, cues),
  translateClearCache: () => ipcRenderer.invoke('translate:clearCache'),

  // 收藏
  favoritesGetAll: () => ipcRenderer.invoke('favorites:getAll'),
  favoritesIsFavorite: (workId) => ipcRenderer.invoke('favorites:isFavorite', workId),
  favoritesAdd: (workId, workInfo) => ipcRenderer.invoke('favorites:add', workId, workInfo),
  favoritesRemove: (workId) => ipcRenderer.invoke('favorites:remove', workId),
  favoritesToggle: (workId, workInfo) => ipcRenderer.invoke('favorites:toggle', workId, workInfo),

  // 文件夹分组
  folderGroupsGetAll: () => ipcRenderer.invoke('folderGroups:getAll'),
  folderGroupsCreate: (name, color) => ipcRenderer.invoke('folderGroups:create', name, color),
  folderGroupsRename: (id, name) => ipcRenderer.invoke('folderGroups:rename', id, name),
  folderGroupsSetColor: (id, color) => ipcRenderer.invoke('folderGroups:setColor', id, color),
  folderGroupsDelete: (id, moveToGroupId) => ipcRenderer.invoke('folderGroups:delete', id, moveToGroupId),
  folderGroupsReorder: (groupIds) => ipcRenderer.invoke('folderGroups:reorder', groupIds),
  folderGroupsSetWorkGroup: (workId, groupId) => ipcRenderer.invoke('folderGroups:setWorkGroup', workId, groupId),
  folderGroupsGetWorks: (groupId) => ipcRenderer.invoke('folderGroups:getWorks', groupId),
})
