const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus']
const SUBTITLE_EXTENSIONS = ['.lrc', '.srt', '.vtt', '.ass', '.ssa']

const FORMAT_PRIORITY = {
  vtt: 5,
  srt: 3,
  lrc: 0,
  ass: -1,
  ssa: -2,
}

const ZH_KEYWORDS = ['中文', '简体', '繁体', '翻译', '译文', '汉化', '中文版', 'llm', '大模型', '机翻', 'ai翻译', '人工翻译', '字幕组', 'zh', 'chs', 'cht', 'cn', '中字']
const JA_KEYWORDS = ['日文', '日本語', 'original', '原版', '生肉', 'jp', 'jpn', '日字', '日语', '原文']
const EN_KEYWORDS = ['英文', 'english', 'en', 'eng', '英字', '英语']
const DUAL_KEYWORDS = ['双语', '中日', '日中', 'dual', 'bilingual', '双语字幕', '中日双语', '双语版']

export const audioExts = AUDIO_EXTENSIONS
export const subtitleExts = SUBTITLE_EXTENSIONS

export function getExtension(filename) {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function isAudioFile(filename) {
  return AUDIO_EXTENSIONS.includes(getExtension(filename))
}

export function isSubtitleFile(filename) {
  return SUBTITLE_EXTENSIONS.includes(getExtension(filename))
}

export function getBasename(filename) {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? filename : filename.slice(0, idx)
}

function detectLanguage(basename) {
  const lower = basename.toLowerCase()
  
  for (const kw of DUAL_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return 'dual'
    }
  }
  
  for (const kw of ZH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return 'zh'
    }
  }
  for (const kw of EN_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return 'en'
    }
  }
  for (const kw of JA_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return 'ja'
    }
  }
  return 'unknown'
}

