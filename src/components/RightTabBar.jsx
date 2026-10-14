import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import LyricView from './LyricView'
import BookmarksPanel from './BookmarksPanel'
import WorkGallery from './WorkGallery'
import ChapterList from './ChapterList'
import SoundstageCompass from './SoundstageCompass'
import VoiceChroniclePanel from './VoiceChroniclePanel'
import VoiceScriptPanel from './VoiceScriptPanel'
import { detectFranchiseSeries } from '../utils/seriesMatcher'
import StateView from './StateView'
import './RightTabBar.css'

function calcSimilarity(workA, workB) {
  if (!workA || !workB || workA.id === workB.id) return 0
  let score = 0
  const tagsA = new Set(workA.tags || [])
  const tagsB = new Set(workB.tags || [])
  if (tagsA.size > 0 && tagsB.size > 0) {
    let commonTags = 0
    for (const tag of tagsA) {
      if (tagsB.has(tag)) commonTags++
    }
    const tagSim = (commonTags * 2) / (tagsA.size + tagsB.size)
    score += tagSim * 40
  }
  const cvsA = new Set(workA.cvs || [])
  const cvsB = new Set(workB.cvs || [])
  if (cvsA.size > 0 && cvsB.size > 0) {
    let commonCvs = 0
    for (const cv of cvsA) {
      if (cvsB.has(cv)) commonCvs++
    }
    const cvSim = (commonCvs * 2) / (cvsA.size + cvsB.size)
    score += cvSim * 35
  }
  if (workA.circle && workB.circle && workA.circle === workB.circle) {
    score += 15
  }
  const titleA = (workA.title || workA.folderName || '').toLowerCase()
  const titleB = (workB.title || workB.folderName || '').toLowerCase()
  if (titleA && titleB) {
    if (titleA.includes(titleB) || titleB.includes(titleA)) {
      score += 10
    }
  }
  return score
}

