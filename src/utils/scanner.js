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
  return 'ja'
}

export function detectLanguageFromContent(text) {
  if (!text) return 'unknown'
  
  let zhCount = 0
  let jaCount = 0
  let enCount = 0
  let totalChars = 0
  
  let hiraganaCount = 0
  let katakanaCount = 0
  let kanjiCount = 0
  
  const sample = text.length > 10000 ? text.slice(0, 10000) : text
  
  for (const char of sample) {
    const code = char.charCodeAt(0)
    
    if (/[a-zA-Z]/.test(char)) {
      enCount++
      totalChars++
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      zhCount++
      kanjiCount++
      totalChars++
    } else if (code >= 0x3040 && code <= 0x309F) {
      jaCount++
      hiraganaCount++
      totalChars++
    } else if (code >= 0x30A0 && code <= 0x30FF) {
      jaCount++
      katakanaCount++
      totalChars++
    } else if (code >= 0x31F0 && code <= 0x31FF) {
      jaCount++
      katakanaCount++
      totalChars++
    }
  }
  
  if (totalChars === 0) return 'unknown'
  
  const zhRatio = zhCount / totalChars
  const jaRatio = jaCount / totalChars
  const enRatio = enCount / totalChars
  
  const hiraganaRatio = hiraganaCount / totalChars
  const katakanaRatio = katakanaCount / totalChars
  const kanaRatio = hiraganaRatio + katakanaRatio
  
  const hasSignificantZh = zhRatio > 0.2
  const hasSignificantJa = jaRatio > 0.08
  const hasSignificantEn = enRatio > 0.3
  
  if (kanaRatio > 0.05 && zhRatio > 0.15) {
    return 'dual'
  }
  
  if (hasSignificantZh && hasSignificantJa && kanaRatio > 0.03) {
    return 'dual'
  }
  
  if (kanaRatio > 0.15) {
    return 'ja'
  }
  
  if (zhRatio > 0.5) return 'zh'
  if (jaRatio > 0.3) return 'ja'
  if (enRatio > 0.6) return 'en'
  
  if (hasSignificantZh && !hasSignificantJa) return 'zh'
  if (hasSignificantJa) return 'ja'
  if (hasSignificantEn) return 'en'
  
  if (zhCount > 0 && zhRatio > 0.1) return 'zh'
  if (jaCount > 0) return 'ja'
  
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

  async function scanDir(dirPath) {
    try {
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

      if (hasDirectAudio) {
        const folderInfo = await scanFolder(dirPath)
        results.push(folderInfo)
        return
      }

      for (const subdir of subdirsWithAudio) {
        await scanDir(subdir.path)
      }
    } catch (e) {
      console.error('Error scanning dir:', dirPath, e)
    }
  }

  try {
    await scanDir(rootPath)
  } catch (e) {
    console.error('Error scanning media library root:', rootPath, e)
  }

  return results
}
