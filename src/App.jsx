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
import ImmersiveView from './components/ImmersiveView'
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
import { useAppSettings } from './hooks/useAppSettings'
import { useViewNavigation } from './hooks/useViewNavigation'
import { usePlaylistPlayback } from './hooks/usePlaylistPlayback'
import { useSubtitleRefresh } from './hooks/useSubtitleRefresh'
import { useFavorites } from './hooks/useFavorites'
import './App.css'

export default function App() {
  const playerRef = useRef(null)
  const handleSelectAudioRef = useRef(null)
  const discoverViewRef = useRef(null)

  // ===== Toast 通知 Hook =====
  const { toasts, showToast, removeToast } = useToast()

  // ===== 设置管理 Hook =====
  const {
    settings,
    setSettings,
    viewMode,
    showLyric,
    setShowLyric,
    handleSaveSettings,
    handleViewModeChange,
  } = useAppSettings({
    playerRef,
    showToast,
  })

  // ===== 视图导航 Hook =====
  const {
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
    handleOpenSettings,
    handleOpenSubtitleSettings,
    pendingAutoPlayRef,
    handleSelectWork,
    handleRecentPlayAutoPlay,
    handlePlayerCoverClick,
  } = useViewNavigation({ showToast })

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
    filteredWorks: filterByTagWorks,
    handleFilterChange,
  } = useFilters(works)

  // ===== 收藏功能 Hook =====
  const {
    favoriteIds,
    showOnlyFavorites,
    setShowOnlyFavorites,
    toggleFavorite,
    isFavorite,
    filterFavorites,
  } = useFavorites({ showToast })

  const filteredWorks = useMemo(() => {
    return filterFavorites(filterByTagWorks)
  }, [filterByTagWorks, filterFavorites])

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

  // 收藏相关处理
  const handleToggleFavorite = useCallback(
    async (work) => {
      if (!work) return
      const workInfo = {
        title: work.title || work.folderName || '',
        cover: work.cover || '',
        circle: work.circle || '',
        isOnline: !!work.isOnline,
      }
      await toggleFavorite(work.id, workInfo)
    },
    [toggleFavorite],
  )

  const handleToggleFavoritesFilter = useCallback(() => {
    setShowOnlyFavorites(prev => !prev)
  }, [setShowOnlyFavorites])

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
    handleCloseImmersive,
    handleToggleImmersive,
  } = useImmersive()

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

  // 监听 audioFiles 加载完成后自动播放（最近播放）
  useEffect(() => {
    if (!pendingAutoPlayRef?.current || !audioFiles.length) return

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
  }, [audioFiles, handleSelectAudio, pendingAutoPlayRef])

  const handlePlayerCoverClickWrapped = useCallback(() => {
    handlePlayerCoverClick({
      playingWork,
      onToggleImmersive: handleToggleImmersive,
    })
  }, [playingWork, handleToggleImmersive, handlePlayerCoverClick])

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

  // ===== 字幕刷新 Hook =====
  const {
    handleRefreshSubtitles,
  } = useSubtitleRefresh({
    selectedWork,
    currentAudio,
    subtitleOptions,
    selectedSubtitleIndex,
    findMatchedSubtitles,
    detectSubtitleLanguagesAsync,
    setAudioFiles,
    setAllSubtitleFiles,
    setSubtitleOptions,
    setSelectedSubtitleIndex,
    setCurrentCues,
    showToast,
  })

  // ===== 播放列表播放 Hook =====
  const {
    addToPlaylistTarget,
    handleOpenAddToPlaylist,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
  } = usePlaylistPlayback({
    works,
    showToast,
    handleSelectAudio,
    setCurrentView,
    setSelectedWork,
    latestAudioFilesRef,
  })

  const handleOpenAddToPlaylistForAudio = useCallback((audio) => {
    handleOpenAddToPlaylist(audio, selectedWork)
  }, [handleOpenAddToPlaylist, selectedWork])

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
              showOnlyFavorites={showOnlyFavorites}
              onToggleFavoritesFilter={handleToggleFavoritesFilter}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
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
                    onAddToPlaylist={handleOpenAddToPlaylistForAudio}
                    onAddToQueue={handleAddToQueue}
                    onPlayNext={handlePlayNext}
                    isFavorite={isFavorite(selectedWork?.id)}
                    onToggleFavorite={handleToggleFavorite}
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
                    onAddToPlaylist={handleOpenAddToPlaylistForAudio}
                    onAddToQueue={handleAddToQueue}
                    onPlayNext={handlePlayNext}
                    isFavorite={isFavorite(selectedWork?.id)}
                    onToggleFavorite={handleToggleFavorite}
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
            onToggleImmersive={handlePlayerCoverClickWrapped}
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
        <ImmersiveView
          work={playingWork}
          currentCues={currentCues}
          currentTime={currentTime}
          subtitleFontSize={settings.subtitleFontSize}
          playerRef={playerRef}
          onClose={handleCloseImmersive}
        />
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
        favoriteIds={favoriteIds}
        onSelectWork={(work) => {
          setCurrentView('library')
          handleSelectWork(work)
        }}
        onPlayAudio={(audio, work) => {
          if (work) {
            setCurrentView(work.isOnline ? 'discover' : 'library')
            if (work.isOnline) {
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
