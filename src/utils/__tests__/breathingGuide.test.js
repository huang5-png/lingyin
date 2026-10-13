import { describe, it, expect } from 'vitest'
import {
  BREATHING_PATTERNS,
  easeInOutSine,
  getBreathingPhase,
  getBreathingVisualParams,
  calculateTotalBreathingDuration,
} from '../breathingGuide'

describe('breathingGuide', () => {
  describe('BREATHING_PATTERNS 配置完整性', () => {
    it('包含 4-7-8、box、balance 三种标准呼吸模式', () => {
      expect(BREATHING_PATTERNS['4-7-8']).toBeDefined()
      expect(BREATHING_PATTERNS['box']).toBeDefined()
      expect(BREATHING_PATTERNS['balance']).toBeDefined()
    })

    it('4-7-8 总周期为 19 秒', () => {
      const p = BREATHING_PATTERNS['4-7-8']
      const sum = p.phases.reduce((acc, cur) => acc + cur.duration, 0)
      expect(p.totalDuration).toBe(19)
      expect(sum).toBe(19)
    })

    it('box 总周期为 16 秒且包含 4 个阶段', () => {
      const p = BREATHING_PATTERNS['box']
      expect(p.totalDuration).toBe(16)
      expect(p.phases.length).toBe(4)
    })
  })

  describe('easeInOutSine', () => {
    it('0 返回 0，1 返回 1，0.5 返回 0.5', () => {
      expect(easeInOutSine(0)).toBeCloseTo(0, 4)
      expect(easeInOutSine(1)).toBeCloseTo(1, 4)
      expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 4)
    })

    it('边界裁剪', () => {
      expect(easeInOutSine(-1)).toBe(0)
      expect(easeInOutSine(2)).toBe(1)
    })
  })

  describe('getBreathingPhase', () => {
    it('4-7-8 初始时刻 0s 为吸气第一周期', () => {
      const state = getBreathingPhase(0, '4-7-8')
      expect(state.cycleIndex).toBe(1)
      expect(state.phaseKey).toBe('inhale')
      expect(state.phaseDuration).toBe(4)
      expect(state.phaseElapsed).toBe(0)
      expect(state.phaseRemaining).toBe(4)
    })

    it('4-7-8 在 2s 时处于吸气中段', () => {
      const state = getBreathingPhase(2, '4-7-8')
      expect(state.phaseKey).toBe('inhale')
      expect(state.phaseProgress).toBeCloseTo(0.5, 2)
      expect(state.scale).toBeGreaterThan(0.65)
      expect(state.scale).toBeLessThan(1.0)
    })

    it('4-7-8 在 5s 时处于屏息阶段 (4s + 1s)', () => {
      const state = getBreathingPhase(5, '4-7-8')
      expect(state.phaseKey).toBe('hold')
      expect(state.phaseDuration).toBe(7)
      expect(state.phaseElapsed).toBe(1)
      expect(state.phaseRemaining).toBe(6)
    })

    it('4-7-8 在 12s 时处于呼气阶段 (4s + 7s + 1s)', () => {
      const state = getBreathingPhase(12, '4-7-8')
      expect(state.phaseKey).toBe('exhale')
      expect(state.phaseDuration).toBe(8)
      expect(state.phaseElapsed).toBe(1)
    })

    it('跨周期递增周期索引', () => {
      // 19s 是第二周期开始
      const stateCycle2 = getBreathingPhase(19, '4-7-8')
      expect(stateCycle2.cycleIndex).toBe(2)
      expect(stateCycle2.phaseKey).toBe('inhale')

      // 38s 是第三周期开始
      const stateCycle3 = getBreathingPhase(38, '4-7-8')
      expect(stateCycle3.cycleIndex).toBe(3)
    })

    it('缺省模式回退到 4-7-8', () => {
      const state = getBreathingPhase(1, 'non-existent')
      expect(state.patternId).toBe('4-7-8')
    })
  })

  describe('getBreathingVisualParams', () => {
    it('吸气阶段从 minScale 膨胀至 maxScale', () => {
      const start = getBreathingVisualParams('inhale', 0)
      const end = getBreathingVisualParams('inhale', 1)
      expect(start.scale).toBeCloseTo(0.65, 2)
      expect(end.scale).toBeCloseTo(1.0, 2)
      expect(start.opacity).toBeCloseTo(0.4, 2)
      expect(end.opacity).toBeCloseTo(0.95, 2)
    })

    it('呼气阶段从 maxScale 收缩至 minScale', () => {
      const start = getBreathingVisualParams('exhale', 0)
      const end = getBreathingVisualParams('exhale', 1)
      expect(start.scale).toBeCloseTo(1.0, 2)
      expect(end.scale).toBeCloseTo(0.65, 2)
    })
  })

  describe('calculateTotalBreathingDuration', () => {
    it('正确计算指定循环次数的总时长', () => {
      expect(calculateTotalBreathingDuration(4, '4-7-8')).toBe(76)
      expect(calculateTotalBreathingDuration(5, 'box')).toBe(80)
      expect(calculateTotalBreathingDuration(6, 'balance')).toBe(60)
    })
  })
})
