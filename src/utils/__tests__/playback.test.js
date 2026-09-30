import { describe, it, expect } from 'vitest'
import { PLAYBACK_RATES, stepPlaybackRate } from '../playback.js'

describe('stepPlaybackRate', () => {
  it('向上调一档', () => {
    expect(stepPlaybackRate(1, 'up')).toBe(1.25)
  })

  it('向下调一档', () => {
    expect(stepPlaybackRate(1, 'down')).toBe(0.75)
  })

  it('到达上限后保持不变', () => {
    expect(stepPlaybackRate(2, 'up')).toBe(2)
  })

  it('到达下限后保持不变', () => {
    expect(stepPlaybackRate(0.5, 'down')).toBe(0.5)
  })

  it('当前值不在档位表中时从 1x 起步', () => {
    expect(stepPlaybackRate(1.1, 'up')).toBe(1.25)
    expect(stepPlaybackRate(1.1, 'down')).toBe(0.75)
  })

  it('档位表按升序排列', () => {
    expect([...PLAYBACK_RATES].sort((a, b) => a - b)).toEqual(PLAYBACK_RATES)
  })
})
