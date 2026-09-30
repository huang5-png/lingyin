import { useEffect, useRef, useState } from 'react'
import { applyThemeColors, getAccentColorForTheme } from '../utils/themePresets'

export function useTheme({ settings, setSettings, setShowLyric, showToast }) {
  const prevThemeRef = useRef(settings.theme)
  const [systemTheme, setSystemTheme] = useState('light')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    setSystemTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isDarkMode = settings.theme === 'auto'
    ? systemTheme === 'dark'
    : settings.theme === 'dark'

  const currentAccentColor = getAccentColorForTheme(
    settings.accentPreset || 'warm-orange',
    settings.customAccentColor,
    isDarkMode,
  )

  useEffect(() => {
    const BASE_WIDTH = 1400
    const BASE_HEIGHT = 900
    const MIN_ZOOM = 0.6
    const MAX_ZOOM = 1.2

    const updateZoom = () => {
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight
      const zoomX = winWidth / BASE_WIDTH
      const zoomY = winHeight / BASE_HEIGHT
      const zoom = Math.min(zoomX, zoomY)
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      document.body.style.zoom = clampedZoom
    }

    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const appRoot = document.getElementById('root')

    root.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)
    root.style.setProperty('--lyric-width', `${settings.lyricWidth}px`)
    root.style.setProperty('--player-height', `${settings.playerHeight}px`)

    const targetTheme = isDarkMode ? 'dark' : 'light'

    if (targetTheme) {
      if (prevThemeRef.current && prevThemeRef.current !== targetTheme && appRoot) {
        appRoot.classList.add('theme-transitioning')
        root.setAttribute('data-theme', targetTheme)
        applyThemeColors(currentAccentColor, isDarkMode)
        const timer = setTimeout(() => {
          appRoot.classList.remove('theme-transitioning')
        }, 550)
        return () => clearTimeout(timer)
      }
      root.setAttribute('data-theme', targetTheme)
      applyThemeColors(currentAccentColor, isDarkMode)
      prevThemeRef.current = targetTheme
    }
  }, [settings, isDarkMode, currentAccentColor])

  useEffect(() => {
    async function loadDbSettings() {
      try {
        const dbSettings = await window.electronAPI.dbGetSettings()
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          setSettings((prev) => ({ ...dbSettings, ...prev }))
          if (dbSettings.showLyric !== undefined && setShowLyric) {
            setShowLyric(dbSettings.showLyric)
          }
        }
      } catch (e) {
        console.error('Failed to load settings from db:', e)
        showToast?.('加载设置失败', 'error')
      }
    }
    loadDbSettings()
  }, [])

  return {
    isDarkMode,
    systemTheme,
    currentAccentColor,
  }
}
