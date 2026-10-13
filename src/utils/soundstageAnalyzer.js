/**
 * soundstageAnalyzer.js
 * 双耳录音与立体声场空间分析纯函数工具
 *
 * 遵循「原汁原味的声音哲学」：仅对音频数据做只读特征提取，零 DSP 数字滤波与混音污染。
 */

/**
 * 计算 PCM 时域样本的 RMS（均方根）能量
 * @param {Uint8Array|Float32Array} data - 时域样本 (Uint8Array: 0~255, 中间 128; Float32Array: -1~1)
 * @returns {number} 归一化能量 (0 ~ 1)
 */
export function calculateChannelRms(data) {
  if (!data || data.length === 0) return 0

  let sum = 0
  const isFloat = data instanceof Float32Array

  for (let i = 0; i < data.length; i++) {
    const val = isFloat ? data[i] : (data[i] - 128) / 128
    sum += val * val
  }

  const rms = Math.sqrt(sum / data.length)
  return Math.min(1, Math.max(0, rms))
}

/**
 * 计算左右声道瞬时声相平衡（Stereo Pan）
 * @param {number} leftRms - 左声道能量 (0 ~ 1)
 * @param {number} rightRms - 右声道能量 (0 ~ 1)
 * @param {number} threshold - 极小音量静音死区阈值 (默认 0.005)
 * @returns {number} Pan 值 (-1.0 完全在左, 0 居中, +1.0 完全在右)
 */
export function calculateStereoPan(leftRms, rightRms, threshold = 0.005) {
  const l = Math.max(0, leftRms || 0)
  const r = Math.max(0, rightRms || 0)
  const total = l + r

  // 静音或底噪极低时保持居中，避免微小波动引起光标漂移
  if (total < threshold) {
    return 0
  }

  // (R - L) / (R + L)
  const pan = (r - l) / total
  return Math.min(1, Math.max(-1, pan))
}

/**
 * 将 Pan 值转换为方位角度数（-90° 左耳到 +90° 右耳）
 * @param {number} pan - (-1 ~ 1)
 * @returns {number} 方位角度数 (-90 ~ 90)
 */
export function calculateAzimuth(pan) {
  const clampedPan = Math.min(1, Math.max(-1, pan || 0))
  return Math.round(clampedPan * 90)
}

/**
 * 计算左右声道立体声分离度 / 声场宽度 (Stereo Width)
 * 基于两声道相关性差异计算 (0% 单声道 ~ 100% 极致双耳立体分离)
 * @param {Uint8Array|Float32Array} leftData
 * @param {Uint8Array|Float32Array} rightData
 * @returns {number} 分离度百分比 (0 ~ 100)
 */
export function calculateStereoWidth(leftData, rightData) {
  if (!leftData || !rightData || leftData.length === 0 || rightData.length !== leftData.length) {
    return 0
  }

  const len = leftData.length
  const isFloat = leftData instanceof Float32Array

  let sumDiff = 0
  let sumAvg = 0

  for (let i = 0; i < len; i++) {
    const l = isFloat ? leftData[i] : (leftData[i] - 128) / 128
    const r = isFloat ? rightData[i] : (rightData[i] - 128) / 128
    const diff = Math.abs(l - r)
    const avg = (Math.abs(l) + Math.abs(r)) / 2

    sumDiff += diff
    sumAvg += avg
  }

  if (sumAvg < 0.001) return 0
  const ratio = sumDiff / (sumAvg * 2)
  return Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

/**
 * 分析频域数据的能量分布（低频/中频人声/高频空气感）
 * @param {Uint8Array} freqData - FFT 频域数组 (0 ~ 255)
 * @returns {{ bass: number, vocal: number, air: number, total: number }} 归一化能量 (0 ~ 1)
 */
export function calculateFrequencyBands(freqData) {
  if (!freqData || freqData.length === 0) {
    return { bass: 0, vocal: 0, air: 0, total: 0 }
  }

  const len = freqData.length
  // 简化的频段划分（按 FFT bin 比例）
  // 低频 ~0-15%, 人声耳语 ~15-60%, 高频空气感 ~60-100%
  const bassEnd = Math.max(1, Math.floor(len * 0.15))
  const vocalEnd = Math.max(bassEnd + 1, Math.floor(len * 0.6))

  let bassSum = 0
  let vocalSum = 0
  let airSum = 0
  let totalSum = 0

  for (let i = 0; i < len; i++) {
    const val = freqData[i] / 255
    totalSum += val
    if (i < bassEnd) {
      bassSum += val
    } else if (i < vocalEnd) {
      vocalSum += val
    } else {
      airSum += val
    }
  }

  const bassCount = bassEnd
  const vocalCount = vocalEnd - bassEnd
  const airCount = len - vocalEnd

  return {
    bass: bassCount > 0 ? Math.min(1, bassSum / bassCount) : 0,
    vocal: vocalCount > 0 ? Math.min(1, vocalSum / vocalCount) : 0,
    air: airCount > 0 ? Math.min(1, airSum / airCount) : 0,
    total: len > 0 ? Math.min(1, totalSum / len) : 0,
  }
}

/**
 * 指数平滑阻尼算法（让视觉光标和仪表丝滑过渡，避免高频跳动）
 * @param {number} current - 当前值
 * @param {number} target - 目标值
 * @param {number} factor - 阻尼系数 (0 ~ 1，越大跟手越快，通常 0.15 ~ 0.3)
 * @returns {number} 平滑后的值
 */
export function smoothValue(current, target, factor = 0.2) {
  if (current === undefined || current === null) return target
  return current + (target - current) * factor
}

/**
 * 格式化声相文本描述
 * @param {number} pan - (-1 ~ 1)
 * @returns {string} 描述文本（例如 "左耳深处 82°"、"正中环绕"、"右耳贴近 45°"）
 */
export function formatPanDescription(pan) {
  const azimuth = calculateAzimuth(pan)
  const absDeg = Math.abs(azimuth)

  if (absDeg <= 5) {
    return '正中环绕 (Center)'
  }
  if (azimuth < 0) {
    if (absDeg >= 60) return `左耳深处 (${absDeg}° L)`
    if (absDeg >= 30) return `左侧贴近 (${absDeg}° L)`
    return `左前方 (${absDeg}° L)`
  } else {
    if (absDeg >= 60) return `右耳深处 (${absDeg}° R)`
    if (absDeg >= 30) return `右侧贴近 (${absDeg}° R)`
    return `右前方 (${absDeg}° R)`
  }
}
