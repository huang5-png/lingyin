const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const axios = require('axios')
const { initDB, getAllWorks, addWork, updateWork, deleteWork, getProgress, getWorkProgress, saveProgress, getSubtitle, saveSubtitle, getSettings, saveSettings, appendHistory, getUsageStats, getAllHistory, exportHistoryCSV, exportHistoryJSON, deleteHistoryByWorkId, clearAllHistory, getRecentWorks, getLastPlayedAudio, getAllPlaylists, createPlaylist, renamePlaylist, deletePlaylist, addPlaylistItem, removePlaylistItem, reorderPlaylistItems, clearPlaylist, getTranslateCache, saveTranslateCache, clearTranslateCache, getAllFavorites, isFavorite, addFavorite, removeFavorite, toggleFavorite, getAllFolderGroups, createFolderGroup, renameFolderGroup, setFolderGroupColor, deleteFolderGroup, reorderFolderGroups, setWorkFolderGroup, getWorksByFolderGroup, getAllBookmarks, getBookmarksByWork, getBookmarksByAudio, addBookmark, updateBookmark, deleteBookmark, deleteBookmarksByWork, clearAllBookmarks, getPlayQueue, savePlayQueue, clearPlayQueue, getLastPlayState, saveLastPlayState, getSmartPlaylists, getSmartPlaylistItems, getDataStats, exportData, importData, getAllTags, getTagMetadata, setTagColor, renameTag, mergeTags, deleteTag, addTagToWork, removeTagFromWork, batchAddTags, batchRemoveTags } = require('./db')
const { searchDLsite, getWorkDetail, extractRJCode, setProxyHelpers } = require('./dlsite')
const { setProxyHelper: setTranslateProxyHelper, translateText, translateBatch } = require('./translate')
const logger = require('./logger')

// 创建 keep-alive agent，复用连接，减少 ECONNRESET
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 })

let parseFile = null
async function getParseFile() {
  if (!parseFile) {
    const mm = await import('music-metadata')
    parseFile = mm.parseFile
  }
  return parseFile
}

const isDev = process.env.NODE_ENV === 'development'

// ========== 白屏防护：GPU / 硬件加速相关开关 ==========
// 禁用 GPU 着色器磁盘缓存，减少 IO 和权限错误
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
// 禁用后台标签页节流，保证音频播放流畅
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
// 禁用不必要的 Chromium 功能
app.commandLine.appendSwitch('disable-features', 'TranslateUI,Translate,MediaRouter,SpareRendererForSitePerProcess')
// 限制缓存大小
app.commandLine.appendSwitch('disk-cache-size', '104857600')

// 白屏防护：Windows 下常见 GPU 驱动问题导致渲染进程崩溃
// 优先尝试禁用硬件加速（最稳妥的白屏解决方案）
const shouldDisableHardwareAcceleration = !isDev || process.env.DISABLE_HW_ACCEL === '1'
if (shouldDisableHardwareAcceleration) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

// 白屏防护：禁用 sandbox（部分 Windows 环境 sandbox 初始化失败导致崩溃）
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-setuid-sandbox')

let mainWindow
let miniWindow = null
let tray = null
let isPlaying = false
let currentTrackTitle = ''
let miniPlayerState = {
  isPlaying: false,
  title: '',
  cover: '',
  currentTime: 0,
  duration: 0,
  workTitle: '',
}

function updateTrayMenu() {
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isPlaying ? '暂停' : '播放',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:togglePlay')
        }
      }
    },
    {
      label: '上一曲',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:prevTrack')
        }
      }
    },
    {
      label: '下一曲',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray:nextTrack')
        }
      }
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        showMainWindow()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon-16.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  
  if (trayIcon.isEmpty()) {
    logger.warn('托盘图标加载失败，使用 fallback')
    return
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('聆音 - 沉浸式 ASMR 音声播放器')

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        showMainWindow()
      }
    } else {
      createWindow()
    }
  })

  tray.on('double-click', () => {
    showMainWindow()
  })

  return { tray }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function updateTrayPlayState(playing, title) {
  isPlaying = playing
  if (title !== undefined) {
    currentTrackTitle = title
  }
  if (tray) {
    const tip = currentTrackTitle
      ? `聆音${isPlaying ? ' · 播放中' : ' · 已暂停'}\n${currentTrackTitle}`
      : '聆音 - 沉浸式 ASMR 音声播放器'
    tray.setToolTip(tip)
    updateTrayMenu()
  }
}

// ========== 全局媒体快捷键 ==========
let globalShortcutsRegistered = false

async function registerGlobalShortcuts() {
  try {
    const settings = await getSettings()
    if (settings.globalMediaKeys === false) {
      unregisterGlobalShortcuts()
      return
    }

    if (globalShortcutsRegistered) return

    const playPauseRegistered = globalShortcut.register('MediaPlayPause', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('globalShortcut:playPause')
      }
    })

    const nextRegistered = globalShortcut.register('MediaNextTrack', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('globalShortcut:nextTrack')
      }
    })

    const prevRegistered = globalShortcut.register('MediaPreviousTrack', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('globalShortcut:prevTrack')
      }
    })

    const stopRegistered = globalShortcut.register('MediaStop', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('globalShortcut:stop')
      }
    })

    globalShortcutsRegistered = playPauseRegistered || nextRegistered || prevRegistered || stopRegistered
    logger.info('全局媒体快捷键注册:', { playPause: playPauseRegistered, next: nextRegistered, prev: prevRegistered, stop: stopRegistered })
  } catch (e) {
    logger.warn('注册全局媒体快捷键失败:', e.message)
  }
}

function unregisterGlobalShortcuts() {
  try {
    globalShortcut.unregisterAll()
    globalShortcutsRegistered = false
    logger.info('已注销全局媒体快捷键')
  } catch (e) {
    logger.warn('注销全局媒体快捷键失败:', e.message)
  }
}

// ========== 系统通知 ==========
let currentNotification = null

