/**
 * breathingGuide.js
 * 深眠呼吸导引与助眠座舱状态机纯函数工具
 *
 * 提供基于生理节律的 4-7-8、箱式 (Box)、心脑平衡 (Resonance) 呼吸算法及视觉光环缓动参数。
 */

export const BREATHING_PATTERNS = {
  '4-7-8': {
    id: '4-7-8',
    name: '4-7-8 深度助眠',
    description: '哈佛大学安德鲁·韦尔博士推荐，通过延长呼气激活副交感神经，强效镇静促眠',
    phases: [
      { key: 'inhale', name: '吸气', duration: 4, prompt: '缓缓吸气 · 感受清澈宁静' },
      { key: 'hold', name: '屏息', duration: 7, prompt: '温和屏息 · 沉入安详夜色' },
      { key: 'exhale', name: '呼气', duration: 8, prompt: '悠悠呼气 · 释放所有疲惫' },
    ],
    totalDuration: 19,
    themeColor: '#e08865',
    accentColor: '#93c5fd',
  },
  'box': {
    id: 'box',
    name: '4-4-4-4 箱式平息',
    description: '特战与冥想经典调节法，四边匀称节奏，迅速消除睡前焦虑与紧绷',
    phases: [
      { key: 'inhale', name: '吸气', duration: 4, prompt: '平稳吸气 · 充盈身心' },
      { key: 'hold', name: '屏息', duration: 4, prompt: '保持定息 · 观照心神' },
      { key: 'exhale', name: '呼气', duration: 4, prompt: '匀速呼气 · 渐入松弛' },
      { key: 'holdEmpty', name: '空屏', duration: 4, prompt: '静心留白 · 归于虚静' },
    ],
    totalDuration: 16,
    themeColor: '#38bdf8',
    accentColor: '#818cf8',
  },
  'balance': {
    id: 'balance',
    name: '5-5 心脑共振',
    description: '每分钟 6 次呼吸的生理黄金共振频率，平衡自主神经与心率变异性',
    phases: [
      { key: 'inhale', name: '吸气', duration: 5, prompt: '柔和吸气 · 气纳丹田' },
      { key: 'exhale', name: '呼气', duration: 5, prompt: '自然呼气 · 随心流动' },
    ],
    totalDuration: 10,
    themeColor: '#34d399',
    accentColor: '#f472b6',
  },
}

/**
 * 缓动曲线：平滑的正弦 ease-in-out
 * @param {number} t (0 ~ 1)
 * @returns {number} (0 ~ 1)
 */
export function easeInOutSine(t) {
  const clamped = Math.max(0, Math.min(1, t))
  const res = -(Math.cos(Math.PI * clamped) - 1) / 2
  return res === 0 ? 0 : res
}

/**
 * 计算指定已运行秒数下的呼吸状态
 * @param {number} elapsedSeconds - 从启动开始的累计秒数 (>= 0)
 * @param {string} patternId - 呼吸模式 ID ('4-7-8' | 'box' | 'balance')
 * @returns {{
 *   patternId: string,
 *   cycleIndex: number,
 *   phaseKey: string,
 *   phaseName: string,
 *   prompt: string,
 *   phaseElapsed: number,
 *   phaseDuration: number,
 *   phaseRemaining: number,
 *   phaseProgress: number,
 *   scale: number,
 *   opacity: number
 * }}
 */
export function getBreathingPhase(elapsedSeconds, patternId = '4-7-8') {
  const pattern = BREATHING_PATTERNS[patternId] || BREATHING_PATTERNS['4-7-8']
  const totalDuration = pattern.totalDuration || 19

  const safeElapsed = Math.max(0, elapsedSeconds || 0)
  const cycleIndex = Math.floor(safeElapsed / totalDuration) + 1
  const cycleElapsed = safeElapsed % totalDuration

  let accumulated = 0
  let currentPhase = pattern.phases[0]
  let phaseElapsed = 0

  for (const phase of pattern.phases) {
    if (cycleElapsed < accumulated + phase.duration) {
      currentPhase = phase
      phaseElapsed = cycleElapsed - accumulated
      break
    }
    accumulated += phase.duration
  }

  const phaseProgress = currentPhase.duration > 0
    ? Math.min(1, Math.max(0, phaseElapsed / currentPhase.duration))
    : 1
  const phaseRemaining = Math.max(0, currentPhase.duration - phaseElapsed)

  // 计算视觉光环的缩放与透明度
  const { scale, opacity } = getBreathingVisualParams(currentPhase.key, phaseProgress)

  return {
    patternId: pattern.id,
    patternName: pattern.name,
    cycleIndex,
    phaseKey: currentPhase.key,
    phaseName: currentPhase.name,
    prompt: currentPhase.prompt,
    phaseElapsed,
    phaseDuration: currentPhase.duration,
    phaseRemaining,
    phaseProgress,
    scale,
    opacity,
  }
}

/**
 * 依据阶段和进度计算视觉光环参数
 * @param {string} phaseKey
 * @param {number} progress (0 ~ 1)
 * @returns {{ scale: number, opacity: number }}
 */
export function getBreathingVisualParams(phaseKey, progress) {
  const minScale = 0.65
  const maxScale = 1.0
  const minOpacity = 0.4
  const maxOpacity = 0.95

  const eased = easeInOutSine(progress)

  switch (phaseKey) {
    case 'inhale':
      return {
        scale: minScale + (maxScale - minScale) * eased,
        opacity: minOpacity + (maxOpacity - minOpacity) * eased,
      }
    case 'hold':
      // 保持满盈，带有极其微弱的微澜漂浮 (±0.015)
      return {
        scale: maxScale + Math.sin(progress * Math.PI * 2) * 0.015,
        opacity: maxOpacity,
      }
    case 'exhale':
      return {
        scale: maxScale - (maxScale - minScale) * eased,
        opacity: maxOpacity - (maxOpacity - minOpacity) * eased,
      }
    case 'holdEmpty':
    default:
      // 保持收缩静虚
      return {
        scale: minScale,
        opacity: minOpacity,
      }
  }
}

/**
 * 计算若干个呼吸循环的累计总秒数
 * @param {number} cycleCount
 * @param {string} patternId
 * @returns {number}
 */
export function calculateTotalBreathingDuration(cycleCount, patternId = '4-7-8') {
  const pattern = BREATHING_PATTERNS[patternId] || BREATHING_PATTERNS['4-7-8']
  const count = Math.max(1, parseInt(cycleCount, 10) || 1)
  return count * pattern.totalDuration
}
