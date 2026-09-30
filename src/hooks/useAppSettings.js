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
  accentPreset: 'warm-orange',
  customAccentColor: '#c96442',
  viewMode: 'grid',
  loopMode: 'none',
  shuffle: false,
  autoHideSidebar: true,
  playbackRate: 1,
  shortcuts: { ...DEFAULT_SHORTCUTS },
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
  globalMediaKeys: true,
  trackChangeNotification: true,
  enableMediaSession: true,
  continuousPlay: false,
  restorePlayOnStart: false,
  persistPlayQueue: true,
  librarySortBy: 'createdAt',
  librarySortOrder: 'desc',
  translateEngine: 'google',
  aiTranslateBaseUrl: 'https://api.openai.com/v1',
  aiTranslateApiKey: '',
  aiTranslateModel: 'gpt-3.5-turbo',
  aiTranslateUseProxy: false,
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      // 迁移：旧版本 prevTrack/nextTrack 默认是 ArrowLeft/ArrowRight，
      // 新版本把它们改为空，方向键让给快退/快进。
      // 仅当用户没自定义过这些键时迁移（保持值等于旧默认值的情况）。
      if (parsed.shortcuts) {
        if (parsed.shortcuts.prevTrack === 'ArrowLeft' && parsed.shortcuts.nextTrack === 'ArrowRight'
            && !parsed.shortcuts.seekBackward && !parsed.shortcuts.seekForward) {
          parsed.shortcuts.prevTrack = ''
          parsed.shortcuts.nextTrack = ''
          parsed.shortcuts.seekBackward = 'ArrowLeft'
          parsed.shortcuts.seekForward = 'ArrowRight'
          // 立即写回，避免下次再迁移
          localStorage.setItem('appSettings', JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }))
        }
      }
      return { ...DEFAULT_SETTINGS, ...parsed }
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

  const handleLibrarySortChange = useCallback(
    (sortBy, sortOrder) => {
      setSettings((prev) => {
        const newSettings = {
          ...prev,
          librarySortBy: sortBy !== undefined ? sortBy : prev.librarySortBy,
          librarySortOrder: sortOrder !== undefined ? sortOrder : prev.librarySortOrder,
        }
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
    handleLibrarySortChange,
    DEFAULT_SETTINGS,
  }
}
