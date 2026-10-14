import { describe, it, expect } from 'vitest'
import {
  SENSORY_STAMP_TYPES,
  RADAR_DIMENSIONS,
  DEFAULT_RADAR,
  CHRONICLE_TIERS,
  calculateRadarPoints,
  pointsToSvgPolygon,
  normalizeSensoryStamp,
  formatChroniclePosterPayload,
} from '../chronicleHelpers.js'

describe('chronicleHelpers 声之手账纯函数工具库', () => {
  it('基础常量完整且字段定义符合规范', () => {
    expect(SENSORY_STAMP_TYPES.length).toBe(6)
    expect(RADAR_DIMENSIONS.length).toBe(4)
    expect(CHRONICLE_TIERS.length).toBe(4)
    expect(DEFAULT_RADAR.intimacy).toBe(8)
  })

  it('calculateRadarPoints: 正确计算 4 维雷达图顶点并规范化至半径范围', () => {
    const scores = { intimacy: 10, sleepiness: 5, story: 2, spatial: 8 }
    const points = calculateRadarPoints(scores, 100, 100, 50)
    expect(points.length).toBe(4)

    // 上点 (intimacy=10): y 应为 100 - 50 = 50, x 应为 100
    expect(points[0].x).toBe(100)
    expect(points[0].y).toBe(50)
    expect(points[0].score).toBe(10)

    // 右点 (sleepiness=5): ratio 应为 0.5, r=25, x 应为 100 + 25 = 125, y 应为 100
    expect(points[1].x).toBe(125)
    expect(points[1].y).toBe(100)
  })

  it('pointsToSvgPolygon: 正确输出 SVG 点坐标字符串', () => {
    const pts = [{ x: 10, y: 20 }, { x: 30, y: 40 }]
    expect(pointsToSvgPolygon(pts)).toBe('10,20 30,40')
    expect(pointsToSvgPolygon([])).toBe('')
  })

  it('normalizeSensoryStamp: 自动补齐默认值与合法边界', () => {
    const raw = {
      time: 125.6,
      type: 'heartbeat',
      rating: 10, // 超出 5 限制，需自动 clamp 到 5
      note: '  超真实心跳  ',
    }
    const stamp = normalizeSensoryStamp(raw)
    expect(stamp.time).toBe(125.6)
    expect(stamp.rating).toBe(5)
    expect(stamp.type).toBe('heartbeat')
    expect(stamp.icon).toBe('💓')
    expect(stamp.note).toBe('超真实心跳')
    expect(typeof stamp.timeFormatted).toBe('string')
  })

  it('formatChroniclePosterPayload: 正确聚合海报卡片所需数据包', () => {
    const work = {
      title: '测试同人音声',
      cvs: ['CV小明', 'CV小红'],
      circle: '甜蜜社团',
      rjCode: 'RJ123456',
      cover: 'http://test/cover.jpg',
    }
    const chronicleData = {
      tier: 'masterpiece',
      equipment: 'Final E500',
      notes: '深度沉浸的一作',
    }
    const stamps = [
      { id: '1', rating: 5, time: 10 },
      { id: '2', rating: 3, time: 20 },
      { id: '3', rating: 4, time: 30 },
      { id: '4', rating: 5, time: 40 },
      { id: '5', rating: 2, time: 50 },
    ]

    const payload = formatChroniclePosterPayload({ work, chronicleData, stamps })
    expect(payload.title).toBe('测试同人音声')
    expect(payload.cvText).toBe('CV小明 / CV小红')
    expect(payload.tierDef.id).toBe('masterpiece')
    expect(payload.stamps.length).toBe(4) // 限制前 4 条高星级印记
    expect(payload.stamps[0].rating).toBe(5)
  })
})
