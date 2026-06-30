import { useEffect, useRef } from 'react'

/**
 * 管理主题切换与窗口缩放逻辑
 * 抽取自 App.jsx，简化主组件逻辑
 *
 * 职责：
 * 1. 窗口缩放：响应式缩放 0.6x - 1.2x，基于 1400x900 基准
 * 2. 主题切换：浅色/深色模式，支持过渡动画
 * 3. CSS 变量同步：将 sidebarWidth/lyricWidth/playerHeight 同步到根元素
 * 4. 设置加载：从数据库加载用户设置
 */
export function useTheme({ settings, setSettings, setShowLyric, showToast }) {
  const prevThemeRef = useRef(settings.theme)

  // 窗口缩放逻辑
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

  // 主题切换与 CSS 变量同步
  useEffect(() => {
    const root = document.documentElement
    const appRoot = document.getElementById('root')

    // 同步 CSS 变量
    root.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)
    root.style.setProperty('--lyric-width', `${settings.lyricWidth}px`)
    root.style.setProperty('--player-height', `${settings.playerHeight}px`)

    // 主题切换
    if (settings.theme) {
      // 主题切换时添加过渡动画
      if (prevThemeRef.current && prevThemeRef.current !== settings.theme && appRoot) {
        appRoot.classList.add('theme-transitioning')
        root.setAttribute('data-theme', settings.theme)
        const timer = setTimeout(() => {
          appRoot.classList.remove('theme-transitioning')
        }, 550)
        return () => clearTimeout(timer)
      }
      root.setAttribute('data-theme', settings.theme)
      prevThemeRef.current = settings.theme
    }
  }, [settings])

  // 从数据库加载设置
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
  }, []) // 仅在挂载时执行一次

  return {}
}
