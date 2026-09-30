import { useCallback } from 'react'
import { extractRJCode } from '../utils/scanner'

/**
 * useWorkMetadata Hook
 * 封装作品元数据编辑与刷新逻辑
 */
export function useWorkMetadata({
  selectedWork,
  setSelectedWork,
  setWorks,
  showToast,
}) {
  // 编辑元数据
  const handleEditMetadata = useCallback(
    async (data) => {
      if (!selectedWork) return
      try {
        const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, data)
        if (updated) {
          setSelectedWork(updated)
          setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
        }
      } catch (e) {
        console.error('Failed to update metadata:', e)
      }
    },
    [selectedWork, setSelectedWork, setWorks],
  )

  // 刷新元数据（从 DLsite 重新刮削）
  const handleRefreshMetadata = useCallback(async () => {
    if (!selectedWork) return
    try {
      const rjCode = selectedWork.rjCode || extractRJCode(selectedWork.folderName)
      if (rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
          return
        }
      }
      const results = await window.electronAPI.dlsiteSearch(selectedWork.folderName)
      if (results.length > 0 && results[0].rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(results[0].rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
        }
      }
    } catch (e) {
      console.error('Failed to refresh metadata:', e)
      showToast('重新刮削失败：' + e.message, 'error')
    }
  }, [selectedWork, setSelectedWork, setWorks, showToast])

  return {
    handleEditMetadata,
    handleRefreshMetadata,
  }
}
