import { useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { findCurrentCue } from '../utils/subtitleParser'
import UpscaledImage from './UpscaledImage'
import './ImmersiveView.css'

// 节流函数
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

const ImmersiveView = memo(function ImmersiveView({
  work,
  currentCues,
  currentTime,
  subtitleFontSize,
  playerRef,
  onClose,
  upscalePreset = 'anime',
  hasTranslation = false,
  onToggleTranslate,
  isTranslating = false,
  subtitleStyleSettings,
}) {
  const immersiveLyricRef = useRef(null)
  const seekThrottleRef = useRef(null)

  // 初始化节流函数
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

  // 节流滚动以避免频繁 DOM 操作
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

  // 节流的点击跳转函数
  const handleCueClick = useCallback((time) => {
    seekThrottleRef.current(time)
  }, [])

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

  if (!work) return null

  return (
    <div
      className="immersive-overlay"
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
      <button className="immersive-close-btn" onClick={onClose} title="关闭 (ESC)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {currentCues.length > 0 && onToggleTranslate && (
        <button
          className={`immersive-translate-btn ${isTranslating ? 'translating' : ''} ${hasTranslation ? 'has-translation' : ''}`}
          onClick={onToggleTranslate}
          title={isTranslating ? '翻译中...' : hasTranslation ? '关闭双语显示' : '翻译字幕'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 10-7-7-2 2 5 5-5 5 2 2 7-7Z"/>
            <path d="M21 12H3"/>
          </svg>
        </button>
      )}
      <div className="immersive-cover-wrapper">
        <UpscaledImage
          src={work.cover}
          alt=""
          preset={upscalePreset}
          className="immersive-cover"
          fit="contain"
        />
      </div>
      <div className="immersive-bottom">
        <div className="immersive-title">{work.title || work.folderName}</div>
        <div className="immersive-subtitle">{work.circle || ''}</div>
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
      </div>
    </div>
  )
})

export default ImmersiveView
