import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * 依据公历计算真实月相状态
 */
export function getMoonPhase(date = new Date()) {
  const LUNAR_MONTH = 29.53058867
  const baseNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime()
  const diffDays = (date.getTime() - baseNewMoon) / (1000 * 60 * 60 * 24)
  const phase = ((diffDays % LUNAR_MONTH) + LUNAR_MONTH) % LUNAR_MONTH
  const normalized = phase / LUNAR_MONTH // 0.0 ~ 1.0

  let name = '朔月 (新月)'
  let icon = '🌑'
  let desc = '万物安歇，深眠极夜'

  if (normalized < 0.0625 || normalized >= 0.9375) {
    name = '朔月 (新月)'
    icon = '🌑'
    desc = '万物安歇，深眠极夜'
  } else if (normalized < 0.25) {
    name = '蛾眉月'
    icon = '🌒'
    desc = '细钩初现，轻风相伴'
  } else if (normalized < 0.3125) {
    name = '上弦月'
    icon = '🌓'
    desc = '夜色渐浓，半弦宁谧'
  } else if (normalized < 0.4375) {
    name = '盈凸月'
    icon = '🌔'
    desc = '清辉如练，枕畔微温'
  } else if (normalized < 0.5625) {
    name = '望月 (满月)'
    icon = '🌕'
    desc = '皓月当空，梦境澄澈'
  } else if (normalized < 0.6875) {
    name = '亏凸月'
    icon = '🌖'
    desc = '月色渐敛，意绪悠然'
  } else if (normalized < 0.75) {
    name = '下弦月'
    icon = '🌗'
    desc = '清辉低垂，夜深梦沉'
  } else {
    name = '残月'
    icon = '🌘'
    desc = '拂晓将至，安享余梦'
  }

  return {
    normalized,
    name,
    icon,
    desc,
    age: Math.round(phase * 10) / 10,
  }
}

/**
 * 枕畔微光 · 床头夜钟助眠座舱 Hook
 * 
 * @param {Object} params
 * @param {Object} params.playerRef 播放器控制
 * @param {Function} params.onSetCountdownTimer 设置倒计时定时器
 * @param {number} params.sleepTimerRemaining 定时器剩余秒数
 * @param {Function} params.onToast Toast 提示
 */
export function useBedsideSlumber({
  playerRef = null,
  onSetCountdownTimer = null,
  sleepTimerRemaining = 0,
  onToast = null,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [pixelShift, setPixelShift] = useState({ x: 0, y: 0 })
  const [dimMode, setDimMode] = useState(false)

  // 1. 每秒刷新时间
  useEffect(() => {
    if (!isOpen) return
    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [isOpen])

  // 2. 防烧屏 (Pixel Shift) 微偏移：每 40 秒缓慢平移微小像素
  useEffect(() => {
    if (!isOpen) return
    let step = 0
    const shiftTimer = setInterval(() => {
      step += 1
      const offsetX = Math.round(Math.sin(step) * 6)
      const offsetY = Math.round(Math.cos(step) * 4)
      setPixelShift({ x: offsetX, y: offsetY })
    }, 40000)
    return () => clearInterval(shiftTimer)
  }, [isOpen])

  // 3. 计算月相
  const moonPhase = useMemo(() => {
    return getMoonPhase(currentDate)
  }, [currentDate])

  // 4. 一键延长睡眠定时 15 分钟
  const handleExtend15Minutes = useCallback(() => {
    if (!onSetCountdownTimer) return
    const currentMins = Math.ceil(sleepTimerRemaining / 60)
    const newMins = currentMins + 15
    onSetCountdownTimer(newMins)
    if (onToast) {
      onToast({
        type: 'info',
        message: `已延时入眠：定时器延长至 ${newMins} 分钟`,
      })
    }
  }, [onSetCountdownTimer, sleepTimerRemaining, onToast])

  const openBedsideClock = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeBedsideClock = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleDimMode = useCallback(() => {
    setDimMode(prev => !prev)
  }, [])

  return {
    isOpen,
    openBedsideClock,
    closeBedsideClock,
    currentDate,
    moonPhase,
    pixelShift,
    dimMode,
    toggleDimMode,
    handleExtend15Minutes,
  }
}
