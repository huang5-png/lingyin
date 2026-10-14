/**
 * tingleAnalyzer.js
 * ASMR 酥麻声能热力流与高能片段分析纯函数工具
 *
 * 恪守「原汁原味的声音哲学」：纯只读声学能量与动态特征解算，零 DSP 数字滤波与人造渲染。
 */

import { formatTime } from './subtitleParser.js'

/**
 * 计算单个时间切片的酥麻声学指数 (0 ~ 1)
 * @param {number} amplitude - 归一化振幅 (0 ~ 1)
 * @param {number} variance - 局部微观动态变化率 (0 ~ 1)
 * @param {number} [highFreqWeight=1.0] - 高频/空气感加权 (0 ~ 1)
 * @returns {number} 归一化酥麻指数 (0 ~ 1)
 */
export function calculateTingleScore(amplitude, variance, highFreqWeight = 1.0) {
  const amp = Math.max(0, Math.min(1, amplitude || 0))
  const v = Math.max(0, Math.min(1, variance || 0))
  const hf = Math.max(0, Math.min(2, highFreqWeight || 1.0))

  // ASMR 心理声学特征：
  // 1. 极致大音量通常属于噪声或突发响声，反而降低酥麻舒适感（过载惩罚）；
  // 2. 微小分贝到中等分贝 (0.15 ~ 0.7) 且伴随密集的细微脉冲 (variance) 时，Tingle 神经反射最强烈；
  // 3. 高频耳语空气感起决定性催化作用。
  let ampComfort = 0
  if (amp <= 0.02) {
    ampComfort = 0.05 // 近乎静音
  } else if (amp <= 0.65) {
    // 黄金酥麻能量带
    ampComfort = Math.sin((amp / 0.65) * (Math.PI / 2))
  } else {
    // 过响音量柔和递减
    ampComfort = 1.0 - (amp - 0.65) * 0.7
  }

  const score = (ampComfort * 0.45 + v * 0.4 + (hf - 1.0) * 0.15) * Math.min(1.2, hf)
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000))
}

/**
 * 平滑数组数据（移动加权平均）
 * @param {number[]} arr
 * @param {number} windowSize
 * @returns {number[]}
 */
export function smoothSeries(arr, windowSize = 3) {
  if (!arr || arr.length === 0) return []
  if (windowSize <= 1) return [...arr]

  const result = []
  const half = Math.floor(windowSize / 2)

  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let count = 0
    for (let w = -half; w <= half; w++) {
      const idx = i + w
      if (idx >= 0 && idx < arr.length) {
        sum += arr[idx]
        count++
      }
    }
    result.push(count > 0 ? sum / count : arr[i])
  }

  return result
}

/**
 * 从原始采样峰值数组生成归一化酥麻声能热力分布
 * @param {number[]|Float32Array} peaks - 波形振幅数组（如 WaveSurfer 的 peaks 或采样数据）
 * @param {number} duration - 音频总时长（秒）
 * @param {number} [targetBins=120] - 划分的分段数量（默认 120 段）
 * @returns {Array<{ index: number, time: number, timeFormatted: string, intensity: number, rawAmp: number }>}
 */
export function generateHeatmapFromPeaks(peaks, duration = 0, targetBins = 120) {
  const bins = Math.max(10, Math.min(300, targetBins))
  if (!peaks || peaks.length === 0) {
    // 兜底生成均匀微澜结构
    return Array.from({ length: bins }, (_, idx) => {
      const t = duration > 0 ? (idx / bins) * duration : idx
      return {
        index: idx,
        time: t,
        timeFormatted: formatTime(t),
        intensity: 0.15,
        rawAmp: 0.1,
      }
    })
  }

  const totalSamples = peaks.length
  const step = totalSamples / bins
  const rawScores = []
  const rawAmps = []

  for (let b = 0; b < bins; b++) {
    const startIdx = Math.floor(b * step)
    const endIdx = Math.min(totalSamples, Math.floor((b + 1) * step))

    let sum = 0
    let count = 0
    let diffSum = 0
    let prevVal = 0

    for (let i = startIdx; i < endIdx; i++) {
      const v = Math.abs(peaks[i] || 0)
      sum += v
      if (count > 0) {
        diffSum += Math.abs(v - prevVal)
      }
      prevVal = v
      count++
    }

    const avgAmp = count > 0 ? sum / count : 0
    const avgDiff = count > 1 ? diffSum / (count - 1) : 0
    const normalizedDiff = Math.min(1, avgDiff * 4) // 局部细微脉冲放大

    const tingle = calculateTingleScore(avgAmp, normalizedDiff)
    rawScores.push(tingle)
    rawAmps.push(avgAmp)
  }

  // 适度平滑消除离散噪点
  const smoothedScores = smoothSeries(rawScores, 3)

  return smoothedScores.map((score, idx) => {
    const time = duration > 0 ? (idx / bins) * duration : idx
    return {
      index: idx,
      time,
      timeFormatted: formatTime(time),
      intensity: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
      rawAmp: Math.round((rawAmps[idx] || 0) * 100) / 100,
    }
  })
}

