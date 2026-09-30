import { useState, useCallback, useEffect, useRef } from 'react'
import { DEFAULT_SHORTCUTS, normalizeShortcuts } from '../utils/shortcuts'

export const DEFAULT_SETTINGS = {
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
  sleepTimerFadeEnabled: true,
  sleepTimerFadeSeconds: 30,
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
      // 快捷键整体替换会丢掉新增动作，这里统一走 normalizeShortcuts：
      // 合并默认值 + 执行历史迁移（详见 utils/shortcuts.js）
      return { ...DEFAULT_SETTINGS, ...parsed, shortcuts: normalizeShortcuts(parsed.shortcuts) }
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS }
}

export function useAppSettings({ playerRef, setShowLyric, showToast }) {
  const [settings, setSettings] = useState(loadSettings)
  const [viewMode, setViewMode] = useState(settings.viewMode || 'grid')
  const [showLyric, setLocalShowLyric] = useState(settings.showLyric)

  // 始终指向最新的设置对象，保证增量更新不会合并到过期快照
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // 设置的唯一写入点：同步内存状态、localStorage、数据库，并触发相关副作用
  const commitSettings = useCallback(
    (next) => {
      settingsRef.current = next
      setSettings(next)
      localStorage.setItem('appSettings', JSON.stringify(next))
      try {
        window.electronAPI?.dbSaveSettings?.(next)?.catch?.(() => {})
      } catch (e) {
        console.error('Failed to save settings to db:', e)
      }
      if (next.showLyric !== undefined) {
        setLocalShowLyric(next.showLyric)
        if (setShowLyric) {
          setShowLyric(next.showLyric)
        }
      }
      if (next.defaultVolume !== undefined && playerRef?.current) {
        playerRef.current.setVolume?.(next.defaultVolume / 100)
      }
    },
    [playerRef, setShowLyric],
  )

  // 整份替换（设置面板保存时使用）
  const handleSaveSettings = useCallback((newSettings) => commitSettings(newSettings), [commitSettings])

  // 增量更新：把 patch 合并到最新设置上，不会覆盖其他被改动过的字段
  const updateSettings = useCallback(
    (patch) => {
      const prev = settingsRef.current
      commitSettings(typeof patch === 'function' ? patch(prev) : { ...prev, ...patch })
    },
    [commitSettings],
  )

  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      updateSettings({ viewMode: mode })
    },
    [updateSettings],
  )

  const handlePlaybackRateChange = useCallback(
    (rate) => {
      updateSettings({ playbackRate: rate })
    },
    [updateSettings],
  )

  const handleLibrarySortChange = useCallback(
    (sortBy, sortOrder) => {
      const patch = {}
      if (sortBy !== undefined) patch.librarySortBy = sortBy
      if (sortOrder !== undefined) patch.librarySortOrder = sortOrder
      updateSettings(patch)
    },
    [updateSettings],
  )

  return {
    settings,
    setSettings,
    viewMode,
    setViewMode,
    showLyric,
    setShowLyric: setLocalShowLyric,
    handleSaveSettings,
    updateSettings,
    handleViewModeChange,
    handlePlaybackRateChange,
    handleLibrarySortChange,
    DEFAULT_SETTINGS,
  }
}
