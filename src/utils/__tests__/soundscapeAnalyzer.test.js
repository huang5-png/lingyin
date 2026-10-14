import { describe, it, expect } from 'vitest'
import {
  detectWorkScenery,
  filterWorksByScenery,
  computeSceneryCounts,
  SCENERY_PRESETS,
} from '../soundscapeAnalyzer'

describe('soundscapeAnalyzer', () => {
  const mockWorks = [
    {
      id: 'w1',
      title: '静かな雨の日の二人きり',
      tags: ['雨音', 'ASMR', '囁き'],
      circle: '雨宿り亭',
    },
    {
      id: 'w2',
      title: '和室旅館でとろける極楽耳かき',
      tags: ['耳かき', '和室', '畳'],
      circle: '癒しの社',
    },
    {
      id: 'w3',
      title: '満天の星空の下で添い寝',
      tags: ['星空', '添い寝', '睡眠誘導'],
    },
  ]

  describe('detectWorkScenery', () => {
    it('正确识别雨夜微凉场景', () => {
      const res = detectWorkScenery(mockWorks[0])
      expect(res.primaryScenery).toBeDefined()
      expect(res.primaryScenery.id).toBe('rainy_night')
    })

    it('正确识别耳搔与和室复合场景', () => {
      const res = detectWorkScenery(mockWorks[1])
      expect(res.primaryScenery).toBeDefined()
      // 包含 ear_cleaning 和 japanese_room
      const ids = res.allMatches.map(m => m.scenery.id)
      expect(ids).toContain('ear_cleaning')
      expect(ids).toContain('japanese_room')
    })

    it('空作品对象安全返回', () => {
      expect(detectWorkScenery(null).primaryScenery).toBeNull()
      expect(detectWorkScenery({}).primaryScenery).toBeNull()
    })
  })

  describe('filterWorksByScenery', () => {
    it('过滤出匹配雨夜场景的作品', () => {
      const filtered = filterWorksByScenery(mockWorks, 'rainy_night')
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('w1')
    })
  })

  describe('computeSceneryCounts', () => {
    it('正确统计媒体库各声景作品数量分布', () => {
      const counts = computeSceneryCounts(mockWorks)
      expect(counts['rainy_night']).toBe(1)
      expect(counts['ear_cleaning']).toBe(1)
      expect(counts['ethereal_space']).toBe(1)
      expect(counts['cozy_bed']).toBe(1)
      expect(counts['cafe_leisure']).toBe(0)
    })
  })
})
