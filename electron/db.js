const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let dbData = null
let dbPath = ''
let writeQueue = []
let isWriting = false
let pendingWrite = false

async function initDB() {
  dbPath = path.join(app.getPath('userData'), 'db.json')

  const defaultData = {
    works: [],
    progress: {},
    subtitles: {},
    settings: {},
  }

  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8')
      dbData = JSON.parse(content)
    } else {
      dbData = defaultData
      await saveDBAsync()
    }
  } catch (e) {
    console.error('Init DB error:', e)
    dbData = defaultData
  }

  return dbData
}

async function saveDBAsync() {
  return new Promise((resolve) => {
    writeQueue.push(resolve)
    processWriteQueue()
  })
}

function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return

  isWriting = true
  const resolvers = [...writeQueue]
  writeQueue = []

  const dataToWrite = JSON.stringify(dbData, null, 2)

  fs.writeFile(dbPath, dataToWrite, 'utf-8', (err) => {
    if (err) {
      console.error('Save DB error:', err)
    }
    isWriting = false
    resolvers.forEach(r => r())
    if (writeQueue.length > 0) {
      processWriteQueue()
    }
  })
}

function saveDB() {
  pendingWrite = true
  if (!isWriting) {
    saveDBAsync()
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
  await saveDBAsync()
  return work
}

async function updateWork(id, data) {
  const work = dbData.works.find((w) => w.id === id)
  if (work) {
    Object.assign(work, data, { updatedAt: Date.now() })
    await saveDBAsync()
    return work
  }
  return null
}

async function deleteWork(id) {
  const index = dbData.works.findIndex((w) => w.id === id)
  if (index > -1) {
    dbData.works.splice(index, 1)
    await saveDBAsync()
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
  await saveDBAsync()
  return true
}

async function getSubtitle(workId, audioFile) {
  const key = `${workId}::${audioFile}`
  return dbData.subtitles[key] || null
}

async function saveSubtitle(workId, audioFile, subtitleData) {
  const key = `${workId}::${audioFile}`
  if (subtitleData === null) {
    delete dbData.subtitles[key]
  } else {
    dbData.subtitles[key] = {
      ...subtitleData,
      savedAt: Date.now(),
    }
  }
  await saveDBAsync()
  return true
}

async function getSettings() {
  return dbData.settings || {}
}

async function saveSettings(settings) {
  dbData.settings = { ...dbData.settings, ...settings }
  await saveDBAsync()
  return dbData.settings
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
  saveDBAsync,
}
