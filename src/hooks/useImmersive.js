import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { findCurrentCue } from '../utils/subtitleParser'

/**
 * 沉浸式播放模式 Hook
 * 管理沉浸式模式的 state、refs 和逻辑
 */
export function useImmersive({ currentCues, currentTime, subtitleFontSize, playerRef }) {
  const [isImmersive, setIsImmersive] = useState(false)
  const immersiveLyricRef = useRef(null)

  // 计算当前字幕索引
  const currentCueIndex = useMemo(() => {
    return findCurrentCue(currentCues, currentTime)
  }, [currentCues, currentTime])

  // 构建带索引的字幕行
  const immersiveLyricCues = useMemo(() => {
    return currentCues.map((cue, idx) => ({
      ...cue,
      realIndex: idx,
      isActive: idx === currentCueIndex,
    }))
  }, [currentCues, currentCueIndex])

  // 沉浸式字幕自动滚动
  useEffect(() => {
    if (!isImmersive) return
    const activeEl = immersiveLyricRef.current?.querySelector(`.immersive-lyric-line.active`)
    if (activeEl && immersiveLyricRef.current) {
      const container = immersiveLyricRef.current
      const offsetTop = activeEl.offsetTop - container.offsetTop
      const targetScroll = offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }
  }, [currentCueIndex, isImmersive])

  const handleCloseImmersive = useCallback(() => {
    setIsImmersive(false)
  }, [])

  const handleOpenImmersive = useCallback(() => {
    setIsImmersive(true)
  }, [])

  const handleToggleImmersive = useCallback(() => {
    setIsImmersive((prev) => !prev)
  }, [])

  return {
    isImmersive,
    setIsImmersive,
    immersiveLyricRef,
    immersiveLyricCues,
    currentCueIndex,
    handleCloseImmersive,
    handleOpenImmersive,
    handleToggleImmersive,
  }
}