export function detectLanguageFromContent(text) {
  if (!text) return 'unknown'

  // Strip timestamps, format tags, control chars — keep only displayable text
  const cleaned = text
    .replace(/\{[^}]*\}/g, '')          // ASS tags
    .replace(/<[^>]+>/g, '')             // HTML/VTT tags
    .replace(/\d{1,2}:\d{2}([:.]\d{2,3})?/g, '') // timestamps
    .replace(/-->/g, '')
    .replace(/[\r\n]+/g, '\n')
    .replace(/[ \t]+/g, ' ')

  const sample = cleaned.length > 8000 ? cleaned.slice(0, 8000) : cleaned

  // Count per-line language so we can detect bilingual structure
  // (e.g. one line ja, next line zh translation)
  const lines = sample.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return 'unknown'

  let totalKana = 0      // hiragana + katakana
  let totalHan = 0       // CJK ideographs (shared zh/ja)
  let totalLatin = 0     // a-z A-Z
  let totalCyrillic = 0
  // Chinese-specific high-frequency function chars (not used as Japanese)
  const zhFuncChars = new Set('的了是在和也都不就这那这个那个一们个着过吗呢吧啊呀哦么与而则即被把将让使往向於')
  let zhFuncCount = 0
  // Japanese-specific small kana / iteration marks — strong ja signal
  // (っ ァ ィ ゥ ェ ォ ッ ャ ュ ョ ゎ ゕ etc.) + ー long vowel
  let jaMarkerCount = 0
  // Chinese-specific punctuation
  const zhPunct = new Set('，。、；：？！「」『』（）《》【】…—')
  let zhPunctCount = 0
  // Japanese-specific punctuation
  const jaPunct = new Set('。、・〜～「」『』〈〉《》【】〆〇')
  let jaPunctCount = 0

  const langByLine = []   // 'zh' | 'ja' | 'en' | 'other'

  for (const line of lines) {
    let kana = 0, han = 0, latin = 0, cyr = 0
    let lineZhFunc = 0, lineJaMarker = 0
    let lineZhPunct = 0, lineJaPunct = 0

    for (const ch of line) {
      const code = ch.charCodeAt(0)
      if (code >= 0x3040 && code <= 0x309F) { kana++; totalKana++ }          // hiragana
      else if (code >= 0x30A0 && code <= 0x30FF) { kana++; totalKana++ }     // katakana
      else if (code >= 0x31F0 && code <= 0x31FF) { kana++; totalKana++ }     // kana ext
      else if (code >= 0x4E00 && code <= 0x9FFF) { han++; totalHan++ }       // CJK ideograph
      else if (code >= 0x3400 && code <= 0x4DBF) { han++; totalHan++ }       // CJK ext A
      else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) { latin++; totalLatin++ }
      else if (code >= 0x0400 && code <= 0x04FF) { cyr++; totalCyrillic++ }
      if (zhFuncChars.has(ch)) { lineZhFunc++; zhFuncCount++ }
      if (jaPunct.has(ch)) { lineJaPunct++; jaPunctCount++ }
      if (zhPunct.has(ch)) { lineZhPunct++; zhPunctCount++ }
      // small kana & long mark = strong japanese marker
      if ('っゃゅょゎァィゥェォッャュョゎゕゖー'.includes(ch)) { lineJaMarker++; jaMarkerCount++ }
    }

    // classify line
    const hasKana = kana > 0
    const hasZhFunc = lineZhFunc > 0
    if (hasKana) langByLine.push('ja')
    else if (hasZhFunc && han > 0) langByLine.push('zh')
    else if (han > 0 && latin === 0) {
      // pure han, no kana, no zh func char — could be either, lean zh (cn) but mark ambiguous
      langByLine.push('zh')
    }
    else if (latin > 0 && han === 0 && kana === 0) langByLine.push('en')
    else langByLine.push('other')
  }

  const totalChars = totalKana + totalHan + totalLatin + totalCyrillic
  if (totalChars === 0) return 'unknown'

  const kanaRatio = totalKana / totalChars
  const hanRatio = totalHan / totalChars
  const latinRatio = totalLatin / totalChars

  // Strong signals
  const hasKana = totalKana > 0
  // Chinese is indicated by: no kana at all, has han, AND has chinese function chars OR zh punctuation
  const isChineseLike = !hasKana && totalHan > 0 && (zhFuncCount > 0 || zhPunctCount > 0)
  // Japanese is indicated by: has kana (any amount) OR has japanese markers
  const isJapaneseLike = hasKana || jaMarkerCount > 0

  // Count distinct languages present at line level
  const lineLangSet = new Set(langByLine)
  const hasZhLines = lineLangSet.has('zh')
  const hasJaLines = lineLangSet.has('ja')
  const hasEnLines = lineLangSet.has('en')

  // Count lines per language (only lines where that language is dominant)
  const zhLineCount = langByLine.filter((l) => l === 'zh').length
  const jaLineCount = langByLine.filter((l) => l === 'ja').length
  const enLineCount = langByLine.filter((l) => l === 'en').length
  const totalLines = langByLine.length

  // ===== Bilingual detection =====
  // Pattern 1: alternating structure — both zh and ja/en lines present in meaningful proportion
  const zhLineRatio = zhLineCount / totalLines
  const jaLineRatio = jaLineCount / totalLines
  const enLineRatio = enLineCount / totalLines

  if (hasZhLines && hasJaLines && zhLineRatio > 0.15 && jaLineRatio > 0.15) return 'dual'
  if (hasZhLines && hasEnLines && zhLineRatio > 0.15 && enLineRatio > 0.15) return 'dual'
  if (hasJaLines && hasEnLines && jaLineRatio > 0.15 && enLineRatio > 0.15) return 'dual'

  // Pattern 2: mixed within lines — significant kana AND chinese function chars in same content
  if (hasKana && zhFuncCount > 0 && hanRatio > 0.1) return 'dual'

  // ===== Single language =====
  if (isJapaneseLike && kanaRatio > 0.03) return 'ja'

  // Ambiguous zone: pure CJK (no kana) — could be zh OR ja
  // Check Japanese compound words FIRST (place names, grammar terms)
  // because shared chars like 都/在/行 are zh function words but also common in ja
  if (totalHan > 0 && !hasKana) {
    const jaCompoundRegex = /日本|東京|大阪|京都|横浜|名古屋|札幌|福岡|現在進行|進行形|促進法案|教育促進|東口|西口|南口|北口|号線|市役所|区役所|県庁|地下鉄|改札|出口|入口|非常口|本日|平成|令和|株式会社|有限会社|町田|八王子|日本語|法案|語教育|港区/
    if (jaCompoundRegex.test(sample)) return 'ja'
    // Then check punctuation dominance
    if (jaPunctCount > zhPunctCount) return 'ja'
    // Then fall back to chinese function chars
    if (isChineseLike) return 'zh'
    // Pure han, no signals at all → lean zh (more common case for subtitles)
    return 'zh'
  }

  if (isChineseLike) return 'zh'
  // Pure han without function chars but WITH kana → ja
  if (hasKana) return 'ja'
  if (latinRatio > 0.5) return 'en'
  if (totalCyrillic > totalChars * 0.3) return 'ru'

  return 'unknown'
}

