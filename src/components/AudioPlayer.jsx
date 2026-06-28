import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { formatTime } from '../utils/subtitleParser'
import './AudioPlayer.css'

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
  { audioPath, title, cover, onTimeUpdate, onReady, onFinish, workId, waveformHeight = 70, defaultVolume = 80, skipSeconds = 5, onPrev, onNext, onToggleImmersive },
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
      setVolume(v)
    },
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
        try {
          wavesurferRef.current.destroy()
        } catch (e) {
          console.error('Error destroying wavesurfer:', e)
        }
        wavesurferRef.current = null
      }
    }
  }, [audioPath, waveformHeight])

  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setVolume(volume)
    }
    if (volumeSliderRef.current) {
      volumeSliderRef.current.style.backgroundSize = `${volume * 100}% 100%`
    }
  }, [volume])

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
      </div>
    </div>
  )
})

export default AudioPlayer
