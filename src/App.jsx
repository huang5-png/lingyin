import { useMemo } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import LeftNavBar from './components/LeftNavBar'
import ImmersiveView from './components/ImmersiveView'
import LibraryLayout from './components/LibraryLayout'
import DiscoverLayout from './components/DiscoverLayout'
import AudioPlayer from './components/AudioPlayer'
import UsageReport from './components/UsageReport'
import DownloadView from './components/DownloadView'
import DownloadModal from './components/DownloadModal'
import PlaylistView from './components/PlaylistView'
import RecentPlaysView from './components/RecentPlaysView'
import GlobalSearchModal from './components/GlobalSearchModal'
import Toast from './components/Toast'
import AddToPlaylistModal from './components/AddToPlaylistModal'
import SettingsModal from './components/SettingsModal'
import { useAppState } from './hooks/useAppState'
import './App.css'

export default function App() {
  const {
    // Refs
    playerRef,
    discoverViewRef,
    contentAreaRef,

    // Toast
    toasts,
    showToast,
    removeToast,

    // 设置
    settings,
    viewMode,
    handleSaveSettings,
    handleViewModeChange,
    handlePlaybackRateChange,

    // 视图导航
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
    handleSelectWork,
    handleRecentPlayAutoPlay,
    handleContinueListen,
    lastPlayedAudio,
    loadLastPlayedAudio,

    // 右侧面板拖拽
    rightPanelWidth,
    handleSplitterMouseDown,

    // 媒体库
    works,
    isLoadingWorks,
    audioFiles,
    handleAddFolder,
    handleAddMediaLibrary,
    handleDeleteWork,

    // 收藏
    favoriteIds,
    showOnlyFavorites,
    handleToggleFavorite,
    isFavorite,
    handleToggleFavoritesFilter,

    // 书签
    bookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    hasBookmarkAtTime,

    // 文件夹分组
    folderGroups,
    activeGroupId,
    setActiveGroupId,
    groupWorkCounts,
    createGroup,
    renameGroup,
    deleteGroup,
    setWorkGroup,

    // 筛选
    cvFilter,
    circleFilter,
    tagFilter,
    allCVs,
    allCircles,
    filteredWorks,
    handleFilterChange,

    // 翻译
    handleTranslate,
    handleTranslateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    handleToggleTranslate,
    hasTranslation,

    // 播放队列
    playQueue,
    queueIndex,
    loopMode,
    shuffle,
    showQueuePanel,
    handlePlayFromQueue,
    handleAddToQueue,
    handlePlayNext,
    handleRemoveFromQueue,
    handleClearQueue,
    handleReorderQueue,
    handleToggleLoopMode,
    handleToggleShuffle,
    handleToggleQueuePanel,

    // 睡眠定时器
    sleepTimerMode,
    sleepTimerActive,
    sleepTimerFading,
    sleepTimerRemaining,
    sleepTimerFadeEnabled,
    setSleepTimerFadeEnabled,
    handleSetCountdownTimer,
    handleSetTrackEndTimer,
    handleSetTimePointTimer,
    handleCancelSleepTimer,
    handleSleepTimerTrackFinish,
    formatSleepTimerRemaining,
    getSleepTimerStatusText,
    SLEEP_TIMER_OPTIONS,
    SLEEP_TIMER_MODES,
    SLEEP_TIMER_PRESETS,

    // 字幕
    subtitleOptions,
    selectedSubtitleIndex,
    handleSelectSubtitle,
    handleAddSubtitleFile,

    // 播放控制
    playingWork,
    currentAudio,
    currentCues,
    currentTime,
    handleSelectAudio,
    handleTimeUpdate,
    handleReady,
    handleSeek,
    handlePrevAudio,
    handleNextAudio,
    handleFinish,

    // 在线作品
    handleSelectOnlineWork,
    handleReloadOnlineTracks,

    // 元数据
    handleEditMetadata,
    handleRefreshMetadata,

    // 沉浸式
    isImmersive,
    handleCloseImmersive,
    handlePlayerCoverClickWrapped,

    // 字幕刷新
    handleRefreshSubtitles,

    // 播放列表
    addToPlaylistTarget,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
    handleOpenAddToPlaylistForAudio,

    // 发现页筛选
    handleFilterCVInDiscover,
    handleFilterTagInDiscover,
    handleCircleClickInDiscover,

    // 全局搜索
    handleGlobalSearchSelectWork,
    handleGlobalSearchPlayAudio,
    handleGlobalSearchSelectPlaylist,
  } = useAppState()

  const favoriteFilteredWorks = useMemo(() => {
    return filteredWorks.filter(work => favoriteIds.has(work.id))
  }, [filteredWorks, favoriteIds])

  const lyricSubtitleStyle = useMemo(() => ({
    fontSize: settings.subtitleLyricFontSize || 14,
    color: settings.subtitleLyricColor || '#e8e6e3',
    activeColor: settings.subtitleLyricActiveColor || '#c96442',
    fontWeight: settings.subtitleLyricFontWeight || 400,
    shadow: settings.subtitleLyricShadow !== false,
    shadowBlur: settings.subtitleLyricShadowBlur || 2,
  }), [
    settings.subtitleLyricFontSize,
    settings.subtitleLyricColor,
    settings.subtitleLyricActiveColor,
    settings.subtitleLyricFontWeight,
    settings.subtitleLyricShadow,
    settings.subtitleLyricShadowBlur,
  ])

  const immersiveSubtitleStyle = useMemo(() => ({
    fontSize: settings.subtitleImmersiveFontSize || 22,
    activeFontSize: settings.subtitleImmersiveActiveFontSize || 34,
    color: settings.subtitleImmersiveColor || '#ffffff',
    activeColor: settings.subtitleImmersiveActiveColor || '#ffffff',
    fontWeight: settings.subtitleImmersiveFontWeight || 500,
    shadow: settings.subtitleImmersiveShadow !== false,
    shadowBlur: settings.subtitleImmersiveShadowBlur || 4,
  }), [
    settings.subtitleImmersiveFontSize,
    settings.subtitleImmersiveActiveFontSize,
    settings.subtitleImmersiveColor,
    settings.subtitleImmersiveActiveColor,
    settings.subtitleImmersiveFontWeight,
    settings.subtitleImmersiveShadow,
    settings.subtitleImmersiveShadowBlur,
  ])

  // 共享的布局 props（LibraryLayout 和 DiscoverLayout 共用部分）
  const commonLayoutProps = useMemo(() => ({
    // 播放相关
    audioFiles,
    currentAudio,
    cues: currentCues,
    currentTime,
    onSeek: handleSeek,
    // 字幕相关
    subtitleOptions,
    selectedSubtitleIndex,
    onSelectSubtitle: handleSelectSubtitle,
    onAddSubtitleFile: handleAddSubtitleFile,
    onToggleTranslate: handleToggleTranslate,
    hasTranslation,
    subtitleFontSize: settings.subtitleFontSize,
    subtitleStyleSettings: lyricSubtitleStyle,
    // 翻译相关
    onTranslate: handleTranslate,
    onTranslateBatch: handleTranslateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    // 元数据相关
    onEditMetadata: handleEditMetadata,
    onRefreshMetadata: handleRefreshMetadata,
    onRefreshSubtitles: handleRefreshSubtitles,
    // 播放操作相关
    onAddToPlaylist: handleOpenAddToPlaylistForAudio,
    onAddToQueue: handleAddToQueue,
    onPlayNext: handlePlayNext,
    // 作品相关
    selectedWork,
    isFavorite: isFavorite(selectedWork?.id),
    onCloseDetail: () => setSelectedWork(null),
    contentAreaRef,
    // 书签相关
    bookmarks,
    onAddBookmark,
    onUpdateBookmark,
    onDeleteBookmark,
    // 右侧面板
    rightPanelWidth,
    onSplitterMouseDown: handleSplitterMouseDown,
    rightTab,
    onTabChange: setRightTab,
    // 筛选相关
    onFilterCV: (cv) => handleFilterChange('cv', cv),
    onFilterTag: (tag) => handleFilterChange('tag', tag),
    onCircleClick: (circle) => handleFilterChange('circle', circle),
    activeCV: cvFilter,
    activeTag: tagFilter,
    // 设置
    settings,
  }), [
    audioFiles, currentAudio, currentCues, currentTime, handleSeek,
    subtitleOptions, selectedSubtitleIndex, handleSelectSubtitle, handleAddSubtitleFile,
    handleToggleTranslate, hasTranslation, settings.subtitleFontSize, lyricSubtitleStyle,
    handleTranslate, handleTranslateBatch, getTranslatedText, isTranslated, isTranslating, isAnyTranslating,
    handleEditMetadata, handleRefreshMetadata, handleRefreshSubtitles,
    handleOpenAddToPlaylistForAudio, handleAddToQueue, handlePlayNext,
    selectedWork, isFavorite,
    bookmarks, onAddBookmark, onUpdateBookmark, onDeleteBookmark,
    rightPanelWidth, handleSplitterMouseDown, rightTab, setRightTab,
    handleFilterChange, cvFilter, tagFilter,
    settings,
  ])

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
          lastPlayedAudio={lastPlayedAudio}
          onContinueListen={() => lastPlayedAudio && handleContinueListen(lastPlayedAudio)}
        />

        <div className="right-content-area">
      {currentView === 'library' && (
        <LibraryLayout
          {...commonLayoutProps}
          filteredWorks={filteredWorks}
          isLoadingWorks={isLoadingWorks}
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
          showOnlyFavorites={showOnlyFavorites}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          folderGroups={folderGroups}
          activeGroupId={activeGroupId}
          onGroupChange={setActiveGroupId}
          onCreateGroup={createGroup}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onSetWorkGroup={setWorkGroup}
          groupWorkCounts={groupWorkCounts}
          onSelectAudio={handleSelectAudio}
          isFavoritesView={false}
        />
      )}
      {currentView === 'favorites' && (
        <LibraryLayout
          {...commonLayoutProps}
          filteredWorks={favoriteFilteredWorks}
          isLoadingWorks={isLoadingWorks}
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
          showOnlyFavorites={true}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          folderGroups={folderGroups}
          activeGroupId={activeGroupId}
          onGroupChange={setActiveGroupId}
          onCreateGroup={createGroup}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onSetWorkGroup={setWorkGroup}
          groupWorkCounts={groupWorkCounts}
          onSelectAudio={handleSelectAudio}
          isFavoritesView={true}
        />
      )}
      {currentView === 'discover' && (
        <DiscoverLayout
          {...commonLayoutProps}
          discoverViewRef={discoverViewRef}
          onSelectWork={handleSelectOnlineWork}
          onFilterCV={handleFilterCVInDiscover}
          onFilterTag={handleFilterTagInDiscover}
          onCircleClick={handleCircleClickInDiscover}
          activeCV={''}
          activeTag={''}
          onDownload={() => setShowDownloadModal(true)}
          onReloadTracks={handleReloadOnlineTracks}
        />
      )}
      {currentView === 'annual-report' && (
        <div className="report-view">
          <UsageReport />
        </div>
      )}

      {currentView === 'download' && (
        <div className="download-view-wrapper">
          <DownloadView
            onToast={showToast}
            onOpenSettings={handleOpenSettings}
          />
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
            onContinueListen={handleContinueListen}
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
            sleepTimerMode={sleepTimerMode}
            sleepTimerActive={sleepTimerActive}
            sleepTimerFading={sleepTimerFading}
            sleepTimerRemaining={sleepTimerRemaining}
            sleepTimerFadeEnabled={sleepTimerFadeEnabled}
            onSetSleepTimerFadeEnabled={setSleepTimerFadeEnabled}
            onSetCountdownTimer={handleSetCountdownTimer}
            onSetTrackEndTimer={handleSetTrackEndTimer}
            onSetTimePointTimer={handleSetTimePointTimer}
            onCancelSleepTimer={handleCancelSleepTimer}
            onSleepTimerTrackFinish={handleSleepTimerTrackFinish}
            formatSleepTimerRemaining={formatSleepTimerRemaining}
            getSleepTimerStatusText={getSleepTimerStatusText}
            sleepTimerOptions={SLEEP_TIMER_OPTIONS}
            sleepTimerModes={SLEEP_TIMER_MODES}
            sleepTimerPresets={SLEEP_TIMER_PRESETS}
            playbackRate={settings.playbackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
            onAddBookmark={addBookmark}
            hasCurrentBookmark={playingWork && currentAudio ? hasBookmarkAtTime(playingWork.id, currentAudio.path, currentTime) : false}
            bookmarkCount={playingWork && currentAudio ? (bookmarks.filter(b => b.workId === playingWork.id && b.audioPath === currentAudio.path)).length : 0}
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
          subtitleStyleSettings={immersiveSubtitleStyle}
          playerRef={playerRef}
          onClose={handleCloseImmersive}
          upscalePreset={settings.upscalePreset}
          hasTranslation={hasTranslation}
          onToggleTranslate={handleToggleTranslate}
          isTranslating={isAnyTranslating}
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
        onSelectWork={handleGlobalSearchSelectWork}
        onPlayAudio={handleGlobalSearchPlayAudio}
        onSelectPlaylist={handleGlobalSearchSelectPlaylist}
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
