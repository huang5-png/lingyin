import { useState, useMemo, useEffect, useCallback } from 'react'
import './Sidebar.css'
import StateView from './StateView'

export default function Sidebar({ works, selectedWorkId, onSelectWork, onAddFolder, onAddMediaLibrary, cvFilter, circleFilter, onFilterChange, allCVs, allCircles, onOpenSettings, onDeleteWork, viewMode, onViewModeChange, onTranslate, onTranslateBatch, getTranslatedText, isTranslated, isTranslating, isAnyTranslating, showOnlyFavorites, onToggleFavoritesFilter, favoriteIds, onToggleFavorite, folderGroups, activeGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup, onSetWorkGroup, groupWorkCounts }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showGroups, setShowGroups] = useState(true)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [workGroupMenu, setWorkGroupMenu] = useState(null)
  const [workProgressMap, setWorkProgressMap] = useState({})

  // 加载所有作品的播放进度
  const loadWorkProgress = useCallback(async () => {
    if (!works || works.length === 0) return
    try {
      const progressEntries = await Promise.all(
        works.map(async (work) => {
          if (work.isOnline) return { id: work.id, progress: null }
          try {
            const progress = await window.electronAPI.dbGetWorkProgress(work.id)
            return { id: work.id, progress }
          } catch {
            return { id: work.id, progress: null }
          }
        })
      )
      const map = {}
      for (const entry of progressEntries) {
        if (entry.progress) {
          map[entry.id] = entry.progress
        }
      }
      setWorkProgressMap(map)
    } catch (e) {
      console.error('Failed to load work progress:', e)
    }
  }, [works])

  useEffect(() => {
    loadWorkProgress()
  }, [loadWorkProgress])

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
            <button className="header-add-btn" onClick={onAddFolder} title="添加文件夹">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>添加</span>
            </button>
            <button className="header-add-btn" onClick={onAddMediaLibrary} title="添加媒体库">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>媒体库</span>
            </button>
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
        <div className="folder-groups-section">
          <div className="folder-groups-header" onClick={() => setShowGroups(prev => !prev)}>
            <div className="folder-groups-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span>文件夹分组</span>
              <span className="group-count-badge">{folderGroups?.length || 0}</span>
            </div>
            <div className="folder-groups-actions">
              <button
                className="group-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowNewGroupInput(true)
                  setNewGroupName('')
                }}
                title="新建分组"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <svg className={`chevron-icon ${showGroups ? 'expanded' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          {showGroups && (
            <div className="folder-groups-list">
              {showNewGroupInput && (
                <div className="group-item new-group-input">
                  <input
                    type="text"
                    className="group-name-input"
                    placeholder="输入分组名称..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newGroupName.trim()) {
                        onCreateGroup?.(newGroupName.trim())
                        setNewGroupName('')
                        setShowNewGroupInput(false)
                      } else if (e.key === 'Escape') {
                        setShowNewGroupInput(false)
                        setNewGroupName('')
                      }
                    }}
                    autoFocus
                  />
                  <button
                    className="group-cancel-btn"
                    onClick={() => {
                      setShowNewGroupInput(false)
                      setNewGroupName('')
                    }}
                    title="取消"
                  >
                    ×
                  </button>
                </div>
              )}
              <div
                className={`group-item ${activeGroupId === 'all' ? 'active' : ''}`}
                onClick={() => onGroupChange?.('all')}
              >
                <svg className="group-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span className="group-name">全部作品</span>
                <span className="group-count">{groupWorkCounts?.get('all') || 0}</span>
              </div>
              <div
                className={`group-item ${activeGroupId === 'ungrouped' ? 'active' : ''}`}
                onClick={() => onGroupChange?.('ungrouped')}
              >
                <svg className="group-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <span className="group-name">未分组</span>
                <span className="group-count">{groupWorkCounts?.get('ungrouped') || 0}</span>
              </div>
              {folderGroups?.map((group) => (
                <div
                  key={group.id}
                  className={`group-item ${activeGroupId === group.id ? 'active' : ''}`}
                  onClick={() => onGroupChange?.(group.id)}
                >
                  {editingGroupId === group.id ? (
                    <input
                      type="text"
                      className="group-name-input inline-edit"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingGroupName.trim()) {
                          onRenameGroup?.(group.id, editingGroupName.trim())
                          setEditingGroupId(null)
                          setEditingGroupName('')
                        } else if (e.key === 'Escape') {
                          setEditingGroupId(null)
                          setEditingGroupName('')
                        }
                      }}
                      onBlur={() => {
                        if (editingGroupName.trim()) {
                          onRenameGroup?.(group.id, editingGroupName.trim())
                        }
                        setEditingGroupId(null)
                        setEditingGroupName('')
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div
                        className="group-color-dot"
                        style={{ backgroundColor: group.color || 'var(--accent-primary)' }}
                      />
                      <span className="group-name">{group.name}</span>
                      <span className="group-count">{groupWorkCounts?.get(group.id) || 0}</span>
                    </>
                  )}
                  <div className="group-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="group-item-btn"
                      onClick={() => {
                        setEditingGroupId(group.id)
                        setEditingGroupName(group.name)
                      }}
                      title="重命名"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      className="group-item-btn delete"
                      onClick={() => {
                        if (confirm(`确定删除分组「${group.name}」吗？\n分组内的作品将变为未分组。`)) {
                          onDeleteGroup?.(group.id)
                        }
                      }}
                      title="删除分组"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <div className="filter-row">
            <div className="filter-group filter-half">
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
            <div className="filter-group filter-half">
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
          <div className="filter-row">
            <button
              className={`favorites-filter-btn ${showOnlyFavorites ? 'active' : ''}`}
              onClick={onToggleFavoritesFilter}
              title={showOnlyFavorites ? '显示全部作品' : '只显示收藏作品'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={showOnlyFavorites ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{showOnlyFavorites ? '收藏中' : '收藏筛选'}</span>
            </button>
          </div>
        </div>
        </div>

      <div className={`work-list ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`} style={viewMode === 'list' && rowMinHeight ? { '--row-min-height': `${rowMinHeight}px` } : undefined}>
        {filteredWorks.length === 0 ? (
          <StateView
            type="empty"
            iconType={searchQuery ? 'search' : 'music'}
            title={searchQuery ? '没有匹配的作品' : '还没有添加作品'}
            description={searchQuery ? '尝试其他关键词' : '点击上方按钮添加文件夹'}
            className="sidebar-empty"
          />
        ) : (
          filteredWorks.map((work) => (
            <div
              key={work.id}
              className={`work-item ${viewMode === 'grid' ? 'card' : 'row'} ${selectedWorkId === work.id ? 'active' : ''}`}
              onClick={() => onSelectWork(work)}
            >
              {viewMode === 'grid' ? (
                <>
                  <div className="card-cover">
                    {work.cover ? (
                      <img src={work.cover} alt="" loading="lazy" decoding="async" />
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
                    {workProgressMap[work.id] && workProgressMap[work.id].percentage > 0 && (
                      <div className="card-progress">
                        <div className="card-progress-bar" style={{ width: `${workProgressMap[work.id].percentage}%` }} />
                      </div>
                    )}
                  </div>
                  <button
                    className={`work-favorite-btn card-favorite ${favoriteIds?.has(work.id) ? 'favorited' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite?.(work)
                    }}
                    title={favoriteIds?.has(work.id) ? '取消收藏' : '添加收藏'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={favoriteIds?.has(work.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
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
                    <img src={work.cover} alt="" className="work-cover" loading="lazy" decoding="async" />
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
                      {workProgressMap[work.id] && workProgressMap[work.id].percentage > 0 && (
                        <span className="work-progress-pct">{workProgressMap[work.id].percentage}%</span>
                      )}
                    </div>
                    {work.tags && work.tags.length > 0 && (
                      <div className="work-tags-row">
                        {work.tags.map((tag, i) => (
                          <span key={i} className="work-tag-chip">{getTranslatedText?.(tag) || tag}</span>
                        ))}
                      </div>
                    )}
                    {workProgressMap[work.id] && workProgressMap[work.id].percentage > 0 && (
                      <div className="work-progress-bar-container">
                        <div className="work-progress-bar" style={{ width: `${workProgressMap[work.id].percentage}%` }} />
                      </div>
                    )}
                  </div>
                  <button
                    className={`work-favorite-btn list-favorite ${favoriteIds?.has(work.id) ? 'favorited' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite?.(work)
                    }}
                    title={favoriteIds?.has(work.id) ? '取消收藏' : '添加收藏'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={favoriteIds?.has(work.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
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
    </div>
  )
}