/**
 * 自动识别音频中的高能酥麻峰值片段 (Peak Moments)
 * @param {Array<{ time: number, intensity: number }>} heatmapData - 热力数组
 * @param {number} duration - 音频时长（秒）
 * @param {object} [options]
 * @param {number} [options.minIntensity=0.45] - 峰值最低门槛
 * @param {number} [options.minDistance=15] - 两个高能点之间的最小间隔秒数
 * @param {number} [options.maxPeaks=6] - 最多返回的峰值点数
 * @returns {Array<{ id: string, time: number, timeFormatted: string, intensity: number, label: string }>}
 */
export function detectPeakMoments(heatmapData, duration = 0, options = {}) {
  const { minIntensity = 0.45, minDistance = 15, maxPeaks = 6 } = options

  if (!heatmapData || heatmapData.length < 3) return []

  const peaks = []

  for (let i = 1; i < heatmapData.length - 1; i++) {
    const prev = heatmapData[i - 1].intensity
    const curr = heatmapData[i].intensity
    const next = heatmapData[i + 1].intensity

    // 局部极大值判定
    if (curr >= prev && curr >= next && curr >= minIntensity) {
      peaks.push({
        time: heatmapData[i].time,
        intensity: curr,
      })
    }
  }

  // 按强度从高到低排序，优先保留最强峰值
  peaks.sort((a, b) => b.intensity - a.intensity)

  const filtered = []
  for (const candidate of peaks) {
    const tooClose = filtered.some((p) => Math.abs(p.time - candidate.time) < minDistance)
    if (!tooClose) {
      filtered.push(candidate)
      if (filtered.length >= maxPeaks) break
    }
  }

  // 按时间递增顺序排列，形成时间线航标
  filtered.sort((a, b) => a.time - b.time)

  return filtered.map((p, idx) => ({
    id: `peak-${idx}-${Math.round(p.time)}`,
    time: Math.round(p.time * 10) / 10,
    timeFormatted: formatTime(p.time),
    intensity: p.intensity,
    label: `高能点 ${idx + 1} (${Math.round(p.intensity * 100)}%)`,
  }))
}

/**
 * 依据当前播放时间，在热力数组中实时插值或匹配瞬时酥麻指数
 * @param {Array<{ time: number, intensity: number }>} heatmapData
 * @param {number} duration
 * @param {number} currentTime
 * @returns {number} 0 ~ 1 酥麻指数
 */
export function getTingleIntensityAtTime(heatmapData, duration = 0, currentTime = 0) {
  if (!heatmapData || heatmapData.length === 0 || duration <= 0) return 0
  const clampedTime = Math.max(0, Math.min(duration, currentTime))
  const progressRatio = clampedTime / duration
  const targetIndex = Math.min(heatmapData.length - 1, Math.floor(progressRatio * heatmapData.length))
  return heatmapData[targetIndex]?.intensity || 0
}

/**
 * 寻址下一个高能峰值点
 * @param {Array<{ time: number }>} peakMoments
 * @param {number} currentTime
 * @returns {object|null}
 */
export function getNextPeakMoment(peakMoments, currentTime = 0) {
  if (!peakMoments || peakMoments.length === 0) return null
  const next = peakMoments.find((p) => p.time > currentTime + 1)
  return next || peakMoments[0] // 若已在最后，循环回到第一个
}

/**
 * 寻址上一个高能峰值点
 * @param {Array<{ time: number }>} peakMoments
 * @param {number} currentTime
 * @returns {object|null}
 */
export function getPrevPeakMoment(peakMoments, currentTime = 0) {
  if (!peakMoments || peakMoments.length === 0) return null
  for (let i = peakMoments.length - 1; i >= 0; i--) {
    if (peakMoments[i].time < currentTime - 1) {
      return peakMoments[i]
    }
  }
  return peakMoments[peakMoments.length - 1]
}
