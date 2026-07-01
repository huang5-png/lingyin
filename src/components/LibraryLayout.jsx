import { memo } from 'react'
import Sidebar from './Sidebar'
import WorkDetail from './WorkDetail'
import RightTabBar from './RightTabBar'

const LibraryLayout = memo(function LibraryLayout({
  selectedWork,
  settings,
  filteredWorks,
  allWorks,
  isLoadingWorks,
  onSelectWork,
  onAddFolder,
  onAddMediaLibrary,
  cvFilter,
  circleFilter,
  onFilterChange,
  allCVs,
  allCircles,
  onOpenSettings,
  onDeleteWork,
  viewMode,
  onViewModeChange,
  onTranslate,
  onTranslateBatch,
  getTranslatedText,
  isTranslated,
  isTranslating,
  isAnyTranslating,
  showOnlyFavorites,
  onToggleFavoritesFilter,
  favoriteIds,
  onToggleFavorite,
  folderGroups,
  activeGroupId,
  onGroupChange,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onSetWorkGroup,
  groupWorkCounts,
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
  onAddToPlaylist,
  onAddToQueue,
  onPlayNext,
  isFavorite,
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
  subtitleStyleSettings,
  isFavoritesView,
  bookmarks,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  bulkMode,
  bulkSelectedIds,
  onToggleBulkMode,
  onToggleBulkSelect,
  onSelectAllBulk,
  onClearBulkSelection,
  onBulkFavorite,
  onBulkDelete,
  onBulkMoveToGroup,
  sortBy,
  sortOrder,
  onSortChange,
  onToast,
}) {
  const hasDetail = !!selectedWork
  const shouldHideSidebar = settings.autoHideSidebar && hasDetail

  return (
    <div className={`library-layout ${hasDetail ? 'has-detail' : ''} ${shouldHideSidebar ? 'hide-sidebar' : ''} ${isFavoritesView ? 'favorites-view' : ''}`}>
      <div className="library-main">
        <Sidebar
          works={filteredWorks}
          isLoadingWorks={isLoadingWorks}
          selectedWorkId={selectedWork?.id}
          onSelectWork={onSelectWork}
          onAddFolder={onAddFolder}
          onAddMediaLibrary={onAddMediaLibrary}
          cvFilter={cvFilter}
          circleFilter={circleFilter}
          onFilterChange={onFilterChange}
          allCVs={allCVs}
          allCircles={allCircles}
          onOpenSettings={onOpenSettings}
          onDeleteWork={onDeleteWork}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onTranslate={onTranslate}
          onTranslateBatch={onTranslateBatch}
          getTranslatedText={getTranslatedText}
          isTranslated={isTranslated}
          isTranslating={isTranslating}
          isAnyTranslating={isAnyTranslating}
          showOnlyFavorites={showOnlyFavorites}
          onToggleFavoritesFilter={onToggleFavoritesFilter}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          folderGroups={folderGroups}
          activeGroupId={activeGroupId}
          onGroupChange={onGroupChange}
          onCreateGroup={onCreateGroup}
          onRenameGroup={onRenameGroup}
          onDeleteGroup={onDeleteGroup}
          onSetWorkGroup={onSetWorkGroup}
          groupWorkCounts={groupWorkCounts}
          isFavoritesView={isFavoritesView}
          bulkMode={bulkMode}
          selectedIds={bulkSelectedIds}
          onToggleBulkMode={onToggleBulkMode}
          onToggleSelect={onToggleBulkSelect}
          onSelectAll={onSelectAllBulk}
          onClearSelection={onClearBulkSelection}
          onBulkFavorite={onBulkFavorite}
          onBulkDelete={onBulkDelete}
          onBulkMoveToGroup={onBulkMoveToGroup}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
        />
      </div>
      {selectedWork && (
        <div className="main-content">
          <div className="content-area" ref={contentAreaRef}>
            <div className="work-detail-wrapper library-work-detail">
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
                folderGroups={folderGroups}
                onSetWorkGroup={onSetWorkGroup}
              />
            </div>
            <div className="content-splitter" onMouseDown={onSplitterMouseDown} />
            <div className="right-tab-wrapper" style={{ width: rightPanelWidth }}>
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
                subtitleStyleSettings={subtitleStyleSettings}
                bookmarks={bookmarks}
                onAddBookmark={onAddBookmark}
                onUpdateBookmark={onUpdateBookmark}
                onDeleteBookmark={onDeleteBookmark}
                currentAudio={currentAudio}
                allWorks={allWorks}
                onSelectWork={onSelectWork}
                onAddToPlaylist={onAddToPlaylist}
                onToast={onToast}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default LibraryLayout
