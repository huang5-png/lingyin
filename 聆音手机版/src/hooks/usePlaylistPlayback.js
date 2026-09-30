import { useState, useCallback } from 'react'

export function usePlaylistPlayback({
  works,
  showToast,
  handleSelectAudio,
  setCurrentView,
  setSelectedWork,
  latestAudioFilesRef,
}) {
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null)

  const handleOpenAddToPlaylist = useCallback(
    (audio, work) => {
      if (!audio) return
      setAddToPlaylistTarget({ audio, work: work || null })
    },
    [],
  )

  const handleCloseAddToPlaylist = useCallback(() => {
    setAddToPlaylistTarget(null)
  }, [])

  const handlePlayPlaylistItem = useCallback(
    async (item) => {
      if (!item) return
      try {
        if (item.isOnline) {
          showToast('在线曲目请在「发现」中重新打开作品后播放', 'info')
          return
        }
        const target =
          works.find((w) => w.id === item.workId) ||
          works.find((w) => w.folderPath === item.workId)
        if (!target) {
          showToast('找不到原作品，可能已被删除', 'warning')
          return
        }
        setCurrentView('library')
        setSelectedWork(target)
        const tryPlay = setInterval(() => {
          const files = latestAudioFilesRef?.current
          if (files && files.length > 0) {
            const target2 = files.find((f) => f.path === item.audioPath)
            if (target2) {
              handleSelectAudio?.(target2)
              clearInterval(tryPlay)
            }
          }
        }, 200)
        setTimeout(() => clearInterval(tryPlay), 8000)
      } catch (e) {
        console.error('Failed to play playlist item:', e)
        showToast('播放失败：' + (e.message || ''), 'error')
      }
    },
    [works, showToast, handleSelectAudio, setCurrentView, setSelectedWork, latestAudioFilesRef],
  )

  const handleNavigateToWorkFromPlaylist = useCallback(
    (item) => {
      if (!item) return
      if (item.isOnline) {
        setCurrentView('discover')
        showToast('已切换到「发现」视图', 'info')
        return
      }
      const target =
        works.find((w) => w.id === item.workId) ||
        works.find((w) => w.folderPath === item.workId)
      if (!target) {
        showToast('找不到原作品', 'warning')
        return
      }
      setCurrentView('library')
      setSelectedWork(target)
    },
    [works, showToast, setCurrentView, setSelectedWork],
  )

  return {
    addToPlaylistTarget,
    setAddToPlaylistTarget,
    handleOpenAddToPlaylist,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
  }
}
