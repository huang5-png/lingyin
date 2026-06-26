const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const { initDB, getAllWorks, addWork, updateWork, deleteWork, getProgress, saveProgress, getSubtitle, saveSubtitle, getSettings, saveSettings } = require('./db')
const { searchDLsite, getWorkDetail, extractRJCode } = require('./dlsite')
const logger = require('./logger')

let parseFile = null
async function getParseFile() {
  if (!parseFile) {
    const mm = await import('music-metadata')
    parseFile = mm.parseFile
  }
  return parseFile
}

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#0a0a1a',
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  
  mainWindow.setTitle('聆音')

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  logger.info('App closing')
  if (process.platform !== 'darwin') {
    app.quit()
    setTimeout(() => {
      process.exit(0)
    }, 500)
  }
})

app.on('before-quit', (e) => {
  logger.info('App before quit')
  if (mainWindow) {
    mainWindow.removeAllListeners('closed')
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

const ASMR_ONE_API_BASE = 'https://api.asmr-200.com/api'

const asmrOneAxiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://asmr.one/',
    'Origin': 'https://asmr.one',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
  timeout: 15000,
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
    
    const res = await axios.get(url, asmrOneAxiosConfig)
    return res.data
  } catch (e) {
    logger.error('Failed to fetch asmr.one works:', e.message)
    throw new Error(e.message || '获取作品列表失败')
  }
})

ipcMain.handle('asmrOne:getWorkInfo', async (_, workId) => {
  try {
    const res = await axios.get(`${ASMR_ONE_API_BASE}/workInfo/${workId}`, asmrOneAxiosConfig)
    return res.data
  } catch (e) {
    logger.error('Failed to fetch asmr.one work info:', workId, e.message)
    throw new Error(e.message || '获取作品详情失败')
  }
})

ipcMain.handle('asmrOne:getTracks', async (_, workId) => {
  try {
    const res = await axios.get(`${ASMR_ONE_API_BASE}/tracks/${workId}?v=2`, asmrOneAxiosConfig)
    return res.data
  } catch (e) {
    logger.error('Failed to fetch asmr.one tracks:', workId, e.message)
    throw new Error(e.message || '获取曲目列表失败')
  }
})

ipcMain.handle('asmrOne:getTags', async () => {
  try {
    const res = await axios.get(`${ASMR_ONE_API_BASE}/tags/`, asmrOneAxiosConfig)
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
