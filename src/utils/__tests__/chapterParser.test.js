import { describe, it, expect } from 'vitest'
import {
  parseTimestampToSeconds,
  formatSecondsToTimestamp,
  extractChaptersFromText,
  normalizeChapters,
  findActiveChapter,
} from '../chapterParser'

describe('chapterParser 时间戳转换', () => {
  it('正确解析 mm:ss 格式', () => {
    expect(parseTimestampToSeconds('03:45')).toBe(225)
    expect(parseTimestampToSeconds('00:00')).toBe(0)
    expect(parseTimestampToSeconds('75:10')).toBe(4510)
  })

  it('正确解析 hh:mm:ss 格式', () => {
    expect(parseTimestampToSeconds('01:02:03')).toBe(3723)
    expect(parseTimestampToSeconds('02:00:00')).toBe(7200)
  })

  it('支持带有方括号或圆括号的时间戳', () => {
    expect(parseTimestampToSeconds('[12:30]')).toBe(750)
    expect(parseTimestampToSeconds('(01:10:05)')).toBe(4205)
  })

  it('格式化秒数为时间戳文本', () => {
    expect(formatSecondsToTimestamp(0)).toBe('00:00')
    expect(formatSecondsToTimestamp(225)).toBe('03:45')
    expect(formatSecondsToTimestamp(3723)).toBe('01:02:03')
  })
})

describe('chapterParser 章节提取与规范化', () => {
  const sampleText = `
    欢迎收听本期音声！
    00:00 序章：相遇在雨夜
    05:30 膝枕与轻柔抚摸
    [15:40] 左右耳近场私语
    (28:15) - 舒适掏耳时光
    42:00 心跳与安眠导引
    感谢大家支持！
  `

  it('从纯文本中提取多个章节', () => {
    const chapters = extractChaptersFromText(sampleText)
    expect(chapters.length).toBe(5)
    expect(chapters[0].startTime).toBe(0)
    expect(chapters[0].title).toBe('序章：相遇在雨夜')
    expect(chapters[1].startTime).toBe(330)
    expect(chapters[1].title).toBe('膝枕与轻柔抚摸')
    expect(chapters[2].startTime).toBe(940)
    expect(chapters[2].title).toBe('左右耳近场私语')
    expect(chapters[3].startTime).toBe(1695)
    expect(chapters[3].title).toBe('舒适掏耳时光')
    expect(chapters[4].startTime).toBe(2520)
    expect(chapters[4].title).toBe('心跳与安眠导引')
  })

  it('规范化计算持续时间与结束时间', () => {
    const raw = [
      { startTime: 100, title: '第二章' },
      { startTime: 0, title: '第一章' },
    ]
    const normalized = normalizeChapters(raw, 300)
    expect(normalized[0].title).toBe('第一章')
    expect(normalized[0].startTime).toBe(0)
    expect(normalized[0].endTime).toBe(100)
    expect(normalized[0].duration).toBe(100)

    expect(normalized[1].title).toBe('第二章')
    expect(normalized[1].startTime).toBe(100)
    expect(normalized[1].endTime).toBe(300)
    expect(normalized[1].duration).toBe(200)
  })

  it('精准定位当前播放时间所在的章节', () => {
    const chapters = [
      { startTime: 0, title: 'A' },
      { startTime: 60, title: 'B' },
      { startTime: 120, title: 'C' },
    ]

    expect(findActiveChapter(chapters, 0)?.title).toBe('A')
    expect(findActiveChapter(chapters, 30)?.title).toBe('A')
    expect(findActiveChapter(chapters, 60)?.title).toBe('B')
    expect(findActiveChapter(chapters, 119)?.title).toBe('B')
    expect(findActiveChapter(chapters, 120)?.title).toBe('C')
    expect(findActiveChapter(chapters, 200)?.title).toBe('C')
  })
})
