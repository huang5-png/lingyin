import { useState, useCallback, useRef } from 'react'

export function useViewNavigation({ showToast }) {
  const [selectedWork, setSelectedWork] = useState(null)
  const [currentView, setCurrentView] = useState('library')
  const [rightTab, setRightTab] = useState('details')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [settingsDefaultTab, setSettingsDefaultTab] = useState('basic')

  const pendingAutoPlayRef = useRef(null)
  const pendingContinueRef = useRef(null)

  const handleSelectWork = useCallback(
    (work) => {
      if (work?.id === selectedWork?.id) return
      setSelectedWork(work)
    },
    [selectedWork],
  )

  const handleOpenSettings = useCallback(() => {
    setSettingsDefaultTab('basic')
    setShowSettingsModal(true)
  }, [])

  const handleOpenSubtitleSettings = useCallback(() => {
    setSettingsDefaultTab('player')
    setShowSettingsModal(true)
  }, [])

  const handleRecentPlayAutoPlay = useCallback((item) => {
    pendingAutoPlayRef.current = { audioPath: item.audioPath, startedAt: Date.now() }
  }, [])

  const handleContinueListen = useCallback((item, works) => {
    if (!item || !item.workId) return
    const targetWork = works ? works.find(w => w.id === item.workId) : null
    pendingContinueRef.current = {
      workId: item.workId,
      audioFile: item.audioFile || item.audioPath,
      currentTime: item.currentTime || 0,
      startedAt: Date.now(),
    }
    if (targetWork) {
      setSelectedWork(targetWork)
      setCurrentView('library')
    }
  }, [])

  const handlePlayerCoverClick = useCallback(
    ({ playingWork, onToggleImmersive }) => {
      if (!playingWork) return

      if (selectedWork?.id !== playingWork.id) {
        if (playingWork.isOnline) {
          setCurrentView('discover')
          setSelectedWork(playingWork)
        } else {
          setCurrentView('library')
          setSelectedWork(playingWork)
        }
        return
      }

      onToggleImmersive?.()
    },
    [selectedWork],
  )

  return {
    selectedWork,
    setSelectedWork,
    currentView,
    setCurrentView,
    rightTab,
    setRightTab,
    showSettingsModal,
    setShowSettingsModal,
    showDownloadModal,
    setShowDownloadModal,
    showGlobalSearch,
    setShowGlobalSearch,
    settingsDefaultTab,
    setSettingsDefaultTab,
    pendingAutoPlayRef,
    pendingContinueRef,
    handleSelectWork,
    handleOpenSettings,
    handleOpenSubtitleSettings,
    handleRecentPlayAutoPlay,
    handleContinueListen,
    handlePlayerCoverClick,
  }
}