function showTrackNotification(title, body, coverUrl) {
  try {
    if (currentNotification) {
      currentNotification.close()
      currentNotification = null
    }

    const notificationOptions = {
      title: title || '聆音',
      body: body || '',
      silent: true,
    }

    if (coverUrl && coverUrl.startsWith('http')) {
      notificationOptions.icon = coverUrl
    }

    currentNotification = new Notification(notificationOptions)

    currentNotification.on('click', () => {
      showMainWindow()
    })

    currentNotification.show()
  } catch (e) {
    logger.warn('显示系统通知失败:', e.message)
  }
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show()
    miniWindow.focus()
    return
  }

  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')

  miniWindow = new BrowserWindow({
    width: 360,
    height: 130,
    minWidth: 300,
    minHeight: 110,
    maxWidth: 500,
    maxHeight: 180,
    backgroundColor: '#faf9f5',
    frame: false,
    transparent: true,
    icon: iconPath,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false,
      spellcheck: false,
      enableWebSQL: false,
    },
  })

  miniWindow.setMenuBarVisibility(false)

  if (isDev) {
    miniWindow.loadURL('http://localhost:5173#mini')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    miniWindow.loadFile(indexPath, { hash: 'mini' }).catch((err) => {
      logger.error('迷你播放器加载失败:', err.message)
    })
  }

  miniWindow.once('ready-to-show', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.show()
    }
  })

  miniWindow.on('closed', () => {
    miniWindow = null
  })

  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds()
    miniWindow.setPosition(
      mainBounds.x + Math.floor((mainBounds.width - 360) / 2),
      mainBounds.y + Math.floor((mainBounds.height - 130) / 2)
    )
  }
}

function broadcastToMini(channel, data) {
  if (miniWindow && !miniWindow.isDestroyed()) {
    try {
      miniWindow.webContents.send(channel, data)
    } catch (e) {}
  }
}

function broadcastToMain(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data)
    } catch (e) {}
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#faf9f5',
    frame: false,
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false,
      spellcheck: false,
      enableWebSQL: false,
    },
  })

  // 白屏防护：窗口就绪后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 白屏防护：超时兜底显示（防止 ready-to-show 因渲染错误永不触发）
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logger.warn('ready-to-show 超时，强制显示窗口')
      mainWindow.show()
    }
  }, 5000)
  mainWindow.once('ready-to-show', () => clearTimeout(showTimeout))
  mainWindow.once('closed', () => clearTimeout(showTimeout))
  
  mainWindow.setTitle('聆音')

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    logger.info('加载生产页面:', indexPath)
    mainWindow.loadFile(indexPath).catch((err) => {
      logger.error('加载 index.html 失败:', err.message)
    })
  }

  // 白屏防护：监听渲染进程崩溃
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('渲染进程崩溃:', details.reason, details.exitCode)
    // 尝试重新加载
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        mainWindow.reload()
      }, 1000)
    }
  })

  // 白屏防护：监听加载失败
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('页面加载失败:', errorCode, errorDescription)
  })

  // 白屏防护：监听控制台错误（便于排查 JS 错误导致的白屏）
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) {
      logger.error('[渲染控制台错误]', message, 'at', sourceId, ':', line)
    }
  })

  // 快捷键：F12 或 Ctrl+Shift+I 切换开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isToggle = input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')
    if (isToggle) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
      event.preventDefault()
    }
  })

  mainWindow.on('close', async (e) => {
    if (app.isQuiting) {
      return
    }
    
    try {
      const settings = await getSettings()
      if (settings.closeToTray !== false) {
        e.preventDefault()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide()
        }
        return
      }
    } catch (e) {
      logger.warn('获取托盘设置失败，直接关闭:', e.message)
    }
    
    app.isQuiting = true
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  logger.initLogger()
  logger.info('App starting...')

  try {
    await initDB()
    logger.info('Database initialized')
  } catch (e) {
    logger.error('Failed to init database:', e.message)
  }

  createWindow()
  createTray()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  logger.info('All windows closed')
  if (process.platform !== 'darwin') {
    if (tray) {
      logger.info('托盘存在，保持应用在后台运行')
    } else {
      app.quit()
      setTimeout(() => {
        process.exit(0)
      }, 500)
    }
  }
})

app.on('before-quit', (e) => {
  logger.info('App before quit')
  app.isQuiting = true
  unregisterGlobalShortcuts()
  if (tray) {
    try {
      tray.destroy()
      tray = null
    } catch (e) {
      logger.warn('销毁托盘失败:', e.message)
    }
  }
  if (mainWindow) {
    mainWindow.removeAllListeners('closed')
    mainWindow.removeAllListeners('close')
    mainWindow.close()
    mainWindow = null
  }
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err.message)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason?.message || reason)
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    return files.map((f) => ({
      name: f.name,
      isDirectory: f.isDirectory(),
      path: path.join(dirPath, f.name),
    }))
  } catch (e) {
    return []
  }
})

ipcMain.handle('fs:readFile', async (_, filePath, encoding = 'utf-8') => {
  try {
    return fs.readFileSync(filePath, encoding)
  } catch (e) {
    return null
  }
})

ipcMain.handle('dialog:openSubtitleFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择字幕文件',
      filters: [
        { name: '字幕文件', extensions: ['lrc', 'srt', 'vtt', 'ass', 'ssa'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })
    if (result.canceled) return []
    return result.filePaths.map((fp) => {
      const name = path.basename(fp)
      return { name, path: fp, isDirectory: false, size: 0 }
    })
  } catch (e) {
    logger.error('Failed to open subtitle dialog:', e.message)
    return []
  }
})

ipcMain.handle('fs:fileExists', async (_, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('fs:stat', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath)
    return {
      size: stat.size,
      mtime: stat.mtime,
      isDirectory: stat.isDirectory(),
    }
  } catch (e) {
    return null
  }
})

ipcMain.handle('path:join', async (_, ...parts) => {
  return path.join(...parts)
})

ipcMain.handle('path:basename', async (_, p) => {
  if (!p) return ''
  return path.basename(p)
})

