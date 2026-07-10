const path = require('path')
const fs = require('fs')
const os = require('os')

const { initDB, saveDB, addWork, appendHistory, importData, getAllWorks, getDB } = require('../db')

let testDbPath = ''

beforeEach(async () => {
  testDbPath = path.join(os.tmpdir(), 'lingyin-test-db')
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { recursive: true })
  }
  await initDB()
})

afterEach(() => {
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { recursive: true })
  }
})

describe('db concurrency', () => {
  it('should handle concurrent writes without data loss', async () => {
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(addWork({
        id: `work_${i}`,
        title: `Work ${i}`,
        folderPath: `/path/to/work/${i}`,
      }))
    }
    await Promise.all(promises)
    const works = await getAllWorks()
    expect(works.length).toBe(10)
  })

  it('should handle concurrent history appends', async () => {
    const promises = []
    for (let i = 0; i < 100; i++) {
      promises.push(appendHistory({
        workId: 'test_work',
        audioFile: 'audio.mp3',
        seconds: 60,
        title: 'Test',
      }))
    }
    await Promise.all(promises)
    const db = getDB()
    expect(db.history.length).toBe(100)
  })
})

describe('importData merge mode', () => {
  it('should not overwrite array with object', async () => {
    await addWork({
      id: 'existing_work',
      title: 'Existing',
      folderPath: '/path',
    })

    const importDataStr = JSON.stringify({
      app: 'lingyin',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        works: {
          invalid: 'data',
        },
      },
    })

    const result = await importData(importDataStr, 'merge')
    expect(result.skippedKeys).toContain('works')
    const works = await getAllWorks()
    expect(works.length).toBe(1)
    expect(works[0].id).toBe('existing_work')
  })

  it('should properly merge objects', async () => {
    const db = getDB()
    db.settings = {
      theme: 'dark',
      volume: 80,
    }
    await saveDB()

    const importDataStr = JSON.stringify({
      app: 'lingyin',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        settings: {
          volume: 100,
          autoPlay: true,
        },
      },
    })

    const result = await importData(importDataStr, 'merge')
    expect(result.importedKeys).toContain('settings')
    const newDb = getDB()
    expect(newDb.settings.theme).toBe('dark')
    expect(newDb.settings.volume).toBe(100)
    expect(newDb.settings.autoPlay).toBe(true)
  })
})