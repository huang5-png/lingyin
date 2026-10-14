import { describe, it, expect } from 'vitest'
import {
  analyzeSeiyuuProfile,
  formatListeningTime,
  buildSeiyuuRadioQueue,
} from '../seiyuuAnalyzer'

describe('seiyuuAnalyzer', () => {
  const mockWorks = [
    {
      id: 'work_1',
      title: '秋の夜長のお耳癒やし',
      cvs: ['小岩井ことり', '逢坂成美'],
      circle: '癒しの杜',
      rating: 4.8,
      tags: ['耳かき', '囁き', '睡眠誘導', 'ASMR'],
      audioFiles: [
        { path: 'c:/a1.mp3', name: '01.mp3', duration: 1800 },
        { path: 'c:/a2.mp3', name: '02.mp3', duration: 1200 },
      ],
      createdAt: 1000,
    },
    {
      id: 'work_2',
      title: '真夜中の甘やかし添い寝',
      cvs: ['小岩井ことり'],
      circle: '癒しの杜',
      rating: 4.9,
      tags: ['添い寝', '甘々', '囁き'],
      audioFiles: [
        { path: 'c:/b1.mp3', name: 'b1.mp3', duration: 2400 },
      ],
      createdAt: 2000,
    },
    {
      id: 'work_3',
      title: '別声優の作品',
      cvs: ['陽向葵ゅか'],
      circle: '桃色ぽっぷ',
      tags: ['耳かき'],
    },
  ]

  const mockHistory = [
    { workId: 'work_1', vas: ['小岩井ことり'], duration: 1500 },
    { workId: 'work_2', vas: ['小岩井ことり'], duration: 2500 },
    { workId: 'work_3', vas: ['陽向葵ゅか'], duration: 3000 },
  ]

  const mockStamps = [
    { workId: 'work_1', time: 120, note: '极度舒服的右耳细语' },
  ]

  describe('formatListeningTime', () => {
    it('正确格式化小时与分钟', () => {
      expect(formatListeningTime(3660)).toBe('1 小时 1 分钟')
      expect(formatListeningTime(180)).toBe('3 分钟')
      expect(formatListeningTime(0)).toBe('0 分钟')
    })
  })

  describe('analyzeSeiyuuProfile', () => {
    it('全维度聚合声优履历、总陪伴时长与声线特征', () => {
      const profile = analyzeSeiyuuProfile('小岩井ことり', mockWorks, mockHistory, mockStamps)
      expect(profile).not.toBeNull()
      expect(profile.cvName).toBe('小岩井ことり')
      expect(profile.totalWorks).toBe(2)
      expect(profile.totalTracks).toBe(3)
      expect(profile.totalListeningSeconds).toBe(4000) // 1500 + 2500
      expect(profile.formattedListeningTime).toBe('1 小时 6 分钟')

      // 声线标签过滤掉了 ASMR，保留了 囁き、耳かき 等
      const tagNames = profile.flavorTags.map(t => t.tag)
      expect(tagNames).toContain('囁き')
      expect(tagNames).not.toContain('ASMR')

      // 社团排名
      expect(profile.circles[0].circle).toBe('癒しの杜')
      expect(profile.circles[0].count).toBe(2)

      // 心动印记
      expect(profile.stampsCount).toBe(1)
    })

    it('声优名字为空时防御返回 null', () => {
      expect(analyzeSeiyuuProfile('', mockWorks)).toBeNull()
      expect(analyzeSeiyuuProfile(null, mockWorks)).toBeNull()
    })
  })

  describe('buildSeiyuuRadioQueue', () => {
    it('编排声优专属电台队列', () => {
      const profile = analyzeSeiyuuProfile('小岩井ことり', mockWorks, mockHistory, mockStamps)
      const queue = buildSeiyuuRadioQueue(profile)
      expect(queue.length).toBe(3)
      expect(queue[0].source).toBe('seiyuu-radio')
      expect(queue[0].audio.path).toBeDefined()
    })
  })
})
