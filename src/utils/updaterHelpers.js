/**
 * 比较两个版本号字符串（支持 v1.50.0 或 1.50.0 格式）
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
export function compareVersions(v1, v2) {
  if (!v1 && !v2) return 0
  if (!v1) return -1
  if (!v2) return 1

  const clean1 = String(v1).trim().replace(/^[vV]/, '')
  const clean2 = String(v2).trim().replace(/^[vV]/, '')

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0)
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0)

  const len = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

/**
 * 根据镜像配置拼接下载 URL
 * @param {string} rawUrl
 * @param {string} mirrorPrefix
 * @returns {string}
 */
export function resolveDownloadUrl(rawUrl, mirrorPrefix) {
  if (!rawUrl) return ''
  if (!mirrorPrefix || mirrorPrefix === 'direct' || mirrorPrefix === 'none') {
    return rawUrl
  }
  const cleanPrefix = mirrorPrefix.trim().replace(/\/+$/, '')
  return `${cleanPrefix}/${rawUrl}`
}

/**
 * 格式化字节大小为易读字符串
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}
