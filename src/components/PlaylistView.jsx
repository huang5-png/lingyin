import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import './PlaylistView.css'
import StateView from './StateView'

// 智能播放列表图标映射
const SMART_ICONS = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  'play-circle': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  shuffle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  ),
}

// 骨架屏播放列表条目
const SkeletonPlaylistItem = memo(() => {
  return (
    <div className="playlist-list-item skeleton-playlist-item">
      <div className="skeleton-line skeleton-playlist-name" />
      <div className="skeleton-line skeleton-playlist-count" />
    </div>
  )
})
SkeletonPlaylistItem.displayName = 'SkeletonPlaylistItem'

// 骨架屏曲目行
const SkeletonPlaylistRow = memo(({ index }) => {
  return (
    <div className="playlist-item-row skeleton-playlist-row">
      <div className="playlist-item-grip">
        <div className="skeleton-line skeleton-grip" />
      </div>
      <div className="playlist-item-index">
        <div className="skeleton-line skeleton-index" />
      </div>
      <div className="playlist-item-cover">
        <div className="skeleton-cover skeleton-cover-sm" />
      </div>
      <div className="playlist-item-info">
        <div className="skeleton-line skeleton-item-name" />
        <div className="skeleton-line skeleton-item-work" />
      </div>
      <div className="playlist-item-actions">
        <div className="skeleton-line skeleton-action-btn" />
        <div className="skeleton-line skeleton-action-btn" />
        <div className="skeleton-line skeleton-action-btn" />
      </div>
    </div>
  )
})
SkeletonPlaylistRow.displayName = 'SkeletonPlaylistRow'

