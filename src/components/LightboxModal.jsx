import { useState, useEffect, useCallback, useRef, memo } from 'react'
import './LightboxModal.css'

const LightboxModal = memo(function LightboxModal({
  images = [],
  currentIndex = 0,
  isOpen = false,
  onClose,
  onSelectIndex,
  onToast,
}) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isSlideshow, setIsSlideshow] = useState(false)
  const [slideshowInterval, setSlideshowInterval] = useState(4000)
  const slideshowTimerRef = useRef(null)

  const currentImage = images[currentIndex] || null

  // 重置缩放和旋转
  useEffect(() => {
    setZoom(1)
    setRotation(0)
  }, [currentIndex])

  const handleNext = useCallback(() => {
    if (images.length === 0) return
    onSelectIndex?.((currentIndex + 1) % images.length)
  }, [currentIndex, images.length, onSelectIndex])

  const handlePrev = useCallback(() => {
    if (images.length === 0) return
    onSelectIndex?.((currentIndex - 1 + images.length) % images.length)
  }, [currentIndex, images.length, onSelectIndex])

  // 键盘快捷键监听
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        setIsSlideshow((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleNext, handlePrev, onClose])

  // 幻灯片定时轮播
  useEffect(() => {
    if (isSlideshow && isOpen) {
      slideshowTimerRef.current = setInterval(() => {
        handleNext()
      }, slideshowInterval)
    } else {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current)
      }
    }
    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current)
      }
    }
  }, [isSlideshow, isOpen, slideshowInterval, handleNext])

  // 滚轮缩放
  const handleWheel = (e) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(3.5, z + 0.15))
    } else {
      setZoom((z) => Math.max(0.5, z - 0.15))
    }
  }

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360)
  }

  const handleResetZoom = () => {
    setZoom(1)
    setRotation(0)
  }

  if (!isOpen || !currentImage) return null

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* 顶部工具栏 */}
        <div className="lightbox-header">
          <div className="lightbox-meta">
            <span className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
            <span className="lightbox-name" title={currentImage.name}>
              {currentImage.name}
            </span>
            {currentImage.categoryLabel && (
              <span className="lightbox-tag">{currentImage.categoryLabel}</span>
            )}
          </div>

          <div className="lightbox-actions">
            <button
              className={`lightbox-btn ${isSlideshow ? 'active' : ''}`}
              onClick={() => setIsSlideshow(!isSlideshow)}
              title={isSlideshow ? '暂停幻灯片 (空格)' : '开始自动轮播 (空格)'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isSlideshow ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                {isSlideshow ? (
                  <>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </>
                ) : (
                  <polygon points="5 3 19 12 5 21 5 3" />
                )}
              </svg>
              {isSlideshow ? '轮播中' : '自动轮播'}
            </button>

            <button className="lightbox-btn" onClick={handleRotate} title="顺时针旋转 90°">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>

            <button className="lightbox-btn" onClick={handleResetZoom} title="复位缩放与旋转">
              {Math.round(zoom * 100)}%
            </button>

            <button className="lightbox-close" onClick={onClose} title="关闭 (ESC)">
              ×
            </button>
          </div>
        </div>

        {/* 主视区与图片 */}
        <div className="lightbox-viewport" onWheel={handleWheel}>
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className="lightbox-image"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: zoom === 1 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          />

          {/* 左右翻页按钮 */}
          {images.length > 1 && (
            <>
              <button
                className="lightbox-nav-btn prev"
                onClick={handlePrev}
                title="上一张 (←)"
              >
                ‹
              </button>
              <button
                className="lightbox-nav-btn next"
                onClick={handleNext}
                title="下一张 (→)"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* 底部缩略图胶囊栏 */}
        {images.length > 1 && (
          <div className="lightbox-filmstrip">
            <div className="lightbox-filmstrip-track">
              {images.map((img, idx) => (
                <div
                  key={img.id || img.url || idx}
                  className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => onSelectIndex?.(idx)}
                  title={img.name}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default LightboxModal
