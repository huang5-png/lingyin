import { useEffect, useCallback } from 'react'
import { DEFAULT_SHORTCUTS } from '../components/KeyboardShortcutsPanel'

function parseShortcut(shortcutStr) {
  if (!shortcutStr) return null
  const parts = shortcutStr.split('+')
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: parts[parts.length - 1],
  }
}

function matchShortcut(e, shortcutStr) {
  if (!shortcutStr) return false
  const expected = parseShortcut(shortcutStr)
  if (!expected) return false
  const key = e.key === ' ' ? 'Space' : e.key
  return e.ctrlKey === expected.ctrl &&
         e.shiftKey === expected.shift &&
         e.altKey === expected.alt &&
         key === expected.key
}

export function useKeyboardShortcuts({
  settings,
  playerRef,
  isImmersive,
  setIsImmersive,
  showGlobalSearch,
  setShowGlobalSearch,
  showSettingsModal,
  setShowSettingsModal,
  showDownloadModal,
  setShowDownloadModal,
  showQueuePanel,
  setShowQueuePanel,
  currentAudio,
  handlePrevAudio,
  handleNextAudio,
}) {
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      if (e.key === 'Escape') {
        if (showGlobalSearch) {
          e.preventDefault()
          setShowGlobalSearch?.(false)
        } else if (showSettingsModal) {
          e.preventDefault()
          setShowSettingsModal?.(false)
        } else if (showDownloadModal) {
          e.preventDefault()
          setShowDownloadModal?.(false)
        } else if (showQueuePanel) {
          e.preventDefault()
          setShowQueuePanel?.(false)
        }
      }
      return
    }

    const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS

    if (matchShortcut(e, shortcuts.exitImmersive)) {
      if (showGlobalSearch) {
        e.preventDefault()
        setShowGlobalSearch?.(false)
        return
      }
      if (showSettingsModal) {
        e.preventDefault()
        setShowSettingsModal?.(false)
        return
      }
      if (showDownloadModal) {
        e.preventDefault()
        setShowDownloadModal?.(false)
        return
      }
      if (showQueuePanel) {
        e.preventDefault()
        setShowQueuePanel?.(false)
        return
      }
      if (isImmersive) {
        e.preventDefault()
        setIsImmersive?.(false)
      }
      return
    }

    if (matchShortcut(e, shortcuts.playPause)) {
      e.preventDefault()
      if (playerRef?.current) {
        playerRef.current.playPause?.()
      }
      return
    }

    if (matchShortcut(e, shortcuts.prevTrack)) {
      e.preventDefault()
      handlePrevAudio?.()
      return
    }

    if (matchShortcut(e, shortcuts.nextTrack)) {
      e.preventDefault()
      handleNextAudio?.()
      return
    }

    if (matchShortcut(e, shortcuts.volumeUp)) {
      e.preventDefault()
      if (playerRef?.current) {
        const currentVol = playerRef.current.getVolume?.() ?? ((settings?.defaultVolume || 80) / 100)
        const newVol = Math.min(1, currentVol + 0.05)
        playerRef.current.setVolume?.(newVol)
      }
      return
    }

    if (matchShortcut(e, shortcuts.volumeDown)) {
      e.preventDefault()
      if (playerRef?.current) {
        const currentVol = playerRef.current.getVolume?.() ?? ((settings?.defaultVolume || 80) / 100)
        const newVol = Math.max(0, currentVol - 0.05)
        playerRef.current.setVolume?.(newVol)
      }
      return
    }

    if (matchShortcut(e, shortcuts.seekBackward)) {
      e.preventDefault()
      if (playerRef?.current) {
        playerRef.current.skipBackward?.(settings?.skipSeconds || 5)
      }
      return
    }

    if (matchShortcut(e, shortcuts.seekForward)) {
      e.preventDefault()
      if (playerRef?.current) {
        playerRef.current.skipForward?.(settings?.skipSeconds || 5)
      }
      return
    }

    if (matchShortcut(e, shortcuts.toggleImmersive)) {
      e.preventDefault()
      if (currentAudio) {
        setIsImmersive?.((prev) => !prev)
      }
      return
    }

    if (matchShortcut(e, shortcuts.toggleQueue)) {
      e.preventDefault()
      setShowQueuePanel?.((prev) => !prev)
      return
    }

    if (matchShortcut(e, shortcuts.openSettings)) {
      e.preventDefault()
      setShowSettingsModal?.(true)
      return
    }

    if (matchShortcut(e, shortcuts.globalSearch)) {
      e.preventDefault()
      setShowGlobalSearch?.((prev) => !prev)
      return
    }
  }, [
    settings,
    playerRef,
    isImmersive,
    setIsImmersive,
    showGlobalSearch,
    setShowGlobalSearch,
    showSettingsModal,
    setShowSettingsModal,
    showDownloadModal,
    setShowDownloadModal,
    showQueuePanel,
    setShowQueuePanel,
    currentAudio,
    handlePrevAudio,
    handleNextAudio,
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    parseShortcut,
    matchShortcut,
  }
}
