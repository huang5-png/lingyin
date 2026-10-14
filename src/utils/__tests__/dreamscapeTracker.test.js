import { describe, it, expect } from 'vitest'
import {
  formatDreamscapeClock,
  estimateSlumberMoment,
  matchDreamscapeMood,
  buildDreamscapeRecord,
  DREAMSCAPE_MOODS,
} from '../dreamscapeTracker'

describe('dreamscapeTracker', () => {
  describe('formatDreamscapeClock', () => {
    it('正确格式化昨夜时刻', () => {
      // 构造 23:30 时间戳
      const d = new Date()
      d.setHours(23, 30, 0, 0)
      const res = formatDreamscapeClock(d.getTime())
      expect(res).toContain('昨夜 23:30')
    })

    it('正确格式化凌晨时刻', () => {
      const d = new Date()
      d.setHours(1, 15, 0, 0)
      const res = formatDreamscapeClock(d.getTime())
      expect(res).toContain('凌晨 01:15')
    })
  })

  describe('estimateSlumberMoment', () => {
    it('短时长会话返回未入眠', () => {
      const res = estimateSlumberMoment({
        sessionStartTime: 1000,
        sessionEndTime: 1000 + 120 * 1000, // 2分钟
      })
      expect(res.fellAsleep).toBe(false)
      expect(res.confidence).toBe('none')
    })

    it('长时长且触发定时器时给出高置信度入眠点', () => {
      const start = 1700000000000
      const end = start + 45 * 60 * 1000 // 45分钟
      const lastActive = start + 5 * 60 * 1000 // 前5分钟有交互

      const res = estimateSlumberMoment({
        sessionStartTime: start,
        sessionEndTime: end,
        lastInteractionTime: lastActive,
        sleepTimerTriggered: true,
        audioDuration: 3600,
        finalTrackTime: 2700,
      })

      expect(res.fellAsleep).toBe(true)
      expect(res.confidence).toBe('high')
      expect(res.slumberDurationMinutes).toBe(45)
      expect(res.estimatedTrackSeconds).toBeGreaterThan(0)
    })
  })

  describe('matchDreamscapeMood', () => {
    it('包含雨声标签时匹配雨夜避难所', () => {
      const mood = matchDreamscapeMood(['雨音', 'ASMR'], '静かな夜')
      expect(mood.id).toBe('rain_retreat')
    })

    it('包含添い寝时匹配暖衾深眠', () => {
      const mood = matchDreamscapeMood(['添い寝', '囁き'], 'おやすみ')
      expect(mood.id).toBe('cozy_slumber')
    })

    it('无特定标签时回退默认意境', () => {
      const mood = matchDreamscapeMood([], '普通作品')
      expect(mood.id).toBe('whisper_dream')
    })
  })

  describe('buildDreamscapeRecord', () => {
    it('成功组装梦境回忆录对象', () => {
      const mockWork = {
        id: 'work_99',
        title: '星空添い寝',
        cvs: ['小岩井ことり'],
        circle: '星の音',
        tags: ['星空', '添い寝'],
      }
      const mockAudio = {
        name: 'track1.mp3',
        displayName: '01. おやすみ',
        path: 'd:/track1.mp3',
      }
      const mockAnalysis = {
        fellAsleep: true,
        confidence: 'high',
        estimatedSleepTimestamp: 1700000000000,
        estimatedTrackSeconds: 980,
        slumberDurationMinutes: 40,
        clockDisplay: '昨夜 23:20',
      }

      const record = buildDreamscapeRecord({
        work: mockWork,
        audio: mockAudio,
        slumberAnalysis: mockAnalysis,
        stampsCount: 2,
      })

      expect(record).toBeDefined()
      expect(record.workTitle).toBe('星空添い寝')
      expect(record.primaryCV).toBe('小岩井ことり')
      expect(record.estimatedTrackSeconds).toBe(980)
      expect(record.stampsCount).toBe(2)
      expect(record.mood).toBeDefined()
    })
  })
})