export default function PlaylistView({ onPlayItem, onNavigateToWork, onToast }) {
  const [playlists, setPlaylists] = useState([])
  const [smartPlaylists, setSmartPlaylists] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedSmartId, setSelectedSmartId] = useState(null)
  const [smartItems, setSmartItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSmart, setLoadingSmart] = useState(false)
  const [creatingName, setCreatingName] = useState('')
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingItemId, setDraggingItemId] = useState(null)
  const [dragOverItemId, setDragOverItemId] = useState(null)
  const createInputRef = useRef(null)
  const renameInputRef = useRef(null)

  const isSmartSelected = !!selectedSmartId

  const refresh = useCallback(async () => {
    try {
      const [playlistData, smartData] = await Promise.all([
        window.electronAPI.playlistGetAll(),
        window.electronAPI.smartPlaylistGetAll(),
      ])
      setPlaylists(playlistData || [])
      setSmartPlaylists(smartData || [])
      if (!selectedId && !selectedSmartId) {
        if (smartData && smartData.length > 0) {
          setSelectedSmartId(smartData[0].id)
        } else if (playlistData && playlistData.length > 0) {
          setSelectedId(playlistData[0].id)
        }
      }
    } catch (e) {
      console.error('Failed to load playlists:', e)
      onToast?.('加载播放列表失败：' + (e.message || ''), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedId, selectedSmartId, onToast])

  const loadSmartItems = useCallback(async (smartId) => {
    setLoadingSmart(true)
    try {
      const items = await window.electronAPI.smartPlaylistGetItems(smartId, 200)
      setSmartItems(items || [])
    } catch (e) {
      console.error('Failed to load smart playlist items:', e)
      setSmartItems([])
    } finally {
      setLoadingSmart(false)
    }
  }, [])

  const handleSelectSmart = useCallback((smartId) => {
    setSelectedSmartId(smartId)
    setSelectedId(null)
    loadSmartItems(smartId)
  }, [loadSmartItems])

  const handleRefreshSmart = useCallback(() => {
    if (selectedSmartId) {
      loadSmartItems(selectedSmartId)
    }
  }, [selectedSmartId, loadSmartItems])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (showCreateInput && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [showCreateInput])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const selectedPlaylist = useMemo(() => {
    if (selectedSmartId) {
      const sp = smartPlaylists.find((p) => p.id === selectedSmartId)
      if (sp) {
        return {
          ...sp,
          items: smartItems,
          isSmart: true,
        }
      }
      return null
    }
    return playlists.find((p) => p.id === selectedId) || null
  }, [playlists, selectedId, smartPlaylists, selectedSmartId, smartItems])

  const handleCreate = useCallback(async () => {
    const name = (creatingName || '').trim()
    if (!name) {
      setShowCreateInput(false)
      setCreatingName('')
      return
    }
    try {
      const created = await window.electronAPI.playlistCreate(name)
      setPlaylists((prev) => [...prev, created])
      setSelectedId(created.id)
      setSelectedSmartId(null)
      setShowCreateInput(false)
      setCreatingName('')
      onToast?.(`已创建播放列表「${created.name}」`, 'success')
    } catch (e) {
      onToast?.('创建播放列表失败：' + (e.message || ''), 'error')
    }
  }, [creatingName, onToast])

  const handleSelectNormal = useCallback((pl) => {
    setSelectedId(pl.id)
    setSelectedSmartId(null)
  }, [])

  const handleStartRename = useCallback((pl) => {
    setRenamingId(pl.id)
    setRenameValue(pl.name)
  }, [])

  const handleConfirmRename = useCallback(async () => {
    if (!renamingId) return
    const name = (renameValue || '').trim()
    if (!name) {
      setRenamingId(null)
      setRenameValue('')
      return
    }
    try {
      const updated = await window.electronAPI.playlistRename(renamingId, name)
      if (updated) {
        setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      }
    } catch (e) {
      onToast?.('重命名失败：' + (e.message || ''), 'error')
    } finally {
      setRenamingId(null)
      setRenameValue('')
    }
  }, [renamingId, renameValue, onToast])

  const handleDelete = useCallback(async (pl) => {
    const confirmed = window.confirm(`确定要删除播放列表「${pl.name}」吗？\n（仅删除播放列表，不会删除原音频文件）`)
    if (!confirmed) return
    try {
      await window.electronAPI.playlistDelete(pl.id)
      setPlaylists((prev) => prev.filter((p) => p.id !== pl.id))
      if (selectedId === pl.id) {
        setSelectedId(null)
      }
      onToast?.('已删除播放列表', 'success')
    } catch (e) {
      onToast?.('删除失败：' + (e.message || ''), 'error')
    }
  }, [selectedId, onToast])

  const handleRemoveItem = useCallback(async (itemId) => {
    if (!selectedPlaylist) return
    try {
      const updated = await window.electronAPI.playlistRemoveItem(selectedPlaylist.id, itemId)
      if (updated) {
        setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      }
    } catch (e) {
      onToast?.('移除曲目失败：' + (e.message || ''), 'error')
    }
  }, [selectedPlaylist, onToast])

  const handleClearAll = useCallback(async () => {
    if (!selectedPlaylist || !selectedPlaylist.items || selectedPlaylist.items.length === 0) return
    const confirmed = window.confirm(`确定要清空播放列表「${selectedPlaylist.name}」中的所有曲目吗？`)
    if (!confirmed) return
    try {
      const updated = await window.electronAPI.playlistClear(selectedPlaylist.id)
      if (updated) {
        setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        onToast?.('已清空播放列表', 'success')
      }
    } catch (e) {
      onToast?.('清空失败：' + (e.message || ''), 'error')
    }
  }, [selectedPlaylist, onToast])

  const handlePlayItem = useCallback((item) => {
    onPlayItem?.(item)
  }, [onPlayItem])

  const handleGotoWork = useCallback((item) => {
    onNavigateToWork?.(item)
  }, [onNavigateToWork])

  // ===== 拖拽排序 =====
  const handleDragStart = useCallback((e, itemId) => {
    setDraggingItemId(itemId)
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', itemId)
    } catch (err) {}
  }, [])

  const handleDragOver = useCallback((e, itemId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverItemId !== itemId) setDragOverItemId(itemId)
  }, [dragOverItemId])

  const handleDragLeave = useCallback(() => {
    setDragOverItemId(null)
  }, [])

  const handleDrop = useCallback(async (e, targetItemId) => {
    e.preventDefault()
    const sourceItemId = draggingItemId
    setDraggingItemId(null)
    setDragOverItemId(null)
    if (!selectedPlaylist) return
    if (!sourceItemId || sourceItemId === targetItemId) return

    const items = selectedPlaylist.items || []
    const fromIdx = items.findIndex((it) => it.id === sourceItemId)
    const toIdx = items.findIndex((it) => it.id === targetItemId)
    if (fromIdx < 0 || toIdx < 0) return

    const newItems = [...items]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    const newIds = newItems.map((it) => it.id)

    // 乐观更新
    setPlaylists((prev) => prev.map((p) => {
      if (p.id !== selectedPlaylist.id) return p
      return { ...p, items: newItems, updatedAt: Date.now() }
    }))

    try {
      await window.electronAPI.playlistReorderItems(selectedPlaylist.id, newIds)
    } catch (err) {
      onToast?.('排序保存失败，已回滚', 'error')
      refresh()
    }
  }, [draggingItemId, selectedPlaylist, onToast, refresh])

  const handleDragEnd = useCallback(() => {
    setDraggingItemId(null)
    setDragOverItemId(null)
  }, [])

  return (
    <div className="playlist-view-wrapper">
      <div className="playlist-sidebar">
        <div className="playlist-sidebar-header">
          <div className="playlist-sidebar-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <h2>播放列表</h2>
          </div>
          <button
            className="playlist-new-btn"
            onClick={() => setShowCreateInput(true)}
            title="新建播放列表"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {showCreateInput && (
          <div className="playlist-create-input-row">
            <input
              ref={createInputRef}
              type="text"
              className="playlist-name-input"
              placeholder="播放列表名称"
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                else if (e.key === 'Escape') { setShowCreateInput(false); setCreatingName('') }
              }}
              onBlur={() => handleCreate()}
              maxLength={50}
            />
          </div>
        )}

        <div className="playlist-list">
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonPlaylistItem key={i} />
              ))}
            </>
          ) : (
            <>
              {/* 智能播放列表分组 */}
              {smartPlaylists.length > 0 && (
                <div className="playlist-group">
                  <div className="playlist-group-title">智能播放列表</div>
                  {smartPlaylists.map((sp) => (
                    <div
                      key={sp.id}
                      className={`playlist-list-item smart-playlist-item ${selectedSmartId === sp.id ? 'active' : ''}`}
                      onClick={() => handleSelectSmart(sp.id)}
                      title={sp.description || ''}
                    >
                      <div className="smart-playlist-icon">
                        {SMART_ICONS[sp.icon] || SMART_ICONS.clock}
                      </div>
                      <div className="playlist-list-item-name">{sp.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 我的播放列表分组 */}
              <div className="playlist-group">
                <div className="playlist-group-title">
                  我的播放列表
                  <button
                    className="playlist-group-add-btn"
                    onClick={(e) => { e.stopPropagation(); setShowCreateInput(true) }}
                    title="新建播放列表"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>

                {showCreateInput && (
                  <div className="playlist-create-input-row">
                    <input
                      ref={createInputRef}
                      type="text"
                      className="playlist-name-input"
                      placeholder="播放列表名称"
                      value={creatingName}
                      onChange={(e) => setCreatingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                        else if (e.key === 'Escape') { setShowCreateInput(false); setCreatingName('') }
                      }}
                      onBlur={() => handleCreate()}
                      maxLength={50}
                    />
                  </div>
                )}

                {playlists.length === 0 ? (
                  <div className="playlist-empty-mini">暂无自定义播放列表</div>
                ) : (
                  playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className={`playlist-list-item ${selectedId === pl.id ? 'active' : ''}`}
                      onClick={() => handleSelectNormal(pl)}
                      onDoubleClick={() => handleStartRename(pl)}
                      title="单击选中，双击重命名"
                    >
                      {renamingId === pl.id ? (
                        <input
                          ref={renameInputRef}
                          type="text"
                          className="playlist-name-input inline"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename()
                            else if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                          }}
                          onBlur={() => handleConfirmRename()}
                          onClick={(e) => e.stopPropagation()}
                          maxLength={50}
                        />
                      ) : (
                        <>
                          <div className="playlist-list-item-name">{pl.name}</div>
                          <div className="playlist-list-item-count">{(pl.items || []).length}</div>
                          <button
                            className="playlist-list-item-del"
                            title="删除播放列表"
                            onClick={(e) => { e.stopPropagation(); handleDelete(pl) }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="playlist-detail">
        {!selectedPlaylist ? (
          <StateView
            type="empty"
            iconType="playlist"
            title={playlists.length === 0 ? '创建你的第一个播放列表' : '选择一个播放列表'}
            description="在曲目列表中点击 + 即可加入播放列表"
          />
        ) : (
          <>
            <div className="playlist-detail-header">
              <div className="playlist-detail-header-left">
                <div className="playlist-detail-title-row">
                  <h2 className="playlist-detail-title">
                    {selectedPlaylist.isSmart && (
                      <span className="smart-playlist-badge">智能</span>
                    )}
                    {selectedPlaylist.name}
                  </h2>
                  <span className="playlist-detail-count">
                    {loadingSmart && selectedSmartId ? '加载中...' : `${(selectedPlaylist.items || []).length} 首`}
                  </span>
                </div>
                {selectedPlaylist.description && (
                  <div className="playlist-detail-desc">{selectedPlaylist.description}</div>
                )}
              </div>
              <div className="playlist-detail-actions">
                {selectedPlaylist.isSmart ? (
                  <button
                    className="playlist-action-btn"
                    onClick={() => handleSelectSmart(selectedPlaylist.id, true)}
                    disabled={loadingSmart}
                    title="刷新列表"
                  >
                    {loadingSmart ? '刷新中...' : '刷新'}
                  </button>
                ) : (
                  <button
                    className="playlist-action-btn"
                    onClick={handleClearAll}
                    disabled={!selectedPlaylist.items || selectedPlaylist.items.length === 0}
                    title="清空"
                  >
                    清空
                  </button>
                )}
                <button
                  className="playlist-action-btn primary"
                  onClick={() => {
                    const items = selectedPlaylist.items || []
                    if (items.length > 0) handlePlayItem(items[0])
                  }}
                  disabled={!selectedPlaylist.items || selectedPlaylist.items.length === 0 || loadingSmart}
                  title="从头开始播放"
                >
                  播放全部
                </button>
              </div>
            </div>

            <div className="playlist-items-list">
              {loadingSmart && selectedSmartId ? (
                <div className="playlist-loading">
                  <div className="playlist-loading-spinner"></div>
                  <span>加载中...</span>
                </div>
              ) : (!selectedPlaylist.items || selectedPlaylist.items.length === 0) ? (
                <StateView
                  type="empty"
                  iconType="empty"
                  title={selectedPlaylist.isSmart ? '智能列表暂无内容' : '这个播放列表还是空的'}
                  description={selectedPlaylist.isSmart ? '继续使用聆音，数据会逐步丰富' : '前往「我的库」或「发现」并点击曲目旁的 + 添加'}
                  className="playlist-state-inline"
                />
              ) : (
                selectedPlaylist.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`playlist-item-row ${!selectedPlaylist.isSmart && dragOverItemId === item.id ? 'drag-over' : ''} ${!selectedPlaylist.isSmart && draggingItemId === item.id ? 'dragging' : ''} ${selectedPlaylist.isSmart ? 'smart-item' : ''}`}
                    draggable={!selectedPlaylist.isSmart}
                    onDragStart={!selectedPlaylist.isSmart ? (e) => handleDragStart(e, item.id) : undefined}
                    onDragOver={!selectedPlaylist.isSmart ? (e) => handleDragOver(e, item.id) : undefined}
                    onDragLeave={!selectedPlaylist.isSmart ? handleDragLeave : undefined}
                    onDrop={!selectedPlaylist.isSmart ? (e) => handleDrop(e, item.id) : undefined}
                    onDragEnd={!selectedPlaylist.isSmart ? handleDragEnd : undefined}
                    onDoubleClick={() => handlePlayItem(item)}
                    title="双击播放"
                  >
                    {!selectedPlaylist.isSmart && (
                      <div className="playlist-item-grip" title="拖拽排序">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="6" r="1" />
                          <circle cx="9" cy="12" r="1" />
                          <circle cx="9" cy="18" r="1" />
                          <circle cx="15" cy="6" r="1" />
                          <circle cx="15" cy="12" r="1" />
                          <circle cx="15" cy="18" r="1" />
                        </svg>
                      </div>
                    )}
                    <div className="playlist-item-index">{idx + 1}</div>
                    <div className="playlist-item-cover">
                      {item.workCover ? (
                        <img src={item.workCover} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="playlist-item-cover-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="playlist-item-info">
                      <div className="playlist-item-name">{item.audioName || '未知曲目'}</div>
                      <div className="playlist-item-work">{item.workTitle || '未知作品'}</div>
                    </div>
                    {item.isOnline && <span className="playlist-item-tag">在线</span>}
                    <div className="playlist-item-actions">
                      <button
                        className="playlist-item-btn"
                        onClick={() => handlePlayItem(item)}
                        title="播放"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                      <button
                        className="playlist-item-btn"
                        onClick={() => handleGotoWork(item)}
                        title="跳转到作品"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6" />
                          <path d="M10 14L21 3" />
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        </svg>
                      </button>
                      {!selectedPlaylist.isSmart && (
                        <button
                          className="playlist-item-btn danger"
                          onClick={() => handleRemoveItem(item.id)}
                          title="移除"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
