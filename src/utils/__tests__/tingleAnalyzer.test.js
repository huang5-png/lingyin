import { describe, it, expect } from 'vitest'
import {
  calculateTingleScore,
  smoothSeries,
  generateHeatmapFromPeaks,
  detectPeakMoments,
  getTingleIntensityAtTime,
  getNextPeakMoment,
  getPrevPeakMoment,
} from '../tingleAnalyzer.js'

describe('tingleAnalyzer 酥麻声能分析算法', () => {
  it('calculateTingleScore: 静音与过响时分数受限，黄金耳语区间得分最高', () => {
    const silent = calculateTingleScore(0, 0)
    expect(silent).toBeLessThan(0.1)

    const goldenWhisper = calculateTingleScore(0.4, 0.8, 1.2)
    expect(goldenWhisper).toBeGreaterThan(0.5)

    const loudBang = calculateTingleScore(0.95, 0.1, 1.0)
    expect(goldenWhisper).toBeGreaterThan(loudBang)
  })

  it('smoothSeries: 正确进行平滑处理', () => {
    const raw = [0, 10, 0, 10, 0]
    const smoothed = smoothSeries(raw, 3)
    expect(smoothed.length).toBe(5)
    // 中间点 (10+0+10)/3
    expect(smoothed[2]).toBeCloseTo(6.666, 1)
  })

  it('generateHeatmapFromPeaks: 空数据优雅兜底', () => {
    const res = generateHeatmapFromPeaks([], 100, 20)
    expect(res.length).toBe(20)
    expect(res[0].intensity).toBe(0.15)
  })

  it('generateHeatmapFromPeaks: 生成指定数量分段且数值合法', () => {
    const peaks = [0.1, 0.2, 0.5, 0.8, 0.3, 0.1, 0.6, 0.9, 0.2, 0.1]
    const heatmap = generateHeatmapFromPeaks(peaks, 60, 10)
    expect(heatmap.length).toBe(10)
    heatmap.forEach((item) => {
      expect(item.intensity).toBeGreaterThanOrEqual(0)
      expect(item.intensity).toBeLessThanOrEqual(1)
      expect(typeof item.timeFormatted).toBe('string')
    })
  })

  it('detectPeakMoments: 正确识别局部最大值并满足时间间距限制', () => {
    const heatmap = [
      { time: 0, intensity: 0.1 },
      { time: 10, intensity: 0.8 },
      { time: 20, intensity: 0.2 },
      { time: 30, intensity: 0.75 },
      { time: 40, intensity: 0.3 },
      { time: 42, intensity: 0.85 }, // 距离 30s 太近 (<15s)
      { time: 60, intensity: 0.9 },
    ]
    const peaks = detectPeakMoments(heatmap, 60, { minIntensity: 0.5, minDistance: 15, maxPeaks: 3 })
    expect(peaks.length).toBeGreaterThanOrEqual(2)
    expect(peaks.length).toBeLessThanOrEqual(3)
    // 检查时间单调递增
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i].time).toBeGreaterThan(peaks[i - 1].time)
      expect(peaks[i].time - peaks[i - 1].time).toBeGreaterThanOrEqual(15)
    }
  })

  it('getTingleIntensityAtTime: 根据时间索引正确取样', () => {
    const heatmap = [
      { time: 0, intensity: 0.2 },
      { time: 50, intensity: 0.8 },
    ]
    expect(getTingleIntensityAtTime(heatmap, 100, 10)).toBe(0.2)
    expect(getTingleIntensityAtTime(heatmap, 100, 80)).toBe(0.8)
    expect(getTingleIntensityAtTime([], 100, 10)).toBe(0)
  })

  it('getNextPeakMoment / getPrevPeakMoment: 正确寻址与循环回到起点', () => {
    const peaks = [
      { id: '1', time: 10 },
      { id: '2', time: 30 },
      { id: '3', time: 50 },
    ]
    expect(getNextPeakMoment(peaks, 5).time).toBe(10)
    expect(getNextPeakMoment(peaks, 20).time).toBe(30)
    expect(getNextPeakMoment(peaks, 45).time).toBe(50)
    // 超过最后一点循环回到第一个
    expect(getNextPeakMoment(peaks, 55).time).toBe(10)

    expect(getPrevPeakMoment(peaks, 40).time).toBe(30)
    // 处于起点之前循环到最后一个
    expect(getPrevPeakMoment(peaks, 5).time).toBe(50)
  })
})
