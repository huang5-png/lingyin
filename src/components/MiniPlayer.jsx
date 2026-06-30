import { useState, useEffect } from 'react'
import { formatTime } from '../utils/subtitleParser'
import './MiniPlayer.css'

function MiniPlayer() {
  const [state, setState] = useState({
    isPlaying: false,
    title: '',
    cover: '',
    currentTime: 0,
    duration: 0,
    workTitle: '',
  })

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.miniPlayerGetState().then((initialState) => {
      if (initialState) {
        setState(initialState)
      }
    })

    const unsubscribe = window.electronAPI.onMiniPlayerStateUpdate((newState) => {
      setState(newState)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handlePlayPause = () => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerTogglePlay()
    }
  }

  const handlePrev = () => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerPrevTrack()
    }
  }

  const handleNext = () => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerNextTrack()
    }
  }

  const handleShowMain = () => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerShowMain()
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerClose()
    }
  }

  const handleDragStart = (e) => {
    if (window.electronAPI) {
      window.electronAPI.miniPlayerStartDrag()
    }
    e.preventDefault()
  }

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  return (
    <div className="mini-player">
      <div
        className="mini-player-drag-region"
        onMouseDown={handleDragStart}
      >
        <div className="mini-player-header">
          <div className="mini-player-app-title">聆音</div>
          <div className="mini-player-window-controls">
            <button
              className="mini-window-btn minimize-btn"
              onClick={handleShowMain}
              title="展开主窗口"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
            <button
              className="mini-window-btn close-btn"
              onClick={handleClose}
              title="关闭迷你播放器"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mini-player-body">
        <div className="mini-player-cover-wrapper">
          {state.cover ? (
            <img src={state.cover} alt="" className="mini-player-cover" />
          ) : (
            <div className="mini-player-cover-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>

        <div className="mini-player-info">
          <div className="mini-player-title" title={state.title || state.workTitle}>
            {state.title || state.workTitle || '未选择音频'}
          </div>
          <div className="mini-player-time">
            <span>{formatTime(state.currentTime)}</span>
            <span>/</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        <div className="mini-player-controls">
          <button className="mini-ctrl-btn prev-btn" onClick={handlePrev} title="上一曲">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 20L9 12l10-8v16z" />
              <rect x="5" y="4" width="2" height="16" rx="1" />
            </svg>
          </button>
          <button className="mini-ctrl-btn play-btn" onClick={handlePlayPause} title={state.isPlaying ? '暂停' : '播放'}>
            {state.isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3.5L19 12L6 20.5V3.5Z" />
              </svg>
            )}
          </button>
          <button className="mini-ctrl-btn next-btn" onClick={handleNext} title="下一曲">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4l10 8-10 8V4z" />
              <rect x="17" y="4" width="2" height="16" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mini-player-progress">
        <div className="mini-progress-bar">
          <div
            className="mini-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default MiniPlayer
