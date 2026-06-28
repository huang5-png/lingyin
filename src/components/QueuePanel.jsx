import { useState, useCallback, useEffect, useRef } from 'react'
import './QueuePanel.css'

// 循环模式图标
const LoopNoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

const LoopOneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    <text x="12" y="14" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">1</text>
  </svg>
)

const LoopListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const GripIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="18" r="1" />
  </svg>
)

const PlayingIcon = () => (
  <span className="queue-playing-icon">
    <span className="bar bar-1" />
    <span className="bar bar-2" />
    <span className="bar bar-3" />
  </span>
)

const LoopIcon = ({ mode }) => {
  if (mode === 'one') return <LoopOneIcon />
  if (mode === 'list') return <LoopListIcon />
  return <LoopNoneIcon />
}

export default function QueuePanel({
  queue,
  queueIndex,
  loopMode,
  shuffle,
  onPlay,
  onRemove,
  onClear,
  onReorder,
  onToggleLoop,
  onToggleShuffle,
  onClose,
}) {
  const [draggingItemId, setDraggingItemId] = useState(null)
  const [dragOverItemId, setDragOverItemId] = useState(null)
  const listRef = useRef(null)

  // 拖拽排序
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

  const handleDrop = useCallback((e, targetItemId) => {
    e.preventDefault()
    const sourceItemId = draggingItemId
    setDraggingItemId(null)
    setDragOverItemId(null)
    if (!sourceItemId || sourceItemId === targetItemId) return

    const fromIdx = queue.findIndex((it) => it.id === sourceItemId)
    const toIdx = queue.findIndex((it) => it.id === targetItemId)
    if (fromIdx < 0 || toIdx < 0) return

    const newItems = [...queue]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    const newIds = newItems.map((it) => it.id)
    onReorder?.(newIds)
  }, [draggingItemId, queue, onReorder])

  const handleDragEnd = useCallback(() => {
    setDraggingItemId(null)
    setDragOverItemId(null)
  }, [])

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  const loopLabel = loopMode === 'one' ? '单曲循环' : loopMode === 'list' ? '列表循环' : '顺序播放'

  return (
    <div className="queue-panel">
      <div className="queue-panel-header">
        <div className="queue-panel-title">
          <h3>播放队列</h3>
          <span className="queue-count">{queue.length}</span>
        </div>
        <div className="queue-panel-tools">
          <button
            className={`queue-tool-btn ${loopMode !== 'none' ? 'active' : ''}`}
            onClick={onToggleLoop}
            title={`循环模式：${loopLabel}`}
          >
            <LoopIcon mode={loopMode} />
          </button>
          <button
            className={`queue-tool-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={shuffle ? '随机：开' : '随机：关'}
          >
            <ShuffleIcon />
          </button>
          <button
            className="queue-tool-btn"
            onClick={onClear}
            title="清空队列"
            disabled={queue.length === 0}
          >
            <TrashIcon />
          </button>
          <button className="queue-tool-btn queue-close-btn" onClick={onClose} title="关闭">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="queue-panel-body" ref={listRef}>
        {queue.length === 0 ? (
          <div className="queue-empty">
            <div className="queue-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <p>队列为空</p>
            <p className="queue-empty-hint">在作品详情的曲目列表中点击「+」加入队列</p>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((item, idx) => {
              const isCurrent = idx === queueIndex
              return (
                <div
                  key={item.id}
                  className={`queue-item ${isCurrent ? 'current' : ''} ${draggingItemId === item.id ? 'dragging' : ''} ${dragOverItemId === item.id ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onPlay?.(item, idx)}
                >
                  <span className="queue-item-grip" title="拖拽排序">
                    <GripIcon />
                  </span>
                  <span className="queue-item-index">
                    {isCurrent ? <PlayingIcon /> : <span className="queue-item-num">{idx + 1}</span>}
                  </span>
                  <div className="queue-item-cover">
                    {item.workCover ? (
                      <img src={item.workCover} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="queue-item-cover-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="queue-item-info">
                    <div className="queue-item-name" title={item.audioName}>{item.audioName}</div>
                    <div className="queue-item-work" title={item.workTitle}>{item.workTitle}</div>
                  </div>
                  <button
                    className="queue-item-remove"
                    title="移除"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove?.(item.id)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
