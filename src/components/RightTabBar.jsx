import { useState } from 'react'
import LyricView from './LyricView'
import BookmarksPanel from './BookmarksPanel'
import './RightTabBar.css'

export default function RightTabBar({
  activeTab,
  onTabChange,
  work,
  cues,
  currentTime,
  onSeek,
  subtitleOptions,
  selectedSubtitleIndex,
  onSelectSubtitle,
  onAddSubtitleFile,
  onToggleTranslate,
  isTranslating,
  hasTranslation,
  subtitleFontSize,
  bookmarks,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  currentAudio,
}) {
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'subtitles', label: 'Subtitles' },
    { id: 'bookmarks', label: 'Bookmarks' },
    { id: 'related', label: 'Related' },
    { id: 'playlists', label: 'Playlists' },
  ]

  return (
    <div className="right-tab-bar">
      <div className="tab-vertical">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
          >
            <span className="tab-text">{tab.label}</span>
          </div>
        ))}
      </div>
      <div className="tab-content-panel">
        {activeTab === 'details' && work && (
          <div className="details-panel">
            <h3>作品详情</h3>
            <div className="detail-item">
              <span className="detail-label">标题</span>
              <span className="detail-value">{work.title || work.folderName}</span>
            </div>
            {work.rjCode && (
              <div className="detail-item">
                <span className="detail-label">RJ 编号</span>
                <span className="detail-value">{work.rjCode}</span>
              </div>
            )}
            {work.circle && (
              <div className="detail-item">
                <span className="detail-label">社团</span>
                <span className="detail-value">{work.circle}</span>
              </div>
            )}
            {work.cvs && work.cvs.length > 0 && (
              <div className="detail-item">
                <span className="detail-label">CV</span>
                <div className="detail-cvs">
                  {work.cvs.map((cv, i) => (
                    <span key={i} className="cv-tag-mini">{cv}</span>
                  ))}
                </div>
              </div>
            )}
            {work.tags && work.tags.length > 0 && (
              <div className="detail-item">
                <span className="detail-label">标签</span>
                <div className="detail-tags">
                  {work.tags.slice(0, 10).map((tag, i) => (
                    <span key={i} className="tag-mini">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {work.description && (
              <div className="detail-item">
                <span className="detail-label">简介</span>
                <p className="detail-desc">{work.description}</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'details' && !work && (
          <div className="empty-panel">
            <p>选择一个作品查看详情</p>
          </div>
        )}
        {activeTab === 'subtitles' && (
          <div className="subtitles-panel">
            {work && (
              <LyricView
                cues={cues}
                currentTime={currentTime}
                onSeek={onSeek}
                subtitleOptions={subtitleOptions}
                selectedSubtitleIndex={selectedSubtitleIndex}
                onSelectSubtitle={onSelectSubtitle}
                onAddSubtitleFile={onAddSubtitleFile}
                onToggleTranslate={onToggleTranslate}
                isTranslating={isTranslating}
                hasTranslation={hasTranslation}
                subtitleFontSize={subtitleFontSize}
              />
            )}
            {!work && (
              <div className="empty-panel">
                <p>选择一个作品查看字幕</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'bookmarks' && (
          <div className="bookmarks-tab-panel">
            <BookmarksPanel
              bookmarks={bookmarks || []}
              currentTime={currentTime}
              onSeek={onSeek}
              onAddBookmark={onAddBookmark}
              onUpdateBookmark={onUpdateBookmark}
              onDeleteBookmark={onDeleteBookmark}
              work={work}
              currentAudio={currentAudio}
            />
          </div>
        )}
        {activeTab === 'related' && (
          <div className="empty-panel">
            <p>相关作品</p>
            <p className="empty-hint">功能开发中...</p>
          </div>
        )}
        {activeTab === 'playlists' && (
          <div className="empty-panel">
            <p>播放列表</p>
            <p className="empty-hint">功能开发中...</p>
          </div>
        )}
      </div>
    </div>
  )
}
