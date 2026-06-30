import { useState, useMemo, useCallback } from 'react'

/**
 * 管理作品列表的筛选状态（CV / 社团 / 标签）
 * 抽取自 App.jsx，简化主组件逻辑
 */
export function useFilters(works) {
  const [cvFilter, setCvFilter] = useState('')
  const [circleFilter, setCircleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  // useMemo 缓存计算结果，减少重渲染
  const allCVs = useMemo(
    () => [...new Set(works.flatMap((w) => w.cvs || []))].sort(),
    [works],
  )

  const allCircles = useMemo(
    () => [...new Set(works.map((w) => w.circle).filter(Boolean))].sort(),
    [works],
  )

  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      if (cvFilter && !(w.cvs || []).includes(cvFilter)) return false
      if (circleFilter && w.circle !== circleFilter) return false
      if (tagFilter && !(w.tags || []).includes(tagFilter)) return false
      return true
    })
  }, [works, cvFilter, circleFilter, tagFilter])

  const handleFilterChange = useCallback((type, value) => {
    if (type === 'cv') {
      setCvFilter(value)
    } else if (type === 'tag') {
      setTagFilter(value)
    } else {
      setCircleFilter(value)
    }
  }, [])

  const handleClearFilter = useCallback((type) => {
    if (type === 'cv') {
      setCvFilter('')
    } else if (type === 'tag') {
      setTagFilter('')
    } else {
      setCircleFilter('')
    }
  }, [])

  return {
    cvFilter,
    setCvFilter,
    circleFilter,
    setCircleFilter,
    tagFilter,
    setTagFilter,
    allCVs,
    allCircles,
    filteredWorks,
    handleFilterChange,
    handleClearFilter,
  }
}
