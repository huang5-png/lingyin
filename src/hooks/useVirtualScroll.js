import { useState, useCallback, useRef, useEffect, useMemo } from 'react'

export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerRef,
  overscan = 5,
  mode = 'list',
  getColumnCount,
  estimateItemHeight,
  getItemKey,
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const resizeObserverRef = useRef(null)
  const rafRef = useRef(null)

  const columnCount = useMemo(() => {
    if (mode === 'list') return 1
    if (getColumnCount) return getColumnCount(containerWidth)
    return Math.max(1, Math.floor(containerWidth / 180) || 2)
  }, [mode, getColumnCount, containerWidth])

  const rowCount = useMemo(() => {
    return Math.ceil(itemCount / columnCount)
  }, [itemCount, columnCount])

  const totalHeight = useMemo(() => {
    return rowCount * itemHeight
  }, [rowCount, itemHeight])

  const startRow = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  }, [scrollTop, itemHeight, overscan])

  const endRow = useMemo(() => {
    return Math.min(
      rowCount,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    )
  }, [scrollTop, viewportHeight, itemHeight, rowCount, overscan])

  const startIndex = useMemo(() => startRow * columnCount, [startRow, columnCount])
  const endIndex = useMemo(() => Math.min(itemCount, endRow * columnCount), [endRow, columnCount, itemCount])

  const offsetY = useMemo(() => startRow * itemHeight, [startRow, itemHeight])

  const handleScroll = useCallback((e) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(e.target.scrollTop)
      rafRef.current = null
    })
  }, [])

  const measureViewport = useCallback(() => {
    if (containerRef?.current) {
      setViewportHeight(containerRef.current.clientHeight)
      setContainerWidth(containerRef.current.clientWidth)
    }
  }, [containerRef])

  useEffect(() => {
    measureViewport()

    const element = containerRef?.current
    if (element && typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        measureViewport()
      })
      resizeObserverRef.current.observe(element)
    }

    const handleResize = () => measureViewport()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [measureViewport, containerRef])

  const scrollToIndex = useCallback((index, align = 'start') => {
    if (containerRef?.current && itemHeight > 0) {
      const row = Math.floor(index / columnCount)
      const targetScroll = row * itemHeight
      if (align === 'end') {
        containerRef.current.scrollTop = targetScroll - viewportHeight + itemHeight
      } else if (align === 'center') {
        containerRef.current.scrollTop = targetScroll - viewportHeight / 2 + itemHeight / 2
      } else {
        containerRef.current.scrollTop = targetScroll
      }
    }
  }, [containerRef, itemHeight, columnCount, viewportHeight])

  const scrollToTop = useCallback(() => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [containerRef])

  const showBackToTop = useMemo(() => scrollTop > 300, [scrollTop])

  const visibleItemCount = useMemo(() => endIndex - startIndex, [startIndex, endIndex])

  return {
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    handleScroll,
    measureViewport,
    scrollToIndex,
    scrollToTop,
    viewportHeight,
    columnCount,
    scrollTop,
    showBackToTop,
    visibleItemCount,
  }
}
