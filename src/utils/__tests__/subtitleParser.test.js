import { describe, it, expect } from 'vitest'
import { parseSubtitle, detectFormat, findCurrentCue, formatTime } from '../subtitleParser.js'

describe('detectFormat', () => {
  it('detects lrc', () => {
    expect(detectFormat('[00:01.00]歌词')).toBe('lrc')
  })
  it('detects srt', () => {
    expect(detectFormat('1\n00:00:01,000 --> 00:00:02,000\nHello')).toBe('srt')
  })
  it('detects vtt', () => {
    expect(detectFormat('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello')).toBe('vtt')
  })
  it('detects ass', () => {
    expect(detectFormat('[Script Info]\nTitle: test')).toBe('ass')
  })
  it('defaults to lrc', () => {
    expect(detectFormat('任意文本')).toBe('lrc')
  })
})

describe('parseSubtitle', () => {
  it('parses lrc', () => {
    const cues = parseSubtitle('[00:01.00]第一行\n[00:03.50]第二行', 'lrc')
    expect(cues).toHaveLength(2)
    expect(cues[0]).toEqual({ time: 1, text: '第一行' })
    expect(cues[1]).toEqual({ time: 3.5, text: '第二行' })
  })

  it('parses srt', () => {
    const cues = parseSubtitle(
      '1\n00:00:01,000 --> 00:00:03,000\n第一句\n\n2\n00:00:04,000 --> 00:00:06,000\n第二句',
      'srt'
    )
    expect(cues).toHaveLength(2)
    expect(cues[0]).toEqual({ time: 1, endTime: 3, text: '第一句' })
  })

  it('parses vtt', () => {
    const cues = parseSubtitle(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello',
      'vtt'
    )
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Hello')
  })

  it('strips ASS tags from dialogue text', () => {
    const cues = parseSubtitle(
      '[Script Info]\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\an8}Hello world',
      'ass'
    )
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Hello world')
  })
})

describe('findCurrentCue', () => {
  const cues = [
    { time: 1, text: 'a' },
    { time: 3, text: 'b' },
    { time: 5, text: 'c' },
  ]
  it('finds cue at exact time', () => {
    expect(findCurrentCue(cues, 3)).toBe(1)
  })
  it('finds last cue before time', () => {
    expect(findCurrentCue(cues, 4)).toBe(1)
    expect(findCurrentCue(cues, 5.5)).toBe(2)
  })
  it('returns -1 before first cue', () => {
    expect(findCurrentCue(cues, 0.5)).toBe(-1)
  })
  it('returns -1 for empty', () => {
    expect(findCurrentCue([], 5)).toBe(-1)
  })
})

describe('formatTime', () => {
  it('formats mm:ss', () => {
    expect(formatTime(65)).toBe('01:05')
  })
  it('formats hh:mm:ss', () => {
    expect(formatTime(3661)).toBe('01:01:01')
  })
  it('handles invalid input', () => {
    expect(formatTime()).toBe('00:00')
    expect(formatTime(NaN)).toBe('00:00')
  })
})
