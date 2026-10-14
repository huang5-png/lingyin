import { useState, useCallback, useMemo } from 'react'
import { filterWorksByScenery, computeSceneryCounts, SCENERY_PRESETS } from '../utils/soundscapeAnalyzer'

/**
 * 声景心境全景漫游透镜 Hook
 */
export function useSoundscape(works = []) {
  const [activeSceneryId, setActiveSceneryId] = useState(null)

  const handleSelectScenery = useCallback((sceneryId) => {
    setActiveSceneryId((prev) => (prev === sceneryId ? null : sceneryId))
  }, [])

  const handleClearScenery = useCallback(() => {
    setActiveSceneryId(null)
  }, [])

  // 统计各声景作品数量
  const sceneryCounts = useMemo(() => {
    return computeSceneryCounts(works)
  }, [works])

  // 经过声景透镜过滤后的作品列表
  const sceneryFilteredWorks = useMemo(() => {
    return filterWorksByScenery(works, activeSceneryId)
  }, [works, activeSceneryId])

  const activePreset = useMemo(() => {
    return SCENERY_PRESETS.find(p => p.id === activeSceneryId) || null
  }, [activeSceneryId])

  return {
    presets: SCENERY_PRESETS,
    activeSceneryId,
    activePreset,
    sceneryCounts,
    handleSelectScenery,
    handleClearScenery,
    sceneryFilteredWorks,
  }
}
