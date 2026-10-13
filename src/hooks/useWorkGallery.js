import { useState, useEffect, useCallback, useRef } from 'react'
import { scanFolderImages, resolveWorkGallery } from '../utils/galleryScanner'

/**
 * 管理当前作品画集与插画的 Hook
 */
export function useWorkGallery({ work, onToast }) {
  const [galleryImages, setGalleryImages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const isMountedRef = useRef(true)

  // 内存缓存，避免频繁切换作品重复递归扫描磁盘
  const cacheRef = useRef(new Map())

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!work) {
      setGalleryImages([])
      setIsLoading(false)
      return
    }

    const cacheKey = work.id || work.folderPath || work.cover

    if (cacheRef.current.has(cacheKey)) {
      setGalleryImages(cacheRef.current.get(cacheKey))
      return
    }

    let cancelled = false
    setIsLoading(true)

    async function load() {
      try {
        let localImgs = []
        if (work.folderPath && !work.isOnline && window.electronAPI?.readDir) {
          localImgs = await scanFolderImages(work.folderPath)
        }
        if (cancelled || !isMountedRef.current) return

        const resolved = resolveWorkGallery(work, localImgs)
        cacheRef.current.set(cacheKey, resolved)
        setGalleryImages(resolved)
      } catch (e) {
        console.warn('useWorkGallery load failed:', e)
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [work?.id, work?.folderPath, work?.cover, work?.isOnline])

  const openLightbox = useCallback((index = 0) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(-1)
  }, [])

  const nextImage = useCallback(() => {
    setLightboxIndex((prev) => {
      if (galleryImages.length === 0) return -1
      return (prev + 1) % galleryImages.length
    })
  }, [galleryImages.length])

  const prevImage = useCallback(() => {
    setLightboxIndex((prev) => {
      if (galleryImages.length === 0) return -1
      return (prev - 1 + galleryImages.length) % galleryImages.length
    })
  }, [galleryImages.length])

  return {
    galleryImages,
    isLoading,
    lightboxIndex,
    isLightboxOpen: lightboxIndex >= 0,
    currentLightboxImage: galleryImages[lightboxIndex] || null,
    openLightbox,
    closeLightbox,
    nextImage,
    prevImage,
    setLightboxIndex,
  }
}
