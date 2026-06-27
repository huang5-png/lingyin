import { useState, useMemo } from 'react'
import './Sidebar.css'

export default function Sidebar({ works, selectedWorkId, onSelectWork, onAddFolder, onAddMediaLibrary, cvFilter, circleFilter, onFilterChange, allCVs, allCircles, onOpenSettings, onDeleteWork, viewMode, onViewModeChange }) {
  const [searchQuery, setSearchQuery] = useState('')

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
          <h1 className="app-title">🎧 聆音</h1>
          <div className="header-actions">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => onViewModeChange?.('grid')}
                title="卡片视图"
              >
                ▦
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => onViewModeChange?.('list')}
                title="列表视图"
              >
                ☰
              </button>
            </div>
            <button className="settings-btn-icon" onClick={onOpenSettings} title="设置">
              <img src="/icons/icon-settings.png" alt="" className="settings-icon" />
            </button>
          </div>
        </div>
        <button className="add-btn" onClick={onAddFolder}>
          + 添加文件夹
        </button>
        <button className="add-media-library-btn" onClick={onAddMediaLibrary}>
          📚 添加媒体库
        </button>
      </div>

      <div className="sidebar-filters">
        <div className="filter-group search-group">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 搜索作品名称 / RJ号 / CV / 社团..."
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
                      <img src={work.cover} alt="" data-work-cover data-work-id={work.id} />
                    ) : (
                      <div className="card-cover-placeholder">
                        <img src="/icons/icon-music-note.png" alt="" className="cover-placeholder-icon" />
                      </div>
                    )}
                    <div className="card-overlay">
                      {work.rating > 0 && <span className="card-rating"><img src="/icons/icon-star.png" alt="" className="star-icon" /> {work.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <div className="card-info">
                    <div className="card-title">{work.title || work.folderName}</div>
                    <div className="card-meta">
                      {work.cvs && work.cvs.length > 0 && (
                        <span className="card-circle">{work.cvs.slice(0, 2).join('、')}</span>
                      )}
                    </div>
                    {work.tags && work.tags.length > 0 && (
                      <div className="card-tags">
                        {work.tags.map((tag, i) => (
                          <span key={i} className="card-tag">{tag}</span>
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
                    <img src={work.cover} alt="" className="work-cover" data-work-cover data-work-id={work.id} />
                  ) : (
                    <div className="work-cover-placeholder">
                      <img src="/icons/icon-music-note.png" alt="" className="cover-placeholder-icon" />
                    </div>
                  )}
                  <div className="work-info">
                    <div className="work-title">{work.title || work.folderName}</div>
                    <div className="work-meta">
                      {work.cvs && work.cvs.length > 0 && <span className="work-cv">{work.cvs.slice(0, 2).join('、')}</span>}
                      {work.rating > 0 && <span className="work-rating"><img src="/icons/icon-star.png" alt="" className="star-icon" /> {work.rating}</span>}
                      {work.circle && <span className="work-circle-name">{work.circle}</span>}
                    </div>
                    {work.tags && work.tags.length > 0 && (
                      <div className="work-tags-row">
                        {work.tags.map((tag, i) => (
                          <span key={i} className="work-tag-chip">{tag}</span>
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
          📋 打开日志文件夹
        </button>
      </div>
    </div>
  )
}