import { formatTime } from '../subtitleParser'

describe('formatTime', () => {
  test('handles zero and null values', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(null)).toBe('00:00')
    expect(formatTime(undefined)).toBe('00:00')
    expect(formatTime(NaN)).toBe('00:00')
  })

  test('handles positive values correctly', () => {
    expect(formatTime(30)).toBe('00:30')
    expect(formatTime(60)).toBe('01:00')
    expect(formatTime(90)).toBe('01:30')
    expect(formatTime(3600)).toBe('01:00:00')
    expect(formatTime(3661)).toBe('01:01:01')
  })

  test('handles negative values (defect fix)', () => {
    expect(formatTime(-30)).toBe('00:30')
    expect(formatTime(-60)).toBe('01:00')
    expect(formatTime(-90)).toBe('01:30')
    expect(formatTime(-3600)).toBe('01:00:00')
  })

  test('handles Infinity and -Infinity', () => {
    expect(formatTime(Infinity)).toBe('00:00')
    expect(formatTime(-Infinity)).toBe('00:00')
  })

  test('handles floating point values', () => {
    expect(formatTime(30.5)).toBe('00:30')
    expect(formatTime(90.999)).toBe('01:30')
  })
})