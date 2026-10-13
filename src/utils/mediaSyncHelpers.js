/**
 * 提取作品名称或路径中的 RJ/VJ/BJ 码
 * @param {string} text
 * @returns {string|null}
 */
export function extractRJCode(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/(?:RJ|VJ|BJ)\s*(\d{3,8})/i)
  if (match) {
    const prefix = match[0].slice(0, 2).toUpperCase()
    return prefix + match[1]
  }
  return null
}

/**
 * 判断作品是否缺失元数据
 * @param {object} work
 * @returns {boolean}
 */
export function needsScraping(work) {
  if (!work) return false
  const rjCode = work.rjCode || extractRJCode(work.title || work.folderName || work.name || '')
  if (!rjCode) return false

  const hasCover = typeof work.cover === 'string' && work.cover.length > 0
  const hasCvs = Array.isArray(work.cvs) && work.cvs.length > 0
  const hasCircle = typeof work.circle === 'string' && work.circle.length > 0

  return !hasCover || !hasCvs || !hasCircle
}

/**
 * 比较两份音频列表是否实质不同
 * @param {Array} listA
 * @param {Array} listB
 * @returns {boolean}
 */
export function isAudioListDifferent(listA, listB) {
  if (!Array.isArray(listA) || !Array.isArray(listB)) return true
  if (listA.length !== listB.length) return true
  for (let i = 0; i < listA.length; i++) {
    const a = listA[i]
    const b = listB[i]
    if (!a || !b) return true
    if ((a.relativePath || a.name) !== (b.relativePath || b.name)) return true
  }
  return false
}
