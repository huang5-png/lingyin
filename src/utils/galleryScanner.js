/**
 * 聆音 (Lingyin) 作品画集与插画画廊扫描引擎
 *
 * 负责扫描、分类和整合本地同人音声作品以及在线作品的插画、CG、立绘与封面资源。
 */

export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.jfif',
  '.svg',
]

/**
 * 智能分类关键词
 */
const COVER_KEYWORDS = ['cover', 'main', 'folder', 'thumbnail', 'front', 'jacket', '表纸', '封面']
const CG_KEYWORDS = ['cg', 'event', 'scene', '差分', 'event_cg', 'scene_cg']
const BONUS_KEYWORDS = ['bonus', 'tokuten', '特典', 'omake', '附录', '限定']
const CHARACTER_KEYWORDS = ['chara', 'character', 'tachie', '立绘', '人物', '角色']
const COMIC_KEYWORDS = ['comic', 'manga', 'book', '漫画', '四格', '4koma']

export function getExtension(filename) {
  if (!filename || typeof filename !== 'string') return ''
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function isImageFile(filename) {
  return IMAGE_EXTENSIONS.includes(getExtension(filename))
}

export function pathToFileURL(filePath) {
  if (!filePath) return ''
  let normalizedPath = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return (
      'file:///' +
      normalizedPath
        .split('/')
        .map((part, i) => {
          if (i === 0) return part
          return encodeURIComponent(part)
        })
        .join('/')
    )
  }
  if (normalizedPath.startsWith('/')) {
    return (
      'file://' +
      normalizedPath
        .split('/')
        .map((part, i) => {
          if (i === 0) return ''
          return encodeURIComponent(part)
        })
        .join('/')
    )
  }
  return 'file:///' + normalizedPath.split('/').map(encodeURIComponent).join('/')
}

/**
 * 自然数字排序
 */
export function naturalCompare(a, b) {
  const ax = String(a).split(/(\d+)/)
  const bx = String(b).split(/(\d+)/)
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

/**
 * 根据文件名和路径特征智能推断图片分类
 */
export function categorizeImage(name, relativePath = '', isMainCover = false) {
  if (isMainCover) return { key: 'cover', label: '主封面' }

  const text = `${relativePath}/${name}`.toLowerCase()

  for (const kw of COVER_KEYWORDS) {
    if (text.includes(kw)) return { key: 'cover', label: '封面/海报' }
  }
  for (const kw of BONUS_KEYWORDS) {
    if (text.includes(kw)) return { key: 'bonus', label: '特典/附录' }
  }
  for (const kw of CG_KEYWORDS) {
    if (text.includes(kw)) return { key: 'cg', label: 'CG插画' }
  }
  for (const kw of CHARACTER_KEYWORDS) {
    if (text.includes(kw)) return { key: 'character', label: '角色立绘' }
  }
  for (const kw of COMIC_KEYWORDS) {
    if (text.includes(kw)) return { key: 'comic', label: '漫画/台本' }
  }

  return { key: 'illust', label: '插画' }
}

/**
 * 递归扫描本地目录下的所有图片文件
 */
export async function scanFolderImages(folderPath) {
  if (!folderPath || !window.electronAPI?.readDir) return []

  const images = []

  async function walk(dirPath, baseDir) {
    try {
      const files = await window.electronAPI.readDir(dirPath)
      for (const file of files) {
        if (file.isDirectory) {
          await walk(file.path, baseDir)
        } else if (isImageFile(file.name)) {
          const relPath = file.path.slice(baseDir.length + 1)
          const category = categorizeImage(file.name, relPath)
          images.push({
            id: file.path,
            name: file.name,
            path: file.path,
            relativePath: relPath,
            url: pathToFileURL(file.path),
            size: file.size || 0,
            category: category.key,
            categoryLabel: category.label,
          })
        }
      }
    } catch (e) {
      console.warn('scanFolderImages walk failed:', e)
    }
  }

  await walk(folderPath, folderPath)

  // 按相对路径自然排序
  images.sort((a, b) => {
    // 封面优先
    if (a.category === 'cover' && b.category !== 'cover') return -1
    if (b.category === 'cover' && a.category !== 'cover') return 1
    return naturalCompare(a.relativePath, b.relativePath)
  })

  return images
}

/**
 * 整合作品的画集列表（同时支持本地作品与在线作品）
 */
export function resolveWorkGallery(work, localImages = []) {
  if (!work) return []

  const result = []
  const seenUrls = new Set()

  // 1. 如果有主封面，确保主封面在第一位
  if (work.cover) {
    seenUrls.add(work.cover)
    result.push({
      id: 'main-cover',
      name: '主封面',
      url: work.cover,
      path: work.coverPath || null,
      relativePath: 'cover',
      category: 'cover',
      categoryLabel: '主封面',
      isMainCover: true,
    })
  }

  // 2. 本地扫描到的图片
  if (Array.isArray(localImages)) {
    localImages.forEach((img) => {
      if (!seenUrls.has(img.url) && !seenUrls.has(img.path)) {
        seenUrls.add(img.url)
        if (img.path) seenUrls.add(img.path)
        result.push(img)
      }
    })
  }

  // 3. 在线作品的额外图片 (如 work.images / work.image_covers)
  if (work.isOnline) {
    if (Array.isArray(work.images)) {
      work.images.forEach((imgUrl, idx) => {
        if (imgUrl && !seenUrls.has(imgUrl)) {
          seenUrls.add(imgUrl)
          const cat = categorizeImage(`image_${idx + 1}.jpg`)
          result.push({
            id: `online-img-${idx}`,
            name: `插图 ${idx + 1}`,
            url: imgUrl,
            category: cat.key,
            categoryLabel: cat.label,
          })
        }
      })
    }
  }

  return result
}
