import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import './RecentPlaysView.css'
import StateView from './StateView'

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
        <div className="rp-skeleton-progress">
          <div className="skeleton-line rp-skeleton-progress-bar" />
        </div>
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

export default function RecentPlaysView({ works, onSelectWork, onPlayAudio, onToast, onAutoPlay, onContinueListen }) {
  const [recentList, setRecentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [filterType, setFilterType] = useState('all')

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

  const filteredList = useMemo(() => {
    if (filterType === 'unfinished') {
      return enrichedList.filter(item => item.isUnfinished)
    }
    return enrichedList
  }, [enrichedList, filterType])

  const unfinishedCount = useMemo(() => {
    return enrichedList.filter(item => item.isUnfinished).length
  }, [enrichedList])

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

  const handleContinueListen = useCallback((item, e) => {
    e?.stopPropagation()
    if (!item.work) {
      onToast?.('该作品不在本地库中', 'info')
      return
    }
    onContinueListen?.(item)
  }, [onContinueListen, onToast])

  const handlePlay = useCallback((item, e) => {
    e.stopPropagation()
    if (item.work) {
      onSelectWork?.(item.work)
      onAutoPlay?.(item)
    }
  }, [onSelectWork, onAutoPlay])

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
          <div className="rp-filter-tabs">
            <button
              className={`rp-filter-tab ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              全部
            </button>
            <button
              className={`rp-filter-tab ${filterType === 'unfinished' ? 'active' : ''}`}
              onClick={() => setFilterType('unfinished')}
            >
              未听完
              {unfinishedCount > 0 && <span className="rp-filter-badge">{unfinishedCount}</span>}
            </button>
          </div>
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
        ) : filteredList.length === 0 ? (
          <StateView 
            type="empty" 
            title={filterType === 'unfinished' ? '没有未听完的作品' : '还没有播放记录'} 
            description={filterType === 'unfinished' ? '听完的作品会从这里消失' : '播放一些作品后，它们会出现在这里'} 
            iconType={filterType === 'unfinished' ? 'clock' : 'music'}
          />
        ) : (
          <div className="rp-list">
            {filteredList.map((item, index) => (
              <div
                key={`${item.workId}_${item.lastPlayed}_${index}`}
                className={`rp-item ${item.isUnfinished ? 'has-unfinished' : ''}`}
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
                  {item.isUnfinished && (
                    <div className="rp-unfinished-dot" title="未听完">
                      <div className="rp-unfinished-pulse" />
                    </div>
                  )}
                </div>
                <div className="rp-info">
                  <div className="rp-work-title">
                    {item.title}
                    {item.isUnfinished && (
                      <span className="rp-unfinished-tag">未听完</span>
                    )}
                  </div>
                  <div className="rp-meta">
                    {item.work?.circle && <span className="rp-circle">{item.work.circle}</span>}
                    {item.audioName && <span className="rp-audio-name">{item.audioName}</span>}
                  </div>
                  {item.duration > 0 && (
                    <div className="rp-progress-bar" title={`已听 ${formatDuration(item.currentTime)} / ${formatDuration(item.duration)}`}>
                      <div 
                        className="rp-progress-fill" 
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  )}
                  <div className="rp-bottom">
                    <span className="rp-duration">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {item.duration > 0 ? `${formatDuration(item.currentTime)} / ${formatDuration(item.duration)}` : formatDuration(item.duration)}
                    </span>
                    <span className="rp-time">{formatDate(item.lastPlayed)}</span>
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
                  {item.work && item.isUnfinished && (
                    <button
                      className="rp-continue-btn"
                      onClick={(e) => handleContinueListen(item, e)}
                      title="继续听"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      继续
                    </button>
                  )}
                  {item.work && (
                    <button
                      className="rp-play-btn"
                      onClick={(e) => handlePlay(item, e)}
                      title="从头播放"
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
