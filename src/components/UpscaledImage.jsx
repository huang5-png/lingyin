import { useRef, useEffect, useState, useCallback, memo } from 'react'
import { upscaleImage, UPSCALE_PRESETS } from '../utils/upscaleShaders'
import './UpscaledImage.css'

const UpscaledImage = memo(function UpscaledImage({
  src,
  alt = '',
  preset = 'high',
  className = '',
  fit = 'contain',
  ...props
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const processTimeoutRef = useRef(null)

  const processImage = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    const container = containerRef.current
    
    if (!canvas || !img || !img.naturalWidth || !img.naturalHeight || !container) return

    const presetConfig = UPSCALE_PRESETS[preset] || UPSCALE_PRESETS.high
    const { minScale } = presetConfig

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    if (containerWidth === 0 || containerHeight === 0) return

    const srcWidth = img.naturalWidth
    const srcHeight = img.naturalHeight
    const srcAspect = srcWidth / srcHeight
    const containerAspect = containerWidth / containerHeight

    let targetWidth, targetHeight
    
    if (fit === 'contain') {
      if (containerAspect > srcAspect) {
        targetHeight = containerHeight * window.devicePixelRatio
        targetWidth = targetHeight * srcAspect
      } else {
        targetWidth = containerWidth * window.devicePixelRatio
        targetHeight = targetWidth / srcAspect
      }
    } else if (fit === 'cover') {
      if (containerAspect > srcAspect) {
        targetWidth = containerWidth * window.devicePixelRatio
        targetHeight = targetWidth / srcAspect
      } else {
        targetHeight = containerHeight * window.devicePixelRatio
        targetWidth = targetHeight * srcAspect
      }
    } else {
      targetWidth = containerWidth * window.devicePixelRatio
      targetHeight = containerHeight * window.devicePixelRatio
    }

    const scaleX = targetWidth / srcWidth
    const scaleY = targetHeight / srcHeight
    const actualScale = Math.max(scaleX, scaleY, minScale || 1)
    
    const finalWidth = Math.max(1, Math.round(srcWidth * actualScale))
    const finalHeight = Math.max(1, Math.round(srcHeight * actualScale))

    try {
      const success = upscaleImage(img, canvas, preset, finalWidth, finalHeight)
      if (!success) {
        setError(true)
      }
    } catch (e) {
      console.warn('图片超分处理失败:', e)
      setError(true)
    }

    setLoaded(true)
  }, [preset, fit])

  const scheduleProcess = useCallback(() => {
    if (processTimeoutRef.current) {
      cancelAnimationFrame(processTimeoutRef.current)
    }
    processTimeoutRef.current = requestAnimationFrame(() => {
      processImage()
    })
  }, [processImage])

  useEffect(() => {
    if (!src) return

    setLoaded(false)
    setError(false)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    imgRef.current = img

    img.onload = () => {
      scheduleProcess()
    }

    img.onerror = () => {
      setError(true)
      setLoaded(true)
    }

    img.src = src

    return () => {
      if (processTimeoutRef.current) {
        cancelAnimationFrame(processTimeoutRef.current)
      }
    }
  }, [src, scheduleProcess])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth) {
          scheduleProcess()
        }
      })
      observer.observe(container)
      resizeObserverRef.current = observer
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
    }
  }, [scheduleProcess])

  if (error) {
    return (
      <img
        src={src}
        alt={alt}
        className={`upscaled-image-fallback ${className}`}
        style={{ objectFit: fit }}
        {...props}
      />
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`upscaled-image-container ${className}`} 
      {...props}
    >
      {!loaded && (
        <img
          src={src}
          alt={alt}
          className="upscaled-image-placeholder"
          style={{ objectFit: fit }}
        />
      )}
      <canvas
        ref={canvasRef}
        className={`upscaled-image-canvas ${loaded ? 'loaded' : ''}`}
        style={{ objectFit: fit }}
      />
    </div>
  )
})

export default UpscaledImage
