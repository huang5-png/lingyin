import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { formatTime } from '../utils/subtitleParser'
import QueuePanel from './QueuePanel'
import './AudioPlayer.css'

// 格式化睡眠定时器剩余时间
function formatSleepTimerRemaining(seconds) {
  if (seconds <= 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function pathToFileURL(filePath) {
  if (!filePath) return ''
  let normalizedPath = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return 'file:///' + normalizedPath.split('/').map((part, i) => {
      if (i === 0) return part
      return encodeURIComponent(part)
    }).join('/')
  }
  if (normalizedPath.startsWith('/')) {
    return 'file://' + normalizedPath.split('/').map((part, i) => {
      if (i === 0) return ''
      return encodeURIComponent(part)
    }).join('/')
  }
  return 'file:///' + normalizedPath.split('/').map(encodeURIComponent).join('/')
}

const AudioPlayer = forwardRef(function AudioPlayer(
  {
    audioPath, title, cover, onTimeUpdate, onReady, onFinish, workId,
    waveformHeight = 70, defaultVolume = 80, skipSeconds = 5,
    onPrev, onNext, onToggleImmersive,
    // 播放队列相关
    queue = [], queueIndex = -1, loopMode = 'none', shuffle = false, showQueuePanel = false,
    onToggleQueue, onToggleLoop, onToggleShuffle,
    onPlayFromQueue, onRemoveFromQueue, onClearQueue, onReorderQueue, onCloseQueuePanel,
    // 睡眠定时器相关
    sleepTimerMinutes = 0, sleepTimerRemaining = 0, onSetSleepTimer,
    // 播放速度相关
    playbackRate = 1, onPlaybackRateChange,
  },
  ref,
) {
  const waveformRef = useRef(null)
  const waveformContainerRef = useRef(null)
  const wavesurferRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(defaultVolume / 100)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipTime, setTooltipTime] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState(0)
  const volumeSliderRef = useRef(null)
  const [showSleepTimer, setShowSleepTimer] = useState(false) // 定时器下拉菜单显示状态
  const [showPlaybackRate, setShowPlaybackRate] = useState(false) // 倍速下拉菜单显示状态

  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(time / duration)
      }
    },
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    playPause: () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.playPause()
      }
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(1, v))
      setVolume(clamped)
      if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(clamped)
      }
    },
    getVolume: () => volume,
    skipBackward: (seconds) => {
      if (wavesurferRef.current && currentTime > 0) {
        wavesurferRef.current.skip(-(seconds || skipSeconds))
      }
    },
    skipForward: (seconds) => {
      if (wavesurferRef.current && currentTime < duration) {
        wavesurferRef.current.skip(seconds || skipSeconds)
      }
    },
    setPlaybackRate: (rate) => {
      if (wavesurferRef.current) {
        wavesurferRef.current.setPlaybackRate(rate)
      }
    },
    getPlaybackRate: () => playbackRate,
  }))

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(v)
    }
  }

  const skipBackward = () => {
    if (wavesurferRef.current && currentTime > 0) {
      wavesurferRef.current.skip(-skipSeconds)
    }
  }

  const skipForward = () => {
    if (wavesurferRef.current && currentTime < duration) {
      wavesurferRef.current.skip(skipSeconds)
    }
  }

  const handleWaveformMouseMove = (e) => {
    if (!waveformContainerRef.current || !isReady || duration <= 0) return

    const rect = waveformContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const time = percentage * duration

    // 使用百分比定位，避免大窗口下像素偏差
    setTooltipPosition(percentage * 100)
    setTooltipTime(time)
    setShowTooltip(true)
  }

  const handleWaveformMouseLeave = () => {
    setShowTooltip(false)
  }

  const handleWaveformClick = (e) => {
    if (!wavesurferRef.current) return
    if (!isReady) return
    if (duration <= 0) return

    const container = waveformContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const clampedPercentage = Math.max(0, Math.min(1, percentage))

    wavesurferRef.current.seekTo(clampedPercentage)
  }

  useEffect(() => {
    let cancelled = false

    function loadAudio() {
      if (!waveformRef.current || !audioPath) return

      setIsReady(false)
      setCurrentTime(0)
      setDuration(0)
      setError(null)
      setIsLoading(true)

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }

      try {
        const fileUrl = audioPath.startsWith('http') ? audioPath : pathToFileURL(audioPath)

        const ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: 'rgba(201, 100, 66, 0.4)',
          progressColor: '#ec4899',
          cursorColor: 'rgba(255, 255, 255, 0.9)',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: waveformHeight,
          normalize: true,
          hideScrollbar: true,
          barAlign: 'center',
          backend: 'MediaElement',
          partialRender: true,
        })

        wavesurferRef.current = ws

        ws.load(fileUrl)
        ws.setVolume(volume)

        ws.on('ready', () => {
          if (cancelled) return
          setIsLoading(false)
          setIsReady(true)
          const dur = ws.getDuration()
          setDuration(dur)

          ws.setPlaybackRate(playbackRate)
          ws.play()
          if (onReady) onReady(dur)
        })

        ws.on('error', (err) => {
          if (cancelled) return
          setIsLoading(false)
          setError(err?.message || err || '加载失败')
          console.error('WaveSurfer error:', err)
        })

        // 节流 auioprocess 事件到约 15fps，减少 React 重渲染
        let lastProcessTime = 0
        ws.on('audioprocess', (time) => {
          if (cancelled) return
          const now = performance.now()
          if (now - lastProcessTime < 66) return
          lastProcessTime = now
          setCurrentTime(time)
          if (onTimeUpdate) onTimeUpdate(time)
        })

        ws.on('seek', (time) => {
          if (cancelled) return
          setCurrentTime(time)
          if (onTimeUpdate) onTimeUpdate(time)
        })

        ws.on('play', () => !cancelled && setIsPlaying(true))
        ws.on('pause', () => !cancelled && setIsPlaying(false))
        ws.on('finish', () => {
          if (cancelled) return
          setIsPlaying(false)
          if (onFinish) onFinish()
        })
      } catch (e) {
        if (cancelled) return
        setIsLoading(false)
        setError(e.message || '加载失败')
        console.error('Failed to load audio:', e)
      }
    }

    loadAudio()

    return () => {
      cancelled = true
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
    }
  }, [audioPath, waveformHeight])

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume)
    }
    if (volumeSliderRef.current) {
      volumeSliderRef.current.style.backgroundSize = `${volume * 100}% 100%`
    }
  }, [volume])

  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setPlaybackRate(playbackRate)
    }
  }, [playbackRate, isReady])

  return (
    <div className="audio-player">
      <div className="player-left">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="player-cover"
            onClick={onToggleImmersive}
            title="点击进入沉浸模式"
          />
        ) : (
          <div className="player-cover-placeholder" onClick={onToggleImmersive} title="点击进入沉浸模式">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="player-info-bar">
          <div className={`player-title ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`}>
            {isLoading && '加载中...'}
            {error && `错误: ${error}`}
            {!isLoading && !error && (title || '未选择音频')}
          </div>
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="waveform-wrapper">
          <div
            ref={waveformContainerRef}
            className="waveform-container"
            style={{ height: `${waveformHeight}px` }}
            onMouseMove={handleWaveformMouseMove}
            onMouseLeave={handleWaveformMouseLeave}
            onClick={handleWaveformClick}
          >
            <div ref={waveformRef} className="waveform" />
            <div className="waveform-gradient-overlay" />
          </div>
          <div
            className={`waveform-tooltip ${showTooltip ? 'visible' : ''}`}
            style={{ left: `${tooltipPosition}%` }}
          >
            {formatTime(tooltipTime)}
          </div>
        </div>

        <div className="player-controls">
          <button className="ctrl-btn prev-next-btn" onClick={onPrev} title="上一曲" disabled={!isReady || !onPrev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 20L9 12l10-8v16z"/>
              <rect x="5" y="4" width="2" height="16" rx="1"/>
            </svg>
          </button>
          <button className="ctrl-btn skip-btn" onClick={skipBackward} title={`后退${skipSeconds}秒`} disabled={!isReady}>
            -{skipSeconds}s
          </button>
          <button className="ctrl-btn play-btn" onClick={handlePlayPause} title="播放/暂停" disabled={!isReady}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3.5L19 12L6 20.5V3.5Z" />
              </svg>
            )}
          </button>
          <button className="ctrl-btn skip-btn" onClick={skipForward} title={`前进${skipSeconds}秒`} disabled={!isReady}>
            +{skipSeconds}s
          </button>
          <button className="ctrl-btn prev-next-btn" onClick={onNext} title="下一曲" disabled={!isReady || !onNext}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4l10 8-10 8V4z"/>
              <rect x="17" y="4" width="2" height="16" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="player-right">
        <div className="volume-control">
          <span className="volume-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </span>
          <input
            ref={volumeSliderRef}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
        <div className="queue-controls">
          <button
            className={`ctrl-btn loop-btn ${loopMode !== 'none' ? 'active' : ''}`}
            onClick={onToggleLoop}
            title={`循环模式：${loopMode === 'one' ? '单曲循环' : loopMode === 'list' ? '列表循环' : '顺序播放'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              {loopMode === 'one' && (
                <text x="12" y="14.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">1</text>
              )}
            </svg>
          </button>
          <button
            className={`ctrl-btn shuffle-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={shuffle ? '随机：开' : '随机：关'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>
          <button
            className={`ctrl-btn queue-btn ${showQueuePanel ? 'active' : ''}`}
            onClick={onToggleQueue}
            title="播放队列"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            {queue.length > 0 && <span className="queue-badge">{queue.length}</span>}
          </button>
        </div>
        <div className="playback-rate-control">
          <button
            className={`ctrl-btn playback-rate-btn ${playbackRate !== 1 ? 'active' : ''}`}
            onClick={() => setShowPlaybackRate(!showPlaybackRate)}
            title={`播放速度：${playbackRate}x`}
          >
            <span className="playback-rate-text">{playbackRate}x</span>
          </button>
          {showPlaybackRate && (
            <div className="playback-rate-dropdown">
              <div className="playback-rate-header">播放速度</div>
              <div className="playback-rate-options">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <button
                    key={rate}
                    className={`playback-rate-option ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => {
                      if (onPlaybackRateChange) onPlaybackRateChange(rate)
                      setShowPlaybackRate(false)
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sleep-timer-control">
          <button
            className={`ctrl-btn sleep-timer-btn ${sleepTimerMinutes > 0 ? 'active' : ''}`}
            onClick={() => setShowSleepTimer(!showSleepTimer)}
            title={sleepTimerMinutes > 0 ? `睡眠定时器：${formatSleepTimerRemaining(sleepTimerRemaining)}后停止` : '睡眠定时器'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            {sleepTimerMinutes > 0 && (
              <span className="sleep-timer-badge">{formatSleepTimerRemaining(sleepTimerRemaining)}</span>
            )}
          </button>
          {showSleepTimer && (
            <div className="sleep-timer-dropdown">
              <div className="sleep-timer-header">睡眠定时器</div>
              <div className="sleep-timer-options">
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 0 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(0); setShowSleepTimer(false) }}
                >
                  关闭
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 5 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(5); setShowSleepTimer(false) }}
                >
                  5 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 10 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(10); setShowSleepTimer(false) }}
                >
                  10 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 15 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(15); setShowSleepTimer(false) }}
                >
                  15 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 30 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(30); setShowSleepTimer(false) }}
                >
                  30 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 45 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(45); setShowSleepTimer(false) }}
                >
                  45 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 60 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(60); setShowSleepTimer(false) }}
                >
                  60 分钟
                </button>
                <button
                  className={`sleep-timer-option ${sleepTimerMinutes === 90 ? 'active' : ''}`}
                  onClick={() => { onSetSleepTimer(90); setShowSleepTimer(false) }}
                >
                  90 分钟
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showQueuePanel && (
        <QueuePanel
          queue={queue}
          queueIndex={queueIndex}
          loopMode={loopMode}
          shuffle={shuffle}
          onPlay={onPlayFromQueue}
          onRemove={onRemoveFromQueue}
          onClear={onClearQueue}
          onReorder={onReorderQueue}
          onToggleLoop={onToggleLoop}
          onToggleShuffle={onToggleShuffle}
          onClose={onCloseQueuePanel}
        />
      )}
    </div>
  )
})

export default AudioPlayer
