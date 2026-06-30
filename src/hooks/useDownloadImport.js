import { useEffect } from 'react'

/**
 * 下载完成自动导入 Hook
 * 处理下载任务完成后的 Toast 通知和自动添加到媒体库
 */
export function useDownloadImport({ showToast, autoImportDownloaded, works, loadWorks }) {
  useEffect(() => {
    if (!window.electronAPI?.onDownloadTaskComplete) return

    const unsubscribeComplete = window.electronAPI.onDownloadTaskComplete(async (data) => {
      showToast(`下载完成：${data.workTitle}`, 'success')

      if (autoImportDownloaded) {
        try {
          const folderPath = data.saveDir && data.workFolder
            ? `${data.saveDir}/${data.workFolder}`
            : null

          if (folderPath) {
            const exists = await window.electronAPI.fileExists(folderPath)
            if (exists) {
              const { scanFolder } = await import('@/utils/scanner')
              const folderInfo = await scanFolder(folderPath)

              if (folderInfo.audioFiles.length > 0) {
                const rjCode = data.rjCode || ''
                const workId = rjCode || `local_${Date.now()}`

                const existing = works.find(w => w.id === workId || w.folderPath === folderPath)
                if (!existing) {
                  const newWork = {
                    id: workId,
                    title: data.workTitle || folderInfo.folderName,
                    folderPath: folderPath,
                    folderName: folderInfo.folderName,
                    cover: data.workCover || '',
                    circle: data.workCircle || '',
                    cvs: Array.isArray(data.workVAs) ? data.workVAs : [],
                    tags: Array.isArray(data.workTags) ? data.workTags : [],
                    rjCode: rjCode,
                    isOnline: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  }

                  await window.electronAPI.dbAddWork(newWork)
                  await loadWorks()
                  showToast(`已自动添加到媒体库：${data.workTitle}`, 'success')
                }
              }
            }
          }
        } catch (e) {
          console.error('Auto import failed:', e)
        }
      }
    })

    const unsubscribeFailed = window.electronAPI.onDownloadTaskFailed?.((data) => {
      showToast(`下载失败：${data.workTitle}（${data.failedCount} 个文件）`, 'error')
    })

    return () => {
      unsubscribeComplete?.()
      unsubscribeFailed?.()
    }
  }, [showToast, autoImportDownloaded, works, loadWorks])
}
