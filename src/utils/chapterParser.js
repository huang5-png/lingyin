/**
 * 聆音 (Lingyin) 音频剧情章节与时间戳解析工具
 *
 * 用于从作品描述、台本文档中自动提取时间戳章节，
 * 或管理用户自定义章节标记。
 */

/**
 * 将时间字符串 (mm:ss 或 hh:mm:ss) 解析为秒数
 * 例如:
 * "03:45" -> 225
 * "01:12:30" -> 4350
 * "75:20" -> 4520
 */
export function parseTimestampToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const clean = timeStr.trim().replace(/^\[|\(|\]|\)$/g, '')
  const parts = clean.split(':').map((p) => parseFloat(p))
  if (parts.some((n) => isNaN(n))) return 0

  if (parts.length === 2) {
    const [m, s] = parts
    return Math.max(0, m * 60 + s)
  }
  if (parts.length === 3) {
    const [h, m, s] = parts
    return Math.max(0, h * 3600 + m * 60 + s)
  }
  return 0
}

/**
 * 将秒数格式化为时分秒字符串
 * 例如: 225 -> "03:45", 3665 -> "01:01:05"
 */
export function formatSecondsToTimestamp(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00'
  const totalSecs = Math.floor(seconds)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60

  const mStr = String(m).padStart(2, '0')
  const sStr = String(s).padStart(2, '0')

  if (h > 0) {
    const hStr = String(h).padStart(2, '0')
    return `${hStr}:${mStr}:${sStr}`
  }
  return `${mStr}:${sStr}`
}

/**
 * 从多行纯文本中自动扫描提取时间戳章节
 * 支持常见格式:
 * - 05:20 掏耳环节
 * - [01:12:00] 深层催眠
 * - (02:15) - 左耳吹气
 * - 1. 00:00 序言
 */
export function extractChaptersFromText(text) {
  if (!text || typeof text !== 'string') return []

  const lines = text.split(/\r?\n/)
  const result = []

  // 匹配类似 00:00, 01:23:45, [12:34], (01:02:03) 的时间戳
  const timestampRegex = /(?:^|\s|\[|\()((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\]|\)|\s|-|:|\.|、)+([^\r\n]+)/

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const match = trimmed.match(timestampRegex)
    if (match) {
      const timeStr = match[1]
      let title = match[2].trim()

      // 清理标题开头的多余符号
      title = title.replace(/^[-—:：\s.、]+/, '').trim()
      // 如果标题结尾有括号闭合，清理
      title = title.replace(/[\])]$/, '').trim()

      if (title) {
        const seconds = parseTimestampToSeconds(timeStr)
        result.push({
          startTime: seconds,
          timeFormatted: formatSecondsToTimestamp(seconds),
          title,
        })
      }
    }
  })

  // 按起始时间升序排列，并过滤重复时间点
  return normalizeChapters(result)
}

/**
 * 规范化章节数组：按时间升序排序、去重、补充持续时间
 */
export function normalizeChapters(chapters, totalDuration = 0) {
  if (!Array.isArray(chapters)) return []

  // 深拷贝并排序
  const sorted = chapters
    .filter((ch) => ch && typeof ch.title === 'string' && typeof ch.startTime === 'number' && !isNaN(ch.startTime))
    .map((ch, idx) => ({
      id: ch.id || `ch_${idx}_${Math.round(ch.startTime)}`,
      startTime: Math.max(0, ch.startTime),
      title: ch.title.trim() || `章节 ${idx + 1}`,
      timeFormatted: formatSecondsToTimestamp(ch.startTime),
    }))
    .sort((a, b) => a.startTime - b.startTime)

  // 去重（同一秒的合并/保留第一条）
  const deduped = []
  const seenTimes = new Set()

  for (const item of sorted) {
    const rounded = Math.round(item.startTime)
    if (!seenTimes.has(rounded)) {
      seenTimes.add(rounded)
      deduped.push(item)
    }
  }

  // 计算每个章节的持续时间和结束时间
  return deduped.map((item, idx) => {
    const nextItem = deduped[idx + 1]
    const endTime = nextItem
      ? nextItem.startTime
      : totalDuration > item.startTime
        ? totalDuration
        : item.startTime
    const duration = Math.max(0, endTime - item.startTime)

    return {
      ...item,
      endTime,
      duration,
      durationFormatted: formatSecondsToTimestamp(duration),
    }
  })
}

/**
 * 根据当前播放时间定位当前处于哪一个章节
 */
export function findActiveChapter(chapters, currentTime) {
  if (!Array.isArray(chapters) || chapters.length === 0) return null
  const t = Math.max(0, currentTime || 0)

  // 倒序查找第一个 startTime <= t 的章节
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (t >= chapters[i].startTime) {
      return chapters[i]
    }
  }

  // 默认返回第一个
  return chapters[0]
}
