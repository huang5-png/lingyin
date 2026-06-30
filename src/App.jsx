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
import { useFilters } from './hooks/useFilters'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { useImmersive } from './hooks/useImmersive'
import { useSplitter } from './hooks/useSplitter'
import { usePlayer } from './hooks/usePlayer'
import { useWorkMetadata } from './hooks/useWorkMetadata'
import { scanFolder } from './utils/scanner'
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
  const [selectedWork, setSelectedWork] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [viewMode, setViewMode] = useState(settings.viewMode || 'grid')
  const [showLyric, setShowLyric] = useState(settings.showLyric)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null) // { audio, work } 待加入曲目
  const [rightTab, setRightTab] = useState('details')
  const [currentView, setCurrentView] = useState('library')
  // ===== Toast 通知 Hook =====
  const { toasts, showToast, removeToast } = useToast()

  // ===== 右侧面板宽度拖拽 Hook =====
  const contentAreaRef = useRef(null)
  const {
    width: rightPanelWidth,
    setWidth: setRightPanelWidth,
    isDragging: isDraggingSplitter,
    handleMouseDown: handleSplitterMouseDown,
  } = useSplitter({
    defaultWidth: 320,
    minWidth: 240,
    maxWidth: 600,
    containerRef: contentAreaRef,
  })

  const playerRef = useRef(null)
  const handleSelectAudioRef = useRef(null)
  const discoverViewRef = useRef(null)

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

  // ===== 筛选状态 Hook =====
  const {
    cvFilter,
    circleFilter,
    tagFilter,
    allCVs,
    allCircles,
    filteredWorks,
    handleFilterChange,
  } = useFilters(works)

  // ===== 播放历史记录 Hook =====
  const { recordHistoryIfNeeded } = usePlaybackHistory()

  // ===== 翻译功能 Hook =====
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
    allSubtitleFiles,
    settings,
    translateCacheRef,
    setTranslateVersion,
    showToast,
  })

  // ===== 核心播放控制 Hook =====
  const {
    playingWork,
    currentAudio,
    currentCues,
    currentTime,
    duration,
    handleSelectAudio,
    handleTimeUpdate,
    handleReady,
    handleSeek,
    handlePrevAudio,
    handleNextAudio,
    handleFinish,
    setCurrentCues,
    setCurrentTime,
    setDuration,
    setPlayingWork,
    setCurrentAudio,
    durationRef,
  } = usePlayer({
    selectedWork,
    audioFiles,
    settings,
    playerRef,
    showToast,
    findMatchedSubtitles,
    detectSubtitleLanguagesAsync,
    loadSavedSubtitle,
    selectSubtitleByPriority,
    handleAutoTranslate,
    setSubtitleOptions,
    setSelectedSubtitleIndex,
    queueIndex,
    playQueue,
    advanceQueue,
    recordHistoryIfNeeded,
    handleSelectAudioRef,
  })

  const hasTranslation = useMemo(() => currentCues.some(cue => cue.translated), [currentCues])

  const handleToggleTranslate = useCallback(() => {
    toggleSubtitleTranslate({
      selectedWork,
      currentAudio,
      currentCues,
      setCurrentCues,
    })
  }, [selectedWork, currentAudio, currentCues, toggleSubtitleTranslate])

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
    [mediaLibraryDeleteWork, selectedWork, setCurrentAudio, setCurrentCues],
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

  // ===== 元数据编辑与刷新 Hook =====
  const {
    handleEditMetadata,
    handleRefreshMetadata,
  } = useWorkMetadata({
    selectedWork,
    setSelectedWork,
    setWorks,
    showToast,
  })

  // ===== 沉浸式模式 Hook =====
  const {
    isImmersive,
    setIsImmersive,
    immersiveLyricRef,
    immersiveLyricCues,
    currentCueIndex,
    handleCloseImmersive,
    handleToggleImmersive,
  } = useImmersive({
    currentCues,
    currentTime,
    subtitleFontSize: settings.subtitleFontSize,
    playerRef,
  })

  useEffect(() => {
    loadWorks()
  }, [])

  // ===== 主题与缩放 Hook =====
  useTheme({
    settings,
    setSettings,
    setShowLyric,
    showToast,
  })

  const handleSelectWork = useCallback(
    (work) => {
      if (work?.id === selectedWork?.id) return
      setSelectedWork(work)
    },
    [selectedWork],
  )

  // 监听 audioFiles 加载完成后自动播放（最近播放）
  useEffect(() => {
    if (!pendingAutoPlayRef.current || !audioFiles.length) return

    const pending = pendingAutoPlayRef.current
    const timeout = Date.now() - pending.startedAt > 10000
    if (timeout) {
      pendingAutoPlayRef.current = null
      return
    }

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

  // 点击播放栏封面：跳转到正在播放的作品，或切换沉浸式
  const handlePlayerCoverClick = useCallback(() => {
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

    handleToggleImmersive()
  }, [playingWork, selectedWork, handleToggleImmersive])

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
