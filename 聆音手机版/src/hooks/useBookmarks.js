import { useState, useEffect, useCallback, useMemo } from 'react'

export function useBookmarks({ showToast } = {}) {
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.electronAPI.bookmarksGetAll()
      setBookmarks(list || [])
    } catch (e) {
      console.error('加载书签失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookmarks()
  }, [loadBookmarks])

  const getBookmarksByWork = useCallback(async (workId) => {
    try {
      const list = await window.electronAPI.bookmarksGetByWork(workId)
      return list || []
    } catch (e) {
      console.error('获取作品书签失败:', e)
      return []
    }
  }, [])

  const getBookmarksByAudio = useCallback(async (workId, audioPath) => {
    try {
      const list = await window.electronAPI.bookmarksGetByAudio(workId, audioPath)
      return list || []
    } catch (e) {
      console.error('获取音频书签失败:', e)
      return []
    }
  }, [])

  const currentAudioBookmarks = useMemo(() => {
    return bookmarks
  }, [bookmarks])

  const addBookmark = useCallback(async (bookmark) => {
    try {
      const newBm = await window.electronAPI.bookmarksAdd(bookmark)
      setBookmarks(prev => [...prev, newBm].sort((a, b) => a.time - b.time))
      if (showToast) showToast('已添加书签', 'success')
      return newBm
    } catch (e) {
      console.error('添加书签失败:', e)
      if (showToast) showToast('添加书签失败', 'error')
      return null
    }
  }, [showToast])

  const updateBookmark = useCallback(async (id, data) => {
    try {
      const updated = await window.electronAPI.bookmarksUpdate(id, data)
      if (updated) {
        setBookmarks(prev => prev.map(b => b.id === id ? updated : b).sort((a, b) => a.time - b.time))
        if (showToast) showToast('书签已更新', 'success')
      }
      return updated
    } catch (e) {
      console.error('更新书签失败:', e)
      if (showToast) showToast('更新书签失败', 'error')
      return null
    }
  }, [showToast])

  const deleteBookmark = useCallback(async (id) => {
    try {
      const success = await window.electronAPI.bookmarksDelete(id)
      if (success) {
        setBookmarks(prev => prev.filter(b => b.id !== id))
        if (showToast) showToast('书签已删除', 'info')
      }
      return success
    } catch (e) {
      console.error('删除书签失败:', e)
      if (showToast) showToast('删除书签失败', 'error')
      return false
    }
  }, [showToast])

  const clearAllBookmarks = useCallback(async () => {
    try {
      const count = await window.electronAPI.bookmarksClearAll()
      if (count > 0) {
        setBookmarks([])
        if (showToast) showToast(`已清除 ${count} 个书签`, 'info')
      }
      return count
    } catch (e) {
      console.error('清除书签失败:', e)
      if (showToast) showToast('清除书签失败', 'error')
      return 0
    }
  }, [showToast])

  const hasBookmarkAtTime = useCallback((workId, audioPath, time, tolerance = 1) => {
    return bookmarks.some(b =>
      b.workId === workId &&
      b.audioPath === audioPath &&
      Math.abs(b.time - time) <= tolerance
    )
  }, [bookmarks])

  return {
    bookmarks,
    loading,
    loadBookmarks,
    getBookmarksByWork,
    getBookmarksByAudio,
    currentAudioBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    clearAllBookmarks,
    hasBookmarkAtTime,
  }
}
