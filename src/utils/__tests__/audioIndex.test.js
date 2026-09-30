import { describe, it, expect } from 'vitest'
import {
  buildAudioFilesMap,
  buildIndexPayload,
  getWorkAudioFiles,
  isWorkIndexed,
  normalizeAudioEntry,
  normalizeAudioList,
  pickUnindexedWorks,
  sortAudioEntries,
} from '../audioIndex.js'

const audio = (name, extra = {}) => ({
  name,
  path: `F:\\library\\作品A\\${name}`,
  relativePath: name,
  displayName: name,
  ...extra,
})

describe('normalizeAudioEntry', () => {
  it('保留索引所需字段', () => {
    const entry = normalizeAudioEntry({
      name: '01.mp3',
      path: 'F:\\lib\\A\\01.mp3',
      relativePath: '第一幕\\01.mp3',
      displayName: '第一幕 / 01.mp3',
      duration: 120,
      isFile: true,
    })
    expect(entry).toEqual({
      name: '01.mp3',
      path: 'F:\\lib\\A\\01.mp3',
      relativePath: '第一幕\\01.mp3',
      displayName: '第一幕 / 01.mp3',
    })
  })

  it('缺少 displayName 时由 relativePath 推导', () => {
    const entry = normalizeAudioEntry({
      name: '01.mp3',
      path: 'F:\\lib\\A\\01.mp3',
      relativePath: '第一幕\\01.mp3',
    })
    expect(entry.displayName).toBe('第一幕 / 01.mp3')
  })

  it('只有 name 时回填 path 与 relativePath', () => {
    const entry = normalizeAudioEntry({ name: '02.mp3' })
    expect(entry).toEqual({
      name: '02.mp3',
      path: '02.mp3',
      relativePath: '02.mp3',
      displayName: '02.mp3',
    })
  })

  it('空对象与 null 返回 null', () => {
    expect(normalizeAudioEntry(null)).toBeNull()
    expect(normalizeAudioEntry({})).toBeNull()
  })
})

describe('normalizeAudioList', () => {
  it('过滤无效项', () => {
    const list = normalizeAudioList([audio('01.mp3'), null, {}, audio('02.mp3')])
    expect(list.map((a) => a.name)).toEqual(['01.mp3', '02.mp3'])
  })

  it('非数组返回空数组', () => {
    expect(normalizeAudioList(undefined)).toEqual([])
    expect(normalizeAudioList('x')).toEqual([])
  })
})

describe('sortAudioEntries', () => {
  it('按自然顺序排列（02 在 10 前面）', () => {
    const list = [audio('10.mp3'), audio('02.mp3'), audio('01.mp3')]
    expect(sortAudioEntries(list).map((a) => a.name)).toEqual(['01.mp3', '02.mp3', '10.mp3'])
  })
})

describe('isWorkIndexed / getWorkAudioFiles', () => {
  it('audioFiles 非空视为已索引', () => {
    expect(isWorkIndexed({ audioFiles: [audio('01.mp3')] })).toBe(true)
    expect(isWorkIndexed({ audioFiles: [] })).toBe(false)
    expect(isWorkIndexed({ audioCount: 3 })).toBe(false)
    expect(isWorkIndexed(null)).toBe(false)
  })

  it('未索引作品返回空数组', () => {
    expect(getWorkAudioFiles({ audioCount: 3 })).toEqual([])
    expect(getWorkAudioFiles({ audioFiles: [audio('01.mp3')] })).toHaveLength(1)
  })
})

describe('pickUnindexedWorks', () => {
  const indexed = { id: 'a', folderPath: 'F:\\a', audioFiles: [audio('01.mp3')] }
  const plain = { id: 'b', folderPath: 'F:\\b', audioCount: 2 }
  const online = { id: 'c', isOnline: true }
  const noPath = { id: 'd' }

  it('只挑出未索引的本地作品', () => {
    const picked = pickUnindexedWorks([indexed, plain, online, noPath])
    expect(picked.map((w) => w.id)).toEqual(['b'])
  })

  it('跳过已尝试过的作品', () => {
    const attempted = new Set(['b'])
    expect(pickUnindexedWorks([indexed, plain], attempted)).toEqual([])
  })

  it('非数组返回空数组', () => {
    expect(pickUnindexedWorks(null)).toEqual([])
  })
})

describe('buildAudioFilesMap', () => {
  it('只为已索引作品建立映射', () => {
    const map = buildAudioFilesMap([
      { id: 'a', audioFiles: [audio('01.mp3')] },
      { id: 'b', audioCount: 2 },
      { id: 'c', audioFiles: [] },
    ])
    expect(Object.keys(map)).toEqual(['a'])
    expect(map.a).toHaveLength(1)
  })
})

describe('buildIndexPayload', () => {
  it('归一化、排序并统计数量', () => {
    const payload = buildIndexPayload('a', {
      audioFiles: [audio('10.mp3'), audio('02.mp3'), { bogus: true }],
    })
    expect(payload.workId).toBe('a')
    expect(payload.audioCount).toBe(2)
    expect(payload.audioFiles.map((a) => a.name)).toEqual(['02.mp3', '10.mp3'])
  })

  it('无有效曲目时返回 null', () => {
    expect(buildIndexPayload('a', { audioFiles: [] })).toBeNull()
    expect(buildIndexPayload('a', null)).toBeNull()
    expect(buildIndexPayload('', { audioFiles: [audio('01.mp3')] })).toBeNull()
  })
})