ipcMain.handle('path:dirname', async (_, p) => {
  return path.dirname(p)
})

ipcMain.handle('app:getPath', async (_, name) => {
  return app.getPath(name)
})

ipcMain.handle('dlsite:search', async (_, query) => {
  return searchDLsite(query)
})

ipcMain.handle('dlsite:detail', async (_, rjCode) => {
  return getWorkDetail(rjCode)
})

ipcMain.handle('db:getAllWorks', async () => {
  return getAllWorks()
})

ipcMain.handle('db:addWork', async (_, work) => {
  return addWork(work)
})

ipcMain.handle('db:updateWork', async (_, id, data) => {
  return updateWork(id, data)
})

ipcMain.handle('db:deleteWork', async (_, id) => {
  return deleteWork(id)
})

ipcMain.handle('db:getProgress', async (_, workId, audioFile) => {
  return getProgress(workId, audioFile)
})

ipcMain.handle('db:getWorkProgress', async (_, workId) => {
  return getWorkProgress(workId)
})

ipcMain.handle('db:saveProgress', async (_, workId, audioFile, progress) => {
  return saveProgress(workId, audioFile, progress)
})

ipcMain.handle('db:getSubtitle', async (_, workId, audioFile) => {
  return getSubtitle(workId, audioFile)
})

ipcMain.handle('db:saveSubtitle', async (_, workId, audioFile, subtitleData) => {
  return saveSubtitle(workId, audioFile, subtitleData)
})

ipcMain.handle('db:getSettings', async () => {
  return getSettings()
})

ipcMain.handle('db:saveSettings', async (_, settings) => {
  return saveSettings(settings)
})

ipcMain.handle('db:appendHistory', async (_, entry) => {
  return appendHistory(entry)
})

ipcMain.handle('db:getUsageStats', async (_, opts) => {
  return getUsageStats(opts)
})

ipcMain.handle('db:getAllHistory', async () => {
  return getAllHistory()
})

ipcMain.handle('db:exportHistoryCSV', async (_, opts) => {
  return exportHistoryCSV(opts)
})

ipcMain.handle('db:exportHistoryJSON', async (_, opts) => {
  return exportHistoryJSON(opts)
})

ipcMain.handle('db:getRecentWorks', async (_, limit) => {
  return getRecentWorks(limit)
})

ipcMain.handle('db:getLastPlayedAudio', async () => {
  return getLastPlayedAudio()
})

ipcMain.handle('db:deleteHistoryByWorkId', async (_, workId) => {
  return deleteHistoryByWorkId(workId)
})

ipcMain.handle('db:clearAllHistory', async () => {
  return clearAllHistory()
})

// ===== 播放列表 IPC =====
ipcMain.handle('playlist:getAll', async () => {
  return getAllPlaylists()
})

ipcMain.handle('playlist:create', async (_, name) => {
  return createPlaylist(name)
})

ipcMain.handle('playlist:rename', async (_, id, name) => {
  return renamePlaylist(id, name)
})

ipcMain.handle('playlist:delete', async (_, id) => {
  return deletePlaylist(id)
})

ipcMain.handle('playlist:addItem', async (_, id, item) => {
  return addPlaylistItem(id, item)
})

ipcMain.handle('playlist:removeItem', async (_, id, itemId) => {
  return removePlaylistItem(id, itemId)
})

ipcMain.handle('playlist:reorderItems', async (_, id, itemIds) => {
  return reorderPlaylistItems(id, itemIds)
})

ipcMain.handle('playlist:clear', async (_, id) => {
  return clearPlaylist(id)
})

// ===== 智能播放列表 IPC =====
ipcMain.handle('smartPlaylist:getAll', async () => {
  return getSmartPlaylists()
})

ipcMain.handle('smartPlaylist:getItems', async (_, smartId, limit) => {
  return getSmartPlaylistItems(smartId, limit)
})

// ===== 收藏 IPC =====
ipcMain.handle('favorites:getAll', async () => {
  return getAllFavorites()
})

ipcMain.handle('favorites:isFavorite', async (_, workId) => {
  return isFavorite(workId)
})

ipcMain.handle('favorites:add', async (_, workId, workInfo) => {
  return addFavorite(workId, workInfo)
})

ipcMain.handle('favorites:remove', async (_, workId) => {
  return removeFavorite(workId)
})

ipcMain.handle('favorites:toggle', async (_, workId, workInfo) => {
  return toggleFavorite(workId, workInfo)
})

// ===== 文件夹分组 IPC =====
ipcMain.handle('folderGroups:getAll', async () => {
  return getAllFolderGroups()
})

ipcMain.handle('folderGroups:create', async (_, name, color) => {
  return createFolderGroup(name, color)
})

ipcMain.handle('folderGroups:rename', async (_, id, name) => {
  return renameFolderGroup(id, name)
})

ipcMain.handle('folderGroups:setColor', async (_, id, color) => {
  return setFolderGroupColor(id, color)
})

ipcMain.handle('folderGroups:delete', async (_, id, moveToGroupId) => {
  return deleteFolderGroup(id, moveToGroupId)
})

ipcMain.handle('folderGroups:reorder', async (_, groupIds) => {
  return reorderFolderGroups(groupIds)
})

ipcMain.handle('folderGroups:setWorkGroup', async (_, workId, groupId) => {
  return setWorkFolderGroup(workId, groupId)
})

ipcMain.handle('folderGroups:getWorks', async (_, groupId) => {
  return getWorksByFolderGroup(groupId)
})

// ===== 书签 IPC =====
ipcMain.handle('bookmarks:getAll', async () => {
  return getAllBookmarks()
})

ipcMain.handle('bookmarks:getByWork', async (_, workId) => {
  return getBookmarksByWork(workId)
})

ipcMain.handle('bookmarks:getByAudio', async (_, workId, audioPath) => {
  return getBookmarksByAudio(workId, audioPath)
})

ipcMain.handle('bookmarks:add', async (_, bookmark) => {
  return addBookmark(bookmark)
})

