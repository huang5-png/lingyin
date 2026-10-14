import { useState, useEffect, useCallback, useRef } from 'react'
import { estimateSlumberMoment, buildDreamscapeRecord } from '../utils/dreamscapeTracker'

const STORAGE_KEY = 'lingyin_latest_dreamscape'

/**
 * 梦境声纹回忆录与晨光回溯管理 Hook
 */
export function useDreamscape({
  playingWork = null,
  currentAudio = null,
  currentTime = 0,
  duration = 0,
  stamps = [],
  sleepTimerActive = false,
  onToast = null,
}) {
  const [latestRecord, setLatestRecord] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  const [isRecapOpen, setIsRecapOpen] = useState(false)
  const sessionStartTimeRef = useRef(Date.now())
  const lastInteractionTimeRef = useRef(Date.now())

  // 1. 记录听众交互（播放、拖动等）
  const noteUserInteraction = useCallback(() => {
    lastInteractionTimeRef.current = Date.now()
  }, [])

  // 当切换音频或作品时重置起始时间
  useEffect(() => {
    sessionStartTimeRef.current = Date.now()
    lastInteractionTimeRef.current = Date.now()
  }, [currentAudio?.path, playingWork?.id])

  // 2. 当睡眠定时器触发或音频停止时，结算入眠记录
  const settleDreamscapeOnSleep = useCallback(
    (wasSleepTimer = true) => {
      if (!playingWork || !currentAudio) return

      const sessionEndTime = Date.now()
      const analysis = estimateSlumberMoment({
        sessionStartTime: sessionStartTimeRef.current,
        sessionEndTime,
        lastInteractionTime: lastInteractionTimeRef.current,
        sleepTimerTriggered: wasSleepTimer,
        audioDuration: duration,
        finalTrackTime: currentTime,
      })

      if (analysis.fellAsleep) {
        const record = buildDreamscapeRecord({
          work: playingWork,
          audio: currentAudio,
          slumberAnalysis: analysis,
          stampsCount: stamps.length,
        })

        if (record) {
          setLatestRecord(record)
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
          } catch (e) {}
        }
      }
    },
    [playingWork, currentAudio, duration, currentTime, stamps.length],
  )

  // 3. 晨光拂晓微标触发判断：如果是上午（5:00 ~ 13:00），且最新记录在 18 小时之内
  const hasMorningGreeting = Boolean(
    latestRecord &&
    Date.now() - latestRecord.createdAt < 18 * 60 * 60 * 1000 &&
    new Date().getHours() >= 5 &&
    new Date().getHours() <= 13
  )

  const openRecap = useCallback(() => {
    setIsRecapOpen(true)
  }, [])

  const closeRecap = useCallback(() => {
    setIsRecapOpen(false)
  }, [])

  return {
    latestRecord,
    isRecapOpen,
    openRecap,
    closeRecap,
    hasMorningGreeting,
    noteUserInteraction,
    settleDreamscapeOnSleep,
  }
}
