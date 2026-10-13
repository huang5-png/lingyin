/**
 * audioAnalyzerManager.js
 * 共享 Web Audio 分析管线管理器
 *
 * 遵循「原汁原味的声音哲学」：
 * - 纯净直通：媒体音频直通至 audioCtx.destination，不串联任何 Gain/Filter/DSP 节点
 * - 单一源绑定：规避 HTMLMediaElement 重复 createMediaElementSource 的 InvalidStateError
 * - 双声道解耦：提供 ChannelSplitter -> AnalyserL / AnalyserR 独立声学分析
 */

// 缓存已绑定的 mediaElement 节点
let sharedContext = null
const elementNodeMap = new WeakMap()

/**
 * 获取或初始化指定 audioElement 的 Web Audio 分析节点
 * @param {HTMLMediaElement} audioElement
 * @returns {{
 *   audioCtx: AudioContext,
 *   analyserL: AnalyserNode,
 *   analyserR: AnalyserNode,
 *   analyserMaster: AnalyserNode
 * } | null}
 */
export function getOrCreateAudioNodes(audioElement) {
  if (!audioElement) return null

  if (elementNodeMap.has(audioElement)) {
    const existing = elementNodeMap.get(audioElement)
    // 确保 AudioContext 处于 running 状态
    if (existing.audioCtx.state === 'suspended') {
      existing.audioCtx.resume().catch(() => {})
    }
    return existing
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null

    if (!sharedContext || sharedContext.state === 'closed') {
      sharedContext = new AudioCtx()
    }

    if (sharedContext.state === 'suspended') {
      sharedContext.resume().catch(() => {})
    }

    const source = sharedContext.createMediaElementSource(audioElement)

    // 1. 创建立体声分离器（2 通道：0 为左，1 为右）
    const splitter = sharedContext.createChannelSplitter(2)
    source.connect(splitter)

    const analyserL = sharedContext.createAnalyser()
    analyserL.fftSize = 256
    analyserL.smoothingTimeConstant = 0.8
    splitter.connect(analyserL, 0)

    const analyserR = sharedContext.createAnalyser()
    analyserR.fftSize = 256
    analyserR.smoothingTimeConstant = 0.8
    splitter.connect(analyserR, 1)

    // 2. 主通道分析器（供常规频谱使用，并直通 destination 输出原生音频）
    const analyserMaster = sharedContext.createAnalyser()
    analyserMaster.fftSize = 256
    analyserMaster.smoothingTimeConstant = 0.8

    source.connect(analyserMaster)
    analyserMaster.connect(sharedContext.destination)

    const nodes = {
      audioCtx: sharedContext,
      source,
      splitter,
      analyserL,
      analyserR,
      analyserMaster,
    }

    elementNodeMap.set(audioElement, nodes)
    return nodes
  } catch (err) {
    console.warn('[audioAnalyzerManager] 初始化 Web Audio 失败:', err)
    return null
  }
}
