import { useState, useCallback, useMemo } from 'react'

export function useBulkSelection({ works, onToggleFavorite, onDeleteWork, onSetWorkGroup, showToast }) {
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const selectedCount = selectedIds.size
  const totalCount = works?.length || 0
  const allSelected = totalCount > 0 && selectedCount === totalCount
  const someSelected = selectedCount > 0 && selectedCount < totalCount

  const toggleBulkMode = useCallback(() => {
    setBulkMode((prev) => {
      if (prev) {
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  const toggleSelect = useCallback((workId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(workId)) {
        next.delete(workId)
      } else {
        next.add(workId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!works) return
    setSelectedIds(new Set(works.map((w) => w.id)))
  }, [works])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection()
    } else {
      selectAll()
    }
  }, [allSelected, selectAll, clearSelection])

  const getSelectedWorks = useCallback(() => {
    if (!works) return []
    return works.filter((w) => selectedIds.has(w.id))
  }, [works, selectedIds])

  const handleBulkFavorite = useCallback(async () => {
    if (!onToggleFavorite || selectedCount === 0) return
    const selectedWorks = getSelectedWorks()
    let added = 0
    let removed = 0
    for (const work of selectedWorks) {
      try {
        const wasFavorited = work.isFavorited || false
        await onToggleFavorite(work)
        if (wasFavorited) {
          removed++
        } else {
          added++
        }
      } catch (e) {
        console.error('Failed to toggle favorite for work:', work.id, e)
      }
    }
    showToast?.(`批量收藏完成：添加 ${added} 个，取消 ${removed} 个`, 'success')
    clearSelection()
    setBulkMode(false)
  }, [onToggleFavorite, selectedCount, getSelectedWorks, showToast, clearSelection])

  const handleBulkDelete = useCallback(async () => {
    if (!onDeleteWork || selectedCount === 0) return
    if (!confirm(`确定删除选中的 ${selectedCount} 个作品吗？\n此操作不可恢复。`)) {
      return
    }
    const selectedWorks = getSelectedWorks()
    let successCount = 0
    for (const work of selectedWorks) {
      try {
        await onDeleteWork(work)
        successCount++
      } catch (e) {
        console.error('Failed to delete work:', work.id, e)
      }
    }
    showToast?.(`已删除 ${successCount} 个作品`, 'success')
    clearSelection()
    setBulkMode(false)
  }, [onDeleteWork, selectedCount, getSelectedWorks, showToast, clearSelection])

  const handleBulkMoveToGroup = useCallback(async (groupId) => {
    if (!onSetWorkGroup || selectedCount === 0) return
    const selectedWorks = getSelectedWorks()
    let successCount = 0
    for (const work of selectedWorks) {
      try {
        await onSetWorkGroup(work.id, groupId)
        successCount++
      } catch (e) {
        console.error('Failed to move work to group:', work.id, e)
      }
    }
    showToast?.(`已移动 ${successCount} 个作品到分组`, 'success')
    clearSelection()
    setBulkMode(false)
  }, [onSetWorkGroup, selectedCount, getSelectedWorks, showToast, clearSelection])

  return {
    bulkMode,
    setBulkMode,
    toggleBulkMode,
    selectedIds,
    selectedCount,
    totalCount,
    allSelected,
    someSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleSelectAll,
    getSelectedWorks,
    handleBulkFavorite,
    handleBulkDelete,
    handleBulkMoveToGroup,
  }
}
