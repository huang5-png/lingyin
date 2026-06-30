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
import Toast from './components/Toast'
import AddToPlaylistModal from './components/AddToPlaylistModal'
import LeftNavBar from './components/LeftNavBar'
import { useTranslate } from './hooks/useTranslate'
import { usePlayQueue } from './hooks/usePlayQueue'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSleepTimer, SLEEP_TIMER_OPTIONS } from './hooks/useSleepTimer'
import { useSubtitle } from './hooks/useSubtitle'
import { useMediaLibrary } from './hooks/useMediaLibrary'
import { useOnlineWork } from './hooks/useOnlineWork'
import { usePlaybackHistory } from './hooks/usePlaybackHistory'
import { scanFolder, extractRJCode, getExtension } from './utils/scanner'
import { parseSubtitle, findCurrentCue } from './utils/subtitleParser'
import { DEFAULT_SHORTCUTS } from './components/KeyboardShortcutsPanel'
import './App.css'

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
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [isImmersive, setIsImmersive] = useState(false)
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null) // { audio, work } 待加入曲目
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

  // Toast 通知
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const playerRef = useRef(null)
  const handleSelectAudioRef = useRef(null)
  const discoverViewRef = useRef(null)
  const lastSaveTimeRef = useRef(0)
  const durationRef = useRef(0)

  // 最近播放自动播放：记录待播放的音频路径，audioFiles 加载后自动播放
  const pendingAutoPlayRef = useRef(null)

  const handleRecentPlayAutoPlay = useCallback((item) => {
    pendingAutoPlayRef.current = { audioPath: item.audioPath, startedAt: Date.now() }
  }, [])

  // ===== 媒体库管理 Hook =====
  const {
    works,
    setWorks,
    loadWorks,
    handleAddFolder,
    handleAddMediaLibrary,
    handleDeleteWork: mediaLibraryDeleteWork,
    audioFiles,
    setAudioFiles,
    allSubtitleFiles,
    setAllSubtitleFiles,
    latestAudioFilesRef,
  } = useMediaLibrary({
    showToast,
    setSelectedWork,
  })

  // 包装 handleDeleteWork，注入 selectedWork 和清理回调
  const handleDeleteWork = useCallback(
    async (work) => {
      const onDelete = () => {
        setSelectedWork(null)
        setCurrentAudio(null)
        setCurrentCues([])
      }
      await mediaLibraryDeleteWork(work, selectedWork, onDelete)
    },
    [mediaLibraryDeleteWork, selectedWork],
  )

  // ===== 在线作品 Hook =====
  const {
    handleSelectOnlineWork,
    handleReloadOnlineTracks,
    extractAudiosFromTracks,
  } = useOnlineWork({
    showToast,
    setSelectedWork,
    setAudioFiles,
    setCurrentAudio,
    setCurrentCues,
    setCurrentTime,
    setDuration,
    setAllSubtitleFiles,
    setSubtitleOptions,
    setSelectedSubtitleIndex,
  })

  // ===== 播放历史记录 Hook =====
  const { recordHistoryIfNeeded } = usePlaybackHistory()

  // ===== 自定义 Hooks =====
  const {
    translateCacheRef,
    translateVersion,
    setTranslateVersion,
    translate: handleTranslate,
    translateBatch: handleTranslateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    toggleSubtitleTranslate,
  } = useTranslate(showToast)

  const hasTranslation = useMemo(() => currentCues.some(cue => cue.translated), [currentCues])

  const handleToggleTranslate = useCallback(() => {
    toggleSubtitleTranslate({
      selectedWork,
      currentAudio,
      currentCues,
      setCurrentCues,
    })
  }, [selectedWork, currentAudio, currentCues, toggleSubtitleTranslate])

  const {
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
    playFromQueue: handlePlayFromQueue,
    advanceQueue,
    buildQueueItem,
    addToQueue: handleAddToQueue,
    playNext: handlePlayNext,
    removeFromQueue: handleRemoveFromQueue,
    clearQueue: handleClearQueue,
    reorderQueue: handleReorderQueue,
    toggleLoopMode: handleToggleLoopMode,
    toggleShuffle: handleToggleShuffle,
    toggleQueuePanel: handleToggleQueuePanel,
  } = usePlayQueue({
    selectedWork,
    audioFiles,
    settings,
    showToast,
    playerRef,
    handleSelectAudioRef,
    setCurrentView,
    setSelectedWork,
  })

  const {
    sleepTimerMinutes,
    sleepTimerRemaining,
    setSleepTimer: handleSetSleepTimer,
  } = useSleepTimer({ playerRef, showToast })

  const {
    subtitleOptions,
    setSubtitleOptions,
    selectedSubtitleIndex,
    setSelectedSubtitleIndex,
    detectSubtitleLanguagesAsync,
    findMatchedSubtitles,
    loadSavedSubtitle,
    selectSubtitleByPriority,
    handleSelectSubtitle,
    handleAddSubtitleFile,
    handleAutoTranslate,
  } = useSubtitle({
    selectedWork,
    currentAudio,
    allSubtitleFiles,
    settings,
    translateCacheRef,
    setTranslateVersion,
    showToast,
  })

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

  // useMemo 缓存计算结果，减少重渲染
  const allCVs = useMemo(() => [...new Set(works.flatMap((w) => w.cvs || []))].sort(), [works])
  const allCircles = useMemo(() => [...new Set(works.map((w) => w.circle).filter(Boolean))].sort(), [works])

  const filteredWorks = useMemo(() => works.filter((w) => {
    if (cvFilter && !(w.cvs || []).includes(cvFilter)) return false
    if (circleFilter && w.circle !== circleFilter) return false
    if (tagFilter && !(w.tags || []).includes(tagFilter)) return false
    return true
  }), [works, cvFilter, circleFilter, tagFilter])

  const handleSelectWork = useCallback(
    (work) => {
      if (work?.id === selectedWork?.id) return
      setSelectedWork(work)
      // 注意：切换作品时不重置 currentAudio，实现边听边选
      // 只有当用户明确点击播放新曲目时才切换音频
    },
    [selectedWork],
  )

  const handleSelectAudio = useCallback(
    async (audio) => {
      if (!selectedWork) return

      setPlayingWork(selectedWork) // 记录当前正在播放的作品
      setCurrentAudio(audio)
      setCurrentCues([])

      // 使用 useSubtitle 提供的辅助函数查找匹配的字幕
      let foundSubtitleOptions = []
      
      if (!audio.isOnline) {
        foundSubtitleOptions = findMatchedSubtitles(audio.name, audio.path)
        detectSubtitleLanguagesAsync(foundSubtitleOptions)
      }
      
      setSubtitleOptions(foundSubtitleOptions)

      // 加载保存的字幕选择
      const { savedIndex, updatedOptions } = await loadSavedSubtitle(foundSubtitleOptions)
      if (updatedOptions !== foundSubtitleOptions) {
        setSubtitleOptions(updatedOptions)
      }

      // 根据语言优先级选择字幕
      const selectedIndex = selectSubtitleByPriority(updatedOptions, savedIndex)
      setSelectedSubtitleIndex(selectedIndex)

      if (selectedIndex >= 0 && updatedOptions[selectedIndex]) {
        try {
          const sub = updatedOptions[selectedIndex]
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
    [selectedWork, settings.subtitleLangPriority, settings.autoTranslateSubtitle, findMatchedSubtitles, detectSubtitleLanguagesAsync, loadSavedSubtitle, selectSubtitleByPriority],
  )

  handleSelectAudioRef.current = handleSelectAudio

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
            duration: durationRef.current,
          })
        }
        // 记录播放历史（每 60 秒，由 usePlaybackHistory 管理）
        recordHistoryIfNeeded(selectedWork, currentAudio, now)
      }
    },
    [selectedWork, currentAudio, recordHistoryIfNeeded],
  )

  const handleReady = useCallback((dur) => {
    setDuration(dur)
    durationRef.current = dur
  }, [])

  const handleSeek = useCallback((time) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time)
    }
  }, [])

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

  useKeyboardShortcuts({
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
  })

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
        const newSubtitleOptions = findMatchedSubtitles(currentAudio.name, currentAudio.path)
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
  }, [selectedWork, currentAudio, subtitleOptions, selectedSubtitleIndex, findMatchedSubtitles, detectSubtitleLanguagesAsync])

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
        <LeftNavBar
          currentView={currentView}
          onViewChange={setCurrentView}
          onOpenSettings={handleOpenSettings}
        />

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
        onSelectPlaylist={(playlist) => {
          setCurrentView('playlist')
          setShowGlobalSearch(false)
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
