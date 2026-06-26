const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let dbData = null
let dbPath = ''

async function initDB() {
  dbPath = path.join(app.getPath('userData'), 'db.json')
  const tmpPath = dbPath + '.tmp'

  const defaultData = {
    works: [],
    progress: {},
    subtitles: {},
    settings: {},
  }

  try {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath)
      } catch (e) {
        console.warn('Failed to remove stale tmp file:', e.message)
      }
    }

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
    const tmpPath = dbPath + '.tmp'
    const data = JSON.stringify(dbData, null, 2)
    fs.writeFileSync(tmpPath, data, 'utf-8')
    fs.renameSync(tmpPath, dbPath)
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
}
