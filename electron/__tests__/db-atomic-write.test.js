const fs = require('fs')
const path = require('path')
const os = require('os')

const testData = {
  works: [{ id: 'test1', title: 'Test Work' }],
  progress: {},
  history: [],
  settings: {},
  playlists: [],
  favorites: [],
  folderGroups: [],
  bookmarks: [],
  subtitles: {},
  translateCache: {},
  playQueue: [],
  lastPlayState: null,
  tagMetadata: {},
}

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
}

let dbData = null
let dbPath = ''

function initDBSync(baseDir) {
  dbPath = path.join(baseDir, 'db.json')
  const tmpPath = dbPath + '.tmp'
  const backupPath = dbPath + '.bak'

  try {
    if (fs.existsSync(tmpPath)) {
      if (fs.existsSync(dbPath)) {
        try {
          const mainContent = fs.readFileSync(dbPath, 'utf-8')
          JSON.parse(mainContent)
          fs.unlinkSync(tmpPath)
        } catch (_) {
          fs.unlinkSync(dbPath)
          fs.renameSync(tmpPath, dbPath)
        }
      } else {
        try {
          const tmpContent = fs.readFileSync(tmpPath, 'utf-8')
          JSON.parse(tmpContent)
          fs.renameSync(tmpPath, dbPath)
        } catch (_) {
          fs.unlinkSync(tmpPath)
        }
      }
    }

    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8')
      dbData = JSON.parse(content)
    } else {
      dbData = JSON.parse(JSON.stringify(defaultData))
      saveDBSync()
    }
  } catch (e) {
    console.error('Init DB error:', e.message)
    if (fs.existsSync(dbPath) && fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf-8')
        dbData = JSON.parse(backupContent)
        console.error('Recovered from backup')
      } catch (e2) {
        console.error('Backup recovery failed:', e2.message)
        dbData = JSON.parse(JSON.stringify(defaultData))
      }
    } else {
      dbData = JSON.parse(JSON.stringify(defaultData))
    }
  }

  return dbData
}

function saveDBSync() {
  try {
    const tmpPath = dbPath + '.tmp'
    const backupPath = dbPath + '.bak'
    const dataStr = JSON.stringify(dbData, null, 2)

    fs.writeFileSync(tmpPath, dataStr, 'utf-8')

    if (fs.existsSync(dbPath)) {
      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath)
        }
        fs.renameSync(dbPath, backupPath)
      } catch (_) {}
    }

    fs.renameSync(tmpPath, dbPath)
  } catch (e) {
    console.error('Save DB error:', e.message)
  }
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('\u2713 ' + name)
  } catch (e) {
    failed++
    console.log('\u2717 ' + name + '\n   ' + e.message)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed')
}

function setupTestDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'))
}

