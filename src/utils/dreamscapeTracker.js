/**
 * 枕畔心境 · 梦境声纹轨迹与晨光拂晓入眠回溯纯函数模块
 * 
 * 核心功能：
 * 1. 结合睡眠定时器渐弱事件、听众最后交互时间与声能衰减，智能预估入眠时间点 (Estimated Slumber Point)
 * 2. 结构化构建当夜梦境声纹记忆画卷 (Dreamscape Tapestry)
 * 3. 生成晨光拂晓回溯手账数据与治愈晨曦寄语
 */

// 梦境意境预设库
export const DREAMSCAPE_MOODS = [
  { id: 'whisper_dream', title: '耳畔微风', icon: '🍃', quote: '在极轻的耳语呢喃中，思绪悄然沉入软枕。' },
  { id: 'rain_retreat', title: '雨夜避难所', icon: '🌧️', quote: '窗外淅沥微雨，屋内唯有温暖的轻柔呼唤。' },
  { id: 'cozy_slumber', title: '暖衾深眠', icon: '🛏️', quote: '裹紧被角，心跳与轻声交织成安稳节拍。' },
  { id: 'star_drift', title: '星海微澜', icon: '🌌', quote: '闭上双眼，声音化作夜空中温柔闪烁的微光。' },
  { id: 'healing_haven', title: '治愈温存', icon: '🌸', quote: '放下所有疲惫，在安稳的怀抱中欣然入梦。' },
]

/**
 * 格式化时间戳为易读的夜间时刻（如：昨夜 23:45 或 凌晨 01:20）
 */
export function formatDreamscapeClock(timestamp) {
  if (!timestamp) return '深夜'
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')

  let period = '深夜'
  if (hours >= 19 && hours < 24) {
    period = '昨夜'
  } else if (hours >= 0 && hours < 6) {
    period = '凌晨'
  } else if (hours >= 6 && hours < 9) {
    period = '清晨'
  }

  return `${period} ${hours.toString().padStart(2, '0')}:${minutes}`
}

/**
 * 智能估算入眠时刻与音频进度
 * 
 * @param {Object} params
 * @param {number} params.sessionStartTime 开始聆听时间戳 (ms)
 * @param {number} params.sessionEndTime 结束聆听或停止时间戳 (ms)
 * @param {number} params.lastInteractionTime 听众最后操作时间戳 (ms)
 * @param {boolean} params.sleepTimerTriggered 是否通过睡眠定时器自动暂停
 * @param {number} params.audioDuration 当前音频总长度 (s)
 * @param {number} params.finalTrackTime 结束时音频当前进度 (s)
 * @returns {Object} 入眠时刻推断结果
 */
