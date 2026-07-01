import { useState, useMemo, useCallback } from 'react'

/**
 * 管理作品列表的筛选状态（CV / 社团 / 标签）
 * 抽取自 App.jsx，简化主组件逻辑
 */
export function useFilters(works) {
  const [cvFilter, setCvFilter] = useState('')
  const [circleFilter, setCircleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState([])
  const [tagFilterMode, setTagFilterMode] = useState('and')

  // useMemo 缓存计算结果，减少重渲染
  const allCVs = useMemo(
    () => [...new Set(works.flatMap((w) => w.cvs || []))].sort(),
    [works],
  )

  const allCircles = useMemo(
    () => [...new Set(works.map((w) => w.circle).filter(Boolean))].sort(),
    [works],
  )

  const allTags = useMemo(() => {
    const tagCount = new Map()
    works.forEach((w) => {
      ;(w.tags || []).forEach((t) => {
        tagCount.set(t, (tagCount.get(t) || 0) + 1)
      })
    })
    return Array.from(tagCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [works])

  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      if (cvFilter && !(w.cvs || []).includes(cvFilter)) return false
      if (circleFilter && w.circle !== circleFilter) return false
      if (tagFilter.length > 0) {
        const workTags = w.tags || []
        if (tagFilterMode === 'and') {
          if (!tagFilter.every((t) => workTags.includes(t))) return false
        } else {
          if (!tagFilter.some((t) => workTags.includes(t))) return false
        }
      }
      return true
    })
  }, [works, cvFilter, circleFilter, tagFilter, tagFilterMode])

  const handleFilterChange = useCallback((type, value) => {
    if (type === 'cv') {
      setCvFilter(value)
    } else if (type === 'tag') {
      setTagFilter(Array.isArray(value) ? value : value ? [value] : [])
    } else {
      setCircleFilter(value)
    }
  }, [])

  const handleClearFilter = useCallback((type) => {
    if (type === 'cv') {
      setCvFilter('')
    } else if (type === 'tag') {
      setTagFilter([])
    } else {
      setCircleFilter('')
    }
  }, [])

  const handleToggleTagFilter = useCallback((tagName) => {
    setTagFilter((prev) => {
      if (prev.includes(tagName)) {
        return prev.filter((t) => t !== tagName)
      }
      return [...prev, tagName]
    })
  }, [])

  return {
    cvFilter,
    setCvFilter,
    circleFilter,
    setCircleFilter,
    tagFilter,
    setTagFilter,
    tagFilterMode,
    setTagFilterMode,
    allCVs,
    allCircles,
    allTags,
    filteredWorks,
    handleFilterChange,
    handleClearFilter,
    handleToggleTagFilter,
  }
}
