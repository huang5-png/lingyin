import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FADE_SECONDS,
  formatSleepRemaining,
  remainingSecondsUntil,
  resolveTimePointTarget,
} from '../sleepTimer.js'

describe('resolveTimePointTarget', () => {
  it('返回今天的该时刻（尚未到达）', () => {
    const now = new Date('2026-10-01T08:00:00')
    const target = resolveTimePointTarget('23:30', now)
    expect(target).toBe(new Date('2026-10-01T23:30:00').getTime())
  })

  it('今天的该时刻已过时顺延到明天', () => {
    const now = new Date('2026-10-01T23:40:00')
    const target = resolveTimePointTarget('23:30', now)
    expect(target).toBe(new Date('2026-10-02T23:30:00').getTime())
  })

  it('恰好等于当前时刻时顺延到明天（保证目标在未来）', () => {
    const now = new Date('2026-10-01T23:30:00')
    const target = resolveTimePointTarget('23:30', now)
    expect(target).toBe(new Date('2026-10-02T23:30:00').getTime())
  })

  it('非法输入返回 null', () => {
    expect(resolveTimePointTarget('', new Date())).toBeNull()
    expect(resolveTimePointTarget('25:00', new Date())).toBeNull()
    expect(resolveTimePointTarget('23:70', new Date())).toBeNull()
    expect(resolveTimePointTarget('abc', new Date())).toBeNull()
    expect(resolveTimePointTarget(null, new Date())).toBeNull()
  })
})

describe('remainingSecondsUntil', () => {
  it('向上取整剩余秒数', () => {
    expect(remainingSecondsUntil(1_000_500, 1_000_000)).toBe(1)
    expect(remainingSecondsUntil(1_001_000, 1_000_000)).toBe(1)
    expect(remainingSecondsUntil(1_060_000, 1_000_000)).toBe(60)
  })

  it('已过期返回 0', () => {
    expect(remainingSecondsUntil(999_000, 1_000_000)).toBe(0)
  })

  it('无截止时间返回 0', () => {
    expect(remainingSecondsUntil(null)).toBe(0)
  })
})

describe('formatSleepRemaining', () => {
  it('一小时以内为 m:ss', () => {
    expect(formatSleepRemaining(59)).toBe('0:59')
    expect(formatSleepRemaining(600)).toBe('10:00')
  })

  it('超过一小时为 h:mm:ss', () => {
    expect(formatSleepRemaining(3661)).toBe('1:01:01')
  })

  it('非正数返回空串', () => {
    expect(formatSleepRemaining(0)).toBe('')
    expect(formatSleepRemaining(-5)).toBe('')
  })
})

describe('DEFAULT_FADE_SECONDS', () => {
  it('默认渐弱时长为 30 秒', () => {
    expect(DEFAULT_FADE_SECONDS).toBe(30)
  })
})
