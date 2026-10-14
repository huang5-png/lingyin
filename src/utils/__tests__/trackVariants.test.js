import { describe, it, expect } from 'vitest'
import {
  matchAudioVariantInfo,
  deriveCanonicalSceneKey,
  detectTrackVariants,
  getVariantDiffSummary,
} from '../trackVariants'

describe('trackVariants', () => {
  describe('matchAudioVariantInfo', () => {
    it('正确识别 BGM 变体', () => {
      const withBgm = matchAudioVariantInfo('Track01_序章(BGMあり).wav')
      expect(withBgm.matched).toBe(true)
      expect(withBgm.category).toBe('bgm')
      expect(withBgm.subType).toBe('with_bgm')
      expect(withBgm.shortTag).toBe('BGM有')

      const noBgm = matchAudioVariantInfo('Track01_序章(BGMなし).wav')
      expect(noBgm.matched).toBe(true)
      expect(noBgm.category).toBe('bgm')
      expect(noBgm.subType).toBe('no_bgm')
      expect(noBgm.shortTag).toBe('BGM无')
    })

    it('正确识别麦克风设备变体 (KU100 / 3Dio)', () => {
      const ku100 = matchAudioVariantInfo('02_耳かき_KU100.flac')
      expect(ku100.matched).toBe(true)
      expect(ku100.category).toBe('mic')
      expect(ku100.subType).toBe('ku100')

      const dio = matchAudioVariantInfo('02_耳かき_3Dio.flac')
      expect(dio.matched).toBe(true)
      expect(dio.category).toBe('mic')
      expect(dio.subType).toBe('3dio')
    })

    it('正确识别特化风格变体 (囁き強調 / 心音強め / 耳かき特化)', () => {
      const whisper = matchAudioVariantInfo('scene3 (囁き強調版).mp3')
      expect(whisper.matched).toBe(true)
      expect(whisper.category).toBe('style')
      expect(whisper.subType).toBe('whisper')

      const heartbeat = matchAudioVariantInfo('scene4 [心音強め].wav')
      expect(heartbeat.matched).toBe(true)
      expect(heartbeat.category).toBe('style')
      expect(heartbeat.subType).toBe('heartbeat')
    })

    it('未匹配变体时返回标准默认属性', () => {
      const standard = matchAudioVariantInfo('01_日常の朝.mp3')
      expect(standard.matched).toBe(false)
      expect(standard.category).toBe('standard')
    })
  })

  describe('deriveCanonicalSceneKey', () => {
    it('能够剥离变体标记并归一化基准场景名', () => {
      const key1 = deriveCanonicalSceneKey('01_プロローグ(BGMあり).wav')
      const key2 = deriveCanonicalSceneKey('01_プロローグ(BGMなし).wav')
      expect(key1).toBe('01_プロローグ')
      expect(key2).toBe('01_プロローグ')
      expect(key1).toBe(key2)
    })

    it('支持方括号和特殊分隔符归一化', () => {
      const keyKu = deriveCanonicalSceneKey('Track 02 [KU100].flac')
      const keyDio = deriveCanonicalSceneKey('Track 02 [3Dio].flac')
      expect(keyKu).toBe('track 02')
      expect(keyDio).toBe('track 02')
    })
  })

  describe('detectTrackVariants', () => {
    const mockFiles = [
      { name: '01_耳かき(BGMあり).wav', path: 'd:/audio/01_bgm.wav', displayName: '01_耳かき(BGMあり)' },
      { name: '01_耳かき(BGMなし).wav', path: 'd:/audio/01_nobgm.wav', displayName: '01_耳かき(BGMなし)' },
      { name: '02_添い寝.mp3', path: 'd:/audio/02.mp3', displayName: '02_添い寝' },
      { name: '03_マッサージ[KU100].flac', path: 'd:/audio/03_ku.flac', displayName: '03_マッサージ[KU100]' },
      { name: '03_マッサージ[3Dio].flac', path: 'd:/audio/03_dio.flac', displayName: '03_マッサージ[3Dio]' },
    ]

    it('正确聚类出多版本组与生成快速反查表', () => {
      const result = detectTrackVariants(mockFiles)
      expect(result.hasVariants).toBe(true)
      expect(result.groups.length).toBe(2)

      // 验证第 1 组：BGM 变体组
      const bgmGroup = result.groups.find(g => g.canonicalKey === '01_耳かき')
      expect(bgmGroup).toBeDefined()
      expect(bgmGroup.variants.length).toBe(2)
      expect(bgmGroup.variants[0].subType).toBe('with_bgm')
      expect(bgmGroup.variants[1].subType).toBe('no_bgm')

      // 验证反查表与 Map
      const lookup = result.fileToGroupMap['d:/audio/01_bgm.wav']
      expect(lookup).toBeDefined()
      expect(lookup.otherVariants.length).toBe(1)
      expect(lookup.otherVariants[0].audio.path).toBe('d:/audio/01_nobgm.wav')

      // 验证 sceneGroupMap 与 trackVariantMap
      expect(result.sceneGroupMap).toBeInstanceOf(Map)
      const mappedGroup = result.sceneGroupMap.get('d:/audio/01_bgm.wav')
      expect(mappedGroup).toBeDefined()
      expect(mappedGroup.primaryTrack.path).toBe('d:/audio/01_bgm.wav')
      expect(mappedGroup.variants.length).toBe(2)

      expect(result.trackVariantMap).toBeInstanceOf(Map)
      const kuInfo = result.trackVariantMap.get('d:/audio/03_ku.flac')
      expect(kuInfo).toBeDefined()
      expect(kuInfo.subType).toBe('ku100')
    })

    it('空列表与无变体列表安全处理', () => {
      expect(detectTrackVariants([]).hasVariants).toBe(false)
      expect(detectTrackVariants(null).hasVariants).toBe(false)
      expect(detectTrackVariants([{ name: 'solo.mp3', path: 'p1' }]).hasVariants).toBe(false)
    })
  })

  describe('getVariantDiffSummary', () => {
    it('正确解算格式对比', () => {
      const summary = getVariantDiffSummary(
        { name: 'track.wav', path: 'c:/a.wav' },
        { name: 'track.flac', path: 'c:/a.flac' }
      )
      expect(summary.formatDiff.isDifferent).toBe(true)
      expect(summary.formatDiff.source).toBe('WAV')
      expect(summary.formatDiff.target).toBe('FLAC')
    })
  })
})