ipcMain.handle('bookmarks:update', async (_, id, data) => {
  return updateBookmark(id, data)
})

ipcMain.handle('bookmarks:delete', async (_, id) => {
  return deleteBookmark(id)
})

ipcMain.handle('bookmarks:deleteByWork', async (_, workId) => {
  return deleteBookmarksByWork(workId)
})

ipcMain.handle('bookmarks:clearAll', async () => {
  return clearAllBookmarks()
})

// ===== 标签 IPC =====
ipcMain.handle('tags:getAll', async () => {
  return getAllTags()
})

ipcMain.handle('tags:getMetadata', async (_, tagName) => {
  return getTagMetadata(tagName)
})

ipcMain.handle('tags:setColor', async (_, tagName, color) => {
  return setTagColor(tagName, color)
})

ipcMain.handle('tags:rename', async (_, oldName, newName) => {
  return renameTag(oldName, newName)
})

ipcMain.handle('tags:merge', async (_, sourceNames, targetName) => {
  return mergeTags(sourceNames, targetName)
})

ipcMain.handle('tags:delete', async (_, tagName) => {
  return deleteTag(tagName)
})

ipcMain.handle('tags:addToWork', async (_, workId, tagName) => {
  return addTagToWork(workId, tagName)
})

ipcMain.handle('tags:removeFromWork', async (_, workId, tagName) => {
  return removeTagFromWork(workId, tagName)
})

ipcMain.handle('tags:batchAdd', async (_, workIds, tagNames) => {
  return batchAddTags(workIds, tagNames)
})

ipcMain.handle('tags:batchRemove', async (_, workIds, tagNames) => {
  return batchRemoveTags(workIds, tagNames)
})

ipcMain.handle('playQueue:get', async () => {
  return getPlayQueue()
})

ipcMain.handle('playQueue:save', async (_, queue) => {
  return savePlayQueue(queue)
})

ipcMain.handle('playQueue:clear', async () => {
  return clearPlayQueue()
})

ipcMain.handle('lastPlayState:get', async () => {
  return getLastPlayState()
})

ipcMain.handle('lastPlayState:save', async (_, state) => {
  return saveLastPlayState(state)
})

ipcMain.handle('backup:getStats', async () => {
  return getDataStats()
})

ipcMain.handle('backup:export', async (_, keys) => {
  return exportData(keys)
})

ipcMain.handle('backup:import', async (_, jsonString, mode) => {
  return importData(jsonString, mode)
})

