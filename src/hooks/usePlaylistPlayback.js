import { useState, useCallback } from 'react'

export function usePlaylistPlayback({
  works,
  showToast,
  handleSelectAudio,
  setCurrentView,
  setSelectedWork,
  latestAudioFilesRef,
  buildQueueItem,
  playQueue,
  setPlayQueue,
  playFromQueue,
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

  // 将播放列表转换为可入队的曲目项（跳过在线曲目与已失效作品）
  const buildQueueItemsFromPlaylist = useCallback(
    (playlist) => {
      const allItems = playlist?.items || []
      const localItems = allItems.filter((it) => !it.isOnline && it.audioPath)
      const built = []
      let missing = 0
      for (const it of localItems) {
        // 用原始作品对象补全 folderPath 等信息，保证跨作品切换时能扫描到音频
        const realWork =
          works.find((w) => w.id === it.workId) ||
          works.find((w) => w.folderPath === it.workId)
        if (!realWork) {
          missing++
          continue
        }
        const audio = {
          path: it.audioPath,
          name: it.audioName,
          isOnline: false,
        }
        const queueItem = buildQueueItem?.(audio, realWork)
        if (queueItem) built.push(queueItem)
        else missing++
      }
      const onlineSkipped = allItems.length - localItems.length
      return { items: built, onlineSkipped, missing }
    },
    [works, buildQueueItem],
  )

  // 用播放列表重建队列并从头播放（真正意义上的「播放全部」）
  const handlePlayPlaylist = useCallback(
    (playlist) => {
      if (!playlist) return
      const { items: queueItems, onlineSkipped, missing } = buildQueueItemsFromPlaylist(playlist)
      if (queueItems.length === 0) {
        showToast('播放列表中暂无可播放的本地曲目', 'warning')
        return
      }
      setPlayQueue(queueItems)
      playFromQueue(queueItems[0], 0)
      const parts = []
      if (onlineSkipped > 0) parts.push(`已跳过 ${onlineSkipped} 首在线曲目`)
      if (missing > 0) parts.push(`已跳过 ${missing} 首失效曲目`)
      const suffix = parts.length > 0 ? `（${parts.join('，')}）` : ''
      showToast(`已按队列播放「${playlist.name}」，共 ${queueItems.length} 首${suffix}`, 'success')
    },
    [buildQueueItemsFromPlaylist, setPlayQueue, setQueueIndex, playFromQueue, showToast],
  )

  // 将播放列表追加到当前队列（不打断正在播放的曲目）
  const handleAddPlaylistToQueue = useCallback(
    (playlist) => {
      if (!playlist) return
      const { items: queueItems, onlineSkipped, missing } = buildQueueItemsFromPlaylist(playlist)
      if (queueItems.length === 0) {
        showToast('播放列表中暂无可播放的本地曲目', 'warning')
        return
      }
      const existing = new Set((playQueue || []).map((it) => it.audio?.path).filter(Boolean))
      const toAdd = queueItems.filter((it) => !existing.has(it.audio.path))
      const duplicated = queueItems.length - toAdd.length
      if (toAdd.length === 0) {
        showToast('这些曲目已全部在队列中', 'info')
        return
      }
      setPlayQueue((prev) => [...prev, ...toAdd])
      const parts = [`已加入队列 ${toAdd.length} 首`]
      if (duplicated > 0) parts.push(`跳过 ${duplicated} 首重复`)
      if (onlineSkipped > 0) parts.push(`跳过 ${onlineSkipped} 首在线曲目`)
      if (missing > 0) parts.push(`跳过 ${missing} 首失效曲目`)
      showToast(parts.join('，'), 'success')
    },
    [buildQueueItemsFromPlaylist, playQueue, setPlayQueue, showToast],
  )

  return {
    addToPlaylistTarget,
    setAddToPlaylistTarget,
    handleOpenAddToPlaylist,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
    handlePlayPlaylist,
    handleAddPlaylistToQueue,
  }
}