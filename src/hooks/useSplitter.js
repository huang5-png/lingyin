import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * 可拖拽分割线 Hook
 * 管理分割线拖拽的 state 和逻辑
 * @param {Object} options
 * @param {number} options.defaultWidth - 默认宽度
 * @param {number} options.minWidth - 最小宽度
 * @param {number} options.maxWidth - 最大宽度
 * @param {HTMLElement} options.containerRef - 容器 ref（用于计算边界）
 */
export function useSplitter({
  defaultWidth = 320,
  minWidth = 240,
  maxWidth = 600,
  containerRef,
}) {
  const [width, setWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const widthRef = useRef(defaultWidth)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef?.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = rect.right - e.clientX
      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth))
      widthRef.current = clampedWidth
      setWidth(clampedWidth)
    },
    [isDragging, containerRef, minWidth, maxWidth],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return {
    width,
    setWidth,
    isDragging,
    handleMouseDown,
  }
}
