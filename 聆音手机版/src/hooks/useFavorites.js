import { useState, useEffect, useCallback, useMemo } from 'react'

export function useFavorites({ showToast } = {}) {
  const [favorites, setFavorites] = useState([])
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true)
      const favs = await window.electronAPI.favoritesGetAll()
      setFavorites(favs || [])
    } catch (e) {
      console.error('加载收藏失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const favoriteIds = useMemo(() => {
    return new Set(favorites.map(f => f.workId))
  }, [favorites])

  const isFavorite = useCallback((workId) => {
    return favoriteIds.has(workId)
  }, [favoriteIds])

  const toggleFavorite = useCallback(async (workId, workInfo = {}) => {
    try {
      const result = await window.electronAPI.favoritesToggle(workId, workInfo)
      if (result?.isFavorite) {
        setFavorites(prev => [...prev, result.favorite])
        if (showToast) showToast('已添加到收藏', 'success')
      } else {
        setFavorites(prev => prev.filter(f => f.workId !== workId))
        if (showToast) showToast('已取消收藏', 'info')
      }
      return result?.isFavorite
    } catch (e) {
      console.error('切换收藏失败:', e)
      if (showToast) showToast('操作失败', 'error')
      return null
    }
  }, [showToast])

  const addFavorite = useCallback(async (workId, workInfo = {}) => {
    try {
      const fav = await window.electronAPI.favoritesAdd(workId, workInfo)
      setFavorites(prev => {
        if (prev.some(f => f.workId === workId)) return prev
        return [...prev, fav]
      })
      if (showToast) showToast('已添加到收藏', 'success')
      return true
    } catch (e) {
      console.error('添加收藏失败:', e)
      if (showToast) showToast('添加收藏失败', 'error')
      return false
    }
  }, [showToast])

  const removeFavorite = useCallback(async (workId) => {
    try {
      const success = await window.electronAPI.favoritesRemove(workId)
      if (success) {
        setFavorites(prev => prev.filter(f => f.workId !== workId))
        if (showToast) showToast('已取消收藏', 'info')
      }
      return success
    } catch (e) {
      console.error('移除收藏失败:', e)
      if (showToast) showToast('移除收藏失败', 'error')
      return false
    }
  }, [showToast])

  const filterFavorites = useCallback((works) => {
    if (!showOnlyFavorites) return works
    return works.filter(work => favoriteIds.has(work.id))
  }, [showOnlyFavorites, favoriteIds])

  return {
    favorites,
    favoriteIds,
    showOnlyFavorites,
    setShowOnlyFavorites,
    loading,
    loadFavorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    filterFavorites,
  }
}