function cleanupTestDir(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// Test 1: Normal write produces valid db.json and no tmp file
test('saveDBSync writes valid JSON to db.json (atomic)', () => {
  const dir = setupTestDir()
  try {
    initDBSync(dir)
    dbData.works.push({ id: 'w1', title: 'Work 1' })
    saveDBSync()

    const dbFile = path.join(dir, 'db.json')
    const tmpFile = dbFile + '.tmp'

    assert(fs.existsSync(dbFile), 'db.json should exist')
    assert(!fs.existsSync(tmpFile), '.tmp file should not exist after successful save')

    const content = fs.readFileSync(dbFile, 'utf-8')
    const parsed = JSON.parse(content)
    assert(parsed.works.length === 1, 'should have 1 work')
    assert(parsed.works[0].id === 'w1', 'work id should match')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 2: Crash during write (tmp file exists, main file corrupted) -> recover from tmp
test('initDBSync recovers from tmp file when main db is corrupted', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const tmpFile = dbFile + '.tmp'

    const goodData = JSON.stringify(testData, null, 2)
    fs.writeFileSync(tmpFile, goodData, 'utf-8')
    fs.writeFileSync(dbFile, '{ corrupted json ', 'utf-8')

    const data = initDBSync(dir)

    assert(data.works.length === 1, 'should recover data from tmp file')
    assert(data.works[0].id === 'test1', 'recovered work id should match')
    assert(fs.existsSync(dbFile), 'db.json should exist after recovery')
    assert(!fs.existsSync(tmpFile), '.tmp file should be cleaned up')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 3: Only tmp file exists (no main file) and tmp is valid -> use tmp
test('initDBSync recovers when only valid tmp file exists', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const tmpFile = dbFile + '.tmp'

    const goodData = JSON.stringify(testData, null, 2)
    fs.writeFileSync(tmpFile, goodData, 'utf-8')

    const data = initDBSync(dir)

    assert(data.works.length === 1, 'should recover from tmp file')
    assert(fs.existsSync(dbFile), 'db.json should exist')
    assert(!fs.existsSync(tmpFile), 'tmp file should be renamed to db.json')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 4: Tmp file exists but is corrupted -> delete tmp and use default
test('initDBSync discards corrupted tmp file', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const tmpFile = dbFile + '.tmp'

    fs.writeFileSync(tmpFile, '{ bad json ', 'utf-8')

    const data = initDBSync(dir)

    assert(Array.isArray(data.works), 'should have default works array')
    assert(data.works.length === 0, 'should be empty default')
    assert(!fs.existsSync(tmpFile), 'corrupted tmp should be deleted')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 5: Multiple saves produce backup file with previous version
test('saveDBSync creates backup on subsequent saves', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const bakFile = dbFile + '.bak'

    initDBSync(dir)
    dbData.works.push({ id: 'w1', title: 'First' })
    saveDBSync()
    const firstContent = fs.readFileSync(dbFile, 'utf-8')

    dbData.works.push({ id: 'w2', title: 'Second' })
    saveDBSync()

    assert(fs.existsSync(bakFile), 'backup file should exist after second save')

    const backupContent = fs.readFileSync(bakFile, 'utf-8')
    assert(backupContent === firstContent, 'backup should contain previous version')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 6: Main file corrupted but backup exists -> recover from backup
test('initDBSync recovers from backup when main file is corrupted', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const bakFile = dbFile + '.bak'

    const backupData = JSON.stringify({ ...testData, works: [{ id: 'backup', title: 'Backup Work' }] }, null, 2)
    fs.writeFileSync(bakFile, backupData, 'utf-8')
    fs.writeFileSync(dbFile, '{ totally corrupted ', 'utf-8')

    const data = initDBSync(dir)

    assert(data.works.length === 1, 'should recover from backup')
    assert(data.works[0].id === 'backup', 'recovered work should be from backup')
  } finally {
    cleanupTestDir(dir)
  }
})

// Test 7: Main file valid and tmp file also valid -> use main and clean up tmp
test('initDBSync keeps main file and cleans up tmp when both are valid', () => {
  const dir = setupTestDir()
  try {
    const dbFile = path.join(dir, 'db.json')
    const tmpFile = dbFile + '.tmp'

    const mainData = JSON.stringify({ ...testData, works: [{ id: 'main', title: 'Main Work' }] }, null, 2)
    const tmpData = JSON.stringify({ ...testData, works: [{ id: 'tmp', title: 'Tmp Work' }] }, null, 2)
    fs.writeFileSync(dbFile, mainData, 'utf-8')
    fs.writeFileSync(tmpFile, tmpData, 'utf-8')

    const data = initDBSync(dir)

    assert(data.works.length === 1, 'should have 1 work')
    assert(data.works[0].id === 'main', 'should use main file when it is valid')
    assert(!fs.existsSync(tmpFile), 'tmp file should be cleaned up')
  } finally {
    cleanupTestDir(dir)
  }
})

console.log('\n' + passed + ' passed, ' + failed + ' failed')
if (failed > 0) process.exitCode = 1
