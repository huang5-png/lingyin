/**
 * 声景心境全景漫游透镜纯函数模块
 * 
 * 核心功能：
 * 1. 结构化解构 ASMR 音声的核心情境空间（雨夜、和室、暖床、采耳、星空、日常、暖炉、汤泉等 8 大声景）
 * 2. 结合作品标签、标题、社团等多维文本特征，解算作品的声景属性与匹配强度
 * 3. 支持媒体库与发现视图按心境声景透镜进行多维聚合与智能过滤
 */

export const SCENERY_PRESETS = [
  {
    id: 'rainy_night',
    name: '雨夜微凉',
    icon: '🌧️',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.12)',
    description: '窗外雨声淅沥，水滴敲窗，室内温暖安然',
    keywords: ['雨', '雨音', '雷雨', '雨宿り', 'rain', '水滴', 'しずく', '滴'],
  },
  {
    id: 'japanese_room',
    name: '和室静谧',
    icon: '🍵',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)',
    description: '和室榻榻米、庭院风铃与淡雅茶香',
    keywords: ['和室', '畳', '旅館', '風鈴', '縁側', '古民家', 'お茶', '障子', '温泉旅館'],
  },
  {
    id: 'cozy_bed',
    name: '暖衾深眠',
    icon: '🛏️',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.12)',
    description: '钻进软被，温柔耳语伴随平稳呼吸入眠',
    keywords: ['添い寝', 'ベッド', '布団', '毛布', '睡眠', '安眠', '睡眠誘導', '枕元', 'おやすみ', '寝息', '目覚まし'],
  },
  {
    id: 'ear_cleaning',
    name: '极乐采耳',
    icon: '🪄',
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.12)',
    description: '酥麻触感直击颅骨，深层掏耳清理放松',
    keywords: ['耳かき', '耳掃除', '綿棒', '梵天', '炭酸', '耳垢', '耳塞', 'ear cleaning'],
  },
  {
    id: 'ethereal_space',
    name: '星野空灵',
    icon: '🌌',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    description: '广袤星海、夜空流光与深空寂静',
    keywords: ['星空', '宇宙', '夜空', '月光', 'プラネタリウム', '深海', '幻想', '夜想曲', 'space'],
  },
  {
    id: 'gentle_daily',
    name: '温柔日常',
    icon: '🌸',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.12)',
    description: '青梅竹马、居家看护与无微不至的甜美陪伴',
    keywords: ['日常', '甘やかし', '看病', '幼馴染', 'メイド', '妹', '姉', 'お姉さん', '先輩', '同級生', '彼女', '恋人'],
  },
  {
    id: 'cafe_leisure',
    name: '暖炉轻音',
    icon: '☕',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.12)',
    description: '壁炉柴火毕剥、暖调咖啡与闲适午后',
    keywords: ['カフェ', '喫茶店', '暖炉', '焚き火', '読書', '図書館', '珈琲', '本', '雨宿りカフェ'],
  },
  {
    id: 'onsen_bath',
    name: '汤泉雾气',
    icon: '🛁',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    description: '温泉水波微漾，沐浴洗发时的舒缓流水声',
    keywords: ['お風呂', '温泉', 'シャンプー', '洗髪', '泡', '湯船', '洗体', '露天風呂', 'バスルーム'],
  },
]

/**
 * 结构化解算作品的声景属性与匹配分值
 * @param {Object} work 作品对象
 * @returns {Object} { primaryScenery, allMatches: [{ scenery, score }] }
 */
export function detectWorkScenery(work) {
  if (!work) return { primaryScenery: null, allMatches: [] }

  const title = (work.title || work.folderName || '').toLowerCase()
  const tags = Array.isArray(work.tags) ? work.tags.map(t => String(t).toLowerCase()) : []
  const circle = (work.circle || '').toLowerCase()

  const matches = []

  for (const preset of SCENERY_PRESETS) {
    let score = 0

    for (const kw of preset.keywords) {
      const lowerKw = kw.toLowerCase()

      // 标签强匹配 (+15分)
      if (tags.some(t => t.includes(lowerKw))) {
        score += 15
      }

      // 标题匹配 (+10分)
      if (title.includes(lowerKw)) {
        score += 10
      }

      // 社团名匹配 (+5分)
      if (circle.includes(lowerKw)) {
        score += 5
      }
    }

    if (score > 0) {
      matches.push({
        scenery: preset,
        score,
      })
    }
  }

  // 按匹配分降序排序
  matches.sort((a, b) => b.score - a.score)

  return {
    primaryScenery: matches.length > 0 ? matches[0].scenery : null,
    allMatches: matches,
  }
}

/**
 * 根据声景 ID 筛选作品列表
 */
export function filterWorksByScenery(works = [], sceneryId = null) {
  if (!sceneryId || !Array.isArray(works)) return works

  const preset = SCENERY_PRESETS.find(p => p.id === sceneryId)
  if (!preset) return works

  return works.filter(w => {
    const analysis = detectWorkScenery(w)
    return analysis.allMatches.some(m => m.scenery.id === sceneryId)
  })
}

/**
 * 统计媒体库各声景的作品数量分布
 * @param {Array} works 作品列表
 * @returns {Object} { [sceneryId]: number }
 */
export function computeSceneryCounts(works = []) {
  const counts = {}
  for (const preset of SCENERY_PRESETS) {
    counts[preset.id] = 0
  }
  if (!Array.isArray(works)) return counts

  for (const w of works) {
    const analysis = detectWorkScenery(w)
    for (const m of analysis.allMatches) {
      if (counts[m.scenery.id] !== undefined) {
        counts[m.scenery.id]++
      }
    }
  }
  return counts
}

