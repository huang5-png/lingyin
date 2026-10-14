import { describe, it, expect } from 'vitest'
import {
  extractSeriesIndex,
  extractFranchiseStem,
  detectFranchiseSeries,
} from '../seriesMatcher'

describe('seriesMatcher', () => {
  describe('extractSeriesIndex', () => {
    it('正确解析多种卷数与系列序号格式', () => {
      expect(extractSeriesIndex('【ASMR】怠惰な幼馴染 Vol.2').index).toBe(2)
      expect(extractSeriesIndex('ねこぐらし。 第3弾').index).toBe(3)
      expect(extractSeriesIndex('癒やしの時間 Part 1').index).toBe(1)
      expect(extractSeriesIndex('君と過ごす夜 ①').index).toBe(1)
      expect(extractSeriesIndex('異世界同居生活 後編').index).toBe(2)
    })
  })

  describe('extractFranchiseStem', () => {
    it('去除两端方括号与卷号，提炼核心系列名称', () => {
      expect(extractFranchiseStem('【RJ123456】怠惰な幼馴染 Vol.2 [全年齢]')).toBe('怠惰な幼馴染')
      expect(extractFranchiseStem('ねこぐらし。 第3弾 〜ミケ猫少女〜')).toContain('ねこぐらし。')
    })
  })

  describe('detectFranchiseSeries', () => {
    const mockWorks = [
      {
        id: 'w1',
        title: '怠惰な幼馴染 Vol.1',
        circle: '幼馴染倶楽部',
        cvs: ['秋野花'],
        createdAt: 100,
      },
      {
        id: 'w2',
        title: '怠惰な幼馴染 Vol.2',
        circle: '幼馴染倶楽部',
        cvs: ['秋野花'],
        createdAt: 200,
      },
      {
        id: 'w3',
        title: '怠惰な幼馴染 Vol.3',
        circle: '幼馴染倶楽部',
        cvs: ['秋野花'],
        createdAt: 300,
      },
      {
        id: 'w4',
        title: '全く無関係の作品',
        circle: '他社',
      },
    ]

    it('成功检测多部曲系列，正确关联前后作品', () => {
      const currentWork = mockWorks[1] // Vol.2
      const franchise = detectFranchiseSeries(currentWork, mockWorks)

      expect(franchise).not.toBeNull()
      expect(franchise.franchiseName).toBe('怠惰な幼馴染')
      expect(franchise.totalParts).toBe(3)
      expect(franchise.currentPartIndex).toBe(2)

      // Previous and Next
      expect(franchise.prevWork.id).toBe('w1')
      expect(franchise.nextWork.id).toBe('w3')
    })

    it('单部独立作品不构成系列返回 null', () => {
      expect(detectFranchiseSeries(mockWorks[3], mockWorks)).toBeNull()
    })
  })
})
