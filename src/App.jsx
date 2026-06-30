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
    sleepTimerMinutes,
    sleepTimerRemaining,
    handleSetSleepTimer,

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
        <LibraryLayout
          selectedWork={selectedWork}
          settings={settings}
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
          folderGroups={folderGroups}
          activeGroupId={activeGroupId}
          onGroupChange={setActiveGroupId}
          onCreateGroup={createGroup}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onSetWorkGroup={setWorkGroup}
          groupWorkCounts={groupWorkCounts}
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
          onAddToPlaylist={handleOpenAddToPlaylistForAudio}
          onAddToQueue={handleAddToQueue}
          onPlayNext={handlePlayNext}
          isFavorite={isFavorite(selectedWork?.id)}
          onCloseDetail={() => setSelectedWork(null)}
          contentAreaRef={contentAreaRef}
          rightPanelWidth={rightPanelWidth}
          onSplitterMouseDown={handleSplitterMouseDown}
          rightTab={rightTab}
          onTabChange={setRightTab}
          cues={currentCues}
          currentTime={currentTime}
          onSeek={handleSeek}
          subtitleOptions={subtitleOptions}
          selectedSubtitleIndex={selectedSubtitleIndex}
          onSelectSubtitle={handleSelectSubtitle}
          onAddSubtitleFile={handleAddSubtitleFile}
          onToggleTranslate={handleToggleTranslate}
          hasTranslation={hasTranslation}
          subtitleFontSize={settings.subtitleFontSize}
          isFavoritesView={false}
        />
      )}
      {currentView === 'favorites' && (
        <LibraryLayout
          selectedWork={selectedWork}
          settings={settings}
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
          onTranslate={handleTranslate}
          onTranslateBatch={handleTranslateBatch}
          getTranslatedText={getTranslatedText}
          isTranslated={isTranslated}
          isTranslating={isTranslating}
          isAnyTranslating={isAnyTranslating}
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
          onAddToPlaylist={handleOpenAddToPlaylistForAudio}
          onAddToQueue={handleAddToQueue}
          onPlayNext={handlePlayNext}
          isFavorite={isFavorite(selectedWork?.id)}
          onCloseDetail={() => setSelectedWork(null)}
          contentAreaRef={contentAreaRef}
          rightPanelWidth={rightPanelWidth}
          onSplitterMouseDown={handleSplitterMouseDown}
          rightTab={rightTab}
          onTabChange={setRightTab}
          cues={currentCues}
          currentTime={currentTime}
          onSeek={handleSeek}
          subtitleOptions={subtitleOptions}
          selectedSubtitleIndex={selectedSubtitleIndex}
          onSelectSubtitle={handleSelectSubtitle}
          onAddSubtitleFile={handleAddSubtitleFile}
          onToggleTranslate={handleToggleTranslate}
          hasTranslation={hasTranslation}
          subtitleFontSize={settings.subtitleFontSize}
          isFavoritesView={true}
        />
      )}
      {currentView === 'discover' && (
        <DiscoverLayout
          selectedWork={selectedWork}
          settings={settings}
          discoverViewRef={discoverViewRef}
          onSelectWork={handleSelectOnlineWork}
          onTranslate={handleTranslate}
          onTranslateBatch={handleTranslateBatch}
          getTranslatedText={getTranslatedText}
          isTranslated={isTranslated}
          isTranslating={isTranslating}
          isAnyTranslating={isAnyTranslating}
          audioFiles={audioFiles}
          currentAudio={currentAudio}
          onSelectAudio={handleSelectAudio}
          onEditMetadata={handleEditMetadata}
          onRefreshMetadata={handleRefreshMetadata}
          onRefreshSubtitles={handleRefreshSubtitles}
          onFilterCV={handleFilterCVInDiscover}
          onFilterTag={handleFilterTagInDiscover}
          onCircleClick={handleCircleClickInDiscover}
          activeCV={''}
          activeTag={''}
          onDownload={() => setShowDownloadModal(true)}
          onReloadTracks={handleReloadOnlineTracks}
          onAddToPlaylist={handleOpenAddToPlaylistForAudio}
          onAddToQueue={handleAddToQueue}
          onPlayNext={handlePlayNext}
          isFavorite={isFavorite(selectedWork?.id)}
          onCloseDetail={() => setSelectedWork(null)}
          contentAreaRef={contentAreaRef}
          rightPanelWidth={rightPanelWidth}
          onSplitterMouseDown={handleSplitterMouseDown}
          rightTab={rightTab}
          onTabChange={setRightTab}
          cues={currentCues}
          currentTime={currentTime}
          onSeek={handleSeek}
          subtitleOptions={subtitleOptions}
          selectedSubtitleIndex={selectedSubtitleIndex}
          onSelectSubtitle={handleSelectSubtitle}
          onAddSubtitleFile={handleAddSubtitleFile}
          onToggleTranslate={handleToggleTranslate}
          hasTranslation={hasTranslation}
          subtitleFontSize={settings.subtitleFontSize}
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
            playbackRate={settings.playbackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
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