function isTranslated(basename) {
  const lower = basename.toLowerCase()
  return lower.includes('翻译') || lower.includes('译文') || lower.includes('汉化') || lower.includes('中文版')
}

function cleanDisplayName(basename) {
  let name = basename
  name = name.replace(/^【字幕】/i, '')
  name = name.replace(/【.*?】/g, '')
  name = name.replace(/\[.*?\]/g, '')
  name = name.replace(/(翻译版?|中文版?|日文版?|英文版?|简体|繁体|字幕)/gi, '')
  name = name.trim()
  return name || basename
}

export function findAllSubtitlesForAudio(audioName, subtitleFiles, audioPath) {
  const audioBase = getBasename(audioName).toLowerCase()
  const audioClean = cleanDisplayName(getBasename(audioName)).toLowerCase()
  const audioDir = audioPath ? audioPath.replace(/[^\\/]+$/, '').toLowerCase() : ''
  const results = []

  for (const subFile of subtitleFiles) {
    const subBase = getBasename(subFile.name)
    const subBaseLower = subBase.toLowerCase()
    const format = getExtension(subFile.name).slice(1).toLowerCase()
    const language = detectLanguage(subBase)
    const translated = isTranslated(subBase)
    const displayName = cleanDisplayName(subBase)

    let matchScore = 0

    if (subBaseLower === audioBase) {
      matchScore = 100
    } else if (subBaseLower.replace(/^【字幕】/i, '').trim() === audioBase) {
      matchScore = 95
    } else {
      const subClean = cleanDisplayName(subBase).toLowerCase()
      if (subClean && audioClean && (subClean.includes(audioClean) || audioClean.includes(subClean))) {
        matchScore = 80
      } else if (subBaseLower.includes(audioBase) || audioBase.includes(subBaseLower)) {
        matchScore = 70
      } else if (audioClean && subClean) {
        let commonChars = 0
        const shorter = audioClean.length < subClean.length ? audioClean : subClean
        const longer = audioClean.length >= subClean.length ? audioClean : subClean
        for (let i = 0; i < shorter.length; i++) {
          if (longer.includes(shorter[i])) commonChars++
        }
        const similarity = commonChars / longer.length
        if (similarity > 0.5) {
          matchScore = 50 + Math.floor(similarity * 30)
        }
      }
    }

    if (matchScore > 0 && audioDir && subFile.path) {
      const subDir = subFile.path.replace(/[^\\/]+$/, '').toLowerCase()
      if (subDir === audioDir) {
        matchScore += 10
      }
    }

    if (matchScore === 0 && subtitleFiles.length <= 3) {
      matchScore = 40
    }

    if (matchScore > 0) {
      const formatBonus = FORMAT_PRIORITY[format] || 0
      matchScore += formatBonus
      if (translated) {
        matchScore -= 3
      }
      matchScore = Math.max(0, Math.min(100, matchScore))
    }

    if (matchScore > 0) {
      results.push({
        file: subFile,
        format,
        language,
        isTranslated: translated,
        matchScore,
        displayName: displayName || subBase,
      })
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore)

  return results
}

async function scanRecursive(dirPath, baseDir) {
  const result = { audioFiles: [], subtitleFiles: [] }
  const files = await window.electronAPI.readDir(dirPath)

  for (const file of files) {
    if (file.isDirectory) {
      const subResult = await scanRecursive(file.path, baseDir)
      result.audioFiles.push(...subResult.audioFiles)
      result.subtitleFiles.push(...subResult.subtitleFiles)
    } else if (isAudioFile(file.name)) {
      const relPath = file.path.slice(baseDir.length + 1)
      result.audioFiles.push({
        ...file,
        relativePath: relPath,
        displayName: relPath.replace(/\\/g, ' / '),
      })
    } else if (isSubtitleFile(file.name)) {
      const relPath = file.path.slice(baseDir.length + 1)
      result.subtitleFiles.push({
        ...file,
        relativePath: relPath,
        displayName: relPath.replace(/\\/g, ' / '),
      })
    }
  }

  return result
}

function naturalCompare(a, b) {
  const ax = a.split(/(\d+)/)
  const bx = b.split(/(\d+)/)
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    if (i >= ax.length) return -1
    if (i >= bx.length) return 1
    const av = ax[i]
    const bv = bx[i]
    const an = parseInt(av, 10)
    const bn = parseInt(bv, 10)
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn
    } else {
      if (av !== bv) return av.localeCompare(bv, 'zh-CN')
    }
  }
  return 0
}

