import { describe, it, expect } from 'vitest'
import {
  isScriptFile,
  stripExtension,
  scoreScriptMatch,
  parseScriptContent,
  calculateCruiseProgress,
  findActiveScriptLine,
} from '../scriptParser'

describe('scriptParser', () => {
  describe('isScriptFile', () => {
    it('正确识别合法剧本文本文档', () => {
      expect(isScriptFile('台本.txt')).toBe(true)
      expect(isScriptFile('01_耳かき_scenario.md')).toBe(true)
      expect(isScriptFile('script.text')).toBe(true)
    })

    it('正确过滤非法或系统日志文件', () => {
      expect(isScriptFile('audio.mp3')).toBe(false)
      expect(isScriptFile('debug.log')).toBe(false)
      expect(isScriptFile('changelog.txt')).toBe(false)
      expect(isScriptFile('')).toBe(false)
    })
  })

  describe('scoreScriptMatch', () => {
    it('精准匹配当前音轨获得极高分数', () => {
      const score = scoreScriptMatch('01_耳かき_台本.txt', '01_耳かき.mp3', 'c:/voice', 'c:/voice')
      expect(score).toBeGreaterThan(80)
    })

    it('数字编号匹配音轨', () => {
      const score = scoreScriptMatch('track02_script.txt', 'track02.wav')
      expect(score).toBeGreaterThanOrEqual(50)
    })
  })

  describe('parseScriptContent', () => {
    it('结构化解析带角色、动作括号与音效的戏剧文本', () => {
      const raw = `
[SE: 部屋の扉が開く音]
（深呼吸をして、あなたのベッドに腰掛ける）
妹:「お兄ちゃん、今日も一日お疲れ様（頭を優しく撫でる）ね」
01:30 妹:「じゃあ、耳かき始めよっか」
普通の一言ナレーション
      `.trim()

      const parsed = parseScriptContent(raw)
      expect(parsed.length).toBe(5)

      // 1. SE
      expect(parsed[0].type).toBe('sound_effect')
      expect(parsed[0].content).toBe('部屋の扉が開く音')

      // 2. Action
      expect(parsed[1].type).toBe('action')
      expect(parsed[1].content).toBe('深呼吸をして、あなたのベッドに腰掛ける')

      // 3. Dialogue with inner action
      expect(parsed[2].type).toBe('dialogue')
      expect(parsed[2].speaker).toBe('妹')
      expect(parsed[2].actions).toContain('頭を優しく撫でる')
      expect(parsed[2].text).toContain('お兄ちゃん')

      // 4. Time cue dialogue
      expect(parsed[3].type).toBe('dialogue')
      expect(parsed[3].timeCue).toBe(90) // 1:30 = 90s
      expect(parsed[3].speaker).toBe('妹')

      // 5. Narration
      expect(parsed[4].type).toBe('narration')
      expect(parsed[4].text).toBe('普通の一言ナレーション')
    })
  })

  describe('calculateCruiseProgress', () => {
    it('根据当前进度计算非线性巡航目标行', () => {
      const result = calculateCruiseProgress(60, 120, 20)
      expect(result.progressRatio).toBe(0.5)
      expect(result.targetIndex).toBe(10)
    })

    it('边界防御：时长为0或无效值', () => {
      const result = calculateCruiseProgress(0, 0, 0)
      expect(result.targetIndex).toBe(0)
      expect(result.progressRatio).toBe(0)
    })
  })

  describe('findActiveScriptLine', () => {
    it('命中隐式时间戳锚点', () => {
      const lines = [
        { id: '1', timeCue: 10, text: '第一句' },
        { id: '2', timeCue: 30, text: '第二句' },
        { id: '3', timeCue: 60, text: '第三句' },
      ]
      expect(findActiveScriptLine(25, lines)).toBe(0)
      expect(findActiveScriptLine(35, lines)).toBe(1)
      expect(findActiveScriptLine(70, lines)).toBe(2)
    })

    it('结合字幕 cues 进行文本模糊对齐', () => {
      const lines = [
        { id: '1', text: 'おやすみなさい、いい夢を' },
        { id: '2', text: '耳かきの心地いい音に包まれて' },
      ]
      const cues = [{ start: 5, end: 15, text: 'いい夢を' }]
      expect(findActiveScriptLine(10, lines, cues)).toBe(0)
    })
  })
})
