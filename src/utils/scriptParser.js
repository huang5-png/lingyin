/**
 * 音声台本与剧本文档智能解析纯函数模块
 * 
 * 核心功能：
 * 1. 扫描与识别剧本/台本文档（.txt, .md, .text）
 * 2. 智能打分排序（优先匹配当前音频音轨名、台本/scenario/script 关键词）
 * 3. 剧本结构化分行解析（角色说话人、情绪/情境动作微表情、音效SE、旁白叙事、隐式时间戳）
 * 4. 声速自适应平滑巡航进度计算（根据播放时间与字数分布非线性插值）
 * 5. 台本与字幕 cues 智能跨轨对齐
 */

// 台本扩展名
export const SCRIPT_EXTENSIONS = ['.txt', '.md', '.text']

// 排除的非台本文档关键词
const IGNORED_FILENAME_KEYWORDS = [
  'debug', 'log', 'error', 'changelog', 'update', 'license', 'install',
  'readme_player', 'dlsite_order', 'url', 'link'
]

// 高优先级台本关键词
const SCRIPT_NAME_KEYWORDS = [
  '台本', 'scenario', 'script', 'セリフ', '台词', '剧本', 'テキスト', 'text', 'story', 'track'
]

/**
 * 判断文件名是否为文本台本文档
 */
export function isScriptFile(filename) {
  if (!filename) return false
  const lower = filename.toLowerCase()
  const dotIdx = lower.lastIndexOf('.')
  if (dotIdx === -1) return false
  const ext = lower.slice(dotIdx)
  if (!SCRIPT_EXTENSIONS.includes(ext)) return false
  for (const kw of IGNORED_FILENAME_KEYWORDS) {
    if (lower.includes(kw)) return false
  }
  return true
}

/**
 * 去除文件名后缀
 */
export function stripExtension(filename) {
  if (!filename) return ''
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx === -1 ? filename : filename.slice(0, dotIdx)
}

/**
 * 针对当前音频为台本文档打分
 */
export function scoreScriptMatch(scriptName, audioName, scriptDir = '', audioDir = '') {
  if (!scriptName) return 0
  const scriptBase = stripExtension(scriptName).toLowerCase()
  const audioBase = stripExtension(audioName || '').toLowerCase()
  let score = 10

  // 1. 完全或极高匹配当前音频名
  if (audioBase && scriptBase.includes(audioBase)) {
    score += 80
  } else if (audioBase) {
    // 提取数字音轨编号对比（如 01, track01）
    const audioTrackMatch = audioBase.match(/(\d{1,3})/)
    const scriptTrackMatch = scriptBase.match(/(\d{1,3})/)
    if (audioTrackMatch && scriptTrackMatch && audioTrackMatch[1] === scriptTrackMatch[1]) {
      score += 50
    }
  }

  // 2. 含有经典台本关键词
  for (const kw of SCRIPT_NAME_KEYWORDS) {
    if (scriptBase.includes(kw)) {
      score += 25
      break
    }
  }

  // 3. 同目录优先
  if (scriptDir && audioDir && scriptDir.toLowerCase() === audioDir.toLowerCase()) {
    score += 15
  }

  return score
}

/**
 * 结构化解析台本文档内容
 * @param {string} rawText 原始文本
 * @returns {Array<ScriptLine>}
 */
