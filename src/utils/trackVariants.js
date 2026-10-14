/**
 * 声态异构 · 音轨同态变体检测与无缝聚类纯函数模块
 * 
 * 核心功能：
 * 1. 自动从曲目列表中嗅探多版本/多混音音频（BGM有无、KU100/3Dio双耳录音、囁き特化、心音强化等）
 * 2. 智能提取规范场景基准键 (canonicalSceneKey)，将散落冗余的同态版本收敛聚类
 * 3. 结构化标记变体类型 (BGM / 麦克风 / 风格偏好 / 耳道方位)
 * 4. 变体属性对比与无损热切差异解算
 */

// 变体模式规则定义库
export const VARIANT_PATTERNS = [
  // 1. 配乐与环境音类 (BGM)
  {
    category: 'bgm',
    subType: 'with_bgm',
    label: '含BGM',
    shortTag: 'BGM有',
    icon: '🎵',
    regex: /(?:[\(_（【\[\s_-]|^)(?:BGMあり|BGM有|BGM付(?:き)?|BGM入り|With[-_ ]?BGM|BGM[-_ ]?ver|BGM\+)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:BGMあり|BGM有|BGM付(?:き)?|BGM入り|With[-_ ]?BGM|BGM[-_ ]?ver|BGM\+)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'bgm',
    subType: 'no_bgm',
    label: '无BGM(纯人声)',
    shortTag: 'BGM无',
    icon: '🍃',
    regex: /(?:[\(_（【\[\s_-]|^)(?:BGMなし|BGM無(?:し)?|BGM抜(?:き)?|No[-_ ]?BGM|BGM[-_ ]?free|BGM[-_ ]?off|環境音のみ|人声のみ|Voice[-_ ]?Only|SEのみ|効果音のみ)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:BGMなし|BGM無(?:し)?|BGM抜(?:き)?|No[-_ ]?BGM|BGM[-_ ]?free|BGM[-_ ]?off|環境音のみ|人声のみ|Voice[-_ ]?Only|SEのみ|効果音のみ)[\)_）】\]\s_-]*/gi,
  },

  // 2. 双耳麦克风录音设备类 (MIC)
  {
    category: 'mic',
    subType: 'ku100',
    label: 'KU100 人头母带',
    shortTag: 'KU100',
    icon: '🎧',
    regex: /(?:[\(_（【\[\s_-]|^)(?:KU[-_ ]?100|Neumann|ノイマン)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:KU[-_ ]?100|Neumann|ノイマン)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'mic',
    subType: '3dio',
    label: '3Dio 双耳麦',
    shortTag: '3Dio',
    icon: '🎙️',
    regex: /(?:[\(_（【\[\s_-]|^)(?:3Dio(?:[-_ ]?FS)?|Free[-_ ]?Space|FS[-_ ]?Pro|スリーディオ)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:3Dio(?:[-_ ]?FS)?|Free[-_ ]?Space|FS[-_ ]?Pro|スリーディオ)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'mic',
    subType: 'dummy_head',
    label: '仿真人头',
    shortTag: 'ダミヘ',
    icon: '🗿',
    regex: /(?:[\(_（【\[\s_-]|^)(?:ダミーヘッド|Dummy[-_ ]?Head|ダミヘ)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:ダミーヘッド|Dummy[-_ ]?Head|ダミヘ)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'mic',
    subType: 'binaural',
    label: '双耳立体声',
    shortTag: '双耳',
    icon: '🎛️',
    regex: /(?:[\(_（【\[\s_-]|^)(?:バイノーラル|Binaural)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:バイノーラル|Binaural)[\)_）】\]\s_-]*/gi,
  },

  // 3. 听感风格与声音特征偏好 (STYLE)
  {
    category: 'style',
    subType: 'whisper',
    label: '耳语耳鸣特化',
    shortTag: '囁き版',
    icon: '✨',
    regex: /(?:[\(_（【\[\s_-]|^)(?:(?:囁き強調|囁き特化|耳元囁き|囁き)(?:版)?|Whisper(?:[-_ ]?ver)?)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:(?:囁き強調|囁き特化|耳元囁き|囁き)(?:版)?|Whisper(?:[-_ ]?ver)?)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'ear_cleaning',
    label: '极乐采耳特化',
    shortTag: '耳搔版',
    icon: '🪄',
    regex: /(?:[\(_（【\[\s_-]|^)(?:耳かき特化|耳かき強化|耳かき版|耳掃除特化|Ear[-_ ]?Cleaning(?:[-_ ]?ver)?)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:耳かき特化|耳かき強化|耳かき版|耳掃除特化|Ear[-_ ]?Cleaning(?:[-_ ]?ver)?)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'heartbeat',
    label: '心音增强版',
    shortTag: '心音版',
    icon: '💓',
    regex: /(?:[\(_（【\[\s_-]|^)(?:心音強め|心音強化|心音強調|心音版|Heartbeat(?:[-_ ]?ver)?)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:心音強め|心音強化|心音強調|心音版|Heartbeat(?:[-_ ]?ver)?)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'breath',
    label: '轻柔吹气/吐息',
    shortTag: '吐息版',
    icon: '💨',
    regex: /(?:[\(_（【\[\s_-]|^)(?:吐息多め|吐息特化|息吹き多め|吐息版)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:吐息多め|吐息特化|息吹き多め|吐息版)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'normal',
    label: '标准原版',
    shortTag: '通常版',
    icon: '💿',
    regex: /(?:[\(_（【\[\s_-]|^)(?:通常版|通常|Standard|Normal|Original)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:通常版|通常|Standard|Normal|Original)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'hires',
    label: '高采样母带',
    shortTag: 'Hi-Res',
    icon: '💎',
    regex: /(?:[\(_（【\[\s_-]|^)(?:ハイレゾ|Hi[-_ ]?Res|24bit|96kHz|48kHz|高音質(?:版)?)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:ハイレゾ|Hi[-_ ]?Res|24bit|96kHz|48kHz|高音质(?:版)?|高音質(?:版)?)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'short',
    label: '紧凑短篇版',
    shortTag: '短缩版',
    icon: '⏱️',
    regex: /(?:[\(_（【\[\s_-]|^)(?:ショート版|Short(?:[-_ ]?ver)?|無音カット|短縮版)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:ショート版|Short(?:[-_ ]?ver)?|無音カット|短縮版)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'style',
    subType: 'bonus',
    label: '特典扩展篇',
    shortTag: '特典版',
    icon: '🎁',
    regex: /(?:[\(_（【\[\s_-]|^)(?:特典(?:版)?|Bonus|Extra|Special|おまけ)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:特典(?:版)?|Bonus|Extra|Special|おまけ)[\)_）】\]\s_-]*/gi,
  },

  // 4. 耳道单双声道类 (CHANNEL)
  {
    category: 'channel',
    subType: 'left_ear',
    label: '左耳专属',
    shortTag: '左耳',
    icon: '👂L',
    regex: /(?:[\(_（【\[\s_-]|^)(?:左耳(?:専用|版)?|Left[-_ ]?Ear|Left)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:左耳(?:専用|版)?|Left[-_ ]?Ear|Left)[\)_）】\]\s_-]*/gi,
  },
  {
    category: 'channel',
    subType: 'right_ear',
    label: '右耳专属',
    shortTag: '右耳',
    icon: '👂R',
    regex: /(?:[\(_（【\[\s_-]|^)(?:右耳(?:専用|版)?|Right[-_ ]?Ear|Right)(?:[\)_）】\]\s_-]|$)/i,
    cleanRegex: /[\(_（【\[\s_-]*(?:右耳(?:専用|版)?|Right[-_ ]?Ear|Right)[\)_）】\]\s_-]*/gi,
  },
]

/**
 * 剥离文件名扩展名
 */
export function removeFileExtension(filename) {
  if (!filename) return ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename
}

/**
 * 嗅探单首音频中的变体属性
 */
export function matchAudioVariantInfo(filename) {
  const baseName = removeFileExtension(filename || '')
  
  for (const pattern of VARIANT_PATTERNS) {
    if (pattern.regex.test(baseName)) {
      return {
        matched: true,
        category: pattern.category,
        subType: pattern.subType,
        label: pattern.label,
        shortTag: pattern.shortTag,
        icon: pattern.icon,
        pattern,
      }
    }
  }

  return {
    matched: false,
    category: 'standard',
    subType: 'standard',
    label: '主版本',
    shortTag: '主版本',
    icon: '🎵',
    pattern: null,
  }
}

/**
 * 计算音频的规范场景基准键 (Canonical Scene Key)
 * 剔除变体关键词和包裹符号后，如果两个文件场景名一致，则属于同态异构变体
 */
export function deriveCanonicalSceneKey(filename) {
  let cleaned = removeFileExtension(filename || '')

  // 1. 依次剥离匹配的变体关键词
  for (const pattern of VARIANT_PATTERNS) {
    cleaned = cleaned.replace(pattern.cleanRegex, '')
  }

  // 2. 清理因剥离变体词残留的空括号与多余末尾空格/连接符
  cleaned = cleaned
    .replace(/[\(\)\[\]（）【】]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[_\-\s]+$/g, '')
    .trim()

  // 3. 如果清理后变为空，回退原基本名
  if (!cleaned) {
    cleaned = removeFileExtension(filename || '').trim()
  }

  return cleaned.toLowerCase()
}

/**
 * 智能聚类分析音频列表中的同态音轨变体
 * @param {Array} audioFiles 音频文件数组 [{ name, path, relativePath, displayName, ... }]
 * @returns {Object} 变体聚类分析结果
 */
export function detectTrackVariants(audioFiles = []) {
  if (!Array.isArray(audioFiles) || audioFiles.length === 0) {
    return {
      hasVariants: false,
      variantCount: 0,
      groups: [],
      fileToGroupMap: {},
    }
  }

  // 1. 按规范场景基准键分组
  const sceneMap = new Map()

  for (let index = 0; index < audioFiles.length; index++) {
    const audio = audioFiles[index]
    const rawName = audio.displayName || audio.name || ''
    const canonicalKey = deriveCanonicalSceneKey(rawName)
    const variantInfo = matchAudioVariantInfo(rawName)

    if (!sceneMap.has(canonicalKey)) {
      sceneMap.set(canonicalKey, {
        canonicalKey,
        sceneTitle: audio.displayName || audio.name,
        audios: [],
      })
    }

    const group = sceneMap.get(canonicalKey)
    group.audios.push({
      originalIndex: index,
      audio,
      variantInfo,
      rawName,
    })
  }

  const groups = []
  const fileToGroupMap = {}
  const sceneGroupMap = new Map()
  const trackVariantMap = new Map()
  let totalVariantCount = 0

  // 记录所有音频的单个变体信息（若有）
  for (const audio of audioFiles) {
    const rawName = audio.displayName || audio.name || ''
    const info = matchAudioVariantInfo(rawName)
    if (info.matched) {
      trackVariantMap.set(audio.path, info)
    }
  }

  // 2. 筛选出真正包含 2 个及以上变体的场景组
  for (const [canonicalKey, data] of sceneMap.entries()) {
    const isMultiVariant = data.audios.length >= 2
    
    // 如果组内至少有 1 个明确匹配了变体关键词，或者同场景存在多个曲目
    const hasExplicitVariant = data.audios.some(item => item.variantInfo.matched)

    if (isMultiVariant && hasExplicitVariant) {
      totalVariantCount += data.audios.length

      const variants = data.audios.map((item, vIdx) => {
        // 主推荐版本推断：BGMあり、KU100、通常版，或者首项
        const isPrimary = (
          item.variantInfo.subType === 'with_bgm' ||
          item.variantInfo.subType === 'ku100' ||
          item.variantInfo.subType === 'normal' ||
          vIdx === 0
        )

        return {
          id: item.audio.path || `${item.audio.name}_${vIdx}`,
          variantIndex: vIdx,
          audio: item.audio,
          track: item.audio,
          originalIndex: item.originalIndex,
          label: item.variantInfo.label,
          shortTag: item.variantInfo.shortTag,
          category: item.variantInfo.category,
          subType: item.variantInfo.subType,
          icon: item.variantInfo.icon,
          variantInfo: item.variantInfo,
          isPrimary,
          rawName: item.rawName,
        }
      })

      const primaryVariant = variants.find(v => v.isPrimary) || variants[0]

      const groupObject = {
        canonicalKey,
        sceneTitle: data.sceneTitle,
        primaryTrack: primaryVariant.audio,
        variants,
        count: variants.length,
      }

      groups.push(groupObject)

      // 建立快速索引表与 Map
      for (const v of variants) {
        sceneGroupMap.set(v.audio.path, groupObject)
        fileToGroupMap[v.audio.path] = {
          canonicalKey,
          sceneTitle: data.sceneTitle,
          currentVariant: v,
          allVariants: variants,
          otherVariants: variants.filter(other => other.id !== v.id),
        }
      }
    }
  }

  return {
    hasVariants: groups.length > 0,
    variantCount: totalVariantCount,
    groups,
    fileToGroupMap,
    sceneGroupMap,
    trackVariantMap,
  }
}

/**
 * 对比两个变体的物理属性与声学特征差异
 */
export function getVariantDiffSummary(sourceAudio, targetAudio) {
  if (!sourceAudio || !targetAudio) return null

  const getFormat = (path = '') => {
    const dot = path.lastIndexOf('.')
    return dot >= 0 ? path.slice(dot + 1).toUpperCase() : 'UNKNOWN'
  }

  return {
    formatDiff: {
      source: getFormat(sourceAudio.path),
      target: getFormat(targetAudio.path),
      isDifferent: getFormat(sourceAudio.path) !== getFormat(targetAudio.path),
    },
    nameDiff: {
      source: sourceAudio.displayName || sourceAudio.name,
      target: targetAudio.displayName || targetAudio.name,
    },
  }
}
