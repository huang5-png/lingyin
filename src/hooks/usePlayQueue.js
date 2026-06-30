import { useState, useRef, useCallback, useEffect } from 'react'

function genQueueItemId() {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

export function usePlayQueue({
  selectedWork,
  audioFiles,
  settings,
  showToast,
  playerRef,
  handleSelectAudioRef,
  setCurrentView,
  setSelectedWork,
}) {
  const [playQueue, setPlayQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [loopMode, setLoopMode] = useState(settings?.loopMode || 'none')
  const [shuffle, setShuffle] = useState(!!settings?.shuffle)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const pendingQueuePlayRef = useRef(null)

  const playFromQueue = useCallback((item, index) => {
    if (!item || !item.audio) return
    setQueueIndex(index)

    const targetWork = item.work
    const isSameWork = selectedWork && (
      selectedWork.id === targetWork.id ||
      (targetWork.folderPath && selectedWork.folderPath === targetWork.folderPath)
    )

    if (isSameWork) {
      handleSelectAudioRef?.current?.(item.audio)
      return
    }

    setCurrentView?.(item.source === 'discover' ? 'discover' : 'library')
    setSelectedWork?.(targetWork)
    pendingQueuePlayRef.current = { item, startedAt: Date.now() }
  }, [selectedWork, handleSelectAudioRef, setCurrentView, setSelectedWork])

  useEffect(() => {
    if (!pendingQueuePlayRef.current) return
    const { item, startedAt } = pendingQueuePlayRef.current
    if (Date.now() - startedAt > 8000) {
      pendingQueuePlayRef.current = null
      showToast?.('队列播放超时，请重试', 'warning')
      return
    }
    const matched = selectedWork && (
      selectedWork.id === item.work.id ||
      (item.work.folderPath && selectedWork.folderPath === item.work.folderPath)
    )
    if (!matched) return
    if (item.audio.isOnline) {
      handleSelectAudioRef?.current?.(item.audio)
      pendingQueuePlayRef.current = null
      return
    }
    if (audioFiles?.length > 0) {
      handleSelectAudioRef?.current?.(item.audio)
      pendingQueuePlayRef.current = null
    }
  }, [audioFiles, selectedWork, handleSelectAudioRef, showToast])

  const advanceQueue = useCallback((direction = 1, isAutoFinish = false) => {
    if (queueIndex < 0 || playQueue.length === 0) return false
    if (isAutoFinish && loopMode === 'one') {
      if (playerRef?.current) playerRef.current.seekTo?.(0)
      return true
    }
    if (shuffle && playQueue.length > 1) {
      let next
      do {
        next = Math.floor(Math.random() * playQueue.length)
      } while (next === queueIndex)
      playFromQueue(playQueue[next], next)
      return true
    }
    let nextIdx = queueIndex + direction
    if (nextIdx < 0) {
      if (loopMode === 'list') nextIdx = playQueue.length - 1
      else return false
    } else if (nextIdx >= playQueue.length) {
      if (loopMode === 'list') nextIdx = 0
      else {
        setQueueIndex(-1)
        return false
      }
    }
    playFromQueue(playQueue[nextIdx], nextIdx)
    return true
  }, [queueIndex, playQueue, loopMode, shuffle, playFromQueue, playerRef])

  const buildQueueItem = useCallback((audio, work) => {
    const w = work || selectedWork
    if (!audio || !w) return null
    return {
      id: genQueueItemId(),
      audio: {
        path: audio.path,
        name: audio.name,
        isOnline: !!audio.isOnline,
        duration: audio.duration,
      },
      work: {
        id: w.id,
        title: w.title || w.folderName || '',
        cover: w.cover || '',
        folderPath: w.folderPath || '',
        isOnline: !!w.isOnline,
      },
      source: w.isOnline ? 'discover' : 'library',
      audioName: audio.name || '',
      workTitle: w.title || w.folderName || '',
      workCover: w.cover || '',
      addedAt: Date.now(),
    }
  }, [selectedWork])

  const addToQueue = useCallback((audio, work) => {
    const item = buildQueueItem(audio, work)
    if (!item) return
    setPlayQueue((prev) => {
      if (item.audio.path && prev.some((it) => it.audio.path === item.audio.path)) {
        showToast?.('该曲目已在队列中', 'info')
        return prev
      }
      showToast?.(`已加入队列：${item.audioName}`, 'success')
      return [...prev, item]
    })
  }, [buildQueueItem, showToast])

  const playNext = useCallback((audio, work) => {
    const item = buildQueueItem(audio, work)
    if (!item) return
    setPlayQueue((prev) => {
      if (item.audio.path && prev.some((it) => it.audio.path === item.audio.path)) {
        showToast?.('该曲目已在队列中', 'info')
        return prev
      }
      const insertAt = queueIndex >= 0 ? queueIndex + 1 : prev.length
      const next = [...prev]
      next.splice(insertAt, 0, item)
      showToast?.(`下一首播放：${item.audioName}`, 'success')
      return next
    })
  }, [buildQueueItem, queueIndex, showToast])

  const removeFromQueue = useCallback((itemId) => {
    const idx = playQueue.findIndex((it) => it.id === itemId)
    if (idx < 0) return
    setPlayQueue((prev) => prev.filter((it) => it.id !== itemId))
    setQueueIndex((qi) => {
      if (qi < 0) return -1
      if (idx < qi) return qi - 1
      if (idx === qi) return idx >= playQueue.length - 1 ? -1 : idx
      return qi
    })
  }, [playQueue])

  const clearQueue = useCallback(() => {
    setPlayQueue([])
    setQueueIndex(-1)
    showToast?.('队列已清空', 'info')
  }, [showToast])

  const reorderQueue = useCallback((itemIds) => {
    setPlayQueue((prev) => {
      const map = new Map(prev.map((it) => [it.id, it]))
      const next = []
      for (const id of itemIds) {
        const it = map.get(id)
        if (it) {
          next.push(it)
          map.delete(id)
        }
      }
      for (const it of map.values()) next.push(it)
      setQueueIndex((qi) => {
        if (qi < 0) return -1
        const current = prev[qi]
        if (!current) return -1
        const newIdx = next.findIndex((it) => it.id === current.id)
        return newIdx < 0 ? -1 : newIdx
      })
      return next
    })
  }, [])

  const toggleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      const next = prev === 'none' ? 'one' : prev === 'one' ? 'list' : 'none'
      try {
        const s = { ...settings, loopMode: next }
        localStorage.setItem('appSettings', JSON.stringify(s))
        window.electronAPI?.dbSaveSettings?.(s)
      } catch (e) {}
      return next
    })
  }, [settings])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev
      try {
        const s = { ...settings, shuffle: next }
        localStorage.setItem('appSettings', JSON.stringify(s))
        window.electronAPI?.dbSaveSettings?.(s)
      } catch (e) {}
      return next
    })
  }, [settings])

  const toggleQueuePanel = useCallback(() => {
    setShowQueuePanel((prev) => !prev)
  }, [])

  return {
    playQueue,
    setPlayQueue,
    queueIndex,
    setQueueIndex,
    loopMode,
    setLoopMode,
    shuffle,
    setShuffle,
    showQueuePanel,
    setShowQueuePanel,
    pendingQueuePlayRef,
    playFromQueue,
    advanceQueue,
    buildQueueItem,
    addToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    toggleLoopMode,
    toggleShuffle,
    toggleQueuePanel,
  }
}
