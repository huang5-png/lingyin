export function parseSubtitle(text, format) {
  const fmt = format ? format.toLowerCase().replace(/^\./, '') : detectFormat(text)

  switch (fmt) {
    case 'lrc':
      return parseLRC(text)
    case 'srt':
      return parseSRT(text)
    case 'vtt':
      return parseVTT(text)
    case 'ass':
    case 'ssa':
      return parseASS(text)
    default:
      return []
  }
}

export function detectFormat(text) {
  if (!text) return 'lrc'
  if (/^\[(\d{2}):(\d{2})[.:](\d{2,3})/.test(text)) return 'lrc'
  if (/^\d+\s*$/.test(text.split('\n')[0] || '')) {
    if (text.includes('-->')) return 'srt'
  }
  if (text.startsWith('WEBVTT')) return 'vtt'
  if (text.includes('[Script Info]')) return 'ass'
  return 'lrc'
}

function parseLRC(text) {
  const lines = text.split(/\r?\n/)
  const result = []

  for (const line of lines) {
    const matches = line.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g)
    if (!matches) continue

    const content = line.replace(/\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g, '').trim()
    if (!content) continue

    for (const match of matches) {
      const timeMatch = match.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\]/)
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1], 10)
        const seconds = parseInt(timeMatch[2], 10)
        const millisStr = timeMatch[3]
        const millis = parseInt(millisStr, 10) * (millisStr.length === 2 ? 10 : 1)
        const time = minutes * 60 + seconds + millis / 1000

        result.push({ time, text: content })
      }
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

function parseSRT(text) {
  const blocks = text.trim().split(/\r?\n\r?\n/)
  const result = []

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/)
    if (lines.length < 2) continue

    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/)
    if (!timeMatch) continue

    const startTime =
      parseInt(timeMatch[1], 10) * 3600 +
      parseInt(timeMatch[2], 10) * 60 +
      parseInt(timeMatch[3], 10) +
      parseInt(timeMatch[4], 10) / 1000

    const endTime =
      parseInt(timeMatch[5], 10) * 3600 +
      parseInt(timeMatch[6], 10) * 60 +
      parseInt(timeMatch[7], 10) +
      parseInt(timeMatch[8], 10) / 1000

    const timeLineIdx = lines.indexOf(timeLine)
    const contentLines = lines.slice(timeLineIdx + 1)
    const content = contentLines.join('\n').trim()

    if (content) {
      result.push({ time: startTime, endTime, text: content })
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

function parseVTT(text) {
  const cleaned = text.replace(/^WEBVTT.*?\r?\n\r?\n/s, '')
  return parseSRT(cleaned)
}

function parseASS(text) {
  const result = []
  const lines = text.split(/\r?\n/)
  let inEvents = false
  let formatOrder = []

  for (const line of lines) {
    if (line.trim() === '[Events]') {
      inEvents = true
      continue
    }
    if (inEvents && line.startsWith('[')) {
      break
    }
    if (inEvents && line.startsWith('Format:')) {
      formatOrder = line.replace('Format:', '').split(',').map((s) => s.trim())
      continue
    }
    if (inEvents && line.startsWith('Dialogue:')) {
      const parts = line.replace('Dialogue:', '').split(',')
      const startIdx = formatOrder.indexOf('Start')
      const endIdx = formatOrder.indexOf('End')
      const textIdx = formatOrder.indexOf('Text')

      if (startIdx > -1 && textIdx > -1) {
        const startTime = parseASSTime(parts[startIdx])
        const endTime = endIdx > -1 ? parseASSTime(parts[endIdx]) : startTime
        const contentParts = parts.slice(textIdx)
        const content = contentParts.join(',').replace(/\{[^}]*\}/g, '').trim()

        if (content) {
          result.push({ time: startTime, endTime, text: content })
        }
      }
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

function parseASSTime(timeStr) {
  const match = timeStr.trim().match(/(\d+):(\d{2}):(\d{2})\.(\d{2,3})/)
  if (!match) return 0
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const centis = parseInt(match[4], 10)
  const millis = match[4].length === 2 ? centis * 10 : centis
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

export function findCurrentCue(cues, currentTime) {
  if (!cues || cues.length === 0) return -1

  let left = 0
  let right = cues.length - 1
  let result = -1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (cues[mid].time <= currentTime) {
      result = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return result
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}
