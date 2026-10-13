import { describe, it, expect } from 'vitest'
import { extractRJCode, needsScraping, isAudioListDifferent } from '../mediaSyncHelpers'

describe('extractRJCode', () => {
  it('提取标准 RJ 码', () => {
    expect(extractRJCode('RJ123456')).toBe('RJ123456')
    expect(extractRJCode('[RJ01234567] 作品名称')).toBe('RJ01234567')
    expect(extractRJCode('rj654321 音频')).toBe('RJ654321')
  })

  it('提取 VJ / BJ 码', () => {
    expect(extractRJCode('VJ01002345')).toBe('VJ01002345')
    expect(extractRJCode('bj999999')).toBe('BJ999999')
  })

  it('无 RJ 码返回 null', () => {
    expect(extractRJCode('普通音声文件夹')).toBeNull()
    expect(extractRJCode('')).toBeNull()
    expect(extractRJCode(null)).toBeNull()
  })
})

describe('needsScraping', () => {
  it('缺少封面时需要刮削', () => {
    const work = {
      title: 'RJ123456',
      cover: '',
      cvs: ['声优A'],
      circle: '社团B',
    }
    expect(needsScraping(work)).toBe(true)
  })

  it('缺少 CV 时需要刮削', () => {
    const work = {
      title: 'RJ123456',
      cover: 'https://example.com/cover.jpg',
      cvs: [],
      circle: '社团B',
    }
    expect(needsScraping(work)).toBe(true)
  })

  it('缺少社团时需要刮削', () => {
    const work = {
      title: 'RJ123456',
      cover: 'https://example.com/cover.jpg',
      cvs: ['声优A'],
      circle: '',
    }
    expect(needsScraping(work)).toBe(true)
  })

  it('信息完整且包含 RJ 码时不需要刮削', () => {
    const work = {
      title: 'RJ123456',
      cover: 'https://example.com/cover.jpg',
      cvs: ['声优A'],
      circle: '社团B',
    }
    expect(needsScraping(work)).toBe(false)
  })

  it('无 RJ 码时不触发刮削', () => {
    const work = {
      title: '无编号作品',
      cover: '',
    }
    expect(needsScraping(work)).toBe(false)
  })
})

describe('isAudioListDifferent', () => {
  it('列表长度不同时判定为不同', () => {
    expect(isAudioListDifferent([{ name: '1.mp3' }], [])).toBe(true)
  })

  it('曲目内容相同时判定为相同', () => {
    const listA = [{ relativePath: '1.mp3' }, { relativePath: '2.mp3' }]
    const listB = [{ relativePath: '1.mp3' }, { relativePath: '2.mp3' }]
    expect(isAudioListDifferent(listA, listB)).toBe(false)
  })

  it('曲目顺序或名称不同时判定为不同', () => {
    const listA = [{ relativePath: '1.mp3' }, { relativePath: '2.mp3' }]
    const listB = [{ relativePath: '2.mp3' }, { relativePath: '1.mp3' }]
    expect(isAudioListDifferent(listA, listB)).toBe(true)
  })
})