export async function scanFolder(folderPath) {
  const result = await scanRecursive(folderPath, folderPath)

  result.audioFiles.sort((a, b) => naturalCompare(a.relativePath, b.relativePath))
  result.subtitleFiles.sort((a, b) => naturalCompare(a.relativePath, b.relativePath))

  return {
    folderPath,
    folderName: await window.electronAPI.pathBasename(folderPath),
    audioFiles: result.audioFiles,
    subtitleFiles: result.subtitleFiles,
  }
}

export function buildDirectoryTree(audioFiles, basePath) {
  const root = { name: 'root', path: basePath, isDirectory: true, children: [], audioCount: 0 }
  
  for (const audio of audioFiles) {
    const relPath = audio.relativePath || audio.folder
      ? (audio.folder ? `${audio.folder}/${audio.name}` : audio.name)
      : audio.name
    const parts = relPath.split(/[\\/]/)
    let current = root
    let currentPath = basePath
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      currentPath = currentPath + (currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : '/') + part
      
      if (i === parts.length - 1) {
        current.children.push({
          ...audio,
          name: audio.name,
          isDirectory: false,
        })
      } else {
        let child = current.children.find(c => c.isDirectory && c.name === part)
        if (!child) {
          child = { name: part, path: currentPath, isDirectory: true, children: [], audioCount: 0 }
          current.children.push(child)
        }
        child.audioCount++
        current = child
      }
    }
  }
  
  function sortNode(node) {
    node.children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return naturalCompare(a.name, b.name)
    })
    for (const child of node.children) {
      if (child.isDirectory) sortNode(child)
    }
  }
  sortNode(root)
  
  return root
}

export function pathToFileURL(filePath) {
  if (!filePath) return ''
  let normalized = filePath.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }
  return 'file://' + encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')
}

export function matchSubtitleForAudio(audioName, subtitleFiles) {
  const results = findAllSubtitlesForAudio(audioName, subtitleFiles)
  return results.length > 0 ? results[0].file : null
}

export function extractRJCode(text) {
  if (!text) return null
  const match = text.match(/[Rr][Jj]\s*(\d{3,8})/)
  if (match) {
    return 'RJ' + match[1]
  }
  return null
}

export async function scanMediaLibrary(rootPath) {
  const results = []

  function isRJCodeDir(dirName) {
    return /^[Rr][Jj]\d{3,8}/.test(dirName)
  }

  async function hasAudioDeep(dirPath) {
    try {
      const files = await window.electronAPI.readDir(dirPath)
      for (const file of files) {
        if (file.isDirectory) {
          if (await hasAudioDeep(file.path)) {
            return true
          }
        } else if (isAudioFile(file.name)) {
          return true
        }
      }
    } catch (e) {
      console.error('Error checking audio deep in:', dirPath, e)
    }
    return false
  }

  async function scanDir(dirPath, isRoot = false) {
    try {
      const dirName = await window.electronAPI.pathBasename(dirPath)
      const files = await window.electronAPI.readDir(dirPath)
      let hasDirectAudio = false
      const subdirsWithAudio = []

      for (const file of files) {
        if (file.isDirectory) {
          const subHasAudio = await hasAudioDeep(file.path)
          if (subHasAudio) {
            subdirsWithAudio.push(file)
          }
        } else if (isAudioFile(file.name)) {
          hasDirectAudio = true
        }
      }

      if (isRJCodeDir(dirName) && (hasDirectAudio || subdirsWithAudio.length > 0)) {
        const folderInfo = await scanFolder(dirPath)
        results.push(folderInfo)
        return
      }

      if (hasDirectAudio) {
        const folderInfo = await scanFolder(dirPath)
        results.push(folderInfo)
        return
      }

      for (const subdir of subdirsWithAudio) {
        await scanDir(subdir.path, false)
      }
    } catch (e) {
      console.error('Error scanning dir:', dirPath, e)
    }
  }

  try {
    await scanDir(rootPath, true)
  } catch (e) {
    console.error('Error scanning media library root:', rootPath, e)
  }

  return results
}
