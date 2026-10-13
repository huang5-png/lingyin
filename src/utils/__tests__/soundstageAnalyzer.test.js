import { describe, it, expect } from 'vitest'
import {
  calculateChannelRms,
  calculateStereoPan,
  calculateAzimuth,
  calculateStereoWidth,
  calculateFrequencyBands,
  smoothValue,
  formatPanDescription,
} from '../soundstageAnalyzer'

describe('soundstageAnalyzer', () => {
  describe('calculateChannelRms', () => {
    it('处理空数据或无效数据返回 0', () => {
      expect(calculateChannelRms(null)).toBe(0)
      expect(calculateChannelRms([])).toBe(0)
      expect(calculateChannelRms(new Uint8Array(0))).toBe(0)
    })

    it('当 Uint8Array 为静音（值为 128）时返回 0', () => {
      const data = new Uint8Array([128, 128, 128, 128])
      expect(calculateChannelRms(data)).toBe(0)
    })

    it('计算非静音 Uint8Array 的 RMS', () => {
      // 0 到 255 的满幅方波
      const data = new Uint8Array([0, 255, 0, 255])
      const rms = calculateChannelRms(data)
      // (128/128)^2 = 1, sqrt(1) = 1
      expect(rms).toBeCloseTo(1, 1)
    })

    it('支持 Float32Array 输入', () => {
      const data = new Float32Array([0.5, -0.5, 0.5, -0.5])
      const rms = calculateChannelRms(data)
      expect(rms).toBeCloseTo(0.5, 2)
    })
  })

  describe('calculateStereoPan', () => {
    it('静音或低于阈值时返回 0（居中）', () => {
      expect(calculateStereoPan(0, 0)).toBe(0)
      expect(calculateStereoPan(0.001, 0.001, 0.005)).toBe(0)
    })

    it('仅左声道发声时返回 -1（完全左耳）', () => {
      expect(calculateStereoPan(0.8, 0)).toBe(-1)
    })

    it('仅右声道发声时返回 1（完全右耳）', () => {
      expect(calculateStereoPan(0, 0.8)).toBe(1)
    })

    it('两声道等能量时返回 0（居中）', () => {
      expect(calculateStereoPan(0.5, 0.5)).toBe(0)
    })

    it('右声道略高于左声道时返回合理的正数', () => {
      const pan = calculateStereoPan(0.2, 0.6)
      // (0.6 - 0.2) / 0.8 = 0.5
      expect(pan).toBeCloseTo(0.5, 2)
    })
  })

  describe('calculateAzimuth', () => {
    it('转换 pan 为方位角度数 (-90° ~ 90°)', () => {
      expect(calculateAzimuth(0)).toBe(0)
      expect(calculateAzimuth(-1)).toBe(-90)
      expect(calculateAzimuth(1)).toBe(90)
      expect(calculateAzimuth(0.5)).toBe(45)
      expect(calculateAzimuth(-0.5)).toBe(-45)
    })
  })

  describe('calculateStereoWidth', () => {
    it('两声道完全一致时返回 0（单声道）', () => {
      const left = new Uint8Array([100, 150, 200])
      const right = new Uint8Array([100, 150, 200])
      expect(calculateStereoWidth(left, right)).toBe(0)
    })

    it('两声道反相/极端分离时返回高百分比', () => {
      const left = new Uint8Array([255, 255, 0, 0])
      const right = new Uint8Array([0, 0, 255, 255])
      const width = calculateStereoWidth(left, right)
      expect(width).toBeGreaterThan(80)
    })

    it('处理异常或不同长度返回 0', () => {
      expect(calculateStereoWidth(null, null)).toBe(0)
      expect(calculateStereoWidth(new Uint8Array(4), new Uint8Array(2))).toBe(0)
    })
  })

  describe('calculateFrequencyBands', () => {
    it('空数组返回各频段 0', () => {
      expect(calculateFrequencyBands(null)).toEqual({ bass: 0, vocal: 0, air: 0, total: 0 })
      expect(calculateFrequencyBands(new Uint8Array(0))).toEqual({ bass: 0, vocal: 0, air: 0, total: 0 })
    })

    it('提取低频、人声、高频能量', () => {
      const data = new Uint8Array(100)
      data.fill(128)
      const bands = calculateFrequencyBands(data)
      expect(bands.total).toBeCloseTo(128 / 255, 2)
      expect(bands.bass).toBeCloseTo(128 / 255, 2)
      expect(bands.vocal).toBeCloseTo(128 / 255, 2)
      expect(bands.air).toBeCloseTo(128 / 255, 2)
    })
  })

  describe('smoothValue', () => {
    it('以阻尼系数向目标值平滑逼近', () => {
      const current = 0
      const target = 100
      const next = smoothValue(current, target, 0.2)
      expect(next).toBe(20)
    })

    it('current 未定义时直接返回 target', () => {
      expect(smoothValue(undefined, 50)).toBe(50)
      expect(smoothValue(null, 50)).toBe(50)
    })
  })

  describe('formatPanDescription', () => {
    it('正确生成各个角度的方位文本描述', () => {
      expect(formatPanDescription(0)).toContain('正中环绕')
      expect(formatPanDescription(-0.9)).toContain('左耳深处')
      expect(formatPanDescription(-0.4)).toContain('左侧贴近')
      expect(formatPanDescription(0.9)).toContain('右耳深处')
      expect(formatPanDescription(0.4)).toContain('右侧贴近')
    })
  })
})
