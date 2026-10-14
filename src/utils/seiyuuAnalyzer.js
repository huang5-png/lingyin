/**
 * 声优宇宙画像与深度分析纯函数模块
 * 
 * 核心功能：
 * 1. 深度聚合声优在用户媒体库中的履历与收录数据
 * 2. 统计累计陪伴聆听时长（从 progressHistory 中精准关联）
 * 3. 提炼声线风格与风味特征标签星云（排除泛化词，聚焦特色声线）
 * 4. 统计合作社团合作足迹与频次分布
 * 5. 编排「声优专属心动电台」连播队列
 */

// 过滤掉过于泛化的通用标签，突出声线与角色特色
const GENERIC_TAG_FILTER = new Set([
  'asmr', '音声', '同人音声', '同人', 'dlsite', 'rj', '作品', '全年齢', '健全', 'mp3', 'wav', 'flac'
])

// 格式化秒数为友好时长
export function formatListeningTime(seconds) {
  if (!seconds || seconds <= 0) return '0 分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`
  }
  return `${minutes} 分钟`
}

/**
 * 分析指定声优的完整星盘档案
 * @param {string} cvName 声优名字
 * @param {Array} allWorks 全量作品列表
 * @param {Array} progressHistory 历史播放记录
 * @param {Array} allStamps 全量心动感官印记
 */
export function analyzeSeiyuuProfile(cvName, allWorks = [], progressHistory = [], allStamps = []) {
  if (!cvName || typeof cvName !== 'string') {
    return null
  }

  const cleanName = cvName.trim()
  if (!cleanName) return null

  // 1. 筛选该声优的所有收录作品
  const cvWorks = (allWorks || []).filter((w) => {
    if (!w) return false
    const cvs = w.cvs || []
    return cvs.some((cv) => cv && cv.toLowerCase().includes(cleanName.toLowerCase()))
  })

  const totalWorks = cvWorks.length
  let totalTracks = 0
  const workIdsSet = new Set()

  cvWorks.forEach((w) => {
    if (w.id) workIdsSet.add(w.id)
    if (w.audioFiles && Array.isArray(w.audioFiles)) {
      totalTracks += w.audioFiles.length
    } else if (w.audioCount) {
      totalTracks += w.audioCount
    }
  })

  // 2. 统计累计聆听陪伴时长（从 progressHistory）
  let totalListeningSeconds = 0
  if (Array.isArray(progressHistory)) {
    progressHistory.forEach((h) => {
      if (!h) return
      let isMatch = false
      if (h.vas && Array.isArray(h.vas)) {
        isMatch = h.vas.some((va) => va && va.toLowerCase().includes(cleanName.toLowerCase()))
      } else if (h.workId && workIdsSet.has(h.workId)) {
        isMatch = true
      }
      if (isMatch) {
        totalListeningSeconds += (Number(h.duration) || 0)
      }
    })
  }

  // 3. 统计声线风格与风味特征标签星云
  const tagCounts = {}
  cvWorks.forEach((w) => {
    const tags = w.tags || []
    tags.forEach((tag) => {
      if (!tag) return
      const cleanTag = tag.trim()
      const lower = cleanTag.toLowerCase()
      if (GENERIC_TAG_FILTER.has(lower)) return
      tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1
    })
  })

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count], index) => {
      const percentage = totalWorks > 0 ? Math.round((count / totalWorks) * 100) : 0
      return {
        tag,
        count,
        percentage,
        weightRank: index < 3 ? 'hero' : index < 7 ? 'featured' : 'standard',
      }
    })

  // 4. 统计合作社团分布
  const circleCounts = {}
  cvWorks.forEach((w) => {
    if (w.circle) {
      const circle = w.circle.trim()
      circleCounts[circle] = (circleCounts[circle] || 0) + 1
    }
  })

  const sortedCircles = Object.entries(circleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([circle, count]) => ({
      circle,
      count,
      ratio: totalWorks > 0 ? Math.round((count / totalWorks) * 100) : 0,
    }))

  // 5. 提取关联的心动感官印记
  const cvStamps = (allStamps || []).filter((s) => s && workIdsSet.has(s.workId))

  // 6. 代表作精选（按评分与是否有心动印记排序）
  const topWorks = [...cvWorks]
    .sort((a, b) => {
      const ratingA = a.rating || 0
      const ratingB = b.rating || 0
      if (ratingB !== ratingA) return ratingB - ratingA
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
    .slice(0, 6)

  return {
    cvName: cleanName,
    totalWorks,
    totalTracks,
    totalListeningSeconds,
    formattedListeningTime: formatListeningTime(totalListeningSeconds),
    flavorTags: sortedTags,
    circles: sortedCircles,
    stampsCount: cvStamps.length,
    stamps: cvStamps.slice(0, 10),
    topWorks,
    allWorks: cvWorks,
  }
}

/**
 * 为声优心动电台编排曲目列表
 * @param {Object} profile analyzeSeiyuuProfile 的输出
 * @returns {Array<PlaylistItem>}
 */
export function buildSeiyuuRadioQueue(profile) {
  if (!profile || !profile.allWorks || profile.allWorks.length === 0) {
    return []
  }

  const queueItems = []
  const addedPaths = new Set()

  profile.allWorks.forEach((work) => {
    const audioFiles = work.audioFiles || []
    audioFiles.forEach((audio) => {
      if (!audio || !audio.path || addedPaths.has(audio.path)) return
      addedPaths.add(audio.path)
      queueItems.push({
        id: `radio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        audio: {
          path: audio.path,
          name: audio.name || '',
          duration: audio.duration || 0,
          isOnline: !!audio.isOnline,
        },
        work: {
          id: work.id,
          title: work.title || work.folderName || '',
          cover: work.cover || '',
          folderPath: work.folderPath || '',
          isOnline: !!work.isOnline,
        },
        source: 'seiyuu-radio',
        audioName: audio.displayName || audio.name || '',
        workTitle: work.title || work.folderName || '',
        workCover: work.cover || '',
        addedAt: Date.now(),
      })
    })
  })

  return queueItems
}
