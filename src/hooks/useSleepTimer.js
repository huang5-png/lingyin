import { useState, useEffect, useCallback, useRef } from 'react'

export const SLEEP_TIMER_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
]

export const SLEEP_TIMER_PRESETS = [5, 15, 30, 45, 60, 90]

export const SLEEP_TIMER_MODES = {
  COUNTDOWN: 'countdown',
  TRACK_END: 'trackEnd',
  TIME_POINT: 'timePoint',
}

const FADE_DURATION = 30

export function useSleepTimer({ playerRef, showToast, isPlaying, onFinish }) {
  const [mode, setMode] = useState(SLEEP_TIMER_MODES.COUNTDOWN)
  const [isActive, setIsActive] = useState(false)
  const [countdownMinutes, setCountdownMinutes] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [targetTime, setTargetTime] = useState(null)
  const [fadeEnabled, setFadeEnabled] = useState(true)
  const [isFading, setIsFading] = useState(false)

  const fadeStartVolumeRef = useRef(1)
  const fadeIntervalRef = useRef(null)

  const stopPlayback = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }
    if (playerRef?.current) {
      playerRef.current.setVolume?.(fadeStartVolumeRef.current)
      playerRef.current.playPause?.()
    }
    setIsFading(false)
    setIsActive(false)
    setCountdownMinutes(0)
    setRemainingSeconds(0)
    setTargetTime(null)
    showToast?.('睡眠定时器到时，播放已停止', 'info')
  }, [playerRef, showToast])

  const startFadeOut = useCallback(() => {
    if (!fadeEnabled || !playerRef?.current) {
      stopPlayback()
      return
    }

    const currentVol = playerRef.current.getVolume?.() ?? 1
    fadeStartVolumeRef.current = currentVol
    setIsFading(true)

    const fadeSteps = FADE_DURATION * 10
    const stepDuration = 100
    const volumeStep = currentVol / fadeSteps
    let step = 0

    fadeIntervalRef.current = setInterval(() => {
      step++
      const newVolume = Math.max(0, currentVol - volumeStep * step)
      playerRef.current?.setVolume?.(newVolume)
      if (step >= fadeSteps) {
        clearInterval(fadeIntervalRef.current)
        fadeIntervalRef.current = null
        stopPlayback()
      }
    }, stepDuration)
  }, [fadeEnabled, playerRef, stopPlayback])

  const cancelSleepTimer = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
      if (playerRef?.current) {
        playerRef.current.setVolume?.(fadeStartVolumeRef.current)
      }
    }
    setIsActive(false)
    setCountdownMinutes(0)
    setRemainingSeconds(0)
    setTargetTime(null)
    setIsFading(false)
    trackEndRegisteredRef.current = false
  }, [playerRef])

  const setCountdownTimer = useCallback((minutes) => {
    cancelSleepTimer()
    if (minutes <= 0) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }
    setMode(SLEEP_TIMER_MODES.COUNTDOWN)
    setCountdownMinutes(minutes)
    setRemainingSeconds(minutes * 60)
    setIsActive(true)
    showToast?.(`睡眠定时器已设置：${minutes} 分钟后停止播放`, 'info')
  }, [cancelSleepTimer, showToast])

  const setTrackEndTimer = useCallback((enabled) => {
    cancelSleepTimer()
    if (!enabled) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }
    setMode(SLEEP_TIMER_MODES.TRACK_END)
    setIsActive(true)
    showToast?.('睡眠定时器已设置：当前曲目播放完毕后停止', 'info')
  }, [cancelSleepTimer, showToast])

  const setTimePointTimer = useCallback((timeStr) => {
    cancelSleepTimer()
    if (!timeStr) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }

    const [hours, minutes] = timeStr.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return

    const now = new Date()
    const target = new Date()
    target.setHours(hours, minutes, 0, 0)

    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }

    const diffSeconds = Math.floor((target - now) / 1000)
    setMode(SLEEP_TIMER_MODES.TIME_POINT)
    setTargetTime(timeStr)
    setRemainingSeconds(diffSeconds)
    setIsActive(true)

    const h = hours.toString().padStart(2, '0')
    const m = minutes.toString().padStart(2, '0')
    showToast?.(`睡眠定时器已设置：${h}:${m} 停止播放`, 'info')
  }, [cancelSleepTimer, showToast])

  useEffect(() => {
    if (!isActive || mode !== SLEEP_TIMER_MODES.COUNTDOWN || remainingSeconds <= 0) return
    if (isFading) return

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= FADE_DURATION && fadeEnabled && !isFading) {
          startFadeOut()
          return prev
        }
        if (prev <= 1) {
          if (!fadeEnabled) {
            stopPlayback()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, mode, remainingSeconds, fadeEnabled, isFading, startFadeOut, stopPlayback])

  useEffect(() => {
    if (!isActive || mode !== SLEEP_TIMER_MODES.TIME_POINT || !targetTime) return
    if (isFading) return

    const timer = setInterval(() => {
      const [hours, minutes] = targetTime.split(':').map(Number)
      const now = new Date()
      const target = new Date()
      target.setHours(hours, minutes, 0, 0)
      if (target <= now) {
        target.setDate(target.getDate() + 1)
      }
      const diff = Math.floor((target - now) / 1000)
      setRemainingSeconds(diff)

      if (diff <= FADE_DURATION && fadeEnabled && !isFading) {
        startFadeOut()
      } else if (diff <= 0 && !fadeEnabled) {
        stopPlayback()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, mode, targetTime, fadeEnabled, isFading, startFadeOut, stopPlayback])

  const handleTrackFinish = useCallback(() => {
    if (isActive && mode === SLEEP_TIMER_MODES.TRACK_END) {
      stopPlayback()
      return true
    }
    return false
  }, [isActive, mode, stopPlayback])

  const formatRemaining = useCallback((seconds) => {
    if (!seconds || seconds <= 0) return ''
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m}:${s.toString().padStart(2, '0')}`
    }
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  const getStatusText = useCallback(() => {
    if (!isActive) return ''
    if (isFading) return '渐弱中...'
    if (mode === SLEEP_TIMER_MODES.TRACK_END) return '曲目结束'
    return formatRemaining(remainingSeconds)
  }, [isActive, isFading, mode, remainingSeconds, formatRemaining])

  return {
    mode,
    isActive,
    isFading,
    countdownMinutes,
    remainingSeconds,
    targetTime,
    fadeEnabled,
    setFadeEnabled,
    setCountdownTimer,
    setTrackEndTimer,
    setTimePointTimer,
    cancelSleepTimer,
    handleTrackFinish,
    formatRemaining,
    getStatusText,
    SLEEP_TIMER_PRESETS,
    SLEEP_TIMER_MODES,
  }
}
