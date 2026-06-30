import { useState, useCallback } from 'react'
import { DEFAULT_SHORTCUTS } from '../components/KeyboardShortcutsPanel'

const DEFAULT_SETTINGS = {
  autoPlayNext: true,
  rememberProgress: true,
  autoPlayOnStart: false,
  defaultVolume: 80,
  sidebarWidth: 280,
  lyricWidth: 360,
  playerHeight: 96,
  showRatingStars: true,
  waveformHeight: 56,
  showLyric: true,
  autoScrollLyric: true,
  skipSeconds: 5,
  theme: 'light',
  viewMode: 'grid',
  loopMode: 'none',
  shuffle: false,
  autoHideSidebar: true,
  playbackRate: 1,
  shortcuts: { ...DEFAULT_SHORTCUTS },
  closeToTray: true,
  subtitleStylePreset: 'default',
  subtitleLyricFontSize: 14,
  subtitleLyricColor: '#e8e6e3',
  subtitleLyricActiveColor: '#c96442',
  subtitleLyricFontWeight: 400,
  subtitleLyricShadow: true,
  subtitleLyricShadowBlur: 2,
  subtitleImmersiveFontSize: 22,
  subtitleImmersiveActiveFontSize: 34,
  subtitleImmersiveColor: '#ffffff',
  subtitleImmersiveActiveColor: '#ffffff',
  subtitleImmersiveFontWeight: 500,
  subtitleImmersiveShadow: true,
  subtitleImmersiveShadowBlur: 4,
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS }
}

export function useAppSettings({ playerRef, setShowLyric, showToast }) {
  const [settings, setSettings] = useState(loadSettings)
  const [viewMode, setViewMode] = useState(settings.viewMode || 'grid')
  const [showLyric, setLocalShowLyric] = useState(settings.showLyric)

  const handleSaveSettings = useCallback(
    (newSettings) => {
      setSettings(newSettings)
      localStorage.setItem('appSettings', JSON.stringify(newSettings))
      try {
        window.electronAPI.dbSaveSettings(newSettings)
      } catch (e) {
        console.error('Failed to save settings to db:', e)
      }
      if (newSettings.showLyric !== undefined) {
        setLocalShowLyric(newSettings.showLyric)
        if (setShowLyric) {
          setShowLyric(newSettings.showLyric)
        }
      }
      if (newSettings.defaultVolume !== undefined && playerRef?.current) {
        playerRef.current.setVolume?.(newSettings.defaultVolume / 100)
      }
    },
    [playerRef, setShowLyric],
  )

  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setSettings((prev) => {
        const newSettings = { ...prev, viewMode: mode }
        window.electronAPI?.dbSaveSettings(newSettings).catch(() => {})
        return newSettings
      })
    },
    [],
  )

  const handlePlaybackRateChange = useCallback(
    (rate) => {
      setSettings((prev) => {
        const newSettings = { ...prev, playbackRate: rate }
        localStorage.setItem('appSettings', JSON.stringify(newSettings))
        window.electronAPI?.dbSaveSettings(newSettings).catch(() => {})
        return newSettings
      })
    },
    [],
  )

  return {
    settings,
    setSettings,
    viewMode,
    setViewMode,
    showLyric,
    setShowLyric: setLocalShowLyric,
    handleSaveSettings,
    handleViewModeChange,
    handlePlaybackRateChange,
    DEFAULT_SETTINGS,
  }
}
