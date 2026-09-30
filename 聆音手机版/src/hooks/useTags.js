import { useState, useCallback } from 'react'

export function useTags({ onToast, onRefreshWorks } = {}) {
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(false)

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const tags = await window.electronAPI.tagsGetAll()
      setAllTags(tags || [])
    } catch (e) {
      console.error('Failed to load tags:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const setTagColor = useCallback(async (tagName, color) => {
    try {
      const result = await window.electronAPI.tagsSetColor(tagName, color)
      setAllTags((prev) =>
        prev.map((t) =>
          t.name === tagName ? { ...t, color: result?.color || color } : t
        )
      )
      return result
    } catch (e) {
      console.error('Failed to set tag color:', e)
      onToast?.('设置标签颜色失败', 'error')
      return null
    }
  }, [onToast])

  const renameTag = useCallback(async (oldName, newName) => {
    try {
      const result = await window.electronAPI.tagsRename(oldName, newName)
      if (result?.success) {
        onToast?.(`已重命名标签，影响 ${result.updatedCount} 个作品`, 'success')
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to rename tag:', e)
      onToast?.('重命名标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const mergeTags = useCallback(async (sourceNames, targetName) => {
    try {
      const result = await window.electronAPI.tagsMerge(sourceNames, targetName)
      if (result?.success) {
        onToast?.(`已合并 ${sourceNames.length} 个标签到「${targetName}」，影响 ${result.updatedCount} 个作品`, 'success')
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to merge tags:', e)
      onToast?.('合并标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const deleteTag = useCallback(async (tagName) => {
    try {
      const result = await window.electronAPI.tagsDelete(tagName)
      if (result?.success) {
        onToast?.(`已删除标签「${tagName}」，影响 ${result.updatedCount} 个作品`, 'success')
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to delete tag:', e)
      onToast?.('删除标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const addTagToWork = useCallback(async (workId, tagName) => {
    try {
      const result = await window.electronAPI.tagsAddToWork(workId, tagName)
      if (result) {
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to add tag to work:', e)
      onToast?.('添加标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const removeTagFromWork = useCallback(async (workId, tagName) => {
    try {
      const result = await window.electronAPI.tagsRemoveFromWork(workId, tagName)
      if (result) {
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to remove tag from work:', e)
      onToast?.('移除标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const batchAddTags = useCallback(async (workIds, tagNames) => {
    try {
      const result = await window.electronAPI.tagsBatchAdd(workIds, tagNames)
      if (result?.success) {
        onToast?.(`已为 ${result.updatedCount} 个作品添加标签`, 'success')
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to batch add tags:', e)
      onToast?.('批量添加标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const batchRemoveTags = useCallback(async (workIds, tagNames) => {
    try {
      const result = await window.electronAPI.tagsBatchRemove(workIds, tagNames)
      if (result?.success) {
        onToast?.(`已从 ${result.updatedCount} 个作品移除标签`, 'success')
        await loadTags()
        onRefreshWorks?.()
      }
      return result
    } catch (e) {
      console.error('Failed to batch remove tags:', e)
      onToast?.('批量移除标签失败', 'error')
      return null
    }
  }, [loadTags, onToast, onRefreshWorks])

  const getTagColor = useCallback((tagName) => {
    const tag = allTags.find((t) => t.name === tagName)
    return tag?.color || ''
  }, [allTags])

  return {
    allTags,
    loading,
    loadTags,
    setTagColor,
    renameTag,
    mergeTags,
    deleteTag,
    addTagToWork,
    removeTagFromWork,
    batchAddTags,
    batchRemoveTags,
    getTagColor,
  }
}