ipcMain.handle('backup:saveFile', async (_, jsonString, defaultName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出备份',
    defaultPath: defaultName || `lingyin-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
  })
  if (!filePath) return null
  fs.writeFileSync(filePath, jsonString, 'utf-8')
  return filePath
})

ipcMain.handle('backup:openFile', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '选择备份文件',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!filePaths || filePaths.length === 0) return null
  const content = fs.readFileSync(filePaths[0], 'utf-8')
  return { filePath: filePaths[0], content }
})

ipcMain.handle('log:info', async (_, message, ...args) => {
  logger.info('[Renderer] ' + message, ...args)
})

ipcMain.handle('log:warn', async (_, message, ...args) => {
  logger.warn('[Renderer] ' + message, ...args)
})

ipcMain.handle('log:error', async (_, message, ...args) => {
  logger.error('[Renderer] ' + message, ...args)
})

ipcMain.handle('log:getPath', async () => {
  return logger.getLogPath()
})

ipcMain.handle('log:getDir', async () => {
  return logger.getLogDir()
})

ipcMain.handle('log:openFolder', async () => {
  const logDir = logger.getLogDir()
  if (logDir && fs.existsSync(logDir)) {
    shell.openPath(logDir)
  }
  return logDir
})

ipcMain.handle('shell:openExternal', async (_, url) => {
  try {
    await shell.openExternal(url)
    return true
  } catch (e) {
    logger.error('Failed to open external URL:', url, e.message)
    return false
  }
})

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
})

ipcMain.handle('window:hide', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
    return true
  }
  return false
})

ipcMain.handle('window:show', () => {
  showMainWindow()
  return true
})

ipcMain.handle('window:isVisible', () => {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
})

ipcMain.handle('tray:updatePlayState', (_, playing, title) => {
  updateTrayPlayState(playing, title)
  return true
})

ipcMain.handle('tray:setCloseToTray', (_, enabled) => {
  logger.info('设置关闭最小化到托盘:', enabled)
  return true
})

// 全局媒体快捷键 IPC
ipcMain.handle('globalShortcut:register', async () => {
  await registerGlobalShortcuts()
  return true
})

ipcMain.handle('globalShortcut:unregister', () => {
  unregisterGlobalShortcuts()
  return true
})

ipcMain.handle('globalShortcut:isRegistered', () => {
  return globalShortcutsRegistered
})

// 系统通知 IPC
ipcMain.handle('notification:show', (_, { title, body, icon }) => {
  showTrackNotification(title, body, icon)
  return true
})

// 翻译 IPC
ipcMain.handle('translate:text', async (event, text, targetLang) => {
  try {
    const settings = await getSettings()
    const engine = settings.translateEngine || 'google'
    return await translateText(text, targetLang || 'zh-CN', engine)
  } catch (e) {
    logger.error('[翻译] 单条翻译失败:', e.message)
    return text
  }
})

ipcMain.handle('translate:batch', async (event, texts, targetLang) => {
  try {
    const settings = await getSettings()
    const engine = settings.translateEngine || 'google'
    return await translateBatch(texts, targetLang || 'zh-CN', engine)
  } catch (e) {
    logger.error('[翻译] 批量翻译失败:', e.message)
    return texts
  }
})

// 翻译缓存 IPC
ipcMain.handle('translate:getCache', async (_, workId, audioPath) => {
  return await getTranslateCache(workId, audioPath)
})

ipcMain.handle('translate:saveCache', async (_, workId, audioPath, cues) => {
  return await saveTranslateCache(workId, audioPath, cues)
})

ipcMain.handle('translate:clearCache', async () => {
  return await clearTranslateCache()
})

const ASMR_ONE_API_BASE = 'https://api.asmr-200.com/api'

const asmrOneHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://asmr.one/',
  'Origin': 'https://asmr.one',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

// 获取代理配置
async function getProxyConfig() {
  try {
    const settings = await getSettings()
    // 优先用用户设置的代理
    if (settings.proxyUrl) {
      return parseProxyUrl(settings.proxyUrl)
    }
    // 其次用环境变量
    const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
    if (envProxy) {
      return parseProxyUrl(envProxy)
    }
  } catch (e) {
    logger.warn('获取代理配置失败:', e.message)
  }
  return null
}

function parseProxyUrl(url) {
  try {
    // 支持格式: http://127.0.0.1:7897, socks5://127.0.0.1:7890, 127.0.0.1:7897
    let host = url
    let port = 7890
    let protocol = 'http'
    
    if (url.startsWith('http://')) {
      protocol = 'http'
      url = url.slice(7)
    } else if (url.startsWith('https://')) {
      protocol = 'https'
      url = url.slice(8)
    } else if (url.startsWith('socks5://')) {
      protocol = 'socks5'
      url = url.slice(9)
    }
    
    const parts = url.split(':')
    if (parts.length >= 2) {
      host = parts[0]
      port = parseInt(parts[1], 10)
    } else {
      host = url
    }
    
    return { host, port, protocol }
  } catch (e) {
    return null
  }
}

setProxyHelpers(getProxyConfig, parseProxyUrl)
setTranslateProxyHelper(getProxyConfig)

async function asmrOneGet(url, retries = 5) {
  const proxy = await getProxyConfig()
  let lastError = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const axiosConfig = {
        headers: asmrOneHeaders,
        timeout: 15000,
      }
      if (proxy) {
        if (proxy.protocol === 'socks5') {
          // socks5 需要用 socks-proxy-agent，暂时不支持，提示用户用 http 代理
          logger.warn('Socks5 代理暂不支持，请使用 HTTP 代理')
        } else {
          axiosConfig.proxy = {
            host: proxy.host,
            port: proxy.port,
            protocol: proxy.protocol,
          }
          logger.info('使用代理:', `${proxy.protocol}://${proxy.host}:${proxy.port}`)
        }
      }
      const res = await axios.get(url, axiosConfig)
      return res
    } catch (e) {
      lastError = e
      const isRetryable = e.code === 'ECONNRESET' || 
                         e.code === 'ECONNREFUSED' ||
                         e.code === 'ETIMEDOUT' ||
                         e.code === 'ECONNABORTED' ||
                         e.code === 'ERR_NETWORK' ||
                         e.code === 'EPIPE' ||
                         (e.response && e.response.status >= 500)
      
      if (!isRetryable || attempt >= retries - 1) {
        break
      }
      logger.info(`asmrOneGet 重试第 ${attempt + 1}/${retries - 1} 次，错误: ${e.code}`)
      // 指数退避：1s, 2s, 3s, 4s
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

ipcMain.handle('asmrOne:getWorks', async (_, params = {}) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      order = 'create_date',
      sort = 'desc',
      subtitle = 0,
      keyword = ''
    } = params
    
    let url
    if (keyword) {
      url = `${ASMR_ONE_API_BASE}/search/${encodeURIComponent(keyword)}?order=${order}&sort=${sort}&page=${page}&pageSize=${pageSize}&subtitle=${subtitle}&includeTranslationWorks=true`
    } else {
      url = `${ASMR_ONE_API_BASE}/works?order=${order}&sort=${sort}&page=${page}&pageSize=${pageSize}&subtitle=${subtitle}`
    }
    
    const res = await asmrOneGet(url)
    return {
      works: res.data.works || [],
      pagination: res.data.pagination || { currentPage: page, pageSize, totalCount: 0 }
    }
  } catch (e) {
    logger.error('Failed to fetch asmr.one works:', e.message)
    throw new Error(e.message || '获取作品列表失败')
  }
})

ipcMain.handle('asmrOne:getWorkInfo', async (_, workId) => {
  try {
    const res = await asmrOneGet(`${ASMR_ONE_API_BASE}/workInfo/${workId}`)
    return res.data
  } catch (e) {
    logger.error('Failed to fetch asmr.one work info:', workId, e.message)
    throw new Error(e.message || '获取作品详情失败')
  }
})

ipcMain.handle('asmrOne:getTracks', async (_, workId) => {
  try {
    const res = await asmrOneGet(`${ASMR_ONE_API_BASE}/tracks/${workId}?v=2`)
    let data = res.data
    
    // 调试日志
    logger.info('Tracks API response type:', typeof data, 'isArray:', Array.isArray(data))
    if (data && typeof data === 'object') {
      const keys = Object.keys(data)
      logger.info('Tracks API keys:', JSON.stringify(keys.slice(0, 10)))
      // 打印第一个元素的结构
      const firstItem = Array.isArray(data) ? data[0] : data[keys[0]]
      if (firstItem && typeof firstItem === 'object') {
        logger.info('Tracks first item keys:', JSON.stringify(Object.keys(firstItem)))
        logger.info('Tracks first item type:', firstItem.type)
      }
    }
    
    // 统一转换成数组
    if (!Array.isArray(data)) {
      if (data && Array.isArray(data.tracks)) {
        data = data.tracks
      } else if (data && Array.isArray(data.data)) {
        data = data.data
      } else if (data && Array.isArray(data.list)) {
        data = data.list
      } else if (data && typeof data === 'object') {
        // 可能是类数组对象，转换成数组
        const keys = Object.keys(data)
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
          data = keys.map(k => data[k])
          logger.info('Converted array-like object to array, length:', data.length)
        } else {
          logger.warn('Unknown tracks response format, keys:', keys)
          data = []
        }
      } else {
        data = []
      }
    }
    
    return data
  } catch (e) {
    logger.error('Failed to fetch asmr.one tracks:', workId, e.message)
    throw new Error(e.message || '获取曲目列表失败')
  }
})

