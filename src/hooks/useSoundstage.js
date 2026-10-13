import { useState, useEffect, useRef, useCallback } from 'react'
import { getOrCreateAudioNodes } from '../utils/audioAnalyzerManager'
import {
  calculateChannelRms,
  calculateStereoPan,
  calculateAzimuth,
  calculateStereoWidth,
  calculateFrequencyBands,
  smoothValue,
  formatPanDescription,
} from '../utils/soundstageAnalyzer'

/**
 * useSoundstage
 * 双耳声场与立体方位空间监听 Hook
 *
 * @param {Object} options
 * @param {HTMLMediaElement|null} options.audioElement - 底层音频元素
 * @param {boolean} options.enabled - 是否启用实时分析
 * @param {number} options.sensitivity - 灵敏度 (0.5 ~ 2.0，默认 1.0)
 * @param {number} options.smoothFactor - 平滑阻尼系数 (0.05 ~ 0.5，默认 0.2)
 */
export function useSoundstage({
  audioElement = null,
  enabled = true,
  sensitivity = 1.0,
  smoothFactor = 0.22,
} = {}) {
  const [soundstage, setSoundstage] = useState({
    leftRms: 0,
    rightRms: 0,
    pan: 0,
    azimuth: 0,
    stereoWidth: 0,
    bands: { bass: 0, vocal: 0, air: 0, total: 0 },
    panText: '正中环绕 (Center)',
    isActive: false,
  })

  const animIdRef = useRef(null)
  const smoothedPanRef = useRef(0)
  const smoothedWidthRef = useRef(0)
  const smoothedLeftRef = useRef(0)
  const smoothedRightRef = useRef(0)

  // 临时数据缓冲
  const dataArraysRef = useRef({
    timeL: null,
    timeR: null,
    freq: null,
  })

  const updateLoop = useCallback(() => {
    if (!audioElement || !enabled || audioElement.paused) {
      setSoundstage((prev) => (prev.isActive ? { ...prev, isActive: false } : prev))
      return
    }

    const nodes = getOrCreateAudioNodes(audioElement)
    if (!nodes) {
      animIdRef.current = requestAnimationFrame(updateLoop)
      return
    }

    const { analyserL, analyserR, analyserMaster } = nodes
    let { timeL, timeR, freq } = dataArraysRef.current

    if (!timeL || timeL.length !== analyserL.fftSize) {
      timeL = new Uint8Array(analyserL.fftSize)
      timeR = new Uint8Array(analyserR.fftSize)
      freq = new Uint8Array(analyserMaster.frequencyBinCount)
      dataArraysRef.current = { timeL, timeR, freq }
    }

    analyserL.getByteTimeDomainData(timeL)
    analyserR.getByteTimeDomainData(timeR)
    analyserMaster.getByteFrequencyData(freq)

    // 1. 计算双耳 RMS 能量（带灵敏度倍率）
    const rawLeftRms = calculateChannelRms(timeL) * sensitivity
    const rawRightRms = calculateChannelRms(timeR) * sensitivity
    const leftRms = smoothValue(smoothedLeftRef.current, Math.min(1, rawLeftRms), smoothFactor)
    const rightRms = smoothValue(smoothedRightRef.current, Math.min(1, rawRightRms), smoothFactor)
    smoothedLeftRef.current = leftRms
    smoothedRightRef.current = rightRms

    // 2. 计算声相与方位角
    const rawPan = calculateStereoPan(leftRms, rightRms, 0.008)
    const smoothPan = smoothValue(smoothedPanRef.current, rawPan, smoothFactor)
    smoothedPanRef.current = smoothPan
    const azimuth = calculateAzimuth(smoothPan)

    // 3. 计算立体声分离度
    const rawWidth = calculateStereoWidth(timeL, timeR)
    const smoothWidth = Math.round(smoothValue(smoothedWidthRef.current, rawWidth, smoothFactor))
    smoothedWidthRef.current = smoothWidth

    // 4. 频段特征
    const bands = calculateFrequencyBands(freq)
    const panText = formatPanDescription(smoothPan)

    setSoundstage({
      leftRms,
      rightRms,
      pan: smoothPan,
      azimuth,
      stereoWidth: smoothWidth,
      bands,
      panText,
      isActive: true,
    })

    animIdRef.current = requestAnimationFrame(updateLoop)
  }, [audioElement, enabled, sensitivity, smoothFactor])

  useEffect(() => {
    if (!enabled || !audioElement) {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
      return
    }

    const handlePlay = () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
      animIdRef.current = requestAnimationFrame(updateLoop)
    }

    const handlePause = () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
      setSoundstage((prev) => ({ ...prev, isActive: false }))
    }

    audioElement.addEventListener('play', handlePlay)
    audioElement.addEventListener('pause', handlePause)
    audioElement.addEventListener('ended', handlePause)

    if (!audioElement.paused) {
      animIdRef.current = requestAnimationFrame(updateLoop)
    }

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
      audioElement.removeEventListener('play', handlePlay)
      audioElement.removeEventListener('pause', handlePause)
      audioElement.removeEventListener('ended', handlePause)
    }
  }, [audioElement, enabled, updateLoop])

  return soundstage
}
