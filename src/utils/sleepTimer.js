// 睡眠定时器纯函数：目标时间解析、剩余时间计算与格式化。
// 抽离为纯函数便于单元测试，Hook 只负责状态与副作用。

export const DEFAULT_FADE_SECONDS = 30

/**
 * 计算「指定时间点」模式的目标时间戳。
 * 若今天该时刻已过，则顺延到明天，保证目标始终位于未来。
 * @param {string} timeStr 形如 "23:30" 的时间字符串
 * @param {Date} [now] 当前时间，便于测试注入
 * @returns {number|null} 目标时间戳（毫秒），非法输入返回 null
 */
export function resolveTimePointTarget(timeStr, now = new Date()) {
  if (typeof timeStr !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  const target = new Date(now.getTime())
  target.setHours(hours, minutes, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

/**
 * 距离目标时间戳的剩余秒数（向上取整，避免剩余 0.4 秒时提前显示 0）。
 * @returns {number} 非负整数
 */
export function remainingSecondsUntil(deadline, now = Date.now()) {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

/**
 * 剩余秒数格式化为 mm:ss 或 h:mm:ss，非正数返回空串。
 */
export function formatSleepRemaining(seconds) {
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
}