ipcMain.handle('asmrOne:getTags', async () => {
  try {
    const res = await asmrOneGet(`${ASMR_ONE_API_BASE}/tags/`)
    return res.data
  } catch (e) {
    logger.error('Failed to fetch asmr.one tags:', e.message)
    throw new Error(e.message || '获取标签列表失败')
  }
})

ipcMain.handle('fs:readAudioBuffer', async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    return arrayBuffer
  } catch (e) {
    logger.error('Failed to read audio buffer:', filePath, e.message)
    return null
  }
})

ipcMain.handle('fs:getAudioDuration', async (_, filePath) => {
  try {
    const pf = await getParseFile()
    const metadata = await pf(filePath, { duration: true })
    return metadata.format.duration || 0
  } catch (e) {
    logger.error('Failed to read audio duration:', filePath, e.message)
    return 0
  }
})

// 全局下载取消控制器
let downloadAbortController = null

// 下载队列的取消控制器集合（支持多线程并发取消）
let activeAbortControllers = new Set()

// ===== ASMR-One 文件下载 =====
// 下载单个文件到指定目录，支持进度回调
ipcMain.handle('asmrOne:downloadFile', async (event, { url, savePath, fileName }) => {
  try {
    logger.info('[下载] 开始:', fileName)
    logger.info('[下载] URL:', url)
    logger.info('[下载] 目录:', savePath)
    
    const targetDir = savePath
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    const finalPath = path.join(targetDir, fileName)
    logger.info('[下载] 完整路径:', finalPath)

    // 创建取消控制器
    downloadAbortController = new AbortController()
    const signal = downloadAbortController.signal

    logger.info('[下载] 发起请求...')
    const proxy = await getProxyConfig()
    const axiosConfig = {
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: asmrOneHeaders,
      timeout: 60000,
      signal: signal,
    }
    if (proxy && proxy.protocol !== 'socks5') {
      axiosConfig.proxy = {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
      }
      logger.info('[下载] 使用代理:', `${proxy.protocol}://${proxy.host}:${proxy.port}`)
    }
    const response = await axios(axiosConfig)
    
    logger.info('[下载] 响应状态:', response.status)
    logger.info('[下载] Content-Length:', response.headers['content-length'])

    const totalLength = parseInt(response.headers['content-length'] || 0, 10)
    let downloaded = 0
    const writer = fs.createWriteStream(finalPath)
    let lastProgressTime = 0
    let lastDownloadedBytes = 0

    response.data.on('data', (chunk) => {
      downloaded += chunk.length
      const now = Date.now()
      if (now - lastProgressTime >= 300 || downloaded === totalLength) {
        const elapsed = lastProgressTime ? (now - lastProgressTime) / 1000 : 0
        const speed = elapsed > 0 ? (downloaded - lastDownloadedBytes) / elapsed : 0
        const progress = totalLength > 0 ? Math.round((downloaded / totalLength) * 100) : 0
        try {
          event.sender.send('download:progress', { 
            fileName, 
            progress, 
            downloaded, 
            totalLength,
            speed: Math.round(speed)
          })
        } catch (_) {}
        lastProgressTime = now
        lastDownloadedBytes = downloaded
      }
    })

    response.data.pipe(writer)

    // 监听取消信号
    const onAbort = () => {
      logger.info('[下载] 用户取消:', fileName)
      if (response.data && response.data.destroy) {
        response.data.destroy()
      }
      if (writer && writer.destroy) {
        writer.destroy()
      }
    }
    signal.addEventListener('abort', onAbort)

    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info('[下载] 完成:', fileName, '共', downloaded, '字节')
        signal.removeEventListener('abort', onAbort)
        try {
          event.sender.send('download:progress', { 
            fileName, progress: 100, downloaded, totalLength, speed: 0
          })
        } catch (_) {}
        resolve()
      })
      writer.on('error', (err) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) {
          reject(new Error('已取消'))
        } else {
          logger.error('[下载] 写入错误:', err.message)
          reject(err)
        }
      })
      response.data.on('error', (err) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) {
          reject(new Error('已取消'))
        } else {
          logger.error('[下载] 响应流错误:', err.message)
          reject(err)
        }
      })
    })

    downloadAbortController = null
    return { success: true, path: finalPath, size: downloaded }
  } catch (e) {
    downloadAbortController = null
    logger.error('[下载] 失败:', fileName, e.message, e.code)
    return { success: false, error: e.message || '下载失败', cancelled: e.message === '已取消' }
  }
})

// 取消当前下载
ipcMain.handle('asmrOne:cancelDownload', async () => {
  if (downloadAbortController) {
    downloadAbortController.abort()
    return true
  }
  return false
})

// 选择下载目录
ipcMain.handle('dialog:selectDownloadDir', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  } catch (e) {
    logger.error('Select download dir failed:', e.message)
    return null
  }
})

// ========== 下载队列管理 ==========

/**
 * 下载任务结构:
 * {
 *   id: string,
 *   workId: string,
 *   workTitle: string,
 *   workCover: string,
 *   rjCode: string,
 *   files: Array<{
 *     url: string,
 *     fileName: string,
 *     savePath: string,
 *     size: number,
 *     status: 'pending' | 'downloading' | 'done' | 'failed' | 'cancelled',
 *     progress: number,
 *     downloaded: number,
 *     totalLength: number,
 *     speed: number,
 *     error: string,
 *   }>,
 *   status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled',
 *   currentIndex: number,
 *   createdAt: number,
 * }
 */

const downloadQueue = []
let activeDownloadTask = null
let taskIdCounter = 0

function generateTaskId() {
  taskIdCounter++
  return `task_${Date.now()}_${taskIdCounter}`
}

function broadcastDownloadState() {
  if (!mainWindow) return
  try {
    mainWindow.webContents.send('download:state', {
      queue: downloadQueue,
      active: activeDownloadTask,
    })
  } catch (e) {}
}

