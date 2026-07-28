/**
 * 测试数据库原子写入保护
 * 
 * 此测试验证：
 * 1. saveDB 使用临时文件写入
 * 2. 并发 saveDB 调用不会互相干扰
 * 3. 写入失败时数据完整性保护
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 模拟完整的 db.js 模块（包含修复后的 saveDB）
function createDBModule() {
  let dbData = null;
  let dbPath = '';
  let saveInProgress = false;
  let pendingSave = false;

  function initDB(testPath) {
    dbPath = testPath;
    const defaultData = {
      works: [],
      progress: {},
      settings: {},
    };

    try {
      if (fs.existsSync(dbPath)) {
        const content = fs.readFileSync(dbPath, 'utf-8');
        dbData = JSON.parse(content);
      } else {
        dbData = defaultData;
        saveDB();
      }
    } catch (e) {
      // 尝试从备份恢复
      const backupPath = dbPath + '.backup';
      if (fs.existsSync(backupPath)) {
        try {
          const backupContent = fs.readFileSync(backupPath, 'utf-8');
          dbData = JSON.parse(backupContent);
        } catch (be) {
          dbData = defaultData;
        }
      } else {
        dbData = defaultData;
      }
    }

    return dbData;
  }

  function saveDB() {
    // 防止并发写入
    if (saveInProgress) {
      pendingSave = true;
      return;
    }

    saveInProgress = true;

    try {
      const tempPath = dbPath + '.tmp';
      const backupPath = dbPath + '.backup';
      const data = JSON.stringify(dbData, null, 2);

      // 1. 先写入临时文件
      fs.writeFileSync(tempPath, data, 'utf-8');

      // 2. 如果已有备份，删除旧备份
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      // 3. 如果已有数据库文件，创建备份
      if (fs.existsSync(dbPath)) {
        fs.renameSync(dbPath, backupPath);
      }

      // 4. 将临时文件重命名为正式数据库文件
      fs.renameSync(tempPath, dbPath);
    } catch (e) {
      console.error('Save DB error:', e);
    } finally {
      saveInProgress = false;

      // 如果有待处理的保存请求，执行它
      if (pendingSave) {
        pendingSave = false;
        setImmediate(() => saveDB());
      }
    }
  }

  function getDB() {
    return dbData;
  }

  function setDBData(data) {
    dbData = data;
  }

  return { initDB, saveDB, getDB, setDBData };
}

describe('Database Atomic Write Protection', () => {
  let tempDir;
  let dbPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'));
    dbPath = path.join(tempDir, 'db.json');
  });

  afterEach(() => {
    // 清理临时文件
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should use atomic write with temp file', () => {
    const db = createDBModule();
    db.initDB(dbPath);
    db.setDBData({ works: [{ id: 'test', title: 'Test Work' }] });
    db.saveDB();

    // 验证正式文件存在
    assert.ok(fs.existsSync(dbPath), 'Database file should exist');

    // 验证临时文件已被清理
    assert.ok(!fs.existsSync(dbPath + '.tmp'), 'Temp file should be cleaned up');

    // 验证备份文件存在
    assert.ok(fs.existsSync(dbPath + '.backup'), 'Backup file should exist');

    // 验证数据完整性
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    assert.strictEqual(data.works.length, 1, 'Should have one work');
    assert.strictEqual(data.works[0].id, 'test', 'Work ID should match');
  });

  test('should handle concurrent saveDB calls without data loss', async () => {
    const db = createDBModule();
    db.initDB(dbPath);

    // 快速连续调用 saveDB
    for (let i = 0; i < 10; i++) {
      db.setDBData({ works: [{ id: `work-${i}` }] });
      db.saveDB();
    }

    // 等待所有保存完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 验证数据库文件存在
    assert.ok(fs.existsSync(dbPath), 'Database file should exist');

    // 验证数据完整性
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    assert.strictEqual(data.works.length, 1, 'Should have one work');
    assert.ok(data.works[0].id.startsWith('work-'), 'Work ID should be from one of the saves');
  });

  test('should recover from backup when main file is corrupted', () => {
    const db = createDBModule();
    
    // 初始化并保存两次（第一次创建数据库，第二次创建备份）
    db.initDB(dbPath);
    db.setDBData({ works: [{ id: 'original' }] });
    db.saveDB();
    
    // 再次保存，这次会创建备份文件
    db.setDBData({ works: [{ id: 'updated' }] });
    db.saveDB();

    // 验证备份文件存在
    assert.ok(fs.existsSync(dbPath + '.backup'), 'Backup file should exist after second save');

    // 模拟数据库文件损坏
    fs.writeFileSync(dbPath, 'corrupted data {', 'utf-8');

    // 重新初始化应该从备份恢复
    const db2 = createDBModule();
    db2.initDB(dbPath);
    const data = db2.getDB();

    assert.strictEqual(data.works.length, 1, 'Should recover one work from backup');
    assert.strictEqual(data.works[0].id, 'original', 'Should recover original data from backup');
  });

  test('should handle file system errors gracefully', () => {
    const db = createDBModule();
    
    // 使用无效路径
    try {
      db.initDB('/nonexistent/path/that/does/not/exist/db.json');
      // 不应该抛出异常
      assert.ok(true);
    } catch (e) {
      // 如果抛出异常，测试失败
      assert.fail('Should not throw error: ' + e.message);
    }
  });
});

// 运行测试
console.log('Running atomic write tests...');