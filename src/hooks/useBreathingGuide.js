import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  BREATHING_PATTERNS,
  getBreathingPhase,
  calculateTotalBreathingDuration,
} from '../utils/breathingGuide'

/**
 * useBreathingGuide
 * 深眠呼吸导引与助眠座舱状态机 Hook
 *
 * @param {Object} options
 * @param {Function} [options.onSleepTrigger] - 达成设定循环后触发的休眠回调（如暂停播放）
 * @param {Function} [options.onToast] - 消息通知
 */
export function useBreathingGuide({ onSleepTrigger, onToast } = {}) {
  const [isActive, setIsActive] = useState(false)
  const [patternId, setPatternId] = useState('4-7-8')
  const [isDarkRoom, setIsDarkRoom] = useState(false)
  const [cycleLimit, setCycleLimit] = useState(0) // 0 表示无限循环，4/8/12 表示指定周期后入眠
  const [elapsed, setElapsed] = useState(0)

  const startTimeRef = useRef(null)
  const timerRef = useRef(null)
  const completedRef = useRef(false)

  // 计算当前瞬时呼吸状态
  const breathingState = useMemo(() => {
    return getBreathingPhase(elapsed, patternId)
  }, [elapsed, patternId])

  // 周期到达检测
  useEffect(() => {
    if (!isActive || cycleLimit <= 0 || completedRef.current) return

    if (breathingState.cycleIndex > cycleLimit) {
      completedRef.current = true
      setIsActive(false)
      onToast?.(`已完成 ${cycleLimit} 轮深眠呼吸导引，伴您安稳入梦`, 'success')
      onSleepTrigger?.()
    }
  }, [isActive, cycleLimit, breathingState.cycleIndex, onSleepTrigger, onToast])

  // 运行计时器 (以高精度 RAF + performance.now 驱动平滑流动)
  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current)
      startTimeRef.current = null
      return
    }

    completedRef.current = false
    startTimeRef.current = performance.now() - elapsed * 1000

    const tick = () => {
      const now = performance.now()
      const totalSec = Math.max(0, (now - startTimeRef.current) / 1000)
      setElapsed(totalSec)
      timerRef.current = requestAnimationFrame(tick)
    }

    timerRef.current = requestAnimationFrame(tick)

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current)
    }
  }, [isActive])

  const start = useCallback(() => {
    completedRef.current = false
    setElapsed(0)
    startTimeRef.current = performance.now()
    setIsActive(true)
  }, [])

  const stop = useCallback(() => {
    setIsActive(false)
    setElapsed(0)
  }, [])

  const toggle = useCallback(() => {
    if (isActive) {
      stop()
    } else {
      start()
    }
  }, [isActive, start, stop])

  const changePattern = useCallback((newPatternId) => {
    if (BREATHING_PATTERNS[newPatternId]) {
      setPatternId(newPatternId)
      setElapsed(0)
      startTimeRef.current = performance.now()
    }
  }, [])

  const toggleDarkRoom = useCallback(() => {
    setIsDarkRoom((prev) => !prev)
  }, [])

  return {
    isActive,
    patternId,
    currentPattern: BREATHING_PATTERNS[patternId] || BREATHING_PATTERNS['4-7-8'],
    isDarkRoom,
    cycleLimit,
    elapsed,
    breathingState,
    start,
    stop,
    toggle,
    setPatternId: changePattern,
    setIsDarkRoom,
    toggleDarkRoom,
    setCycleLimit,
    availablePatterns: BREATHING_PATTERNS,
  }
}