async function downloadFileInTask(task, file, fileIndex) {
  return new Promise(async (resolve, reject) => {
    try {
      const targetDir = file.savePath
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      const finalPath = path.join(targetDir, file.fileName)

      const abortController = new AbortController()
      activeAbortControllers.add(abortController)
      const signal = abortController.signal

      const proxy = await getProxyConfig()
      const axiosConfig = {
        method: 'GET',
        url: file.url,
        responseType: 'stream',
        headers: asmrOneHeaders,
        timeout: 60000,
        signal: signal,
      }
      if (proxy && proxy.protocol !== 'socks5') {
        axiosConfig.proxy = {
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.protocol,
        }
      }

      const response = await axios(axiosConfig)
      const totalLength = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0
      const writer = fs.createWriteStream(finalPath)
      let lastProgressTime = 0
      let lastDownloadedBytes = 0

      file.status = 'downloading'
      file.totalLength = totalLength
      file.downloaded = 0
      file.progress = 0
      file.speed = 0

      response.data.on('data', (chunk) => {
        downloaded += chunk.length
        file.downloaded = downloaded
        const now = Date.now()
        if (now - lastProgressTime >= 300 || downloaded === totalLength) {
          const elapsed = lastProgressTime ? (now - lastProgressTime) / 1000 : 0
          const speed = elapsed > 0 ? (downloaded - lastDownloadedBytes) / elapsed : 0
          const progress = totalLength > 0 ? Math.round((downloaded / totalLength) * 100) : 0
          file.progress = progress
          file.speed = Math.round(speed)
          lastProgressTime = now
          lastDownloadedBytes = downloaded
          broadcastDownloadState()
        }
      })

      response.data.pipe(writer)

      const onAbort = () => {
        if (response.data && response.data.destroy) response.data.destroy()
        if (writer && writer.destroy) writer.destroy()
      }
      signal.addEventListener('abort', onAbort)

      const cleanup = () => {
        signal.removeEventListener('abort', onAbort)
        activeAbortControllers.delete(abortController)
      }

      writer.on('finish', () => {
        cleanup()
        file.status = 'done'
        file.progress = 100
        file.speed = 0
        broadcastDownloadState()
        resolve({ success: true, path: finalPath, size: downloaded })
      })

      writer.on('error', (err) => {
        cleanup()
        if (signal.aborted) {
          file.status = 'cancelled'
          file.error = '已取消'
          reject(new Error('已取消'))
        } else {
          file.status = 'failed'
          file.error = err.message
          reject(err)
        }
      })

      response.data.on('error', (err) => {
        cleanup()
        if (signal.aborted) {
          file.status = 'cancelled'
          file.error = '已取消'
          reject(new Error('已取消'))
        } else {
          file.status = 'failed'
          file.error = err.message
          reject(err)
        }
      })
    } catch (e) {
      file.status = 'failed'
      file.error = e.message || '下载失败'
      reject(e)
    }
  })
}

async function processDownloadQueue() {
  if (activeDownloadTask) return
  if (downloadQueue.length === 0) return

  const task = downloadQueue.shift()
  activeDownloadTask = task
  task.status = 'downloading'
  broadcastDownloadState()

  logger.info(`[下载队列] 开始任务: ${task.workTitle}, 共 ${task.files.length} 个文件`)

  try {
    const settings = await getSettings()
    const maxConcurrent = settings.downloadConcurrency || 3

    const pendingFiles = task.files.filter(f => f.status !== 'done')
    let cancelled = false

    async function downloadWorker() {
      while (pendingFiles.length > 0 && !cancelled) {
        const file = pendingFiles.shift()
        if (!file) break
        
        task.currentIndex = task.files.indexOf(file)
        broadcastDownloadState()

        try {
          await downloadFileInTask(task, file, task.currentIndex)
        } catch (e) {
          if (file.status === 'cancelled') {
            cancelled = true
            logger.info(`[下载队列] 任务取消: ${task.workTitle}`)
            break
          }
          logger.warn(`[下载队列] 文件失败: ${file.fileName}, ${e.message}`)
        }
      }
    }

    const concurrency = Math.min(maxConcurrent, pendingFiles.length)
    const workers = Array.from({ length: concurrency }, () => downloadWorker())
    await Promise.all(workers)

    if (task.status !== 'cancelled') {
      const allDone = task.files.every((f) => f.status === 'done')
      const anyFailed = task.files.some((f) => f.status === 'failed')
      if (allDone) {
        task.status = 'completed'
        task.completedAt = Date.now()
        logger.info(`[下载队列] 任务完成: ${task.workTitle}`)
        if (mainWindow) {
          mainWindow.webContents.send('download:taskComplete', {
            taskId: task.id,
            workTitle: task.workTitle,
            workCover: task.workCover,
            saveDir: task.saveDir,
            workFolder: task.workFolder,
            rjCode: task.rjCode,
            workCircle: task.workCircle,
            workVAs: task.workVAs,
            workTags: task.workTags,
          })
        }
      } else if (anyFailed) {
        task.status = 'failed'
        task.completedAt = Date.now()
        logger.warn(`[下载队列] 任务部分失败: ${task.workTitle}`)
        if (mainWindow) {
          mainWindow.webContents.send('download:taskFailed', {
            taskId: task.id,
            workTitle: task.workTitle,
            failedCount: task.files.filter(f => f.status === 'failed').length,
          })
        }
      }
    }
  } catch (e) {
    task.status = 'failed'
    task.completedAt = Date.now()
    logger.error(`[下载队列] 任务出错: ${task.workTitle}, ${e.message}`)
  }

  // Re-add the finished task to the queue so it stays visible in the UI and
  // remains actionable by download:retryTask / download:removeTask /
  // download:clearCompleted (which all look up tasks in downloadQueue).
  downloadQueue.push(task)

  activeDownloadTask = null
  activeAbortControllers.clear()
  broadcastDownloadState()

  processDownloadQueue()
}

