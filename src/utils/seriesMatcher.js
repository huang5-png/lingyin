/**
 * 音声系列作品智能聚类与脉络推断纯函数模块
 * 
 * 核心功能：
 * 1. 自动提取多部曲作品的系列主干标题（去除卷号、前后篇、Part、数字等）
 * 2. 在媒体库中聚类同一系列的全部作品
 * 3. 推断前后作品（Previous / Next）与在系列中的位置序数
 */

// 常见的卷数/序号正则匹配模式
const VOLUME_PATTERNS = [
  /(?:vol|volume|第)\s*[._-]?\s*(\d{1,2})(?:[巻幕部弾话話])?/i,
  /part\s*[._-]?\s*(\d{1,2})/i,
  /[#＃](\d{1,2})/,
  /[._-\s](\d{1,2})$/,
  /([①②③④⑤⑥⑦⑧⑨⑩])/,
  /([前后前後][篇编編])/,
]

// 序号字符对应数值
const SPECIAL_NUM_MAP = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
  '前篇': 1, '前编': 1, '前編': 1,
  '后篇': 2, '后编': 2, '後編': 2,
}

/**
 * 提取作品标题中的系列序号
 */
export function extractSeriesIndex(title) {
  if (!title) return { index: 1, raw: '' }

  for (const pattern of VOLUME_PATTERNS) {
    const match = title.match(pattern)
    if (match) {
      const matchedStr = match[1]
      if (SPECIAL_NUM_MAP[matchedStr] !== undefined) {
        return { index: SPECIAL_NUM_MAP[matchedStr], raw: match[0] }
      }
      const parsed = parseInt(matchedStr, 10)
      if (!isNaN(parsed)) {
        return { index: parsed, raw: match[0] }
      }
    }
  }

  return { index: 1, raw: '' }
}

/**
 * 提取标题系列核心主干名称
 */
export function extractFranchiseStem(title) {
  if (!title) return ''
  let stem = title

  // 1. 去除两端的方括号/特殊括号（如【RJ123456】、【ASMR】等）
  stem = stem.replace(/【[^】]*】/g, ' ')
  stem = stem.replace(/\[[^\]]*\]/g, ' ')
  stem = stem.replace(/\([^\)]*\)/g, ' ')
  stem = stem.replace(/（[^）]*）/g, ' ')

  // 2. 去除卷号/序号
  for (const pattern of VOLUME_PATTERNS) {
    stem = stem.replace(pattern, ' ')
  }

  // 3. 去除常见无意义尾缀
  stem = stem.replace(/(?:全年齢|健全|mp3|wav|flac|音声|asmr)/gi, ' ')
  stem = stem.trim().replace(/\s+/g, ' ')

  return stem
}

/**
 * 检测当前作品是否属于某一多部曲系列
 * @param {Object} currentWork 当前作品
 * @param {Array} allWorks 全量作品列表
 * @returns {Object|null} 系列脉络对象或 null
 */
export function detectFranchiseSeries(currentWork, allWorks = []) {
  if (!currentWork || !allWorks || allWorks.length <= 1) return null

  const currentTitle = currentWork.title || currentWork.folderName || ''
  const currentStem = extractFranchiseStem(currentTitle)

  // 主干太短（小于3个字符）不具备足够区分度，避免误判
  if (!currentStem || currentStem.length < 3) return null

  const currentIdxInfo = extractSeriesIndex(currentTitle)

  // 筛选属于同系列的候选作品：相同社团优先，且主干包含或高度相似
  const matchedWorks = allWorks.filter((w) => {
    if (!w) return false
    const otherTitle = w.title || w.folderName || ''
    const otherStem = extractFranchiseStem(otherTitle)
    if (!otherStem || otherStem.length < 3) return false

    // 检查主干相同或包含
    const stemA = currentStem.toLowerCase()
    const stemB = otherStem.toLowerCase()
    const isStemMatch = stemA === stemB || stemA.includes(stemB) || stemB.includes(stemA)
    if (!isStemMatch) return false

    // 相同社团或相同 CV 加权确认
    const isSameCircle = currentWork.circle && w.circle && currentWork.circle === w.circle
    const hasCommonCV = currentWork.cvs && w.cvs && currentWork.cvs.some(cv => w.cvs.includes(cv))

    return isStemMatch && (isSameCircle || hasCommonCV || stemA === stemB)
  })

  // 如果只匹配到自己，则说明未构成系列
  if (matchedWorks.length < 2) return null

  // 对匹配作品按系列序数排序
  const sortedSeries = matchedWorks.map((w) => {
    const t = w.title || w.folderName || ''
    const { index } = extractSeriesIndex(t)
    return {
      work: w,
      index,
      isCurrent: w.id === currentWork.id,
    }
  }).sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index
    return (a.work.createdAt || 0) - (b.work.createdAt || 0)
  })

  const currentPos = sortedSeries.findIndex((item) => item.isCurrent)
  const prevWork = currentPos > 0 ? sortedSeries[currentPos - 1].work : null
  const nextWork = currentPos < sortedSeries.length - 1 ? sortedSeries[currentPos + 1].work : null

  return {
    franchiseName: currentStem,
    totalParts: sortedSeries.length,
    currentPartIndex: currentPos !== -1 ? sortedSeries[currentPos].index : currentIdxInfo.index,
    seriesList: sortedSeries,
    prevWork,
    nextWork,
  }
}