export function estimateSlumberMoment({
  sessionStartTime = 0,
  sessionEndTime = 0,
  lastInteractionTime = 0,
  sleepTimerTriggered = false,
  audioDuration = 0,
  finalTrackTime = 0,
}) {
  const totalSessionMs = Math.max(0, sessionEndTime - sessionStartTime)
  const totalSessionMinutes = totalSessionMs / (60 * 1000)

  // 1. 若聆听时间极短（少于 5 分钟），或未设置睡眠定时且听众在最后时刻仍有交互
  if (totalSessionMinutes < 4) {
    return {
      fellAsleep: false,
      reason: 'session_too_short',
      confidence: 'none',
      estimatedSleepTimestamp: null,
      estimatedTrackSeconds: 0,
      slumberDurationMinutes: 0,
    }
  }

  // 2. 估算入睡延迟 (Sleep Latency)
  // 医学统计：静卧听 ASMR / 助眠音频时，平均入睡时间在最后一次交互后 8~18 分钟
  const lastActiveTime = lastInteractionTime > sessionStartTime ? lastInteractionTime : sessionStartTime
  const activeDurationMs = Math.max(0, lastActiveTime - sessionStartTime)
  const idleMs = Math.max(0, sessionEndTime - lastActiveTime)

  let estimatedLatencyMinutes = 12
  if (idleMs > 30 * 60 * 1000) {
    // 静止超过 30 分钟，说明很早就睡着了
    estimatedLatencyMinutes = 14
  } else if (idleMs > 15 * 60 * 1000) {
    estimatedLatencyMinutes = 10
  } else {
    estimatedLatencyMinutes = Math.max(4, Math.floor(idleMs / (60 * 1000) * 0.6))
  }

  // 预估入睡时刻 (时间戳)
  let estimatedSleepTimestamp = lastActiveTime + estimatedLatencyMinutes * 60 * 1000
  if (estimatedSleepTimestamp > sessionEndTime) {
    estimatedSleepTimestamp = sessionEndTime - 2 * 60 * 1000
  }

  // 预估在音频中的对应秒数
  const elapsedMinutesBeforeSleep = (estimatedSleepTimestamp - sessionStartTime) / (60 * 1000)
  let estimatedTrackSeconds = Math.round(elapsedMinutesBeforeSleep * 60)
  
  if (finalTrackTime > 0 && estimatedTrackSeconds > finalTrackTime) {
    estimatedTrackSeconds = Math.max(30, Math.round(finalTrackTime * 0.75))
  } else if (audioDuration > 0 && estimatedTrackSeconds > audioDuration) {
    estimatedTrackSeconds = Math.round(audioDuration * 0.8)
  }

  // 陪伴入眠总时长（分钟）
  const slumberDurationMinutes = Math.max(1, Math.round(totalSessionMinutes))

  return {
    fellAsleep: true,
    confidence: sleepTimerTriggered ? 'high' : 'medium',
    estimatedSleepTimestamp,
    estimatedTrackSeconds,
    slumberDurationMinutes,
    clockDisplay: formatDreamscapeClock(estimatedSleepTimestamp),
  }
}

/**
 * 根据作品标签与听感特征解算梦境意境主题
 */
export function matchDreamscapeMood(tags = [], workTitle = '') {
  const combined = [...(tags || []), workTitle || ''].join(' ').toLowerCase()

  if (combined.includes('雨') || combined.includes('波') || combined.includes('水') || combined.includes('rain')) {
    return DREAMSCAPE_MOODS[1] // 雨夜避难所
  }
  if (combined.includes('添い寝') || combined.includes('睡眠') || combined.includes('ベッド') || combined.includes('cozy')) {
    return DREAMSCAPE_MOODS[2] // 暖衾深眠
  }
  if (combined.includes('星') || combined.includes('宇宙') || combined.includes('空') || combined.includes('night')) {
    return DREAMSCAPE_MOODS[3] // 星海微澜
  }
  if (combined.includes('癒') || combined.includes('甘') || combined.includes('安らぎ') || combined.includes('母')) {
    return DREAMSCAPE_MOODS[4] // 治愈温存
  }
  return DREAMSCAPE_MOODS[0] // 默认耳畔微风
}

/**
 * 构建完整的梦境声纹回忆录记录对象
 */
export function buildDreamscapeRecord({
  work,
  audio,
  slumberAnalysis,
  stampsCount = 0,
}) {
  if (!work || !slumberAnalysis || !slumberAnalysis.fellAsleep) return null

  const mood = matchDreamscapeMood(work.tags, work.title)
  const primaryCV = Array.isArray(work.cvs) && work.cvs.length > 0 ? work.cvs[0] : (work.cv || '未知声优')

  return {
    id: `dream_${Date.now()}`,
    createdAt: Date.now(),
    workId: work.id,
    workTitle: work.title || work.folderName || '音声作品',
    workCover: work.cover || '',
    circle: work.circle || '',
    primaryCV,
    audioName: audio?.displayName || audio?.name || '未知曲目',
    audioPath: audio?.path || '',
    estimatedSleepTimestamp: slumberAnalysis.estimatedSleepTimestamp,
    estimatedTrackSeconds: slumberAnalysis.estimatedTrackSeconds,
    slumberDurationMinutes: slumberAnalysis.slumberDurationMinutes,
    confidence: slumberAnalysis.confidence,
    clockDisplay: slumberAnalysis.clockDisplay,
    mood,
    stampsCount,
  }
}
