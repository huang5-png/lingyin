import { useState, useCallback, useMemo, useEffect } from 'react'
import { analyzeSeiyuuProfile, buildSeiyuuRadioQueue } from '../utils/seiyuuAnalyzer'

export function useSeiyuuProfile({
  allWorks = [],
  progressHistory = [],
  stamps = [],
  onPlayPlaylist,
  onFilterCV,
  onToast,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCV, setActiveCV] = useState(null)
  const [historyRecords, setHistoryRecords] = useState(Array.isArray(progressHistory) ? progressHistory : [])

  useEffect(() => {
    if (Array.isArray(progressHistory) && progressHistory.length > 0) {
      setHistoryRecords(progressHistory)
      return
    }
    if (isOpen && window.electronAPI?.dbGetAllHistory) {
      window.electronAPI.dbGetAllHistory().then((res) => {
        if (Array.isArray(res)) {
          setHistoryRecords(res)
        }
      }).catch(() => {})
    }
  }, [isOpen, progressHistory])

  const openSeiyuuProfile = useCallback((cvName) => {
    if (!cvName || typeof cvName !== 'string') return
    const clean = cvName.trim()
    if (!clean) return
    setActiveCV(clean)
    setIsOpen(true)
  }, [])

  const closeSeiyuuProfile = useCallback(() => {
    setIsOpen(false)
    setActiveCV(null)
  }, [])

  const profileData = useMemo(() => {
    if (!isOpen || !activeCV) return null
    return analyzeSeiyuuProfile(activeCV, allWorks, historyRecords, stamps)
  }, [isOpen, activeCV, allWorks, historyRecords, stamps])

  // 开启声优专属心动电台
  const handleStartRadio = useCallback(() => {
    if (!profileData) return
    const queueItems = buildSeiyuuRadioQueue(profileData)
    if (queueItems.length === 0) {
      onToast?.('该声优暂无可播放曲目', 'info')
      return
    }

    if (onPlayPlaylist) {
      onPlayPlaylist({
        id: `radio_${activeCV}`,
        name: `🎙️ ${activeCV} · 声优心动电台`,
        items: queueItems,
      })
      closeSeiyuuProfile()
      onToast?.(`已开启 ${activeCV} 专属电台，共 ${queueItems.length} 首曲目`, 'success')
    }
  }, [profileData, activeCV, onPlayPlaylist, closeSeiyuuProfile, onToast])

  // 在媒体库中快速筛选该声优
  const handleFilterThisCV = useCallback(() => {
    if (!activeCV) return
    if (onFilterCV) {
      onFilterCV(activeCV)
    }
    closeSeiyuuProfile()
    onToast?.(`已筛选声优「${activeCV}」的作品`, 'info')
  }, [activeCV, onFilterCV, closeSeiyuuProfile, onToast])

  return {
    isOpen,
    activeCV,
    profileData,
    openSeiyuuProfile,
    closeSeiyuuProfile,
    handleStartRadio,
    handleFilterThisCV,
  }
}
