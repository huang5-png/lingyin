import { useState, useMemo, useCallback, memo } from 'react'
import StateView from './StateView'
import './BookmarksPanel.css'

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

const BookmarksPanel = memo(function BookmarksPanel({
  bookmarks,
  currentTime,
  onSeek,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  work,
  currentAudio,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const audioBookmarks = useMemo(() => {
    if (!work || !currentAudio) return []
    return bookmarks
      .filter(b => b.workId === work.id && b.audioPath === currentAudio.path)
      .sort((a, b) => a.time - b.time)
  }, [bookmarks, work, currentAudio])

  const workBookmarks = useMemo(() => {
    if (!work) return []
    return bookmarks
      .filter(b => b.workId === work.id)
      .sort((a, b) => a.time - b.time)
  }, [bookmarks, work])

  const handleAdd = useCallback(() => {
    if (!work || !currentAudio || !onAddBookmark) return
    onAddBookmark({
      workId: work.id,
      audioPath: currentAudio.path,
      audioName: currentAudio.name || '',
      time: currentTime || 0,
    })
  }, [work, currentAudio, currentTime, onAddBookmark])

  const handleStartEdit = useCallback((bm) => {
    setEditingId(bm.id)
    setEditName(bm.name)
  }, [])

  const handleSaveEdit = useCallback((id) => {
    if (onUpdateBookmark && editName.trim()) {
      onUpdateBookmark(id, { name: editName.trim() })
    }
    setEditingId(null)
    setEditName('')
  }, [editName, onUpdateBookmark])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditName('')
  }, [])

  const handleKeyDown = useCallback((e, id) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [handleSaveEdit, handleCancelEdit])

  if (!work) {
    return (
      <div className="bookmarks-panel">
        <StateView
          iconType="bookmark"
          title="选择一个作品"
          description="选择作品后可以查看和管理书签"
          size="sm"
        />
      </div>
    )
  }

  return (
    <div className="bookmarks-panel">
      <div className="bookmarks-header">
        <h3>书签</h3>
        <button
          className="bookmark-add-btn"
          onClick={handleAdd}
          disabled={!currentAudio}
          title="在当前位置添加书签"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="8" x2="12" y2="14"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
          </svg>
          <span>添加书签</span>
        </button>
      </div>

      {currentAudio && (
        <div className="bookmarks-audio-section">
          <div className="bookmarks-section-title">
            当前音频 ({formatTime(currentTime)})
          </div>
          {audioBookmarks.length === 0 ? (
            <div className="bookmarks-empty-hint">
              当前音频暂无书签，点击上方按钮添加
            </div>
          ) : (
            <div className="bookmarks-list">
              {audioBookmarks.map((bm) => (
                <div key={bm.id} className="bookmark-item">
                  <div
                    className="bookmark-time"
                    onClick={() => onSeek && onSeek(bm.time)}
                    title="点击跳转到书签位置"
                  >
                    {formatTime(bm.time)}
                  </div>
                  {editingId === bm.id ? (
                    <input
                      className="bookmark-name-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, bm.id)}
                      onBlur={() => handleSaveEdit(bm.id)}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="bookmark-name"
                      onClick={() => onSeek && onSeek(bm.time)}
                      onDoubleClick={() => handleStartEdit(bm)}
                      title="双击编辑名称，点击跳转"
                    >
                      {bm.name}
                    </div>
                  )}
                  <div className="bookmark-actions">
                    <button
                      className="bookmark-action-btn"
                      onClick={() => handleStartEdit(bm)}
                      title="编辑书签名称"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      className="bookmark-action-btn delete"
                      onClick={() => onDeleteBookmark && onDeleteBookmark(bm.id)}
                      title="删除书签"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      )}

      {workBookmarks.length > 0 && currentAudio && (
        <div className="bookmarks-work-section">
          <div className="bookmarks-section-title">
            本作品所有书签 ({workBookmarks.length})
          </div>
          <div className="bookmarks-list small">
            {workBookmarks.map((bm) => (
              <div
                key={bm.id}
                className={`bookmark-item small ${bm.audioPath === currentAudio?.path ? 'current' : ''}`}
                onClick={() => onSeek && onSeek(bm.time)}
                title={bm.audioName}
              >
                <div className="bookmark-time-small">
                  {formatTime(bm.time)}
                </div>
                <div className="bookmark-name-small">
                  {bm.name}
                </div>
                {bm.audioName && (
                  <div className="bookmark-audio-name">
                    {bm.audioName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!currentAudio && workBookmarks.length > 0 && (
        <div className="bookmarks-work-section">
          <div className="bookmarks-section-title">
            本作品书签 ({workBookmarks.length})
          </div>
          <div className="bookmarks-list small">
            {workBookmarks.map((bm) => (
              <div
                key={bm.id}
                className="bookmark-item small"
                title={bm.audioName}
              >
                <div className="bookmark-time-small">
                  {formatTime(bm.time)}
                </div>
                <div className="bookmark-name-small">
                  {bm.name}
                </div>
                {bm.audioName && (
                  <div className="bookmark-audio-name">
                    {bm.audioName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {workBookmarks.length === 0 && !currentAudio && (
        <div className="bookmarks-empty-state">
          <StateView
            iconType="bookmark"
            title="暂无书签"
            description="播放音频时点击「添加书签」来标记喜欢的片段"
            size="sm"
          />
        </div>
      )}
    </div>
  )
})

export default BookmarksPanel
