import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DEFAULT_FADE_SECONDS,
  formatSleepRemaining,
  remainingSecondsUntil,
  resolveTimePointTarget,
} from '../utils/sleepTimer'

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

export const SLEEP_TIMER_FADE_OPTIONS = [
  { label: '10 秒', value: 10 },
  { label: '30 秒', value: 30 },
  { label: '60 秒', value: 60 },
]

const FADE_TICK_MS = 100
const TIMER_TICK_MS = 500

/**
 * 睡眠定时器：倒计时 / 曲目结束 / 指定时间点三种模式，支持渐弱淡出后暂停。
 *
 * 关键约定：
 * - 定时以「截止时间戳 deadline」为唯一依据，避免逐秒累加造成的漂移；
 * - 渐弱开关与时长来自 settings，通过 updateSettings 持久化（单一数据源）；
 * - 到点后调用播放器的 pause() 显式暂停，不使用 playPause() 切换（避免暂停态被反向播放）；
 * - 仅在真正发生过渐弱时才恢复音量，未渐弱时不会篡改用户音量。
 */
export function useSleepTimer({ playerRef, showToast, settings, updateSettings }) {
  const [mode, setMode] = useState(SLEEP_TIMER_MODES.COUNTDOWN)
  const [isActive, setIsActive] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [deadline, setDeadline] = useState(null)

  const configuredFadeEnabled = settings?.sleepTimerFadeEnabled
  const fadeEnabled = configuredFadeEnabled !== false
  const configuredFadeSeconds = Number(settings?.sleepTimerFadeSeconds)
  const fadeSeconds = Number.isFinite(configuredFadeSeconds) && configuredFadeSeconds > 0
    ? configuredFadeSeconds
    : DEFAULT_FADE_SECONDS

  const fadeIntervalRef = useRef(null)
  const fadeStartVolumeRef = useRef(null)
  const isActiveRef = useRef(false)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const clearFadeInterval = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }
  }, [])

  // 结束渐弱并把音量恢复到渐弱前的值；未渐弱过则不动音量
  const restoreVolume = useCallback(() => {
    const startVolume = fadeStartVolumeRef.current
    fadeStartVolumeRef.current = null
    if (startVolume != null) {
      playerRef?.current?.setVolume?.(startVolume)
    }
  }, [playerRef])

  const resetTimerState = useCallback(() => {
    clearFadeInterval()
    restoreVolume()
    setIsFading(false)
    setIsActive(false)
    setDeadline(null)
    setRemainingSeconds(0)
  }, [clearFadeInterval, restoreVolume])

  const stopPlayback = useCallback((message = '睡眠定时器到时，播放已暂停') => {
    clearFadeInterval()
    restoreVolume()
    setIsFading(false)
    setIsActive(false)
    setDeadline(null)
    setRemainingSeconds(0)

    const player = playerRef?.current
    if (player?.pause) {
      player.pause()
    } else {
      player?.playPause?.()
    }
    showToast?.(message, 'info')
  }, [clearFadeInterval, restoreVolume, playerRef, showToast])

  const startFadeOut = useCallback(() => {
    if (fadeStartVolumeRef.current != null) return
    if (!fadeEnabled || fadeSeconds <= 0 || !playerRef?.current?.setVolume) {
      stopPlayback()
      return
    }

    const startVolume = playerRef.current.getVolume?.() ?? 1
    fadeStartVolumeRef.current = startVolume
    setIsFading(true)

    const ticks = Math.max(1, Math.round(fadeSeconds * 1000 / FADE_TICK_MS))
    const volumeStep = startVolume / ticks
    let step = 0

    fadeIntervalRef.current = setInterval(() => {
      step++
      const nextVolume = Math.max(0, startVolume - volumeStep * step)
      playerRef.current?.setVolume?.(nextVolume)
      if (step >= ticks) {
        clearFadeInterval()
        stopPlayback()
      }
    }, FADE_TICK_MS)
  }, [fadeEnabled, fadeSeconds, playerRef, clearFadeInterval, stopPlayback])

  // 统一计时：倒计时与指定时间点都基于 deadline
  useEffect(() => {
    if (!isActive || deadline == null || isFading) return

    const tick = () => {
      const seconds = remainingSecondsUntil(deadline)
      setRemainingSeconds(seconds)
      if (seconds <= 0) {
        stopPlayback()
        return
      }
      if (fadeEnabled && fadeSeconds > 0 && seconds <= fadeSeconds) {
        startFadeOut()
      }
    }

    tick()
    const timer = setInterval(tick, TIMER_TICK_MS)
    return () => clearInterval(timer)
  }, [isActive, deadline, isFading, fadeEnabled, fadeSeconds, startFadeOut, stopPlayback])

  const cancelSleepTimer = useCallback(({ notify = false } = {}) => {
    resetTimerState()
    if (notify) {
      showToast?.('睡眠定时器已取消', 'info')
    }
  }, [resetTimerState, showToast])

  const setCountdownTimer = useCallback((minutes) => {
    cancelSleepTimer()
    const mins = Number(minutes)
    if (!Number.isFinite(mins) || mins <= 0) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }
    setMode(SLEEP_TIMER_MODES.COUNTDOWN)
    setDeadline(Date.now() + mins * 60 * 1000)
    setRemainingSeconds(mins * 60)
    setIsActive(true)
    showToast?.(`睡眠定时器已设置：${mins} 分钟后暂停播放`, 'info')
  }, [cancelSleepTimer, showToast])

  const setTrackEndTimer = useCallback((enabled) => {
    cancelSleepTimer()
    if (!enabled) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }
    setMode(SLEEP_TIMER_MODES.TRACK_END)
    setIsActive(true)
    showToast?.('睡眠定时器已设置：当前曲目播放完毕后暂停', 'info')
  }, [cancelSleepTimer, showToast])

  const setTimePointTimer = useCallback((timeStr) => {
    cancelSleepTimer()
    const target = resolveTimePointTarget(timeStr)
    if (target == null) {
      showToast?.('睡眠定时器已取消', 'info')
      return
    }
    setMode(SLEEP_TIMER_MODES.TIME_POINT)
    setDeadline(target)
    setRemainingSeconds(remainingSecondsUntil(target))
    setIsActive(true)
    showToast?.(`睡眠定时器已设置：${timeStr} 暂停播放`, 'info')
  }, [cancelSleepTimer, showToast])

  const setFadeEnabled = useCallback((enabled) => {
    updateSettings?.({ sleepTimerFadeEnabled: !!enabled })
  }, [updateSettings])

  const setFadeSeconds = useCallback((seconds) => {
    const value = Number(seconds)
    if (!Number.isFinite(value) || value <= 0) return
    updateSettings?.({ sleepTimerFadeSeconds: value })
  }, [updateSettings])

  const handleTrackFinish = useCallback(() => {
    if (isActiveRef.current && mode === SLEEP_TIMER_MODES.TRACK_END) {
      stopPlayback('当前曲目已播放完毕，睡眠定时器已暂停播放')
      return true
    }
    return false
  }, [mode, stopPlayback])

  const getStatusText = useCallback(() => {
    if (!isActive) return ''
    if (isFading) return '渐弱中...'
    if (mode === SLEEP_TIMER_MODES.TRACK_END) return '曲目结束'
    return formatSleepRemaining(remainingSeconds)
  }, [isActive, isFading, mode, remainingSeconds])

  return {
    mode,
    isActive,
    isFading,
    remainingSeconds,
    fadeEnabled,
    fadeSeconds,
    setFadeEnabled,
    setFadeSeconds,
    setCountdownTimer,
    setTrackEndTimer,
    setTimePointTimer,
    cancelSleepTimer,
    handleTrackFinish,
    formatRemaining: formatSleepRemaining,
    getStatusText,
    SLEEP_TIMER_PRESETS,
    SLEEP_TIMER_MODES,
    SLEEP_TIMER_FADE_OPTIONS,
  }
}
