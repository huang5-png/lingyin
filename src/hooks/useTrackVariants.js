import { useState, useMemo, useCallback } from 'react'
import { detectTrackVariants, getVariantDiffSummary } from '../utils/trackVariants'

/**
 * 声态异构 · 音轨同态变体与无缝热切 Hook
 * 
 * @param {Object} params
 * @param {Array} params.audioFiles 当前作品的所有音频文件
 * @param {Object} params.currentAudio 当前正在播放的音频
 * @param {number} params.currentTime 当前播放时间戳 (秒)
 * @param {Object} params.playerRef 播放器命令式引用
 * @param {Function} params.onSelectAudio 切歌方法
 * @param {Function} params.onToast Toast 提示方法
 */
export function useTrackVariants({
  audioFiles = [],
  currentAudio = null,
  currentTime = 0,
  playerRef = null,
  onSelectAudio = null,
  onToast = null,
}) {
  // 是否在曲目列表中聚合折叠同场景变体
  const [collapseVariants, setCollapseVariants] = useState(() => {
    try {
      return localStorage.getItem('lingyin_collapse_variants') === 'true'
    } catch (e) {
      return true
    }
  })

  // 对比弹窗状态
  const [comparisonTarget, setComparisonTarget] = useState(null)
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)

  // 1. 全局解算当前作品的变体聚类
  const variantAnalysis = useMemo(() => {
    return detectTrackVariants(audioFiles)
  }, [audioFiles])

  // 2. 当前正在播放的音频在变体组中的状态
  const currentVariantLookup = useMemo(() => {
    if (!currentAudio || !variantAnalysis.hasVariants) return null
    return variantAnalysis.fileToGroupMap[currentAudio.path] || null
  }, [currentAudio, variantAnalysis])

  const hasVariants = !!currentVariantLookup
  const currentVariant = currentVariantLookup?.currentVariant || null
  const siblingVariants = currentVariantLookup?.otherVariants || []

  // 3. 切换曲目聚合折叠偏好
  const toggleCollapseVariants = useCallback(() => {
    setCollapseVariants((prev) => {
      const next = !prev
      try {
        localStorage.setItem('lingyin_collapse_variants', String(next))
      } catch (e) {}
      return next
    })
  }, [])

  // 4. 毫秒级无损跨轨同态热切 (Seamless Hot-Swap)
  const handleHotSwapVariant = useCallback(
    (targetVariant) => {
      if (!targetVariant || !targetVariant.audio || !onSelectAudio) return
      if (targetVariant.audio.path === currentAudio?.path) return

      const wasPlaying = playerRef?.current?.isPlaying?.() ?? true
      const liveTime = playerRef?.current?.getCurrentTime?.() || currentTime || 0

      // 切换音频
      onSelectAudio(targetVariant.audio)

      // 目标音频就绪后无缝接续当前时间戳
      const checkAndSeek = setInterval(() => {
        if (playerRef?.current && playerRef.current.getDuration() > 0) {
          playerRef.current.seekTo(liveTime)
          if (wasPlaying) {
            playerRef.current.playPause()
          }
          clearInterval(checkAndSeek)
        }
      }, 150)
      setTimeout(() => clearInterval(checkAndSeek), 6000)

      if (onToast) {
        onToast({
          type: 'info',
          message: `声态热切：${targetVariant.icon} ${targetVariant.label}（已平滑对齐进度）`,
        })
      }
    },
    [currentAudio, currentTime, playerRef, onSelectAudio, onToast],
  )

  // 5. 打开声学差异对比弹窗
  const openComparisonModal = useCallback((targetVariant) => {
    setComparisonTarget(targetVariant)
    setIsComparisonOpen(true)
  }, [])

  const closeComparisonModal = useCallback(() => {
    setIsComparisonOpen(false)
    setComparisonTarget(null)
  }, [])

  const comparisonSummary = useMemo(() => {
    if (!currentAudio || !comparisonTarget?.audio) return null
    return getVariantDiffSummary(currentAudio, comparisonTarget.audio)
  }, [currentAudio, comparisonTarget])

  return {
    variantAnalysis,
    hasVariants,
    currentVariant,
    siblingVariants,
    collapseVariants,
    toggleCollapseVariants,
    handleHotSwapVariant,
    isComparisonOpen,
    comparisonTarget,
    comparisonSummary,
    openComparisonModal,
    closeComparisonModal,
  }
}