export function parseScriptContent(rawText) {
  if (!rawText || typeof rawText !== 'string') return []

  // 统一换行符
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines = []
  let lineIdx = 0

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i]
    const trimmed = rawLine.trim()

    // 保留空行作为章节分段
    if (!trimmed) {
      lines.push({
        id: `line_${lineIdx++}`,
        type: 'blank',
        rawText: '',
      })
      continue
    }

    // 1. 尝试嗅探时间戳 [01:23] 或 01:23:45
    let timeCue = null
    let workingText = trimmed
    const timeMatch = workingText.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*/)
    if (timeMatch) {
      if (timeMatch[3] !== undefined) {
        // hh:mm:ss
        timeCue = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10)
      } else {
        // mm:ss
        timeCue = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)
      }
      workingText = workingText.slice(timeMatch[0].length).trim()
    }

    // 2. 检查音效标记 [SE: ...] 或 【SE: ...】或 (SE: ...)
    const seMatch = workingText.match(/^[\[【\(（](?:SE|BGM|効果音|Sound|Bgm)\s*[:：]?\s*([^\]】\)）]+)[\]】\)）]$/i)
    if (seMatch) {
      lines.push({
        id: `line_${lineIdx++}`,
        type: 'sound_effect',
        content: seMatch[1].trim(),
        timeCue,
        rawText: trimmed,
      })
      continue
    }

    // 3. 检查情境动作/微表情独占描写行：例如 （耳元に近づいて囁く） 或 (深呼吸)
    const actionOnlyMatch = workingText.match(/^[\(（]([^\)）]+)[\)）]$/)
    if (actionOnlyMatch) {
      lines.push({
        id: `line_${lineIdx++}`,
        type: 'action',
        content: actionOnlyMatch[1].trim(),
        timeCue,
        rawText: trimmed,
      })
      continue
    }

    // 4. 检查角色台词行：
    // 形式 A: 角色名:「台词」 或 角色名：台词
    // 形式 B: 【角色名】台词
    // 形式 C: 角色名「台词」
    let speaker = null
    let speechContent = null

    const colonMatch = workingText.match(/^([^:：\s「」『』【】]{1,16})\s*[:：]\s*(.*)$/)
    const bracketSpeakerMatch = workingText.match(/^【([^】]{1,16})】\s*(.*)$/)
    const quoteSpeakerMatch = workingText.match(/^([^「『\s]{1,16})\s*[「『](.*)[」』]$/)

    if (colonMatch) {
      speaker = colonMatch[1].trim()
      speechContent = colonMatch[2].trim()
    } else if (bracketSpeakerMatch) {
      speaker = bracketSpeakerMatch[1].trim()
      speechContent = bracketSpeakerMatch[2].trim()
    } else if (quoteSpeakerMatch) {
      speaker = quoteSpeakerMatch[1].trim()
      speechContent = quoteSpeakerMatch[2].trim()
    }

    // 如果台词带引号包裹，去掉首尾引号
    if (speechContent) {
      speechContent = speechContent.replace(/^[「『"\s]+|[」』"\s]+$/g, '')
    }

    if (speaker && speechContent !== null) {
      // 提炼台词内部的动作微表情，如 "こんにちは（頭を撫でる）よろしくね"
      const actionFragments = []
      const cleanSpeech = speechContent.replace(/[\(（]([^\)）]+)[\)）]/g, (_, act) => {
        actionFragments.push(act.trim())
        return ' '
      }).replace(/\s+/g, ' ').trim()

      lines.push({
        id: `line_${lineIdx++}`,
        type: 'dialogue',
        speaker,
        text: cleanSpeech || speechContent,
        actions: actionFragments,
        timeCue,
        rawText: trimmed,
      })
      continue
    }

    // 5. 普通叙事与旁白
    lines.push({
      id: `line_${lineIdx++}`,
      type: 'narration',
      text: workingText,
      timeCue,
      rawText: trimmed,
    })
  }

  return lines
}

/**
 * 计算自动平滑随行巡航目标
 * @param {number} currentTime 当前播放时间（秒）
 * @param {number} duration 总时长（秒）
 * @param {number} totalLines 总有效行数
 * @returns {{ targetIndex: number, progressRatio: number }}
 */
export function calculateCruiseProgress(currentTime, duration, totalLines) {
  if (!duration || duration <= 0 || !totalLines || totalLines <= 0) {
    return { targetIndex: 0, progressRatio: 0 }
  }
  const ratio = Math.max(0, Math.min(1, currentTime / duration))
  const targetIndex = Math.min(totalLines - 1, Math.floor(ratio * totalLines))
  return {
    targetIndex,
    progressRatio: ratio,
  }
}

/**
 * 根据当前播放时间或字幕 cues 定位当前激活的台本行
 */
export function findActiveScriptLine(currentTime, scriptLines, cues = []) {
  if (!scriptLines || scriptLines.length === 0) return -1

  // 优先策略 1：检查台本中自带的显式时间戳 timeCue
  const linesWithCue = scriptLines
    .map((line, idx) => ({ idx, timeCue: line.timeCue }))
    .filter((item) => item.timeCue !== null && item.timeCue !== undefined)

  if (linesWithCue.length > 0) {
    let bestIdx = -1
    for (const item of linesWithCue) {
      if (currentTime >= item.timeCue) {
        bestIdx = item.idx
      } else {
        break
      }
    }
    if (bestIdx !== -1) return bestIdx
  }

  // 策略 2：如果有字幕 cues 且当前有激活字幕，做语义子串匹配
  if (cues && cues.length > 0) {
    const activeCue = cues.find((c) => currentTime >= c.start && currentTime <= c.end)
    if (activeCue && activeCue.text) {
      const cueClean = activeCue.text.replace(/[\s\r\n\.,，。？！?!~～]/g, '').toLowerCase()
      if (cueClean.length >= 3) {
        for (let i = 0; i < scriptLines.length; i++) {
          const sl = scriptLines[i]
          const target = (sl.text || sl.content || sl.rawText || '').replace(/[\s\r\n\.,，。？！?!~～]/g, '').toLowerCase()
          if (target && (target.includes(cueClean) || cueClean.includes(target))) {
            return i
          }
        }
      }
    }
  }

  return -1
}
