import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import './RecentPlaysView.css'
import StateView from './StateView'

// 骨架屏条目组件
const SkeletonItem = memo(() => {
  return (
    <div className="rp-item skeleton-item">
      <div className="rp-index">
        <div className="skeleton-line skeleton-index" />
      </div>
      <div className="rp-cover-wrapper">
        <div className="skeleton-cover rp-skeleton-cover" />
      </div>
      <div className="rp-info">
        <div className="skeleton-line skeleton-title rp-skeleton-title" />
        <div className="skeleton-line skeleton-meta rp-skeleton-meta" />
        <div className="skeleton-bottom">
          <div className="skeleton-line skeleton-stat rp-skeleton-stat" />
          <div className="skeleton-line skeleton-time rp-skeleton-time" />
        </div>
      </div>
      <div className="rp-item-actions">
        <div className="skeleton-line skeleton-btn" />
        <div className="skeleton-line skeleton-btn" />
      </div>
    </div>
  )
})
SkeletonItem.displayName = 'SkeletonItem'

export default function RecentPlaysView({ works, onSelectWork, onPlayAudio, onToast, onAutoPlay }) {
  const [recentList, setRecentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadRecent = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.electronAPI.dbGetRecentWorks(50)
      setRecentList(data || [])
    } catch (e) {
      console.error('Failed to load recent works:', e)
      onToast?.('加载最近播放失败：' + (e.message || ''), 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const enrichedList = useMemo(() => {
    return recentList.map((rw) => {
      const work = works.find((w) => w.id === rw.workId)
      return {
        ...rw,
        work,
        cover: work?.cover || rw.cover,
        title: work?.title || rw.title || '未知作品',
      }
    })
  }, [recentList, works])

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    const now = new Date()
    const diff = now - d
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const mins = Math.floor(diff / (1000 * 60))
        return mins <= 1 ? '刚刚' : `${mins} 分钟前`
      }
      return `${hours} 小时前`
    }
    if (days === 1) return '昨天'
    if (days < 7) return `${days} 天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const handleItemClick = useCallback((item) => {
    if (item.work) {
      onSelectWork?.(item.work)
    } else {
      onToast?.('该作品不在本地库中', 'info')
    }
  }, [onSelectWork, onToast])

  const handleDeleteItem = useCallback(async (item, e) => {
    e.stopPropagation()
    if (!item.workId) return
    try {
      setDeletingId(item.workId)
      const deleted = await window.electronAPI.dbDeleteHistoryByWorkId(item.workId)
      if (deleted > 0) {
        setRecentList((prev) => prev.filter((rw) => rw.workId !== item.workId))
        onToast?.(`已删除 ${deleted} 条播放记录`, 'success')
      }
    } catch (err) {
      console.error('Failed to delete history:', err)
      onToast?.('删除失败：' + (err.message || ''), 'error')
    } finally {
      setDeletingId(null)
    }
  }, [onToast])

  const handleClearAll = useCallback(async () => {
    try {
      const count = await window.electronAPI.dbClearAllHistory()
      setRecentList([])
      setShowClearConfirm(false)
      onToast?.(`已清空 ${count} 条播放记录`, 'success')
    } catch (err) {
      console.error('Failed to clear history:', err)
      onToast?.('清空失败：' + (err.message || ''), 'error')
    }
  }, [onToast])

  return (
    <div className="recent-plays-view">
      <div className="rp-header">
        <div className="rp-title-area">
          <h2 className="rp-title">最近播放</h2>
          <p className="rp-subtitle">共 {recentList.length} 条记录</p>
        </div>
        <div className="rp-actions">
          {recentList.length > 0 && (
            <button
              className="rp-clear-btn"
              onClick={() => setShowClearConfirm(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              清空记录
            </button>
          )}
        </div>
      </div>

      <div className="rp-content">
        {loading ? (
          <div className="rp-list">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : recentList.length === 0 ? (
          <StateView type="empty" title="还没有播放记录" description="播放一些作品后，它们会出现在这里" />
        ) : (
          <div className="rp-list">
            {enrichedList.map((item, index) => (
              <div
                key={`${item.workId}_${item.timestamp}_${index}`}
                className="rp-item"
                onClick={() => handleItemClick(item)}
              >
                <div className="rp-index">{index + 1}</div>
                <div className="rp-cover-wrapper">
                  {item.cover ? (
                    <img src={item.cover} alt="" className="rp-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="rp-cover-placeholder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="rp-info">
                  <div className="rp-work-title">{item.title}</div>
                  <div className="rp-meta">
                    {item.work?.circle && <span className="rp-circle">{item.work.circle}</span>}
                    {item.audioName && <span className="rp-audio-name">{item.audioName}</span>}
                  </div>
                  <div className="rp-bottom">
                    <span className="rp-duration">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {formatDuration(item.duration)}
                    </span>
                    <span className="rp-time">{formatDate(item.timestamp)}</span>
                  </div>
                </div>
                <div className="rp-item-actions">
                  <button
                    className="rp-delete-btn"
                    onClick={(e) => handleDeleteItem(item, e)}
                    title="删除该作品的播放记录"
                    disabled={deletingId === item.workId}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                  {item.work && (
                    <button
                      className="rp-play-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectWork?.(item.work)
                        onAutoPlay?.(item)
                      }}
                      title="播放"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div className="rp-confirm-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="rp-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rp-confirm-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="rp-confirm-title">确认清空全部播放记录？</h3>
            <p className="rp-confirm-desc">此操作不可恢复，所有播放历史和统计数据都将被清除。</p>
            <div className="rp-confirm-actions">
              <button
                className="rp-confirm-btn rp-confirm-cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button
                className="rp-confirm-btn rp-confirm-danger"
                onClick={handleClearAll}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
