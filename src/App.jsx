import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import WorkDetail from './components/WorkDetail'
import AudioPlayer from './components/AudioPlayer'
import LyricView from './components/LyricView'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import RightTabBar from './components/RightTabBar'
import DiscoverView from './components/DiscoverView'
import UsageReport from './components/UsageReport'
import DownloadView from './components/DownloadView'
import DownloadModal from './components/DownloadModal'
import PlaylistView from './components/PlaylistView'
import RecentPlaysView from './components/RecentPlaysView'
import GlobalSearchModal from './components/GlobalSearchModal'
import { scanFolder, scanMediaLibrary, findAllSubtitlesForAudio, extractRJCode, getExtension, detectLanguageFromContent } from './utils/scanner'
import { parseSubtitle, findCurrentCue } from './utils/subtitleParser'
import { DEFAULT_SHORTCUTS } from './components/KeyboardShortcutsPanel'
import './App.css'

// Toast 通知组件
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons = {
    success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    error: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    info: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  }

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

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
  shortcuts: { ...DEFAULT_SHORTCUTS },
}

// 睡眠定时器预设选项（分钟）
export const SLEEP_TIMER_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
]

// 生成队列项 ID
function genQueueItemId() {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
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

export default function App() {
  const [works, setWorks] = useState([])
  const [selectedWork, setSelectedWork] = useState(null) // 当前浏览的作品
  const [playingWork, setPlayingWork] = useState(null) // 当前正在播放的作品
  const [currentAudio, setCurrentAudio] = useState(null)
  const [currentCues, setCurrentCues] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [cvFilter, setCvFilter] = useState('')
  const [circleFilter, setCircleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [settings, setSettings] = useState(loadSettings)
  const [viewMode, setViewMode] = useState(settings.viewMode || 'grid')
  const [showLyric, setShowLyric] = useState(settings.showLyric)
  const [audioFiles, setAudioFiles] = useState([])
  const [allSubtitleFiles, setAllSubtitleFiles] = useState([])
  const [subtitleOptions, setSubtitleOptions] = useState([])
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [isImmersive, setIsImmersive] = useState(false)
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null) // { audio, work } 待加入曲目
  // ===== 播放队列 =====
  const [playQueue, setPlayQueue] = useState([]) // 队列项数组：{ id, audio, work, source, audioName, workTitle, workCover, addedAt }
  const [queueIndex, setQueueIndex] = useState(-1) // 当前播放到队列的位置，-1 表示未在队列中播放
  const [loopMode, setLoopMode] = useState(settings.loopMode || 'none') // none / one / list
  const [shuffle, setShuffle] = useState(!!settings.shuffle) // 随机播放
  const [showQueuePanel, setShowQueuePanel] = useState(false) // 队列浮层开关
  const pendingQueuePlayRef = useRef(null) // 跨作品播放时的待播放项 { item, startedAt }
  // ===== 睡眠定时器 =====
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0) // 设置的分钟数，0 表示关闭
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0) // 剩余秒数
  const [rightTab, setRightTab] = useState('details')
  const [currentView, setCurrentView] = useState('library')
  const [toasts, setToasts] = useState([])
  // ===== 右侧面板宽度拖拽调整 =====
  const [rightPanelWidth, setRightPanelWidth] = useState(320) // 默认宽度
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false)
  const contentAreaRef = useRef(null)

  // 右侧面板宽度拖拽调整
  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDraggingSplitter(true)
  }, [])

  const handleSplitterMouseMove = useCallback((e) => {
    if (!isDraggingSplitter || !contentAreaRef.current) return
    const rect = contentAreaRef.current.getBoundingClientRect()
    const newWidth = rect.right - e.clientX
    // 限制宽度范围 240px - 600px
    const clampedWidth = Math.min(600, Math.max(240, newWidth))
    setRightPanelWidth(clampedWidth)
  }, [isDraggingSplitter])

  const handleSplitterMouseUp = useCallback(() => {
    setIsDraggingSplitter(false)
  }, [])

  // 全局鼠标事件用于 splitter 拖拽
  useEffect(() => {
    if (isDraggingSplitter) {
      document.addEventListener('mousemove', handleSplitterMouseMove)
      document.addEventListener('mouseup', handleSplitterMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleSplitterMouseMove)
      document.removeEventListener('mouseup', handleSplitterMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDraggingSplitter, handleSplitterMouseMove, handleSplitterMouseUp])

  // 最近播放自动播放：记录待播放的音频路径，audioFiles 加载后自动播放
  const pendingAutoPlayRef = useRef(null)

  // 最近播放自动播放处理
  const handleRecentPlayAutoPlay = useCallback((item) => {
    pendingAutoPlayRef.current = { audioPath: item.audioPath, startedAt: Date.now() }
  }, [])

  // 翻译缓存：内存中存储，关闭软件后清空。key = 原文, value = 译文
  const translateCacheRef = useRef(new Map())
  // 翻译状态触发器：每次翻译完成后递增，触发组件重渲染
  const [translateVersion, setTranslateVersion] = useState(0)
  // 正在翻译中的 key 集合
  const [translating, setTranslating] = useState(new Set())

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // 翻译：点击翻译按钮时调用，翻译结果覆盖原文显示
  // 再次点击同一文本则取消翻译（从缓存删除）
  const handleTranslate = useCallback(async (text) => {
    if (!text || !text.trim()) return text

    const cache = translateCacheRef.current

    // 如果已有翻译，则取消翻译（删除缓存，恢复原文）
    if (cache.has(text)) {
      cache.delete(text)
      setTranslateVersion(v => v + 1)
      return text
    }

    // 标记正在翻译
    setTranslating(prev => new Set([...prev, text]))

    try {
      const translated = await window.electronAPI.translateText(text, 'zh-CN')
      if (translated && translated !== text) {
        cache.set(text, translated)
        setTranslateVersion(v => v + 1)
        return translated
      } else {
        showToast('翻译失败，可能已是中文或网络错误', 'warning')
      }
    } catch (e) {
      showToast('翻译失败: ' + (e.message || '未知错误'), 'error')
    } finally {
      setTranslating(prev => {
        const next = new Set(prev)
        next.delete(text)
        return next
      })
    }
    return text
  }, [showToast])

  // 批量翻译：翻译一组文本（如标题+CV+标签+社团）
  const handleTranslateBatch = useCallback(async (texts) => {
    const validTexts = texts.filter(t => t && t.trim())
    if (validTexts.length === 0) return

    const cache = translateCacheRef.current
    // 过滤出未翻译的
    const needTranslate = validTexts.filter(t => !cache.has(t))
    if (needTranslate.length === 0) {
      // 全部已翻译，则取消翻译（恢复原文）
      validTexts.forEach(t => cache.delete(t))
      setTranslateVersion(v => v + 1)
      return
    }

    setTranslating(prev => new Set([...prev, ...needTranslate]))
    try {
      const results = await window.electronAPI.translateBatch(needTranslate, 'zh-CN')
      needTranslate.forEach((text, i) => {
        if (results[i] && results[i] !== text) {
          cache.set(text, results[i])
        }
      })
      setTranslateVersion(v => v + 1)
    } catch (e) {
      showToast('批量翻译失败', 'error')
    } finally {
      setTranslating(prev => {
        const next = new Set(prev)
        needTranslate.forEach(t => next.delete(t))
        return next
      })
    }
  }, [showToast])

  // 获取翻译后的文本：如果缓存中有则返回译文，否则返回原文
  const getTranslatedText = useCallback((text) => {
    if (!text) return text
    return translateCacheRef.current.get(text) || text
  }, [translateVersion])

  // 检查文本是否已翻译
  const isTranslated = useCallback((text) => {
    if (!text) return false
    return translateCacheRef.current.has(text)
  }, [translateVersion])

  // 检查文本是否正在翻译中
  const isTranslating = useCallback((text) => {
    if (!text) return false
    return translating.has(text)
  }, [translating])

  // 是否有任何文本正在翻译中（用于全局翻译按钮的转圈状态）
  const isAnyTranslating = translating.size > 0

  // 是否有翻译内容（用于双语显示模式）
  const hasTranslation = currentCues.some(cue => cue.translated)

  // 切换字幕翻译：批量翻译当前所有字幕文本
  const handleToggleTranslate = useCallback(async () => {
    if (!selectedWork || !currentAudio || currentCues.length === 0) {
      showToast('请先选择字幕', 'warning')
      return
    }

    // 如果已有翻译，清除翻译并恢复原文
    if (hasTranslation) {
      setCurrentCues(prev => prev.map(cue => ({ ...cue, translated: undefined })))
      // 清除内存缓存中的对应翻译
      currentCues.forEach(cue => {
        translateCacheRef.current.delete(cue.text)
      })
      setTranslateVersion(v => v + 1)
      // 清除数据库缓存
      try {
        await window.electronAPI.translateSaveCache(selectedWork.id, currentAudio.path, [])
      } catch (e) {
        console.error('Failed to clear translate cache:', e)
      }
      showToast('已关闭双语显示', 'info')
      return
    }

    // 开始翻译：先从数据库读取缓存
    try {
      const cachedCues = await window.electronAPI.translateGetCache(selectedWork.id, currentAudio.path)
      if (cachedCues && cachedCues.length > 0) {
        // 使用缓存的翻译结果
        setCurrentCues(prev => {
          const cacheMap = new Map(cachedCues.map(c => [c.time, c.translated]))
          return prev.map(cue => ({
            ...cue,
            translated: cacheMap.get(cue.time) || undefined
          }))
        })
        // 同步到内存缓存
        cachedCues.forEach(c => {
          if (c.translated) {
            const original = currentCues.find(cue => cue.time === c.time)
            if (original) {
              translateCacheRef.current.set(original.text, c.translated)
            }
          }
        })
        setTranslateVersion(v => v + 1)
        showToast('已加载缓存翻译', 'success')
        return
      }
    } catch (e) {
      console.error('Failed to load translate cache:', e)
    }

    // 没有缓存，开始在线翻译
    const texts = currentCues.map(cue => cue.text).filter(t => t && t.trim())
    if (texts.length === 0) {
      showToast('没有可翻译的文本', 'info')
      return
    }

    setTranslating(new Set(texts))
    showToast(`开始翻译 ${texts.length} 条字幕...`, 'info')

    try {
      const results = await window.electronAPI.translateBatch(texts, 'zh-CN')
      const resultMap = new Map(texts.map((text, i) => [text, results[i]]))

      const updatedCues = currentCues.map(cue => {
        if (!cue.text || !cue.text.trim()) return cue
        const translated = resultMap.get(cue.text)
        if (translated && translated !== cue.text) {
          translateCacheRef.current.set(cue.text, translated)
          return { ...cue, translated }
        }
        return cue
      })

      setCurrentCues(updatedCues)
      setTranslateVersion(v => v + 1)

      // 保存到数据库缓存
      try {
        const cacheData = updatedCues.map(cue => ({
          time: cue.time,
          text: cue.text,
          translated: cue.translated
        }))
        await window.electronAPI.translateSaveCache(selectedWork.id, currentAudio.path, cacheData)
      } catch (e) {
        console.error('Failed to save translate cache:', e)
      }

      const translatedCount = updatedCues.filter(c => c.translated).length
      showToast(`翻译完成！成功翻译 ${translatedCount} 条字幕`, 'success')
    } catch (e) {
      showToast('翻译失败: ' + (e.message || '未知错误'), 'error')
    } finally {
      setTranslating(new Set())
    }
  }, [selectedWork, currentAudio, currentCues, hasTranslation, showToast])

  const playerRef = useRef(null)
  const discoverViewRef = useRef(null)
  const lastSaveTimeRef = useRef(0)
  const lastHistoryTimeRef = useRef(0)
  const loadingWorkIdRef = useRef(null)

  const currentCueIndex = useMemo(() => {
    return findCurrentCue(currentCues, currentTime)
  }, [currentCues, currentTime])

  const immersiveLyricRef = useRef(null)

  const immersiveLyricCues = useMemo(() => {
    return currentCues.map((cue, idx) => ({
      ...cue,
      realIndex: idx,
      isActive: idx === currentCueIndex,
    }))
  }, [currentCues, currentCueIndex])

  useEffect(() => {
    if (!isImmersive) return
    const activeEl = immersiveLyricRef.current?.querySelector(`.immersive-lyric-line.active`)
    if (activeEl && immersiveLyricRef.current) {
      const container = immersiveLyricRef.current
      const offsetTop = activeEl.offsetTop - container.offsetTop
      const targetScroll = offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }
  }, [currentCueIndex, isImmersive])

  const handleCloseImmersive = useCallback(() => {
    setIsImmersive(false)
  }, [])

  useEffect(() => {
    if (!isImmersive) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsImmersive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isImmersive])

  const zoomRef = useRef(1)

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
      zoomRef.current = clampedZoom
    }

    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  useEffect(() => {
    loadWorks()
    async function loadDbSettings() {
      try {
        const dbSettings = await window.electronAPI.dbGetSettings()
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          setSettings((prev) => ({ ...dbSettings, ...prev }))
          if (dbSettings.showLyric !== undefined) {
            setShowLyric(dbSettings.showLyric)
          }
        }
      } catch (e) {
        console.error('Failed to load settings from db:', e)
      }
    }
    loadDbSettings()
  }, [])

  // 全局快捷键：Ctrl+K 打开快速搜索
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 忽略输入框中的 Ctrl+K
      if (e.ctrlKey && e.key === 'k') {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
          return
        }
        e.preventDefault()
        setShowGlobalSearch((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 记住上一次的主题，用于检测主题变化
  const prevThemeRef = useRef(settings.theme)

  useEffect(() => {
    const root = document.documentElement
    const appRoot = document.getElementById('root')
    root.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)
    root.style.setProperty('--lyric-width', `${settings.lyricWidth}px`)
    root.style.setProperty('--player-height', `${settings.playerHeight}px`)
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

  const loadWorks = async () => {
    try {
      const data = await window.electronAPI.dbGetAllWorks()
      setWorks(data || [])
    } catch (e) {
      console.error('Failed to load works:', e)
    }
  }

  const allCVs = [...new Set(works.flatMap((w) => w.cvs || []))].sort()
  const allCircles = [...new Set(works.map((w) => w.circle).filter(Boolean))].sort()

  const filteredWorks = works.filter((w) => {
    if (cvFilter && !(w.cvs || []).includes(cvFilter)) return false
    if (circleFilter && w.circle !== circleFilter) return false
    if (tagFilter && !(w.tags || []).includes(tagFilter)) return false
    return true
  })

  const fetchDlsiteMetadataAsync = useCallback(async (workId, folderName, rjCode) => {
    try {
      let detail = null
      let searchResults = []

      if (rjCode) {
        try {
          detail = await window.electronAPI.dlsiteGetDetail(rjCode)
        } catch (e) {
          console.warn('DLsite 详情获取失败，尝试搜索:', e.message)
        }
      }

      if (!detail) {
        try {
          searchResults = await window.electronAPI.dlsiteSearch(folderName)
        } catch (e) {
          console.warn('DLsite 搜索失败:', e.message)
        }
      }

      const updates = {}
      if (detail) {
        Object.assign(updates, detail)
      } else if (searchResults.length > 0) {
        const first = searchResults[0]
        updates.cover = first.cover
        updates.title = first.title || folderName
        if (!rjCode && first.rjCode) {
          updates.rjCode = first.rjCode
        }
      }

      if (Object.keys(updates).length > 0) {
        const updated = await window.electronAPI.dbUpdateWork(workId, updates)
        if (updated) {
          setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          setSelectedWork((prev) => (prev && prev.id === updated.id ? updated : prev))
        }
      }
    } catch (e) {
      console.error('异步获取 DLsite 元数据失败:', e)
    }
  }, [])

  const handleAddFolder = async () => {
    try {
      const folderPath = await window.electronAPI.openDirectory()
      if (!folderPath) return

      const scanResult = await scanFolder(folderPath)
      if (scanResult.audioFiles.length === 0) {
        showToast('该文件夹中没有找到音频文件', 'warning')
        return
      }

      const folderName = scanResult.folderName
      const rjCode = extractRJCode(folderName)

      const metadata = {
        id: folderPath,
        folderPath,
        folderName,
        rjCode,
        title: folderName,
        audioCount: scanResult.audioFiles.length,
        cover: '',
        rating: 0,
        tags: [],
        cvs: [],
        circle: '',
        description: '',
      }

      const savedWork = await window.electronAPI.dbAddWork(metadata)
      setWorks((prev) => [...prev, savedWork])
      setSelectedWork(savedWork)

      fetchDlsiteMetadataAsync(savedWork.id, folderName, rjCode)
    } catch (e) {
      console.error('Failed to add folder:', e)
      showToast('添加文件夹失败：' + e.message, 'error')
    }
  }

  const handleAddMediaLibrary = async () => {
    try {
      const rootPath = await window.electronAPI.openDirectory()
      if (!rootPath) return

      const existingWorks = await window.electronAPI.dbGetAllWorks()
      const existingPaths = new Set(existingWorks.map((w) => w.folderPath))

      const scanResults = await scanMediaLibrary(rootPath)
      if (scanResults.length === 0) {
        showToast('在该目录下没有找到包含音频文件的文件夹', 'warning')
        return
      }

      let addedCount = 0
      const newWorks = []

      for (const result of scanResults) {
        if (existingPaths.has(result.folderPath)) {
          continue
        }

        const folderName = result.folderName
        const rjCode = extractRJCode(folderName)

        const metadata = {
          id: result.folderPath,
          folderPath: result.folderPath,
          folderName,
          rjCode,
          title: folderName,
          audioCount: result.audioFiles.length,
          cover: '',
          rating: 0,
          tags: [],
          cvs: [],
          circle: '',
          description: '',
        }

        const savedWork = await window.electronAPI.dbAddWork(metadata)
        newWorks.push(savedWork)
        addedCount++

        fetchDlsiteMetadataAsync(savedWork.id, folderName, rjCode)
      }

      if (newWorks.length > 0) {
        setWorks((prev) => [...prev, ...newWorks])
      }

      showToast('媒体库扫描完成！共找到 ' + scanResults.length + ' 个作品，成功添加 ' + addedCount + ' 个新作品', 'success')
    } catch (e) {
      console.error('Failed to add media library:', e)
      showToast('添加媒体库失败：' + e.message, 'error')
    }
  }

  const handleSelectWork = useCallback(
    (work) => {
      if (work?.id === selectedWork?.id) return

      loadingWorkIdRef.current = null

      setSelectedWork(work)
      // 注意：切换作品时不重置 currentAudio，实现边听边选
      // 只有当用户明确点击播放新曲目时才切换音频
    },
    [selectedWork],
  )

  const extractAudiosFromTracks = useCallback((tracks, folderPath = '') => {
    const audios = []
    if (!tracks) return audios
    
    let trackList = tracks
    if (!Array.isArray(tracks)) {
      if (tracks.tracks && Array.isArray(tracks.tracks)) {
        trackList = tracks.tracks
      } else if (tracks.data && Array.isArray(tracks.data)) {
        trackList = tracks.data
      } else if (tracks.list && Array.isArray(tracks.list)) {
        trackList = tracks.list
      } else {
        return audios
      }
    }
    
    for (const track of trackList) {
      if (!track) continue
      
      if (track.type === 'folder' && track.children) {
        const childAudios = extractAudiosFromTracks(track.children, folderPath ? `${folderPath}/${track.title}` : track.title)
        audios.push(...childAudios)
      } else if (track.type === 'audio') {
        const relPath = folderPath ? `${folderPath}/${track.title}` : track.title
        audios.push({
          name: track.title,
          path: track.mediaStreamUrl,
          isOnline: true,
          duration: track.duration,
          size: track.size,
          folder: folderPath,
          relativePath: relPath,
          displayName: relPath.replace(/\//g, ' / '),
        })
      }
    }
    return audios
  }, [])

  const handleSelectOnlineWork = useCallback(
    async (workSummary) => {
      try {
        loadingWorkIdRef.current = workSummary.id

        const clickedWorkId = workSummary.id

        // Show the full work from search result data immediately (no API wait)
        const searchWork = {
          id: `online_${clickedWorkId}`,
          rjCode: workSummary.source_id || '',
          title: workSummary.title || '',
          folderName: workSummary.title || '',
          circle: workSummary.name || '',
          cover: workSummary.mainCoverUrl || workSummary.thumbnailCoverUrl || '',
          thumbnailCover: workSummary.thumbnailCoverUrl || '',
          samCover: workSummary.samCoverUrl || '',
          cvs: workSummary.vas?.map((v) => v.name) || [],
          tags: workSummary.tags?.map((t) => t.name) || [],
          price: workSummary.price || 0,
          rate: workSummary.rate_average_2dp || 0,
          dlCount: workSummary.dl_count || 0,
          releaseDate: workSummary.release || '',
          nsfw: workSummary.nsfw || false,
          sourceUrl: workSummary.source_url || '',
          isOnline: true,
          onlineId: workSummary.id,
          _loadingTracks: true,
        }
        setSelectedWork(searchWork)
        setAudioFiles([])
        setCurrentAudio(null)
        setCurrentCues([])
        setCurrentTime(0)
        setDuration(0)
        setAllSubtitleFiles([])
        setSubtitleOptions([])
        setSelectedSubtitleIndex(-1)

        // Fetch tracks in background (essential for playback)
        // Also fetch workInfo in background for additional metadata (RJ code etc.)
        const [workInfo, tracks] = await Promise.all([
          window.electronAPI.asmrOneGetWorkInfo(clickedWorkId).catch(() => null),
          window.electronAPI.asmrOneGetTracks(clickedWorkId),
        ])

        // Guard: if user clicked another work while API was loading, discard stale result
        if (String(clickedWorkId) !== String(loadingWorkIdRef.current)) return

        const audioFiles = extractAudiosFromTracks(tracks)
        const rjCode = workInfo?.source_id || searchWork.rjCode

        // Build the enriched work object
        const fullWork = {
          id: `online_${(workInfo || workSummary).id}`,
          rjCode,
          title: workInfo?.title || searchWork.title,
          folderName: workInfo?.title || searchWork.folderName,
          circle: workInfo?.name || searchWork.circle,
          cover: workInfo?.mainCoverUrl || searchWork.cover,
          thumbnailCover: workInfo?.thumbnailCoverUrl || searchWork.thumbnailCover,
          samCover: workInfo?.samCoverUrl || searchWork.samCover,
          cvs: workInfo?.vas?.map((v) => v.name) || searchWork.cvs,
          tags: workInfo?.tags?.map((t) => t.name) || searchWork.tags,
          price: workInfo?.price ?? searchWork.price,
          rate: workInfo?.rate_average_2dp ?? searchWork.rate,
          dlCount: workInfo?.dl_count ?? searchWork.dlCount,
          releaseDate: workInfo?.release || searchWork.releaseDate,
          nsfw: workInfo?.nsfw ?? searchWork.nsfw,
          sourceUrl: workInfo?.source_url || searchWork.sourceUrl,
          isOnline: true,
          onlineId: (workInfo || workSummary).id,
          _loadingTracks: false,
        }

        setSelectedWork(fullWork)
        setAudioFiles(audioFiles)
      } catch (e) {
        console.error('Failed to load online work tracks:', e)
        setSelectedWork(prev => prev ? { ...prev, _loadingTracks: false, _tracksError: true } : prev)
      }
    },
    [extractAudiosFromTracks],
  )

  const handleReloadOnlineTracks = useCallback(async () => {
    if (!selectedWork?.isOnline || !selectedWork?.onlineId) return
    const workId = selectedWork.onlineId
    loadingWorkIdRef.current = workId
    setSelectedWork(prev => prev ? { ...prev, _loadingTracks: true, _tracksError: false } : prev)
    try {
      const tracks = await window.electronAPI.asmrOneGetTracks(workId)
      if (String(workId) !== String(loadingWorkIdRef.current)) return
      const audioFiles = extractAudiosFromTracks(tracks)
      setSelectedWork(prev => prev ? { ...prev, _loadingTracks: false, _tracksError: false } : prev)
      setAudioFiles(audioFiles)
    } catch (e) {
      console.error('Failed to reload online work tracks:', e)
      if (String(workId) !== String(loadingWorkIdRef.current)) return
      setSelectedWork(prev => prev ? { ...prev, _loadingTracks: false, _tracksError: true } : prev)
    }
  }, [selectedWork, extractAudiosFromTracks])

  const handleDeleteWork = useCallback(async (work) => {
    const confirmed = window.confirm(`确定要删除「${work.title || work.folderName}」吗？\n\n（只会删除记录，不会删除本地文件）`)
    if (!confirmed) return

    try {
      await window.electronAPI.dbDeleteWork(work.id)
      setWorks((prev) => prev.filter((w) => w.id !== work.id))
      if (selectedWork && selectedWork.id === work.id) {
        setSelectedWork(null)
        setCurrentAudio(null)
        setCurrentCues([])
        setAudioFiles([])
        setAllSubtitleFiles([])
      }
    } catch (e) {
      console.error('Failed to delete work:', e)
      showToast('删除失败：' + e.message, 'error')
    }
  }, [selectedWork])

  useEffect(() => {
    let cancelled = false
    if (selectedWork) {
      // 在线作品不需要扫描本地文件夹
      if (selectedWork.isOnline) {
        return
      }
      scanFolder(selectedWork.folderPath).then(async (r) => {
        if (cancelled) return
        const filesWithDuration = await Promise.all(
          r.audioFiles.map(async (f) => {
            try {
              const dur = await window.electronAPI.getAudioDuration(f.path)
              return { ...f, duration: dur ? Math.round(dur) : null }
            } catch {
              return f
            }
          })
        )
        if (!cancelled) {
          setAudioFiles(filesWithDuration)
          setAllSubtitleFiles(r.subtitleFiles)
        }
      })
    } else {
      setAudioFiles([])
      setAllSubtitleFiles([])
    }
    return () => {
      cancelled = true
    }
  }, [selectedWork])

  const detectSubtitleLanguagesAsync = useCallback(async (subOptions) => {
    if (!subOptions || subOptions.length === 0) return
    
    for (let i = 0; i < subOptions.length; i++) {
      const sub = subOptions[i]
      if (!sub || !sub.file || !sub.file.path) continue
      
      try {
        const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
        if (!content) continue
        
        const detectedLang = detectLanguageFromContent(content)
        if (detectedLang !== 'unknown' && sub.language !== detectedLang) {
          setSubtitleOptions((prev) => {
            const newOptions = [...prev]
            if (newOptions[i] && newOptions[i].file.path === sub.file.path) {
              newOptions[i] = { ...newOptions[i], language: detectedLang }
            }
            return newOptions
          })
        }
      } catch (e) {
        console.warn('Failed to detect language for subtitle:', sub.file?.name, e)
      }
    }
  }, [])

  const handleSelectAudio = useCallback(
    async (audio) => {
      if (!selectedWork) return

      setPlayingWork(selectedWork) // 记录当前正在播放的作品
      setCurrentAudio(audio)
      setCurrentCues([])

      let subtitleOptions = []
      
      if (!audio.isOnline) {
        subtitleOptions = findAllSubtitlesForAudio(audio.name, allSubtitleFiles, audio.path)
        detectSubtitleLanguagesAsync(subtitleOptions)
      }
      
      setSubtitleOptions(subtitleOptions)

      let savedSubtitleIndex = -1

      try {
        const savedSubtitle = await window.electronAPI.dbGetSubtitle(selectedWork.id, audio.path)
        if (savedSubtitle && savedSubtitle.filePath) {
          const existingIndex = subtitleOptions.findIndex((s) => s.file.path === savedSubtitle.filePath)
          if (existingIndex >= 0) {
            savedSubtitleIndex = existingIndex
          } else if (savedSubtitle.isManual) {
            const manualSub = {
              file: {
                name: savedSubtitle.fileName,
                path: savedSubtitle.filePath,
                isDirectory: false,
              },
              format: savedSubtitle.format,
              language: savedSubtitle.language || 'unknown',
              isTranslated: savedSubtitle.isTranslated || false,
              matchScore: 100,
              displayName: savedSubtitle.displayName || savedSubtitle.fileName,
              isManual: true,
            }
            subtitleOptions.unshift(manualSub)
            savedSubtitleIndex = 0
            setSubtitleOptions([...subtitleOptions])
          }
        }
      } catch (e) {
        console.error('Failed to load saved subtitle:', e)
      }

      // 如果没有保存的字幕选择，且设置了语言优先级，则按优先级选择
      if (savedSubtitleIndex < 0 && subtitleOptions.length > 0) {
        const langPriority = settings.subtitleLangPriority || 'auto'
        if (langPriority !== 'auto') {
          const priorityIndex = subtitleOptions.findIndex((s) => s.language === langPriority)
          if (priorityIndex >= 0) {
            savedSubtitleIndex = priorityIndex
          } else {
            savedSubtitleIndex = 0
          }
        } else {
          savedSubtitleIndex = 0
        }
      }

      setSelectedSubtitleIndex(savedSubtitleIndex)

      if (savedSubtitleIndex >= 0 && subtitleOptions[savedSubtitleIndex]) {
        try {
          const sub = subtitleOptions[savedSubtitleIndex]
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            let cues = parseSubtitle(content, ext)
            
            // 如果设置了自动翻译，且字幕语言不是中文，则自动翻译
            if (settings.autoTranslateSubtitle && sub.language !== 'zh' && sub.language !== 'dual') {
              const texts = cues.map(cue => cue.text).filter(t => t && t.trim())
              if (texts.length > 0) {
                try {
                  // 先从数据库读取缓存
                  const cachedCues = await window.electronAPI.translateGetCache(selectedWork.id, audio.path)
                  if (cachedCues && cachedCues.length > 0) {
                    const cacheMap = new Map(cachedCues.map(c => [c.time, c.translated]))
                    cues = cues.map(cue => ({
                      ...cue,
                      translated: cacheMap.get(cue.time) || undefined
                    }))
                    // 同步到内存缓存
                    cachedCues.forEach(c => {
                      if (c.translated) {
                        const original = cues.find(cue => cue.time === c.time)
                        if (original) {
                          translateCacheRef.current.set(original.text, c.translated)
                        }
                      }
                    })
                  } else {
                    // 没有缓存，异步翻译（不阻塞播放，先显示原文，翻译完成后更新）
                    ;(async () => {
                      try {
                        const results = await window.electronAPI.translateBatch(texts, 'zh-CN')
                        const resultMap = new Map()
                        texts.forEach((text, i) => {
                          if (results[i] && results[i] !== text) {
                            resultMap.set(text, results[i])
                            translateCacheRef.current.set(text, results[i])
                          }
                        })
                        setCurrentCues(prevCues => {
                          const updated = prevCues.map(cue => {
                            if (!cue.text || !cue.text.trim()) return cue
                            const translated = resultMap.get(cue.text)
                            if (translated) {
                              return { ...cue, translated }
                            }
                            return cue
                          })
                          // 保存到数据库缓存
                          try {
                            const cacheData = updated.map(cue => ({
                              time: cue.time,
                              text: cue.text,
                              translated: cue.translated
                            }))
                            window.electronAPI.translateSaveCache(selectedWork.id, audio.path, cacheData).catch(() => {})
                          } catch (e) {
                            console.error('Failed to save translate cache:', e)
                          }
                          return updated
                        })
                        setTranslateVersion(v => v + 1)
                      } catch (e) {
                        console.error('Auto translate failed:', e)
                      }
                    })()
                  }
                } catch (e) {
                  console.error('Auto translate init failed:', e)
                }
              }
            }
            
            setCurrentCues(cues)
          }
        } catch (e) {
          console.error('Failed to load subtitle:', e)
          if (window.electronAPI?.logError) {
            window.electronAPI.logError('Failed to load subtitle:', e.message)
          }
        }
      }

      if (!audio.isOnline) {
        try {
          const progress = await window.electronAPI.dbGetProgress(selectedWork.id, audio.path)
          if (progress && progress.currentTime > 5 && progress.duration > 0) {
            const targetTime = progress.currentTime
            const checkAndSeek = setInterval(() => {
              if (playerRef.current && playerRef.current.getDuration() > 0) {
                playerRef.current.seekTo(targetTime)
                clearInterval(checkAndSeek)
              }
            }, 200)
            setTimeout(() => clearInterval(checkAndSeek), 10000)
          }
        } catch (e) {
          console.error('Failed to load progress:', e)
        }
      }
    },
    [selectedWork, allSubtitleFiles, settings.subtitleLangPriority, settings.autoTranslateSubtitle],
  )

  // 监听 audioFiles 加载完成后自动播放（最近播放）
  useEffect(() => {
    if (!pendingAutoPlayRef.current || !audioFiles.length) return

    const pending = pendingAutoPlayRef.current
    const timeout = Date.now() - pending.startedAt > 10000 // 10秒超时
    if (timeout) {
      pendingAutoPlayRef.current = null
      return
    }

    // 尝试找到匹配的音频
    let targetAudio = null
    if (pending.audioPath) {
      targetAudio = audioFiles.find(a => a.path === pending.audioPath)
    }
    if (!targetAudio && audioFiles.length > 0) {
      targetAudio = audioFiles[0]
    }

    if (targetAudio) {
      pendingAutoPlayRef.current = null
      handleSelectAudio(targetAudio)
    }
  }, [audioFiles, handleSelectAudio])

  const handleTimeUpdate = useCallback(
    (time) => {
      setCurrentTime(time)

      if (selectedWork && currentAudio && time > 0) {
        const now = Date.now()
        if (!currentAudio.isOnline && now - lastSaveTimeRef.current > 5000) {
          lastSaveTimeRef.current = now
          window.electronAPI.dbSaveProgress(selectedWork.id, currentAudio.path, {
            currentTime: time,
            duration: duration,
          })
        }
        // Record listening history every 60 seconds (both online & local)
        if (now - lastHistoryTimeRef.current > 60000) {
          lastHistoryTimeRef.current = now
          window.electronAPI.dbAppendHistory?.({
            ts: now,
            workId: selectedWork.id,
            audioFile: currentAudio.path || currentAudio.name || '',
            seconds: 60,
            title: selectedWork.title || selectedWork.folderName || '',
            cover: selectedWork.cover || '',
            circle: selectedWork.circle || '',
            cvs: selectedWork.cvs || [],
            tags: selectedWork.tags || [],
          }).catch(() => {})
        }
      }
    },
    [selectedWork, currentAudio, duration],
  )

  const handleReady = useCallback((dur) => {
    setDuration(dur)
  }, [])

  const handleSeek = useCallback((time) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time)
    }
  }, [])

  // ===== 播放队列：从队列播放某项（支持跨作品）=====
  const handlePlayFromQueue = useCallback((item, index) => {
    if (!item || !item.audio) return
    setQueueIndex(index)

    const targetWork = item.work
    const isSameWork = selectedWork && (
      selectedWork.id === targetWork.id ||
      (targetWork.folderPath && selectedWork.folderPath === targetWork.folderPath)
    )

    if (isSameWork) {
      handleSelectAudio(item.audio)
      return
    }

    // 跨作品：切换视图和作品，等待加载后由 useEffect 播放
    setCurrentView(item.source === 'discover' ? 'discover' : 'library')
    setSelectedWork(targetWork)
    pendingQueuePlayRef.current = { item, startedAt: Date.now() }
  }, [selectedWork, handleSelectAudio])

  // 监听 audioFiles / selectedWork 变化，播放跨作品的待播放队列项
  useEffect(() => {
    if (!pendingQueuePlayRef.current) return
    const { item, startedAt } = pendingQueuePlayRef.current
    if (Date.now() - startedAt > 8000) {
      pendingQueuePlayRef.current = null
      showToast('队列播放超时，请重试', 'warning')
      return
    }
    const matched = selectedWork && (
      selectedWork.id === item.work.id ||
      (item.work.folderPath && selectedWork.folderPath === item.work.folderPath)
    )
    if (!matched) return
    // 在线作品不依赖 audioFiles
    if (item.audio.isOnline) {
      handleSelectAudio(item.audio)
      pendingQueuePlayRef.current = null
      return
    }
    // 本地作品等 audioFiles 加载完成
    if (audioFiles.length > 0) {
      handleSelectAudio(item.audio)
      pendingQueuePlayRef.current = null
    }
  }, [audioFiles, selectedWork, handleSelectAudio, showToast])

  // 推进到队列下一首/上一首，返回是否已处理
  const advanceQueue = useCallback((direction = 1, isAutoFinish = false) => {
    if (queueIndex < 0 || playQueue.length === 0) return false
    // 单曲循环（仅自动播完时）
    if (isAutoFinish && loopMode === 'one') {
      if (playerRef.current) playerRef.current.seekTo(0)
      return true
    }
    // 随机
    if (shuffle && playQueue.length > 1) {
      let next
      do {
        next = Math.floor(Math.random() * playQueue.length)
      } while (next === queueIndex)
      handlePlayFromQueue(playQueue[next], next)
      return true
    }
    let nextIdx = queueIndex + direction
    if (nextIdx < 0) {
      if (loopMode === 'list') nextIdx = playQueue.length - 1
      else return false
    } else if (nextIdx >= playQueue.length) {
      if (loopMode === 'list') nextIdx = 0
      else {
        // 队列结束，退出队列模式
        setQueueIndex(-1)
        return false
      }
    }
    handlePlayFromQueue(playQueue[nextIdx], nextIdx)
    return true
  }, [queueIndex, playQueue, loopMode, shuffle, handlePlayFromQueue])

  // ===== 播放队列操作 =====
  // 构造队列项（轻量 work 快照，避免持有完整对象）
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

  // 加入队列末尾
  const handleAddToQueue = useCallback((audio, work) => {
    const item = buildQueueItem(audio, work)
    if (!item) return
    setPlayQueue((prev) => {
      if (item.audio.path && prev.some((it) => it.audio.path === item.audio.path)) {
        showToast('该曲目已在队列中', 'info')
        return prev
      }
      showToast(`已加入队列：${item.audioName}`, 'success')
      return [...prev, item]
    })
  }, [buildQueueItem, showToast])

  // 下一首播放：插入到当前 queueIndex 之后
  const handlePlayNext = useCallback((audio, work) => {
    const item = buildQueueItem(audio, work)
    if (!item) return
    setPlayQueue((prev) => {
      if (item.audio.path && prev.some((it) => it.audio.path === item.audio.path)) {
        showToast('该曲目已在队列中', 'info')
        return prev
      }
      const insertAt = queueIndex >= 0 ? queueIndex + 1 : prev.length
      const next = [...prev]
      next.splice(insertAt, 0, item)
      showToast(`下一首播放：${item.audioName}`, 'success')
      return next
    })
  }, [buildQueueItem, queueIndex, showToast])

  // 移除队列项
  const handleRemoveFromQueue = useCallback((itemId) => {
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

  // 清空队列
  const handleClearQueue = useCallback(() => {
    setPlayQueue([])
    setQueueIndex(-1)
    showToast('队列已清空', 'info')
  }, [showToast])

  // 重排序：按 itemIds 顺序重排，未列入的追加到末尾
  const handleReorderQueue = useCallback((itemIds) => {
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
      // 同步 queueIndex 指向当前播放项的新位置
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

  // 切换循环模式：none -> one -> list -> none
  const handleToggleLoopMode = useCallback(() => {
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

  // 切换随机
  const handleToggleShuffle = useCallback(() => {
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

  // 切换队列面板显示
  const handleToggleQueuePanel = useCallback(() => {
    setShowQueuePanel((prev) => !prev)
  }, [])

  // ===== 睡眠定时器 =====
  const handleSetSleepTimer = useCallback((minutes) => {
    setSleepTimerMinutes(minutes)
    if (minutes > 0) {
      setSleepTimerRemaining(minutes * 60)
      showToast(`睡眠定时器已设置：${minutes} 分钟后停止播放`, 'info')
    } else {
      setSleepTimerRemaining(0)
      showToast('睡眠定时器已取消', 'info')
    }
  }, [showToast])

  // 点击播放栏封面：跳转到正在播放的作品，或切换沉浸式
  const handlePlayerCoverClick = useCallback(() => {
    if (!playingWork) return

    // 如果当前浏览的作品不是正在播放的作品，先切换过去
    if (selectedWork?.id !== playingWork.id) {
      // 判断是本地还是在线作品
      if (playingWork.isOnline) {
        setCurrentView('discover')
        // 在线作品需要重新加载详情，先设置 selectedWork
        setSelectedWork(playingWork)
      } else {
        // 本地作品：先切到 library 视图，再选中作品
        setCurrentView('library')
        setSelectedWork(playingWork)
      }
      return
    }

    // 已经在播放的作品，切换沉浸式
    setIsImmersive(!isImmersive)
  }, [playingWork, selectedWork, isImmersive])

  // 睡眠定时器倒计时逻辑
  useEffect(() => {
    if (sleepTimerMinutes <= 0) return
    const timer = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev <= 1) {
          // 时间到，暂停播放
          if (playerRef.current) {
            playerRef.current.playPause()
          }
          setSleepTimerMinutes(0)
          showToast('睡眠定时器到时，播放已停止', 'info')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [sleepTimerMinutes, showToast])

  const handlePrevAudio = useCallback(() => {
    // 队列模式优先
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(-1, false)) return
    }
    // 回退到当前作品 audioFiles 逻辑
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex <= 0) return
    handleSelectAudio(audioFiles[currentIndex - 1])
  }, [queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  const handleNextAudio = useCallback(() => {
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(1, false)) return
    }
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  const handleFinish = useCallback(() => {
    if (!settings.autoPlayNext) return
    // 队列模式
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(1, true)) return
    }
    // 回退到 audioFiles 逻辑
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [settings.autoPlayNext, queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  // 解析快捷键字符串为可比较的格式
  const parseShortcut = (shortcutStr) => {
    if (!shortcutStr) return null
    const parts = shortcutStr.split('+')
    return {
      ctrl: parts.includes('Ctrl'),
      shift: parts.includes('Shift'),
      alt: parts.includes('Alt'),
      key: parts[parts.length - 1],
    }
  }

  // 检查按键事件是否匹配快捷键
  const matchShortcut = (e, shortcutStr) => {
    if (!shortcutStr) return false
    const expected = parseShortcut(shortcutStr)
    if (!expected) return false
    const key = e.key === ' ' ? 'Space' : e.key
    return e.ctrlKey === expected.ctrl &&
           e.shiftKey === expected.shift &&
           e.altKey === expected.alt &&
           key === expected.key
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      const shortcuts = settings.shortcuts || DEFAULT_SHORTCUTS

      if (matchShortcut(e, shortcuts.playPause)) {
        e.preventDefault()
        if (playerRef.current) {
          playerRef.current.playPause()
        }
        return
      }

      if (matchShortcut(e, shortcuts.prevTrack)) {
        e.preventDefault()
        handlePrevAudio()
        return
      }

      if (matchShortcut(e, shortcuts.nextTrack)) {
        e.preventDefault()
        handleNextAudio()
        return
      }

      if (matchShortcut(e, shortcuts.exitImmersive)) {
        if (isImmersive) {
          e.preventDefault()
          setIsImmersive(false)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevAudio, handleNextAudio, settings.shortcuts, isImmersive])

  const handleSelectSubtitle = useCallback(async (index) => {
    setSelectedSubtitleIndex(index)
    if (index < 0 || !subtitleOptions[index]) {
      setCurrentCues([])
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, null)
        } catch (e) {
          console.error('Failed to clear subtitle:', e)
        }
      }
      return
    }
    try {
      const sub = subtitleOptions[index]
      const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
      if (content) {
        const ext = getExtension(sub.file.name)
        const cues = parseSubtitle(content, ext)
        setCurrentCues(cues)
        
        const contentLanguage = detectLanguageFromContent(content)
        if (contentLanguage !== 'unknown' && sub.language !== contentLanguage) {
          const updatedSub = { ...sub, language: contentLanguage }
          const newOptions = [...subtitleOptions]
          newOptions[index] = updatedSub
          setSubtitleOptions(newOptions)
          
          if (selectedWork && currentAudio) {
            try {
              await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
                filePath: updatedSub.file.path,
                fileName: updatedSub.file.name,
                format: updatedSub.format,
                language: updatedSub.language,
                isTranslated: updatedSub.isTranslated,
                displayName: updatedSub.displayName,
                isManual: updatedSub.isManual || false,
              })
            } catch (e) {
              console.error('Failed to save updated subtitle language:', e)
            }
          }
          return
        }
      }
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
            filePath: sub.file.path,
            fileName: sub.file.name,
            format: sub.format,
            language: sub.language,
            isTranslated: sub.isTranslated,
            displayName: sub.displayName,
            isManual: sub.isManual || false,
          })
        } catch (e) {
          console.error('Failed to save subtitle:', e)
        }
      }
    } catch (e) {
      console.error('Failed to load subtitle:', e)
    }
  }, [subtitleOptions, selectedWork, currentAudio])

  const handleAddSubtitleFile = useCallback(async () => {
    try {
      const files = await window.electronAPI.openSubtitleFile()
      if (!files || files.length === 0) return

      const newOptions = [...subtitleOptions]
      let newIndex = -1

      for (const file of files) {
        const ext = getExtension(file.name).slice(1).toLowerCase()
        const base = file.name.replace(/\.[^/.]+$/, '')
        
        let detectedLang = 'unknown'
        try {
          const content = await window.electronAPI.readFile(file.path, 'utf-8')
          if (content) {
            detectedLang = detectLanguageFromContent(content)
          }
        } catch (e) {
          console.warn('Failed to detect language for subtitle:', file.name, e)
        }

        const newSub = {
          file,
          format: ext,
          language: detectedLang,
          isTranslated: false,
          matchScore: 100,
          displayName: base,
          isManual: true,
        }
        newOptions.push(newSub)
        newIndex = newOptions.length - 1
      }

      setSubtitleOptions(newOptions)

      if (newIndex >= 0 && currentAudio && selectedWork) {
        const sub = newOptions[newIndex]
        try {
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            const cues = parseSubtitle(content, ext)
            setCurrentCues(cues)
            setSelectedSubtitleIndex(newIndex)
          }
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
            filePath: sub.file.path,
            fileName: sub.file.name,
            format: sub.format,
            language: sub.language,
            isTranslated: sub.isTranslated,
            displayName: sub.displayName,
            isManual: true,
          })
        } catch (e) {
          console.error('Failed to load subtitle:', e)
        }
      }
    } catch (e) {
      console.error('Failed to add subtitle file:', e)
    }
  }, [subtitleOptions, currentAudio, selectedWork])

  const [settingsDefaultTab, setSettingsDefaultTab] = useState('basic')

  const handleOpenSettings = useCallback(() => {
    setSettingsDefaultTab('basic')
    setShowSettingsModal(true)
  }, [])

  const handleOpenSubtitleSettings = useCallback(() => {
    setSettingsDefaultTab('player')
    setShowSettingsModal(true)
  }, [])

  const handleEditMetadata = async (data) => {
    if (!selectedWork) return
    try {
      const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, data)
      if (updated) {
        setSelectedWork(updated)
        setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      }
    } catch (e) {
      console.error('Failed to update metadata:', e)
    }
  }

  const handleRefreshMetadata = async () => {
    if (!selectedWork) return
    try {
      const rjCode = selectedWork.rjCode || extractRJCode(selectedWork.folderName)
      if (rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
          return
        }
      }
      const results = await window.electronAPI.dlsiteSearch(selectedWork.folderName)
      if (results.length > 0 && results[0].rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(results[0].rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
        }
      }
    } catch (e) {
      console.error('Failed to refresh metadata:', e)
      showToast('重新刮削失败：' + e.message, 'error')
    }
  }

  const handleRefreshSubtitles = useCallback(async () => {
    if (!selectedWork) return
    try {
      const r = await scanFolder(selectedWork.folderPath)
      const filesWithDuration = await Promise.all(
        r.audioFiles.map(async (f) => {
          try {
            const dur = await window.electronAPI.getAudioDuration(f.path)
            return { ...f, duration: dur ? Math.round(dur) : null }
          } catch {
            return f
          }
        })
      )
      setAudioFiles(filesWithDuration)
      setAllSubtitleFiles(r.subtitleFiles)

      if (currentAudio) {
        const newSubtitleOptions = findAllSubtitlesForAudio(currentAudio.name, r.subtitleFiles, currentAudio.path)
        const currentSubPath = subtitleOptions[selectedSubtitleIndex]?.file?.path
        let newSelectedIndex = newSubtitleOptions.length > 0 ? 0 : -1

        if (currentSubPath && selectedSubtitleIndex >= 0) {
          const existingIndex = newSubtitleOptions.findIndex((s) => s.file.path === currentSubPath)
          if (existingIndex >= 0) {
            newSelectedIndex = existingIndex
          }
        }

        setSubtitleOptions(newSubtitleOptions)
        setSelectedSubtitleIndex(newSelectedIndex)
        detectSubtitleLanguagesAsync(newSubtitleOptions)

        if (newSelectedIndex >= 0) {
          const sub = newSubtitleOptions[newSelectedIndex]
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            const cues = parseSubtitle(content, ext)
            setCurrentCues(cues)
          }
        } else {
          setCurrentCues([])
        }
      }
    } catch (e) {
      console.error('Failed to refresh subtitles:', e)
      showToast('刷新字幕失败：' + e.message, 'error')
    }
  }, [selectedWork, currentAudio, subtitleOptions, selectedSubtitleIndex])

  const handleFilterChange = (type, value) => {
    if (type === 'cv') {
      setCvFilter(value)
    } else if (type === 'tag') {
      setTagFilter(value)
    } else {
      setCircleFilter(value)
    }
  }

  const handleClearFilter = (type) => {
    if (type === 'cv') {
      setCvFilter('')
    } else if (type === 'tag') {
      setTagFilter('')
    } else if (type === 'circle') {
      setCircleFilter('')
    }
  }

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    setSettings((prev) => {
      const newSettings = { ...prev, viewMode: mode }
      window.electronAPI?.dbSaveSettings(newSettings).catch(() => {})
      return newSettings
    })
  }, [])

  // ===== 播放列表：从曲目项「+」加入 =====
  const handleOpenAddToPlaylist = useCallback((audio) => {
    if (!audio) return
    setAddToPlaylistTarget({ audio, work: selectedWork })
  }, [selectedWork])

  const handleCloseAddToPlaylist = useCallback(() => {
    setAddToPlaylistTarget(null)
  }, [])

  // 从播放列表点击播放某项：根据 workId 找到本地作品，切换视图并播放
  const handlePlayPlaylistItem = useCallback(async (item) => {
    if (!item) return
    try {
      // 在线曲目：直接构造作品并播放
      if (item.isOnline) {
        // 在线曲目通常依赖已加载的作品上下文，简单切换到「发现」视图并提示
        showToast('在线曲目请在「发现」中重新打开作品后播放', 'info')
        return
      }
      // 本地作品：从 works 中查找
      const target = works.find((w) => w.id === item.workId) || works.find((w) => w.folderPath === item.workId)
      if (!target) {
        showToast('找不到原作品，可能已被删除', 'warning')
        return
      }
      // 切换到 library 视图并选中作品
      setCurrentView('library')
      setSelectedWork(target)
      // 等待 audioFiles 加载完成后播放对应曲目（通过轮询 playerRef）
      const tryPlay = setInterval(() => {
        // audioFiles 是异步加载的，借助 closure 直接读 state 不可行，改用全局引用
        // 使用 querySelector 找到对应 audio-name 的元素并不优雅，改为读取最新 audioFiles 通过 setState 后再触发
        // 这里采用轮询 setAudioFiles 已加载的标志
        // 但因为 closure 限制，使用 ref 保存最新 audioFiles
        const files = latestAudioFilesRef.current
        if (files && files.length > 0) {
          const target2 = files.find((f) => f.path === item.audioPath)
          if (target2) {
            handleSelectAudio(target2)
            clearInterval(tryPlay)
          }
        }
      }, 200)
      setTimeout(() => clearInterval(tryPlay), 8000)
    } catch (e) {
      console.error('Failed to play playlist item:', e)
      showToast('播放失败：' + (e.message || ''), 'error')
    }
  }, [works, showToast, handleSelectAudio])

  // 跳转到作品
  const handleNavigateToWorkFromPlaylist = useCallback((item) => {
    if (!item) return
    if (item.isOnline) {
      setCurrentView('discover')
      showToast('已切换到「发现」视图', 'info')
      return
    }
    const target = works.find((w) => w.id === item.workId) || works.find((w) => w.folderPath === item.workId)
    if (!target) {
      showToast('找不到原作品', 'warning')
      return
    }
    setCurrentView('library')
    setSelectedWork(target)
  }, [works, showToast])

  // 保存最新的 audioFiles 到 ref，供上面轮询使用
  const latestAudioFilesRef = useRef([])
  useEffect(() => {
    latestAudioFilesRef.current = audioFiles
  }, [audioFiles])

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem('appSettings', JSON.stringify(newSettings))
    try {
      window.electronAPI.dbSaveSettings(newSettings)
    } catch (e) {
      console.error('Failed to save settings to db:', e)
    }
    if (newSettings.showLyric !== undefined) {
      setShowLyric(newSettings.showLyric)
    }
    if (newSettings.defaultVolume !== undefined && playerRef.current) {
      playerRef.current.setVolume?.(newSettings.defaultVolume / 100)
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        <div className="title-bar">
          <span className="title-bar-text">聆音 · 沉浸式 ASMR 音声播放器</span>
          <div className="window-controls">
            <button className="window-btn minimize-btn" onClick={() => window.electronAPI.windowMinimize()} title="最小化">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
              </svg>
            </button>
            <button className="window-btn maximize-btn" onClick={() => window.electronAPI.windowMaximize()} title="最大化">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button className="window-btn close-btn" onClick={() => window.electronAPI.windowClose()} title="关闭">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="app-main">
        <div className="left-nav-bar">
          <div className="nav-items">
            <div
              className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
              title="我的库"
              onClick={() => setCurrentView('library')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'discover' ? 'active' : ''}`}
              title="发现"
              onClick={() => setCurrentView('discover')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'recent-plays' ? 'active' : ''}`}
              title="最近播放"
              onClick={() => setCurrentView('recent-plays')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'annual-report' ? 'active' : ''}`}
              title="使用报告"
              onClick={() => setCurrentView('annual-report')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'download' ? 'active' : ''}`}
              title="下载管理"
              onClick={() => setCurrentView('download')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'playlist' ? 'active' : ''}`}
              title="播放列表"
              onClick={() => setCurrentView('playlist')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
          </div>
          <div className="nav-bottom">
            <div className="nav-item" title="设置" onClick={handleOpenSettings}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="right-content-area">
      {currentView === 'library' && (
        <div className={`library-layout ${selectedWork ? 'has-detail' : ''} ${settings.autoHideSidebar && selectedWork ? 'hide-sidebar' : ''}`}>
          <div className="library-main">
            <Sidebar
              works={filteredWorks}
              selectedWorkId={selectedWork?.id}
              onSelectWork={handleSelectWork}
              onAddFolder={handleAddFolder}
              onAddMediaLibrary={handleAddMediaLibrary}
              cvFilter={cvFilter}
              circleFilter={circleFilter}
              onFilterChange={handleFilterChange}
              allCVs={allCVs}
              allCircles={allCircles}
              onOpenSettings={handleOpenSettings}
              onDeleteWork={handleDeleteWork}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onTranslate={handleTranslate}
              onTranslateBatch={handleTranslateBatch}
              getTranslatedText={getTranslatedText}
              isTranslated={isTranslated}
              isTranslating={isTranslating}
              isAnyTranslating={isAnyTranslating}
            />
          </div>
          {selectedWork && (
            <div className="main-content">
              <div className="content-area" ref={contentAreaRef}>
                <div className="work-detail-wrapper library-work-detail">
                  <button
                    className="detail-close-btn"
                    onClick={() => setSelectedWork(null)}
                    title="关闭详情"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <WorkDetail
                    work={selectedWork}
                    audioFiles={audioFiles}
                    currentAudio={currentAudio}
                    onSelectAudio={handleSelectAudio}
                    onEditMetadata={handleEditMetadata}
                    onRefreshMetadata={handleRefreshMetadata}
                    onRefreshSubtitles={handleRefreshSubtitles}
                    onFilterCV={(cv) => handleFilterChange('cv', cv)}
                    onFilterTag={(tag) => handleFilterChange('tag', tag)}
                    onCircleClick={(circle) => handleFilterChange('circle', circle)}
                    activeCV={cvFilter}
                    activeTag={tagFilter}
                    onTranslate={handleTranslate}
                    onTranslateBatch={handleTranslateBatch}
                    getTranslatedText={getTranslatedText}
                    isTranslated={isTranslated}
                    isTranslating={isTranslating}
                    onAddToPlaylist={handleOpenAddToPlaylist}
                    onAddToQueue={handleAddToQueue}
                    onPlayNext={handlePlayNext}
                  />
                </div>
                <div className="content-splitter" onMouseDown={handleSplitterMouseDown} />
                <div className="right-tab-wrapper" style={{ width: rightPanelWidth }}>
                  <RightTabBar
                    activeTab={rightTab}
                    onTabChange={setRightTab}
                    work={selectedWork}
                    cues={currentCues}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    subtitleOptions={subtitleOptions}
                    selectedSubtitleIndex={selectedSubtitleIndex}
                    onSelectSubtitle={handleSelectSubtitle}
                    onAddSubtitleFile={handleAddSubtitleFile}
                    onToggleTranslate={handleToggleTranslate}
                    isTranslating={isAnyTranslating}
                    hasTranslation={hasTranslation}
                    subtitleFontSize={settings.subtitleFontSize}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className={`discover-layout ${selectedWork && selectedWork.isOnline ? 'has-detail' : ''} ${settings.autoHideSidebar && selectedWork && selectedWork.isOnline ? 'hide-sidebar' : ''}`} style={{ display: currentView === 'discover' ? '' : 'none' }}>
          <div className="discover-main">
            <DiscoverView 
              ref={discoverViewRef}
              onSelectWork={handleSelectOnlineWork} 
              selectedWorkId={selectedWork?.id} 
              onTranslate={handleTranslate}
              onTranslateBatch={handleTranslateBatch}
              getTranslatedText={getTranslatedText}
              isTranslated={isTranslated}
              isTranslating={isTranslating}
              isAnyTranslating={isAnyTranslating}
            />
          </div>
          {selectedWork && selectedWork.isOnline && (
            <div className="main-content discover-detail-content">
              <div className="content-area" ref={contentAreaRef}>
                <div className="work-detail-wrapper discover-work-detail">
                  <button
                    className="detail-close-btn"
                    onClick={() => setSelectedWork(null)}
                    title="关闭详情"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <WorkDetail
                    work={selectedWork}
                    audioFiles={audioFiles}
                    currentAudio={currentAudio}
                    onSelectAudio={handleSelectAudio}
                    onEditMetadata={handleEditMetadata}
                    onRefreshMetadata={handleRefreshMetadata}
                    onRefreshSubtitles={handleRefreshSubtitles}
                    onFilterCV={(cv) => {
                      if (cv && discoverViewRef.current) {
                        discoverViewRef.current.toggleVa(cv)
                      }
                    }}
                    onFilterTag={(tag) => {
                      if (tag && discoverViewRef.current) {
                        discoverViewRef.current.toggleTag(tag)
                      }
                    }}
                    onCircleClick={(circle) => {
                      if (circle && discoverViewRef.current) {
                        discoverViewRef.current.toggleCircle(circle)
                      }
                    }}
                    activeCV={''}
                    activeTag={''}
                    onDownload={() => setShowDownloadModal(true)}
                    onReloadTracks={handleReloadOnlineTracks}
                    onTranslate={handleTranslate}
                    onTranslateBatch={handleTranslateBatch}
                    getTranslatedText={getTranslatedText}
                    isTranslated={isTranslated}
                    isTranslating={isTranslating}
                    onAddToPlaylist={handleOpenAddToPlaylist}
                    onAddToQueue={handleAddToQueue}
                    onPlayNext={handlePlayNext}
                  />
                </div>
                <div className="content-splitter" onMouseDown={handleSplitterMouseDown} />
                <div className="right-tab-wrapper discover-right-tab" style={{ width: rightPanelWidth }}>
                  <RightTabBar
                    activeTab={rightTab}
                    onTabChange={setRightTab}
                    work={selectedWork}
                    cues={currentCues}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    subtitleOptions={subtitleOptions}
                    selectedSubtitleIndex={selectedSubtitleIndex}
                    onSelectSubtitle={handleSelectSubtitle}
                    onAddSubtitleFile={handleAddSubtitleFile}
                    onToggleTranslate={handleToggleTranslate}
                    isTranslating={isAnyTranslating}
                    hasTranslation={hasTranslation}
                    subtitleFontSize={settings.subtitleFontSize}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      {currentView === 'annual-report' && (
        <div className="report-view">
          <UsageReport />
        </div>
      )}

      {currentView === 'download' && (
        <div className="download-view-wrapper">
          <DownloadView />
        </div>
      )}

      {currentView === 'playlist' && (
        <PlaylistView
          onPlayItem={handlePlayPlaylistItem}
          onNavigateToWork={handleNavigateToWorkFromPlaylist}
          onToast={showToast}
        />
      )}

      {currentView === 'recent-plays' && (
        <div className="recent-plays-wrapper">
          <RecentPlaysView
            works={works}
            onSelectWork={handleSelectWork}
            onAutoPlay={handleRecentPlayAutoPlay}
            onToast={showToast}
          />
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      )}

      {/* 全局播放栏 - 常驻底部 */}
      {currentAudio && (
        <div className="global-player-bar">
          <AudioPlayer
            ref={playerRef}
            audioPath={currentAudio?.path}
            title={currentAudio?.name}
            cover={playingWork?.cover}
            onTimeUpdate={handleTimeUpdate}
            onReady={handleReady}
            onFinish={handleFinish}
            onPrev={handlePrevAudio}
            onNext={handleNextAudio}
            workId={playingWork?.id}
            waveformHeight={settings.waveformHeight}
            defaultVolume={settings.defaultVolume}
            skipSeconds={settings.skipSeconds || 5}
            onToggleImmersive={handlePlayerCoverClick}
            queue={playQueue}
            queueIndex={queueIndex}
            loopMode={loopMode}
            shuffle={shuffle}
            showQueuePanel={showQueuePanel}
            onToggleQueue={handleToggleQueuePanel}
            onToggleLoop={handleToggleLoopMode}
            onToggleShuffle={handleToggleShuffle}
            onPlayFromQueue={handlePlayFromQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onClearQueue={handleClearQueue}
            onReorderQueue={handleReorderQueue}
            onCloseQueuePanel={() => setShowQueuePanel(false)}
            sleepTimerMinutes={sleepTimerMinutes}
            sleepTimerRemaining={sleepTimerRemaining}
            onSetSleepTimer={handleSetSleepTimer}
          />
        </div>
      )}

      </div>
      </div>

      {isImmersive && playingWork && (
        <div 
          className="immersive-overlay"
          style={{
            '--immersive-lyric-font-size': `${settings.subtitleFontSize ? settings.subtitleFontSize * 1.2 : 22}px`,
            '--immersive-lyric-active-font-size': `${settings.subtitleFontSize ? settings.subtitleFontSize * 1.8 : 34}px`,
          }}
        >
          <div className="immersive-bg" style={{ backgroundImage: `url(${playingWork.cover})` }} />
          <button className="immersive-close-btn" onClick={handleCloseImmersive} title="关闭 (ESC)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="immersive-cover-wrapper">
            <img src={playingWork.cover} alt="" className="immersive-cover" />
          </div>
          <div className="immersive-bottom">
            <div className="immersive-title">{playingWork.title || playingWork.folderName}</div>
            <div className="immersive-subtitle">{playingWork.circle || ''}</div>
            {immersiveLyricCues.length > 0 && (
              <div className="immersive-lyrics-container" ref={immersiveLyricRef}>
                {immersiveLyricCues.map((cue) => (
                  <div
                    key={cue.realIndex}
                    className={`immersive-lyric-line ${cue.isActive ? 'active' : ''}`}
                    onClick={() => playerRef.current?.seekTo(cue.time)}
                  >
                    {cue.text.split('\n').map((line, lineIdx) => (
                      <div key={lineIdx}>{line}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
        currentSettings={settings}
        defaultTab={settingsDefaultTab}
      />

      {showDownloadModal && selectedWork && selectedWork.isOnline && (
        <DownloadModal
          work={selectedWork}
          onClose={() => setShowDownloadModal(false)}
          onNavigateToDownload={() => setCurrentView('download')}
        />
      )}

      <GlobalSearchModal
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        works={works}
        currentAudio={currentAudio}
        currentWork={selectedWork}
        onSelectWork={(work) => {
          setCurrentView('library')
          handleSelectWork(work)
        }}
        onPlayAudio={(audio, work) => {
          if (work) {
            setCurrentView(work.isOnline ? 'discover' : 'library')
            if (work.isOnline) {
              // 在线作品需要完整加载
              handleSelectOnlineWork({ id: work.onlineId, title: work.title, mainCoverUrl: work.cover, name: work.circle, vas: (work.cvs || []).map(c => ({ name: c })), tags: (work.tags || []).map(t => ({ name: t })) })
            } else {
              handleSelectWork(work)
            }
          }
        }}
      />

      {addToPlaylistTarget && (
        <AddToPlaylistModal
          target={addToPlaylistTarget}
          onClose={handleCloseAddToPlaylist}
          onToast={showToast}
        />
      )}
      </div>
    </ErrorBoundary>
  )
}

// 加入播放列表弹窗
function AddToPlaylistModal({ target, onClose, onToast }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [creatingName, setCreatingName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await window.electronAPI.playlistGetAll()
      setPlaylists(data || [])
      if (data && data.length > 0) setSelectedId(data[0].id)
    } catch (e) {
      console.error('Failed to load playlists:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleConfirm = useCallback(async () => {
    if (!selectedId || !target?.audio) return
    setSubmitting(true)
    try {
      const { audio, work } = target
      const item = {
        workId: work?.id || '',
        workTitle: work?.title || work?.folderName || '',
        workCover: work?.cover || '',
        audioPath: audio.path,
        audioName: audio.name || '',
        isOnline: !!audio.isOnline,
      }
      const updated = await window.electronAPI.playlistAddItem(selectedId, item)
      if (updated) {
        // 检查是否真的加入（去重时 items 不变）
        const existsBefore = playlists.find((p) => p.id === selectedId)?.items?.some((it) => it.audioPath === audio.path)
        onToast?.(existsBefore ? '该曲目已在播放列表中' : `已加入播放列表`, existsBefore ? 'info' : 'success')
      }
      onClose()
    } catch (e) {
      onToast?.('加入失败：' + (e.message || ''), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [selectedId, target, playlists, onToast, onClose])

  const handleCreateAndAdd = useCallback(async () => {
    const name = (creatingName || '').trim()
    if (!name) {
      setShowCreate(false)
      setCreatingName('')
      return
    }
    setSubmitting(true)
    try {
      const created = await window.electronAPI.playlistCreate(name)
      const { audio, work } = target
      const item = {
        workId: work?.id || '',
        workTitle: work?.title || work?.folderName || '',
        workCover: work?.cover || '',
        audioPath: audio.path,
        audioName: audio.name || '',
        isOnline: !!audio.isOnline,
      }
      await window.electronAPI.playlistAddItem(created.id, item)
      onToast?.(`已创建并加入「${created.name}」`, 'success')
      onClose()
    } catch (e) {
      onToast?.('创建失败：' + (e.message || ''), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [creatingName, target, onToast, onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-to-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>加入播放列表</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="add-to-playlist-target-info">
            <span className="add-to-playlist-target-name">{target?.audio?.name || '未知曲目'}</span>
            {target?.work?.title && <span className="add-to-playlist-target-work">{target.work.title}</span>}
          </div>
          {loading ? (
            <div className="add-to-playlist-loading">加载中...</div>
          ) : playlists.length === 0 && !showCreate ? (
            <div className="add-to-playlist-empty">
              <p>还没有播放列表</p>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>新建播放列表</button>
            </div>
          ) : (
            <div className="add-to-playlist-list">
              {playlists.map((pl) => (
                <label
                  key={pl.id}
                  className={`add-to-playlist-option ${selectedId === pl.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="playlist-target"
                    checked={selectedId === pl.id}
                    onChange={() => setSelectedId(pl.id)}
                  />
                  <span className="add-to-playlist-option-name">{pl.name}</span>
                  <span className="add-to-playlist-option-count">{(pl.items || []).length} 首</span>
                </label>
              ))}
              {showCreate ? (
                <div className="add-to-playlist-create">
                  <input
                    type="text"
                    className="playlist-name-input"
                    placeholder="新播放列表名称"
                    value={creatingName}
                    autoFocus
                    onChange={(e) => setCreatingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateAndAdd()
                      else if (e.key === 'Escape') { setShowCreate(false); setCreatingName('') }
                    }}
                    maxLength={50}
                  />
                  <button className="btn-primary" onClick={handleCreateAndAdd} disabled={submitting}>创建并加入</button>
                </div>
              ) : (
                <button className="add-to-playlist-new-btn" onClick={() => setShowCreate(true)}>
                  + 新建播放列表
                </button>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!selectedId || submitting || loading}
          >
            {submitting ? '处理中...' : '加入'}
          </button>
        </div>
      </div>
    </div>
  )
}
