import { memo } from 'react'
import DiscoverView from './DiscoverView'
import WorkDetail from './WorkDetail'
import RightTabBar from './RightTabBar'

const DiscoverLayout = memo(function DiscoverLayout({
  selectedWork,
  settings,
  discoverViewRef,
  onSelectWork,
  onTranslate,
  onTranslateBatch,
  getTranslatedText,
  isTranslated,
  isTranslating,
  isAnyTranslating,
  audioFiles,
  currentAudio,
  onSelectAudio,
  onEditMetadata,
  onRefreshMetadata,
  onRefreshSubtitles,
  onFilterCV,
  onFilterTag,
  onCircleClick,
  activeCV,
  activeTag,
  onDownload,
  onReloadTracks,
  onAddToPlaylist,
  onAddToQueue,
  onPlayNext,
  isFavorite,
  onToggleFavorite,
  onCloseDetail,
  contentAreaRef,
  rightPanelWidth,
  onSplitterMouseDown,
  rightTab,
  onTabChange,
  cues,
  currentTime,
  onSeek,
  subtitleOptions,
  selectedSubtitleIndex,
  onSelectSubtitle,
  onAddSubtitleFile,
  onToggleTranslate,
  hasTranslation,
  subtitleFontSize,
}) {
  const hasDetail = !!selectedWork && !!selectedWork.isOnline
  const shouldHideSidebar = settings.autoHideSidebar && hasDetail

  return (
    <div className={`discover-layout ${hasDetail ? 'has-detail' : ''} ${shouldHideSidebar ? 'hide-sidebar' : ''}`}>
      <div className="discover-main">
        <DiscoverView
          ref={discoverViewRef}
          onSelectWork={onSelectWork}
          selectedWorkId={selectedWork?.id}
          onTranslate={onTranslate}
          onTranslateBatch={onTranslateBatch}
          getTranslatedText={getTranslatedText}
          isTranslated={isTranslated}
          isTranslating={isTranslating}
          isAnyTranslating={isAnyTranslating}
        />
      </div>
      {hasDetail && (
        <div className="main-content discover-detail-content">
          <div className="content-area" ref={contentAreaRef}>
            <div className="work-detail-wrapper discover-work-detail">
              <button
                className="detail-close-btn"
                onClick={onCloseDetail}
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
                onSelectAudio={onSelectAudio}
                onEditMetadata={onEditMetadata}
                onRefreshMetadata={onRefreshMetadata}
                onRefreshSubtitles={onRefreshSubtitles}
                onFilterCV={onFilterCV}
                onFilterTag={onFilterTag}
                onCircleClick={onCircleClick}
                activeCV={activeCV}
                activeTag={activeTag}
                onDownload={onDownload}
                onReloadTracks={onReloadTracks}
                onTranslate={onTranslate}
                onTranslateBatch={onTranslateBatch}
                getTranslatedText={getTranslatedText}
                isTranslated={isTranslated}
                isTranslating={isTranslating}
                onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
            <div className="content-splitter" onMouseDown={onSplitterMouseDown} />
            <div className="right-tab-wrapper discover-right-tab" style={{ width: rightPanelWidth }}>
              <RightTabBar
                activeTab={rightTab}
                onTabChange={onTabChange}
                work={selectedWork}
                cues={cues}
                currentTime={currentTime}
                onSeek={onSeek}
                subtitleOptions={subtitleOptions}
                selectedSubtitleIndex={selectedSubtitleIndex}
                onSelectSubtitle={onSelectSubtitle}
                onAddSubtitleFile={onAddSubtitleFile}
                onToggleTranslate={onToggleTranslate}
                isTranslating={isAnyTranslating}
                hasTranslation={hasTranslation}
                subtitleFontSize={subtitleFontSize}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default DiscoverLayout
