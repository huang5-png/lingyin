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
  dbSaveProgress: (workId, audioFile, progress) => ipcRenderer.invoke('db:saveProgress', workId, audioFile, progress),
  dbGetSubtitle: (workId, audioFile) => ipcRenderer.invoke('db:getSubtitle', workId, audioFile),
  dbSaveSubtitle: (workId, audioFile, subtitleData) => ipcRenderer.invoke('db:saveSubtitle', workId, audioFile, subtitleData),
  dbGetSettings: () => ipcRenderer.invoke('db:getSettings'),
  dbSaveSettings: (settings) => ipcRenderer.invoke('db:saveSettings', settings),
  dbAppendHistory: (entry) => ipcRenderer.invoke('db:appendHistory', entry),
  dbGetUsageStats: (opts) => ipcRenderer.invoke('db:getUsageStats', opts),
  dbGetAllHistory: () => ipcRenderer.invoke('db:getAllHistory'),
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
  onDownloadState: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('download:state', handler)
    return () => ipcRenderer.removeListener('download:state', handler)
  },
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
})
