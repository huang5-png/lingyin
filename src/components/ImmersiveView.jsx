import { useMemo, useEffect, useRef, useCallback, memo, useState } from 'react'
import { findCurrentCue, formatTime } from '../utils/subtitleParser'
import UpscaledImage from './UpscaledImage'
import SpectrumVisualizer from './SpectrumVisualizer'
import './ImmersiveView.css'

function throttle(fn, delay) {
  let lastTime = 0
  return function (...args) {
    const now = performance.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const ImmersiveView = memo(function ImmersiveView({
  work,
  currentCues,
  currentTime,
  duration,
  isPlaying,
  subtitleFontSize,
  playerRef,
  onClose,
  onPrev,
  onNext,
  upscalePreset = 'anime',
  hasTranslation = false,
  onToggleTranslate,
  isTranslating = false,
  subtitleStyleSettings,
  playbackRate = 1,
  onPlaybackRateChange,
  onAddBookmark,
  hasCurrentBookmark = false,
  bookmarkCount = 0,
  sleepTimerActive = false,
  sleepTimerStatusText = '',
  onToggleSleepTimer,
  // 频谱可视化相关
  showSpectrum = true,
  spectrumMode = 'bars',
  spectrumSensitivity = 1.5,
}) {
  const immersiveLyricRef = useRef(null)
  const seekThrottleRef = useRef(null)
  const hideTimerRef = useRef(null)
  const [showControls, setShowControls] = useState(true)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [showRateMenu, setShowRateMenu] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [audioElement, setAudioElement] = useState(null)
  const progressRef = useRef(null)

  if (!seekThrottleRef.current) {
    seekThrottleRef.current = throttle((time) => {
      playerRef.current?.seekTo(time)
    }, 150)
  }

  const currentCueIndex = useMemo(() => {
    return findCurrentCue(currentCues, currentTime)
  }, [currentCues, currentTime])

  const immersiveLyricCues = useMemo(() => {
    return currentCues.map((cue, idx) => ({
      ...cue,
      realIndex: idx,
      isActive: idx === currentCueIndex,
    }))
  }, [currentCues, currentCueIndex])

  const scrollToActiveCue = useCallback(() => {
    const activeEl = immersiveLyricRef.current?.querySelector(`.immersive-lyric-line.active`)
    if (activeEl && immersiveLyricRef.current) {
      const container = immersiveLyricRef.current
      const offsetTop = activeEl.offsetTop - container.offsetTop
      const targetScroll = offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }
  }, [])

  const throttledScrollRef = useRef(null)
  if (!throttledScrollRef.current) {
    throttledScrollRef.current = throttle(scrollToActiveCue, 100)
  }

  useEffect(() => {
    throttledScrollRef.current()
  }, [currentCueIndex])

  const handleCueClick = useCallback((time) => {
    seekThrottleRef.current(time)
  }, [])

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
      setShowVolumeSlider(false)
      setShowRateMenu(false)
    }, 3000)
  }, [])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [resetHideTimer])

  useEffect(() => {
    if (playerRef.current) {
      setVolume(playerRef.current.getVolume?.() || 0.8)
      const audio = playerRef.current.getAudioElement?.()
      if (audio) {
        setAudioElement(audio)
      }
    }
  }, [playerRef, isPlaying])

  const handlePlayPause = useCallback(() => {
    playerRef.current?.playPause()
    resetHideTimer()
  }, [playerRef, resetHideTimer])

  const handlePrev = useCallback(() => {
    if (onPrev) onPrev()
    resetHideTimer()
  }, [onPrev, resetHideTimer])

  const handleNext = useCallback(() => {
    if (onNext) onNext()
    resetHideTimer()
  }, [onNext, resetHideTimer])

  const handleProgressClick = useCallback((e) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const time = percent * duration
    playerRef.current?.seekTo(time)
    resetHideTimer()
  }, [duration, playerRef, resetHideTimer])

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    playerRef.current?.setVolume(v)
  }, [playerRef])

  const handleMuteToggle = useCallback(() => {
    if (volume > 0) {
      playerRef.current?.setVolume(0)
      setVolume(0)
    } else {
      playerRef.current?.setVolume(0.8)
      setVolume(0.8)
    }
    resetHideTimer()
  }, [volume, playerRef, resetHideTimer])

  const handleRateChange = useCallback((rate) => {
    if (onPlaybackRateChange) {
      onPlaybackRateChange(rate)
    }
    setShowRateMenu(false)
    resetHideTimer()
  }, [onPlaybackRateChange, resetHideTimer])

  const handleAddBookmark = useCallback(() => {
    if (onAddBookmark) {
      onAddBookmark()
    }
    resetHideTimer()
  }, [onAddBookmark, resetHideTimer])

  const styleSettings = subtitleStyleSettings || {
    fontSize: subtitleFontSize ? subtitleFontSize * 1.2 : 22,
    activeFontSize: subtitleFontSize ? subtitleFontSize * 1.8 : 34,
    color: '#ffffff',
    activeColor: '#ffffff',
    fontWeight: 500,
    shadow: true,
    shadowBlur: 4,
  }

  const normalShadow = styleSettings.shadow
    ? `0 0 ${styleSettings.shadowBlur}px rgba(0,0,0,0.7), 0 2px ${styleSettings.shadowBlur + 4}px rgba(0,0,0,0.5), 0 -1px ${styleSettings.shadowBlur - 2 > 0 ? styleSettings.shadowBlur - 2 : 2}px rgba(0,0,0,0.3)`
    : 'none'

  const activeShadow = styleSettings.shadow
    ? `0 0 ${styleSettings.shadowBlur + 2}px rgba(0,0,0,0.8), 0 2px ${styleSettings.shadowBlur + 6}px rgba(0,0,0,0.6), 0 0 ${styleSettings.shadowBlur * 2}px rgba(201, 100, 66, 0.3)`
    : 'none'

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!work) return null

  return (
    <div
      className="immersive-overlay"
      onMouseMove={resetHideTimer}
      onMouseDown={resetHideTimer}
      style={{
        '--immersive-lyric-font-size': `${styleSettings.fontSize}px`,
        '--immersive-lyric-active-font-size': `${styleSettings.activeFontSize}px`,
        '--immersive-lyric-color': styleSettings.color,
        '--immersive-lyric-active-color': styleSettings.activeColor,
        '--immersive-lyric-font-weight': styleSettings.fontWeight,
        '--immersive-lyric-shadow': normalShadow,
        '--immersive-lyric-active-shadow': activeShadow,
      }}
    >
      <div className="immersive-bg" style={{ backgroundImage: `url(${work.cover})` }} />

      <div className={`immersive-top-bar ${showControls ? 'visible' : 'hidden'}`}>
        <button className="immersive-close-btn" onClick={onClose} title="关闭 (ESC)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="immersive-top-info">
          <div className="immersive-top-title">{work.title || work.folderName}</div>
          <div className="immersive-top-sub">{work.circle || ''}</div>
        </div>
        <div className="immersive-top-actions">
          {currentCues.length > 0 && onToggleTranslate && (
            <button
              className={`immersive-icon-btn ${isTranslating ? 'translating' : ''} ${hasTranslation ? 'has-translation' : ''}`}
              onClick={onToggleTranslate}
              title={isTranslating ? '翻译中...' : hasTranslation ? '关闭双语显示' : '翻译字幕'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 10-7-7-2 2 5 5-5 5 2 2 7-7Z"/>
                <path d="M21 12H3"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="immersive-cover-wrapper">
        <UpscaledImage
          src={work.cover}
          alt=""
          preset={upscalePreset}
          className="immersive-cover"
          fit="contain"
        />
      </div>

      <div className={`immersive-bottom ${showControls ? 'controls-visible' : ''}`}>
        {showSpectrum && audioElement && (
          <div className="immersive-spectrum-bg">
            <SpectrumVisualizer
              audioElement={audioElement}
              mode={spectrumMode}
              sensitivity={spectrumSensitivity}
              height={120}
              showBg={false}
              barCount={96}
              colorStart="rgba(201, 100, 66, 0.3)"
              colorEnd="rgba(236, 72, 153, 0.6)"
            />
          </div>
        )}
        <div className="immersive-bottom-inner">
          <div className="immersive-info-row">
            <div className="immersive-info-text">
              <div className="immersive-title">{work.title || work.folderName}</div>
              <div className="immersive-subtitle">{work.circle || ''}</div>
            </div>
          </div>

          {immersiveLyricCues.length > 0 && (
            <div className="immersive-lyrics-container" ref={immersiveLyricRef}>
              {immersiveLyricCues.map((cue) => (
                <div
                  key={cue.realIndex}
                  className={`immersive-lyric-line ${cue.isActive ? 'active' : ''}`}
                  onClick={() => handleCueClick(cue.time)}
                >
                  {cue.text.split('\n').map((line, lineIdx) => (
                    <div key={lineIdx}>{line}</div>
                  ))}
                  {hasTranslation && cue.translated && (
                    <div className="immersive-lyric-translated">
                      {cue.translated.split('\n').map((line, lineIdx) => (
                        <div key={lineIdx}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={`immersive-controls ${showControls ? 'visible' : 'hidden'}`}>
            <div
              className="immersive-progress-bar"
              ref={progressRef}
              onClick={handleProgressClick}
            >
              <div className="immersive-progress-bg" />
              <div
                className="immersive-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="immersive-progress-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            <div className="immersive-time-row">
              <span className="immersive-time">{formatTime(currentTime)}</span>
              <span className="immersive-time-divider">/</span>
              <span className="immersive-time immersive-time-total">{formatTime(duration)}</span>
            </div>

            <div className="immersive-control-btns">
              <button
                className="immersive-ctrl-btn immersive-ctrl-secondary"
                onClick={handlePrev}
                title="上一曲"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              <button
                className="immersive-ctrl-btn immersive-ctrl-play"
                onClick={handlePlayPause}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                className="immersive-ctrl-btn immersive-ctrl-secondary"
                onClick={handleNext}
                title="下一曲"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18 14.5 12 6 6zM16 6h2v12h-2z" />
                </svg>
              </button>
            </div>

            <div className="immersive-controls-row">
              <div className="immersive-volume-wrapper">
                <button
                  className="immersive-ctrl-btn immersive-ctrl-small"
                  onClick={handleMuteToggle}
                  title={volume === 0 ? '取消静音' : '静音'}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  {volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <div
                  className={`immersive-volume-slider ${showVolumeSlider ? 'visible' : ''}`}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="immersive-volume-input"
                  />
                </div>
              </div>

              <div className="immersive-rate-wrapper">
                <button
                  className={`immersive-ctrl-btn immersive-ctrl-small ${playbackRate !== 1 ? 'active' : ''}`}
                  onClick={() => setShowRateMenu(!showRateMenu)}
                  title="播放速度"
                >
                  <span className="immersive-rate-text">{playbackRate}x</span>
                </button>
                {showRateMenu && (
                  <div className="immersive-rate-menu" onMouseLeave={() => setShowRateMenu(false)}>
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        className={`immersive-rate-item ${playbackRate === rate ? 'active' : ''}`}
                        onClick={() => handleRateChange(rate)}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className={`immersive-ctrl-btn immersive-ctrl-small ${hasCurrentBookmark ? 'active' : ''}`}
                onClick={handleAddBookmark}
                title={hasCurrentBookmark ? '已有书签' : '添加书签'}
              >
                <svg viewBox="0 0 24 24" fill={hasCurrentBookmark ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {bookmarkCount > 0 && (
                  <span className="immersive-badge">{bookmarkCount}</span>
                )}
              </button>

              <button
                className={`immersive-ctrl-btn immersive-ctrl-small ${sleepTimerActive ? 'active' : ''}`}
                onClick={onToggleSleepTimer}
                title={sleepTimerActive ? `睡眠定时器：${sleepTimerStatusText}` : '睡眠定时器'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                {sleepTimerActive && sleepTimerStatusText && (
                  <span className="immersive-sleep-text">{sleepTimerStatusText}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ImmersiveView
