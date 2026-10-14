/**
 * chronicleHelpers.js
 * 声之手账与感官心动印记系统纯函数工具库
 *
 * 遵循「原汁原味的声音哲学」，提供纯净的情感沉淀与鉴赏可视化数据组织。
 */

import { formatTime } from './subtitleParser.js'

/**
 * 预设 ASMR 感官心动印记类型
 */
export const SENSORY_STAMP_TYPES = [
  { id: 'whisper', label: '耳边轻语', icon: '👂', color: '#f59e0b', desc: '近场呢喃与贴耳低语' },
  { id: 'heartbeat', label: '温柔心跳', icon: '💓', color: '#ec4899', desc: '胸膛共鸣与真实心律' },
  { id: 'breath', label: '微热吹气', icon: '💨', color: '#06b6d4', desc: '耳廓气流与湿润温热' },
  { id: 'ear_cleaning', label: '极乐耳搔', icon: '🪄', color: '#8b5cf6', desc: '棉棒掏耳与轻柔刮擦' },
  { id: 'hypnosis', label: '深度催眠', icon: '🌙', color: '#6366f1', desc: '意识沉静与入眠诱导' },
  { id: 'comfort', label: '治愈安抚', icon: '🌸', color: '#10b981', desc: '揉头拥抱与温柔陪伴' },
]

/**
 * 四维听感风味图谱维度定义
 */
export const RADAR_DIMENSIONS = [
  { key: 'intimacy', label: '耳语亲密度', short: '亲密', max: 10 },
  { key: 'sleepiness', label: '催眠助眠度', short: '助眠', max: 10 },
  { key: 'story', label: '剧本情感度', short: '情感', max: 10 },
  { key: 'spatial', label: '空间沉浸感', short: '空间', max: 10 },
]

export const DEFAULT_RADAR = {
  intimacy: 8,
  sleepiness: 8,
  story: 7,
  spatial: 8,
}

/**
 * 鉴赏综合评级预设
 */
export const CHRONICLE_TIERS = [
  { id: 'masterpiece', label: '殿堂神作', badge: '👑 殿堂级', color: '#f59e0b' },
  { id: 'deep_sleep', label: '深度助眠', badge: '🌙 助眠神轨', color: '#6366f1' },
  { id: 'comforting', label: '治愈良药', badge: '🌸 温暖治愈', color: '#10b981' },
  { id: 'loop_repeat', label: '无限循环', badge: '🔁 循环精听', color: '#ec4899' },
]

/**
 * 计算四维雷达图的各多边形顶点坐标 (SVG / Canvas 通用)
 * 4 个维度依次分布在 上 (0°), 右 (90°), 下 (180°), 左 (270°)
 * @param {Record<string, number>} scores - 各维度的分值 (1 ~ 10)
 * @param {number} cx - 中心 X
 * @param {number} cy - 中心 Y
 * @param {number} radius - 最大外径
 * @returns {Array<{ key: string, x: number, y: number, score: number, ratio: number }>}
 */
export function calculateRadarPoints(scores = {}, cx = 100, cy = 100, radius = 70) {
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI] // 上，右，下，左

  return RADAR_DIMENSIONS.map((dim, idx) => {
    const rawVal = scores[dim.key] !== undefined ? scores[dim.key] : DEFAULT_RADAR[dim.key]
    const clamped = Math.max(1, Math.min(dim.max, rawVal))
    const ratio = clamped / dim.max
    const r = radius * ratio
    const angle = angles[idx]

    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)

    return {
      key: dim.key,
      label: dim.label,
      short: dim.short,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      score: clamped,
      ratio,
    }
  })
}

/**
 * 将雷达点转换为 SVG polygon points 字符串
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string}
 */
export function pointsToSvgPolygon(points) {
  if (!points || points.length === 0) return ''
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * 校验并规范化单条心动印记数据
 * @param {object} rawStamp
 * @returns {object}
 */
export function normalizeSensoryStamp(rawStamp) {
  if (!rawStamp) return null
  const typeDef = SENSORY_STAMP_TYPES.find((t) => t.id === rawStamp.type) || SENSORY_STAMP_TYPES[0]
  const time = Math.max(0, parseFloat(rawStamp.time) || 0)
  const rating = Math.max(1, Math.min(5, parseInt(rawStamp.rating, 10) || 5))

  return {
    id: rawStamp.id || `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time,
    timeFormatted: rawStamp.timeFormatted || formatTime(time),
    audioPath: rawStamp.audioPath || '',
    audioName: rawStamp.audioName || '',
    type: typeDef.id,
    typeLabel: typeDef.label,
    icon: typeDef.icon,
    color: typeDef.color,
    rating,
    note: (rawStamp.note || '').trim().slice(0, 140),
    createdAt: rawStamp.createdAt || Date.now(),
  }
}

/**
 * 格式化手账数据包，用于海报导出
 * @param {object} params
 * @returns {object}
 */
export function formatChroniclePosterPayload({
  work,
  chronicleData = {},
  stamps = [],
}) {
  const title = (work?.title || work?.folderName || '无题音声').trim()
  const cvText = (work?.cvs || []).slice(0, 3).join(' / ') || '未知CV'
  const circleText = work?.circle || '个人同人'
  const rjCode = work?.rjCode || ''
  const coverUrl = work?.cover || ''

  const tierId = chronicleData.tier || 'masterpiece'
  const tierDef = CHRONICLE_TIERS.find((t) => t.id === tierId) || CHRONICLE_TIERS[0]
  const radar = { ...DEFAULT_RADAR, ...(chronicleData.radar || {}) }
  const equipment = chronicleData.equipment || '未记录耳机'
  const notes = chronicleData.notes || '暂无文字短评，静心聆听。'

  // 精选前 4 条心动印记
  const sortedStamps = [...stamps]
    .sort((a, b) => (b.rating || 5) - (a.rating || 5))
    .slice(0, 4)

  return {
    title,
    cvText,
    circleText,
    rjCode,
    coverUrl,
    tierDef,
    radar,
    equipment,
    notes,
    stamps: sortedStamps,
    dateText: new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  }
}
