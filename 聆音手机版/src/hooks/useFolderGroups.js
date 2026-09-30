import { useState, useEffect, useCallback, useMemo } from 'react'

export function useFolderGroups({ showToast, works, setWorks } = {}) {
  const [folderGroups, setFolderGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState('all')
  const [loading, setLoading] = useState(true)

  const loadFolderGroups = useCallback(async () => {
    try {
      setLoading(true)
      const groups = await window.electronAPI.folderGroupsGetAll()
      setFolderGroups(groups || [])
    } catch (e) {
      console.error('加载文件夹分组失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFolderGroups()
  }, [loadFolderGroups])

  const groupMap = useMemo(() => {
    const map = new Map()
    for (const g of folderGroups) {
      map.set(g.id, g)
    }
    return map
  }, [folderGroups])

  const createGroup = useCallback(async (name, color = '') => {
    try {
      const group = await window.electronAPI.folderGroupsCreate(name, color)
      setFolderGroups(prev => [...prev, group])
      if (showToast) showToast(`已创建分组「${group.name}」`, 'success')
      return group
    } catch (e) {
      console.error('创建分组失败:', e)
      if (showToast) showToast('创建分组失败', 'error')
      return null
    }
  }, [showToast])

  const renameGroup = useCallback(async (id, name) => {
    try {
      const group = await window.electronAPI.folderGroupsRename(id, name)
      if (group) {
        setFolderGroups(prev => prev.map(g => g.id === id ? group : g))
        if (showToast) showToast('分组已重命名', 'success')
      }
      return group
    } catch (e) {
      console.error('重命名分组失败:', e)
      if (showToast) showToast('重命名失败', 'error')
      return null
    }
  }, [showToast])

  const setGroupColor = useCallback(async (id, color) => {
    try {
      const group = await window.electronAPI.folderGroupsSetColor(id, color)
      if (group) {
        setFolderGroups(prev => prev.map(g => g.id === id ? group : g))
      }
      return group
    } catch (e) {
      console.error('设置分组颜色失败:', e)
      return null
    }
  }, [])

  const deleteGroup = useCallback(async (id, moveToGroupId = null) => {
    try {
      const group = groupMap.get(id)
      const success = await window.electronAPI.folderGroupsDelete(id, moveToGroupId)
      if (success) {
        setFolderGroups(prev => prev.filter(g => g.id !== id))
        if (activeGroupId === id) {
          setActiveGroupId('all')
        }
        if (showToast) showToast(`已删除分组「${group?.name || ''}」`, 'info')
      }
      return success
    } catch (e) {
      console.error('删除分组失败:', e)
      if (showToast) showToast('删除分组失败', 'error')
      return false
    }
  }, [groupMap, activeGroupId, showToast])

  const reorderGroups = useCallback(async (groupIds) => {
    try {
      const groups = await window.electronAPI.folderGroupsReorder(groupIds)
      if (groups) {
        setFolderGroups(groups)
      }
      return groups
    } catch (e) {
      console.error('重排分组失败:', e)
      return null
    }
  }, [])

  const setWorkGroup = useCallback(async (workId, groupId) => {
    try {
      const updatedWork = await window.electronAPI.folderGroupsSetWorkGroup(workId, groupId)
      if (updatedWork && setWorks) {
        setWorks(prev => prev.map(w => w.id === workId ? { ...w, folderGroupId: updatedWork.folderGroupId } : w))
      }
      const group = groupId ? groupMap.get(groupId) : null
      if (showToast) {
        if (groupId) {
          showToast(`已移动到「${group?.name || '分组'}」`, 'success')
        } else {
          showToast('已移出分组', 'info')
        }
      }
      return updatedWork
    } catch (e) {
      console.error('设置作品分组失败:', e)
      if (showToast) showToast('操作失败', 'error')
      return null
    }
  }, [setWorks, groupMap, showToast])

  const getGroupWorks = useCallback((groupId) => {
    if (!works) return []
    if (groupId === 'all') return works
    if (groupId === 'ungrouped') return works.filter(w => !w.folderGroupId)
    return works.filter(w => w.folderGroupId === groupId)
  }, [works])

  const filteredWorks = useMemo(() => {
    if (!works) return []
    return getGroupWorks(activeGroupId)
  }, [works, activeGroupId, getGroupWorks])

  const groupWorkCounts = useMemo(() => {
    const counts = new Map()
    let ungrouped = 0
    if (works) {
      for (const w of works) {
        if (w.folderGroupId) {
          counts.set(w.folderGroupId, (counts.get(w.folderGroupId) || 0) + 1)
        } else {
          ungrouped++
        }
      }
    }
    counts.set('all', works?.length || 0)
    counts.set('ungrouped', ungrouped)
    return counts
  }, [works])

  return {
    folderGroups,
    activeGroupId,
    setActiveGroupId,
    loading,
    groupMap,
    groupWorkCounts,
    filteredWorks,
    loadFolderGroups,
    createGroup,
    renameGroup,
    setGroupColor,
    deleteGroup,
    reorderGroups,
    setWorkGroup,
    getGroupWorks,
  }
}