const RelatedPanel = memo(function RelatedPanel({ work, allWorks, onSelectWork, onToast }) {
  const relatedWorks = useMemo(() => {
    if (!work || !allWorks || allWorks.length === 0) return []
    const scored = allWorks
      .filter((w) => w.id !== work.id)
      .map((w) => ({ work: w, score: calcSimilarity(work, w) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
    return scored
  }, [work, allWorks])

  const topByTags = useMemo(() => {
    return relatedWorks.filter((item) => {
      const tagsA = new Set(work?.tags || [])
      const tagsB = new Set(item.work.tags || [])
      let common = 0
      for (const t of tagsA) if (tagsB.has(t)) common++
      return common >= 2
    }).slice(0, 5)
  }, [relatedWorks, work])

  const topByCV = useMemo(() => {
    return relatedWorks.filter((item) => {
      const cvsA = new Set(work?.cvs || [])
      const cvsB = new Set(item.work.cvs || [])
      let common = 0
      for (const cv of cvsA) if (cvsB.has(cv)) common++
      return common >= 1
    }).slice(0, 5)
  }, [relatedWorks, work])

  const topByCircle = useMemo(() => {
    return relatedWorks
      .filter((item) => item.work.circle && work?.circle && item.work.circle === work.circle)
      .slice(0, 5)
  }, [relatedWorks, work])

  const franchise = useMemo(() => {
    return detectFranchiseSeries(work, allWorks)
  }, [work, allWorks])

  if (!work) {
    return (
      <div className="empty-panel">
        <p>选择一个作品查看相关推荐</p>
      </div>
    )
  }

  if (relatedWorks.length === 0 && !franchise) {
    return (
      <div className="related-panel">
        <StateView type="empty" iconType="search" size="sm" title="暂无相关作品" description="尝试为作品添加更多标签和CV信息" />
      </div>
    )
  }

  return (
    <div className="related-panel">
      {franchise && (
        <div className="related-section franchise-section">
          <h4 className="related-section-title">
            <span className="related-section-icon">📚</span>
            同系列脉络 · {franchise.franchiseName}
            <span className="related-section-count">{franchise.totalParts} 部</span>
          </h4>
          <div className="franchise-series-strip">
            {franchise.seriesList.map((item) => (
              <div
                key={item.work.id}
                className={`franchise-part-chip ${item.isCurrent ? 'active' : ''}`}
                onClick={() => !item.isCurrent && onSelectWork?.(item.work)}
                title={item.work.title || item.work.folderName}
              >
                <span className="part-num">第 {item.index} 部</span>
                <span className="part-title">{item.work.title || item.work.folderName}</span>
                {item.isCurrent && <span className="part-current-badge">正在收听</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="related-section">
        <h4 className="related-section-title">
          <span className="related-section-icon">✨</span>
          相似推荐
          <span className="related-section-count">{relatedWorks.length} 个</span>
        </h4>
        <div className="related-list">
          {relatedWorks.slice(0, 8).map(({ work: w, score }) => (
            <div
              key={w.id}
              className="related-item"
              onClick={() => onSelectWork?.(w)}
              title={w.title || w.folderName}
            >
              <div className="related-cover">
                {w.cover ? (
                  <img src={w.cover} alt="" loading="lazy" decoding="async" />
                ) : (
                  <div className="related-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>
                )}
                <div className="related-score" style={{ opacity: Math.min(1, score / 80) }}>
                  {Math.round(score)}%
                </div>
              </div>
              <div className="related-info">
                <div className="related-title">{w.title || w.folderName}</div>
                <div className="related-meta">
                  {w.cvs && w.cvs.length > 0 && (
                    <span className="related-cv">{w.cvs.slice(0, 2).join('、')}</span>
                  )}
                  {w.circle && <span className="related-circle">{w.circle}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {topByTags.length > 0 && (
        <div className="related-section">
          <h4 className="related-section-title">
            <span className="related-section-icon">🏷️</span>
            同标签作品
          </h4>
          <div className="related-mini-list">
            {topByTags.map(({ work: w }) => (
              <div
                key={w.id}
                className="related-mini-item"
                onClick={() => onSelectWork?.(w)}
                title={w.title || w.folderName}
              >
                <span className="related-mini-title">{w.title || w.folderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topByCV.length > 0 && (
        <div className="related-section">
          <h4 className="related-section-title">
            <span className="related-section-icon">🎙️</span>
            同 CV 作品
          </h4>
          <div className="related-mini-list">
            {topByCV.map(({ work: w }) => (
              <div
                key={w.id}
                className="related-mini-item"
                onClick={() => onSelectWork?.(w)}
                title={w.title || w.folderName}
              >
                <span className="related-mini-title">{w.title || w.folderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topByCircle.length > 0 && (
        <div className="related-section">
          <h4 className="related-section-title">
            <span className="related-section-icon">🎪</span>
            同社团作品
          </h4>
          <div className="related-mini-list">
            {topByCircle.map(({ work: w }) => (
              <div
                key={w.id}
                className="related-mini-item"
                onClick={() => onSelectWork?.(w)}
                title={w.title || w.folderName}
              >
                <span className="related-mini-title">{w.title || w.folderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

const PlaylistsPanel = memo(function PlaylistsPanel({ work, currentAudio, onAddToPlaylist, onToast }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creating, setCreating] = useState(false)

  const loadPlaylists = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.playlistGetAll()
      setPlaylists(data || [])
      if (data && data.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(data[0].id)
      }
    } catch (e) {
      console.error('Failed to load playlists:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedPlaylistId])

  useEffect(() => {
    loadPlaylists()
  }, [loadPlaylists])

  const handleCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await window.electronAPI.playlistCreate(name)
      setPlaylists((prev) => [...prev, created])
      setSelectedPlaylistId(created.id)
      setNewPlaylistName('')
      setShowCreate(false)
      onToast?.('播放列表创建成功', 'success')
    } catch (e) {
      onToast?.('创建失败：' + (e.message || ''), 'error')
    } finally {
      setCreating(false)
    }
  }, [newPlaylistName, onToast])

  const handleAddCurrentTrack = useCallback(async (playlistId) => {
    if (!currentAudio || !work) return
    try {
      const item = {
        workId: work.id || '',
        workTitle: work.title || work.folderName || '',
        workCover: work.cover || '',
        audioPath: currentAudio.path,
        audioName: currentAudio.name || '',
        isOnline: !!currentAudio.isOnline,
      }
      await window.electronAPI.playlistAddItem(playlistId, item)
      loadPlaylists()
      onToast?.('已添加到播放列表', 'success')
    } catch (e) {
      onToast?.('添加失败：' + (e.message || ''), 'error')
    }
  }, [currentAudio, work, loadPlaylists, onToast])

  const handleAddAllTracks = useCallback(async (playlistId) => {
    if (!work || !work.audioFiles || work.audioFiles.length === 0) return
    try {
      let added = 0
      for (const audio of work.audioFiles) {
        const item = {
          workId: work.id || '',
          workTitle: work.title || work.folderName || '',
          workCover: work.cover || '',
          audioPath: audio.path,
          audioName: audio.name || '',
          isOnline: !!audio.isOnline,
        }
        await window.electronAPI.playlistAddItem(playlistId, item)
        added++
      }
      loadPlaylists()
      onToast?.(`已添加 ${added} 首曲目`, 'success')
    } catch (e) {
      onToast?.('添加失败：' + (e.message || ''), 'error')
    }
  }, [work, loadPlaylists, onToast])

  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId)
  }, [playlists, selectedPlaylistId])

  if (!work) {
    return (
      <div className="empty-panel">
        <p>选择一个作品管理播放列表</p>
      </div>
    )
  }

  return (
    <div className="playlists-panel">
      <div className="playlists-header">
        <h4 className="playlists-title">我的播放列表</h4>
        <button
          className="playlists-new-btn"
          onClick={() => setShowCreate(true)}
          title="新建播放列表"
        >
          + 新建
        </button>
      </div>

      {showCreate && (
        <div className="playlists-create-row">
          <input
            type="text"
            className="playlists-name-input"
            placeholder="播放列表名称"
            value={newPlaylistName}
            autoFocus
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreatePlaylist()
              else if (e.key === 'Escape') {
                setShowCreate(false)
                setNewPlaylistName('')
              }
            }}
            maxLength={50}
          />
          <button
            className="btn-primary btn-sm"
            onClick={handleCreatePlaylist}
            disabled={creating || !newPlaylistName.trim()}
          >
            {creating ? '...' : '创建'}
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              setShowCreate(false)
              setNewPlaylistName('')
            }}
          >
            取消
          </button>
        </div>
      )}

      {loading ? (
        <div className="playlists-loading">
          <StateView type="loading" size="sm" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="playlists-empty">
          <StateView type="empty" iconType="playlist" size="sm" title="暂无播放列表" description="创建一个播放列表来组织喜欢的曲目" />
        </div>
      ) : (
        <div className="playlists-list">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={`playlist-list-item ${selectedPlaylistId === pl.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlaylistId(pl.id)}
            >
              <div className="playlist-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </div>
              <div className="playlist-item-info">
                <div className="playlist-item-name">{pl.name}</div>
                <div className="playlist-item-count">{(pl.items || []).length} 首</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPlaylist && (
        <div className="playlists-actions">
          <div className="playlists-actions-title">添加到「{selectedPlaylist.name}」</div>
          <div className="playlists-action-buttons">
            <button
              className="btn-primary btn-sm"
              onClick={() => handleAddCurrentTrack(selectedPlaylist.id)}
              disabled={!currentAudio}
            >
              添加当前曲目
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => handleAddAllTracks(selectedPlaylist.id)}
              disabled={!work?.audioFiles?.length}
            >
              添加全部曲目
            </button>
          </div>
        </div>
      )}

      {selectedPlaylist && selectedPlaylist.items && selectedPlaylist.items.length > 0 && (
        <div className="playlists-preview">
          <div className="playlists-preview-title">
            列表预览（前 10 首）
          </div>
          <div className="playlists-preview-list">
            {selectedPlaylist.items.slice(0, 10).map((item, idx) => (
              <div key={idx} className="playlist-preview-item">
                <span className="playlist-preview-index">{idx + 1}</span>
                <span className="playlist-preview-name" title={item.audioName}>
                  {item.audioName}
                </span>
              </div>
            ))}
            {selectedPlaylist.items.length > 10 && (
              <div className="playlist-preview-more">
                还有 {selectedPlaylist.items.length - 10} 首...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

const RightTabBar = memo(function RightTabBar({
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
  subtitleStyleSettings,
  bookmarks,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  currentAudio,
  allWorks,
  onSelectWork,
  onAddToPlaylist,
  onToast,
  // 画集相关
  galleryImages = [],
  loadingGallery = false,
  onOpenLightbox,
  // 章节相关
  chapters = [],
  activeChapter = null,
  duration = 0,
  onSeekToChapter,
  onAddCustomChapter,
  onDeleteCustomChapter,
  // 双耳声场相关
  audioElement = null,
  // 音声手账与感官印记
  chronicleData = {},
  stamps = [],
  onUpdateChronicle,
  onOpenStampModal,
  onOpenPosterModal,
  onSeekToStamp,
  onDeleteStamp,
  // 台本剧场相关
  scriptFiles = [],
  selectedScriptPath,
  onSelectScriptPath,
  scriptLines = [],
  rawScriptText = '',
  loadingScript = false,
  theaterMode = true,
  onToggleTheaterMode,
  autoCruise = true,
  onToggleAutoCruise,
  scriptFontSize = 14,
  onChangeScriptFontSize,
  activeScriptLineIndex = -1,
  isUserScrollingScript = false,
  onUserScrollScript,
  onResumeScriptSync,
  onImportScript,
  onQuoteToStamp,
  onCopyScriptLine,
}) {
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'subtitles', label: 'Subtitles' },
    { id: 'script', label: `Script${scriptFiles && scriptFiles.length > 0 ? ` (${scriptFiles.length})` : ''}` },
    { id: 'chapters', label: `Chapters${chapters && chapters.length > 0 ? ` (${chapters.length})` : ''}` },
    { id: 'compass', label: 'Compass' },
    { id: 'gallery', label: `Gallery${galleryImages && galleryImages.length > 0 ? ` (${galleryImages.length})` : ''}` },
    { id: 'chronicle', label: `Chronicle${stamps && stamps.length > 0 ? ` (${stamps.length})` : ''}` },
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
                subtitleStyleSettings={subtitleStyleSettings}
              />
            )}
            {!work && (
              <div className="empty-panel">
                <p>选择一个作品查看字幕</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'script' && (
          <div className="script-tab-panel" style={{ height: '100%', overflow: 'hidden' }}>
            <VoiceScriptPanel
              work={work}
              scriptFiles={scriptFiles}
              selectedScriptPath={selectedScriptPath}
              onSelectScriptPath={onSelectScriptPath}
              scriptLines={scriptLines}
              rawText={rawScriptText}
              loadingScript={loadingScript}
              theaterMode={theaterMode}
              onToggleTheaterMode={onToggleTheaterMode}
              autoCruise={autoCruise}
              onToggleAutoCruise={onToggleAutoCruise}
              fontSize={scriptFontSize}
              onChangeFontSize={onChangeScriptFontSize}
              activeLineIndex={activeScriptLineIndex}
              isUserScrolling={isUserScrollingScript}
              onUserScroll={onUserScrollScript}
              onResumeSync={onResumeScriptSync}
              onImportScript={onImportScript}
              onQuoteToStamp={onQuoteToStamp}
              onCopyLine={onCopyScriptLine}
            />
          </div>
        )}
        {activeTab === 'chapters' && (
          <div className="chapters-tab-panel">
            <ChapterList
              chapters={chapters}
              activeChapter={activeChapter}
              currentTime={currentTime}
              duration={duration}
              onSeekToChapter={onSeekToChapter}
              onAddCustomChapter={onAddCustomChapter}
              onDeleteCustomChapter={onDeleteCustomChapter}
            />
          </div>
        )}
        {activeTab === 'compass' && (
          <div className="compass-tab-panel" style={{ padding: '8px' }}>
            <SoundstageCompass audioElement={audioElement} />
          </div>
        )}
        {activeTab === 'gallery' && (
          <div className="gallery-tab-panel">
            <WorkGallery
              images={galleryImages}
              isLoading={loadingGallery}
              onImageClick={onOpenLightbox}
            />
          </div>
        )}
        {activeTab === 'chronicle' && (
          <div className="chronicle-tab-panel" style={{ height: '100%', overflow: 'hidden' }}>
            <VoiceChroniclePanel
              work={work}
              currentAudio={currentAudio}
              currentTime={currentTime}
              chronicleData={chronicleData}
              stamps={stamps}
              onUpdateChronicle={onUpdateChronicle}
              onOpenStampModal={onOpenStampModal}
              onOpenPosterModal={onOpenPosterModal}
              onSeekToStamp={onSeekToStamp}
              onDeleteStamp={onDeleteStamp}
              onToast={onToast}
            />
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
          <RelatedPanel
            work={work}
            allWorks={allWorks}
            onSelectWork={onSelectWork}
            onToast={onToast}
          />
        )}
        {activeTab === 'playlists' && (
          <PlaylistsPanel
            work={work}
            currentAudio={currentAudio}
            onAddToPlaylist={onAddToPlaylist}
            onToast={onToast}
          />
        )}
      </div>
    </div>
  )
})

export default RightTabBar