// 添加下载任务
ipcMain.handle('download:addTask', async (event, { work, files, saveDir }) => {
  const taskId = generateTaskId()
  const workFolder = work.rjCode || (work.onlineId ? `RJ${work.onlineId}` : work.title || 'download')

  const taskFiles = files.map((f) => {
    const subDir = f.path ? `${saveDir}/${workFolder}/${f.path}` : `${saveDir}/${workFolder}`
    return {
      url: f.url,
      fileName: f.title,
      savePath: subDir,
      size: f.size || 0,
      status: 'pending',
      progress: 0,
      downloaded: 0,
      totalLength: 0,
      speed: 0,
      error: '',
    }
  })

  const task = {
    id: taskId,
    workId: work.id || work.onlineId || '',
    workTitle: work.title || '',
    workCover: work.cover || '',
    rjCode: work.rjCode || '',
    workCircle: work.circle || '',
    workVAs: work.vas || [],
    workTags: work.tags || [],
    saveDir: saveDir || '',
    workFolder: workFolder,
    files: taskFiles,
    status: 'queued',
    currentIndex: 0,
    createdAt: Date.now(),
    completedAt: null,
  }

  downloadQueue.push(task)
  logger.info(`[下载队列] 添加任务: ${task.workTitle}, 共 ${taskFiles.length} 个文件, 队列长度: ${downloadQueue.length}`)
  broadcastDownloadState()

  processDownloadQueue()

  return taskId
})

// 获取下载状态
ipcMain.handle('download:getState', async () => {
  return {
    queue: downloadQueue,
    active: activeDownloadTask,
  }
})

// 取消下载任务
ipcMain.handle('download:cancelTask', async (_, taskId) => {
  if (activeDownloadTask && activeDownloadTask.id === taskId) {
    // 取消所有正在进行的下载
    for (const controller of activeAbortControllers) {
      try { controller.abort() } catch (e) {}
    }
    activeAbortControllers.clear()
    return true
  }
  const idx = downloadQueue.findIndex((t) => t.id === taskId)
  if (idx >= 0) {
    const task = downloadQueue[idx]
    task.status = 'cancelled'
    task.files.forEach((f) => {
      if (f.status === 'pending') f.status = 'cancelled'
    })
    downloadQueue.splice(idx, 1)
    broadcastDownloadState()
    return true
  }
  return false
})

// 删除已完成的任务
ipcMain.handle('download:removeTask', async (_, taskId) => {
  const idx = downloadQueue.findIndex((t) => t.id === taskId)
  if (idx >= 0) {
    downloadQueue.splice(idx, 1)
    broadcastDownloadState()
    return true
  }
  return false
})

// 清空已完成的任务
ipcMain.handle('download:clearCompleted', async () => {
  for (let i = downloadQueue.length - 1; i >= 0; i--) {
    const task = downloadQueue[i]
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      downloadQueue.splice(i, 1)
    }
  }
  broadcastDownloadState()
  return true
})

// 重试整个任务
ipcMain.handle('download:retryTask', async (_, taskId) => {
  let targetTask = null
  let taskIndex = -1

  if (activeDownloadTask && activeDownloadTask.id === taskId) {
    return false
  }

  taskIndex = downloadQueue.findIndex((t) => t.id === taskId)
  if (taskIndex >= 0) {
    targetTask = downloadQueue[taskIndex]
  }

  if (!targetTask) return false
  if (targetTask.status !== 'failed') return false

  targetTask.files.forEach((f) => {
    if (f.status === 'failed') {
      f.status = 'pending'
      f.progress = 0
      f.downloaded = 0
      f.speed = 0
      f.error = ''
    }
  })

  targetTask.status = 'queued'
  targetTask.completedAt = null
  targetTask.currentIndex = 0

  logger.info(`[下载队列] 重试任务: ${targetTask.workTitle}`)
  broadcastDownloadState()
  processDownloadQueue()

  return true
})

// 重试单个文件
ipcMain.handle('download:retryFile', async (_, taskId, fileIndex) => {
  let targetTask = null
  let isActive = false

  if (activeDownloadTask && activeDownloadTask.id === taskId) {
    targetTask = activeDownloadTask
    isActive = true
  } else {
    const idx = downloadQueue.findIndex((t) => t.id === taskId)
    if (idx >= 0) {
      targetTask = downloadQueue[idx]
    }
  }

  if (!targetTask) return false
  if (!targetTask.files[fileIndex]) return false

  const file = targetTask.files[fileIndex]
  if (file.status !== 'failed') return false

  file.status = 'pending'
  file.progress = 0
  file.downloaded = 0
  file.speed = 0
  file.error = ''

  if (targetTask.status === 'failed') {
    targetTask.status = 'queued'
    targetTask.completedAt = null
  }

  logger.info(`[下载队列] 重试文件: ${targetTask.workTitle} - ${file.fileName}`)
  broadcastDownloadState()

  if (!isActive) {
    processDownloadQueue()
  }

  return true
})

// ========== 迷你播放器 ==========

ipcMain.handle('miniPlayer:open', () => {
  createMiniWindow()
  return true
})

ipcMain.handle('miniPlayer:close', () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close()
  }
  return true
})

ipcMain.handle('miniPlayer:isOpen', () => {
  return miniWindow && !miniWindow.isDestroyed()
})

ipcMain.handle('miniPlayer:updateState', (_, state) => {
  miniPlayerState = { ...miniPlayerState, ...state }
  broadcastToMini('miniPlayer:stateUpdate', miniPlayerState)
  return true
})

ipcMain.handle('miniPlayer:getState', () => {
  return miniPlayerState
})

ipcMain.handle('miniPlayer:togglePlay', () => {
  broadcastToMain('miniPlayer:togglePlay')
  return true
})

ipcMain.handle('miniPlayer:prevTrack', () => {
  broadcastToMain('miniPlayer:prevTrack')
  return true
})

ipcMain.handle('miniPlayer:nextTrack', () => {
  broadcastToMain('miniPlayer:nextTrack')
  return true
})

ipcMain.handle('miniPlayer:showMain', () => {
  showMainWindow()
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close()
  }
  return true
})

ipcMain.handle('miniPlayer:startDrag', () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.startDrag()
  }
  return true
})
