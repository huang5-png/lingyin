import { useState, useCallback, useEffect, useRef } from 'react'
import { scanFolder, scanMediaLibrary, extractRJCode } from '../utils/scanner'

export function useMediaLibrary({ showToast, setSelectedWork }) {
  const [works, setWorks] = useState([])
  const [isLoadingWorks, setIsLoadingWorks] = useState(true)
  const [audioFiles, setAudioFiles] = useState([])
  const [allSubtitleFiles, setAllSubtitleFiles] = useState([])

  // 最新 audioFiles 供轮询使用
  const latestAudioFilesRef = useRef([])
  useEffect(() => {
    latestAudioFilesRef.current = audioFiles
  }, [audioFiles])

  // 选中作品时扫描音频文件（在线作品直接跳过）
  useEffect(() => {
    let cancelled = false
    if (selectedWork) {
      if (selectedWork.isOnline) {
        return
      }
      scanFolder(selectedWork.folderPath).then(async (r) => {
        if (cancelled) return
        const filesWithDuration = await Promise.all(
          r.audioFiles.map(async (f) => {
            try {
              const dur = await window.electronAPI.getAudioDuration(f.path)
              return { ...f, duration: dur ? Math.round(dur) : null }
            } catch {
              return f
            }
          })
        )
        if (!cancelled) {
          setAudioFiles(filesWithDuration)
          setAllSubtitleFiles(r.subtitleFiles)
        }
      })
    } else {
      setAudioFiles([])
      setAllSubtitleFiles([])
    }
    return () => {
      cancelled = true
    }
  }, [selectedWork])

  // 加载所有作品
  const loadWorks = useCallback(async () => {
    setIsLoadingWorks(true)
    try {
      const data = await window.electronAPI.dbGetAllWorks()
      setWorks(data || [])
    } catch (e) {
      console.error('Failed to load works:', e)
    } finally {
      setIsLoadingWorks(false)
    }
  }, [])

  // 异步获取 DLsite 元数据（后台运行，不阻塞）
  const fetchDlsiteMetadataAsync = useCallback(async (workId, folderName, rjCode) => {
    try {
      let detail = null
      let searchResults = []

      if (rjCode) {
        try {
          detail = await window.electronAPI.dlsiteGetDetail(rjCode)
        } catch (e) {
          console.warn('DLsite 详情获取失败，尝试搜索:', e.message)
        }
      }

      if (!detail) {
        try {
          searchResults = await window.electronAPI.dlsiteSearch(folderName)
        } catch (e) {
          console.warn('DLsite 搜索失败:', e.message)
        }
      }

      const updates = {}
      if (detail) {
        Object.assign(updates, detail)
      } else if (searchResults.length > 0) {
        const first = searchResults[0]
        updates.cover = first.cover
        updates.title = first.title || folderName
        if (!rjCode && first.rjCode) {
          updates.rjCode = first.rjCode
        }
      }

      if (Object.keys(updates).length > 0) {
        const updated = await window.electronAPI.dbUpdateWork(workId, updates)
        if (updated) {
          setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          setSelectedWork((prev) => (prev && prev.id === updated.id ? updated : prev))
        }
      }
    } catch (e) {
      console.error('异步获取 DLsite 元数据失败:', e)
    }
  }, [setSelectedWork])

  // 添加单个文件夹
  const handleAddFolder = useCallback(async () => {
    try {
      const folderPath = await window.electronAPI.openDirectory()
      if (!folderPath) return

      const scanResult = await scanFolder(folderPath)
      if (scanResult.audioFiles.length === 0) {
        showToast('该文件夹中没有找到音频文件', 'warning')
        return false
      }

      const folderName = scanResult.folderName
      const rjCode = extractRJCode(folderName)

      const metadata = {
        id: folderPath,
        folderPath,
        folderName,
        rjCode,
        title: folderName,
        audioCount: scanResult.audioFiles.length,
        cover: '',
        rating: 0,
        tags: [],
        cvs: [],
        circle: '',
        description: '',
      }

      const savedWork = await window.electronAPI.dbAddWork(metadata)
      setWorks((prev) => [...prev, savedWork])
      setSelectedWork(savedWork)
      fetchDlsiteMetadataAsync(savedWork.id, folderName, rjCode)
      return true
    } catch (e) {
      console.error('Failed to add folder:', e)
      showToast('添加文件夹失败：' + e.message, 'error')
      return false
    }
  }, [showToast, setSelectedWork, fetchDlsiteMetadataAsync])

  // 批量扫描媒体库
  const handleAddMediaLibrary = useCallback(async () => {
    try {
      const rootPath = await window.electronAPI.openDirectory()
      if (!rootPath) return

      const existingWorks = await window.electronAPI.dbGetAllWorks()
      const existingPaths = new Set(existingWorks.map((w) => w.folderPath))

      const scanResults = await scanMediaLibrary(rootPath)
      if (scanResults.length === 0) {
        showToast('在该目录下没有找到包含音频文件的文件夹', 'warning')
        return
      }

      let addedCount = 0
      const newWorks = []

      for (const result of scanResults) {
        if (existingPaths.has(result.folderPath)) {
          continue
        }

        const folderName = result.folderName
        const rjCode = extractRJCode(folderName)

        const metadata = {
          id: result.folderPath,
          folderPath: result.folderPath,
          folderName,
          rjCode,
          title: folderName,
          audioCount: result.audioFiles.length,
          cover: '',
          rating: 0,
          tags: [],
          cvs: [],
          circle: '',
          description: '',
        }

        const savedWork = await window.electronAPI.dbAddWork(metadata)
        newWorks.push(savedWork)
        addedCount++

        fetchDlsiteMetadataAsync(savedWork.id, folderName, rjCode)
      }

      if (newWorks.length > 0) {
        setWorks((prev) => [...prev, ...newWorks])
      }

      showToast('媒体库扫描完成！共找到 ' + scanResults.length + ' 个作品，成功添加 ' + addedCount + ' 个新作品', 'success')
    } catch (e) {
      console.error('Failed to add media library:', e)
      showToast('添加媒体库失败：' + e.message, 'error')
    }
  }, [showToast, fetchDlsiteMetadataAsync])

  // 删除作品（回调给 App.jsx 清理相关状态）
  const handleDeleteWork = useCallback(async (work, selectedWork, onDelete) => {
    const confirmed = window.confirm(`确定要删除「${work.title || work.folderName}」吗？\n\n（只会删除记录，不会删除本地文件）`)
    if (!confirmed) return

    try {
      await window.electronAPI.dbDeleteWork(work.id)
      setWorks((prev) => prev.filter((w) => w.id !== work.id))
      if (selectedWork && selectedWork.id === work.id) {
        // 回调 App.jsx 清理相关 UI 状态
        if (onDelete) onDelete()
      }
    } catch (e) {
      console.error('Failed to delete work:', e)
      showToast('删除失败：' + e.message, 'error')
    }
  }, [showToast])

  return {
    works,
    isLoadingWorks,
    setWorks,
    loadWorks,
    handleAddFolder,
    handleAddMediaLibrary,
    handleDeleteWork,
    fetchDlsiteMetadataAsync,
    audioFiles,
    setAudioFiles,
    allSubtitleFiles,
    setAllSubtitleFiles,
    latestAudioFilesRef,
  }
}
