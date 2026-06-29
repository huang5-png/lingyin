import { useState, useEffect, useCallback, useMemo } from 'react'
import './RecentPlaysView.css'
import StateView from './StateView'

export default function RecentPlaysView({ works, onSelectWork, onPlayAudio, onToast }) {
  const [recentList, setRecentList] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="recent-plays-view">
      <div className="rp-header">
        <div className="rp-title-area">
          <h2 className="rp-title">最近播放</h2>
          <p className="rp-subtitle">共 {recentList.length} 条记录</p>
        </div>
        <div className="rp-actions">
        </div>
      </div>

      <div className="rp-content">
        {loading ? (
          <StateView type="loading" text="加载中..." />
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
                {item.work && (
                  <button
                    className="rp-play-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectWork?.(item.work)
                    }}
                    title="打开作品"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
