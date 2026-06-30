import { useState, useEffect, useCallback } from 'react'

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

export function useSleepTimer({ playerRef, showToast }) {
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0)
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0)

  const setSleepTimer = useCallback((minutes) => {
    setSleepTimerMinutes(minutes)
    if (minutes > 0) {
      setSleepTimerRemaining(minutes * 60)
      showToast?.(`睡眠定时器已设置：${minutes} 分钟后停止播放`, 'info')
    } else {
      setSleepTimerRemaining(0)
      showToast?.('睡眠定时器已取消', 'info')
    }
  }, [showToast])

  useEffect(() => {
    if (sleepTimerMinutes <= 0) return
    const timer = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev <= 1) {
          if (playerRef?.current) {
            playerRef.current.playPause?.()
          }
          setSleepTimerMinutes(0)
          showToast?.('睡眠定时器到时，播放已停止', 'info')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [sleepTimerMinutes, showToast, playerRef])

  const formatSleepTimerRemaining = useCallback((seconds) => {
    if (seconds <= 0) return ''
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

  return {
    sleepTimerMinutes,
    sleepTimerRemaining,
    setSleepTimer,
    formatSleepTimerRemaining,
  }
}
