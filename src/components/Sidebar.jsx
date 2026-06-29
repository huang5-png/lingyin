import { useState, useMemo } from 'react'
import './Sidebar.css'

export default function Sidebar({ works, recentWorks, onSelectRecentWork, selectedWorkId, onSelectWork, onAddFolder, onAddMediaLibrary, cvFilter, circleFilter, onFilterChange, allCVs, allCircles, onOpenSettings, onDeleteWork, viewMode, onViewModeChange, onTranslate, onTranslateBatch, getTranslatedText, isTranslated, isTranslating, isAnyTranslating }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showRecent, setShowRecent] = useState(true)

  const filteredWorks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return works.filter((work) => {
      if (!query) return true

      const title = (work.title || work.folderName || '').toLowerCase()
      const rjCode = (work.rjCode || '').toLowerCase()
      const cvs = (work.cvs || []).join(' ').toLowerCase()
      const circle = (work.circle || '').toLowerCase()
      const folderName = (work.folderName || '').toLowerCase()

      return title.includes(query) || rjCode.includes(query) || cvs.includes(circle) || circle.includes(query) || folderName.includes(query)
    })
  }, [works, searchQuery])

  // Compute the max tag count across visible works so all rows in list-view
  // adopt a uniform height (the tallest row dictates the row height).
  const maxTagCount = useMemo(() => {
    if (viewMode !== 'list') return 0
    let max = 0
    for (const w of filteredWorks) {
      const c = (w.tags && w.tags.length) || 0
      if (c > max) max = c
    }
    return max
  }, [filteredWorks, viewMode])

  // Derive a CSS variable for the uniform row min-height.
  // Base 56px cover + 8px padding * 2; each tag row ~20px; cap at 4 rows.
  const rowMinHeight = useMemo(() => {
    if (viewMode !== 'list' || maxTagCount === 0) return null
    // Estimate how many wrap-lines the tags need given a ~240px wide column.
    // Conservative: 3 tags per line. Min 1 line.
    const tagRows = Math.max(1, Math.ceil(maxTagCount / 3))
    const cover = 56
    const padding = 16
    const titleBlock = 36
    const tagBlock = Math.min(tagRows, 4) * 20
    return cover + padding + titleBlock + tagBlock
  }, [maxTagCount, viewMode])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="header-top">
          <div className="library-title-group">
            <h1 className="app-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <span>我的库</span>
            </h1>
            <p className="library-subtitle">本地音声作品库</p>
          </div>
          <div className="header-actions">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => onViewModeChange?.('grid')}
                title="卡片视图"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => onViewModeChange?.('list')}
                title="列表视图"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <button className="settings-btn-icon" onClick={onOpenSettings} title="设置">
              <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            {onTranslateBatch && (
              <button
                className={`settings-btn-icon translate-all-btn ${isAnyTranslating ? 'translating' : ''}`}
                onClick={() => {
                  const texts = []
                  filteredWorks.forEach(w => {
                    if (w.title) texts.push(w.title)
                    else if (w.folderName) texts.push(w.folderName)
                  })
                  if (texts.length === 0) return
                  onTranslateBatch(texts)
                }}
                title="翻译所有作品标题"
                disabled={isAnyTranslating}
              >
                {isAnyTranslating ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7"/><path d="M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/></svg>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="add-buttons-row">
          <button className="add-btn" onClick={onAddFolder}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            添加文件夹
          </button>
          <button className="add-media-library-btn" onClick={onAddMediaLibrary}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            添加媒体库
          </button>
        </div>
      </div>

      <div className="sidebar-filters">
        <div className="filter-group search-group">
          <input
            type="text"
            className="search-input"
            placeholder="搜索作品名称 / RJ号 / CV / 社团..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>CV 筛选</label>
          <select value={cvFilter} onChange={(e) => onFilterChange('cv', e.target.value)}>
            <option value="">全部 CV</option>
            {allCVs.map((cv) => (
              <option key={cv} value={cv}>
                {cv}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>社团筛选</label>
          <select value={circleFilter} onChange={(e) => onFilterChange('circle', e.target.value)}>
            <option value="">全部社团</option>
            {allCircles.map((circle) => (
              <option key={circle} value={circle}>
                {circle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {recentWorks && recentWorks.length > 0 && (
        <div className="recent-plays-section">
          <div className="recent-plays-header" onClick={() => setShowRecent((v) => !v)}>
            <span className="recent-plays-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              最近播放
            </span>
            <span className="recent-plays-toggle">{showRecent ? '▲' : '▼'}</span>
          </div>
          {showRecent && (
            <div className="recent-plays-list">
              {recentWorks.map((rw) => (
                <div
                  key={rw.workId}
                  className={`recent-play-item ${selectedWorkId === rw.workId ? 'active' : ''}`}
                  onClick={() => onSelectRecentWork(rw)}
                  title={rw.title}
                >
                  {rw.cover ? (
                    <img src={rw.cover} alt="" loading="lazy" decoding="async" className="recent-play-cover" />
                  ) : (
                    <div className="recent-play-cover-placeholder">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                  )}
                  <span className="recent-play-title">{rw.title || '未知作品'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`work-list ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`} style={viewMode === 'list' && rowMinHeight ? { '--row-min-height': `${rowMinHeight}px` } : undefined}>
        {filteredWorks.length === 0 ? (
          <div className="empty-hint">
            <p>{searchQuery ? '没有匹配的作品' : '还没有添加作品'}</p>
            <p className="hint-text">{searchQuery ? '尝试其他关键词' : '点击上方按钮添加文件夹'}</p>
          </div>
        ) : (
          filteredWorks.map((work) => (
            <div
              key={work.id}
              className={`work-item ${viewMode === 'grid' ? 'card' : 'row'} ${selectedWorkId === work.id ? 'active' : ''}`}
              onClick={(e) => onSelectWork(work, e)}
            >
              {viewMode === 'grid' ? (
                <>
                  <div className="card-cover">
                    {work.cover ? (
                      <img src={work.cover} alt="" data-work-cover data-work-id={work.id} loading="lazy" decoding="async" />
                    ) : (
                      <div className="card-cover-placeholder">
                        <svg className="cover-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V5l12-2v13"/>
                          <circle cx="6" cy="18" r="3"/>
                          <circle cx="18" cy="16" r="3"/>
                        </svg>
                      </div>
                    )}
                    <div className="card-overlay">
                      {work.rating > 0 && <span className="card-rating"><svg className="star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> {work.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <div className="card-info">
                    <div className="card-title">{getTranslatedText?.(work.title || work.folderName) || work.title || work.folderName}</div>
                    <div className="card-meta">
                      {work.cvs && work.cvs.length > 0 && (
                        <span className="card-circle">{work.cvs.slice(0, 2).map(cv => getTranslatedText?.(cv) || cv).join('、')}</span>
                      )}
                    </div>
                    {work.tags && work.tags.length > 0 && (
                      <div className="card-tags">
                        {work.tags.map((tag, i) => (
                          <span key={i} className="card-tag">{getTranslatedText?.(tag) || tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="work-delete-btn card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteWork(work)
                    }}
                    title="删除"
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  {work.cover ? (
                    <img src={work.cover} alt="" className="work-cover" data-work-cover data-work-id={work.id} loading="lazy" decoding="async" />
                  ) : (
                    <div className="work-cover-placeholder">
                      <svg className="cover-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                  )}
                  <div className="work-info">
                    <div className="work-title">{getTranslatedText?.(work.title || work.folderName) || work.title || work.folderName}</div>
                    <div className="work-meta">
                      {work.cvs && work.cvs.length > 0 && <span className="work-cv">{work.cvs.slice(0, 2).map(cv => getTranslatedText?.(cv) || cv).join('、')}</span>}
                      {work.rating > 0 && <span className="work-rating"><svg className="star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> {work.rating}</span>}
                      {work.circle && <span className="work-circle-name">{getTranslatedText?.(work.circle) || work.circle}</span>}
                    </div>
                    {work.tags && work.tags.length > 0 && (
                      <div className="work-tags-row">
                        {work.tags.map((tag, i) => (
                          <span key={i} className="work-tag-chip">{getTranslatedText?.(tag) || tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="work-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteWork(work)
                    }}
                    title="删除"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button
          className="log-btn"
          onClick={async () => {
            await window.electronAPI.openLogFolder()
          }}
        >
          打开日志文件夹
        </button>
      </div>
    </div>
  )
}