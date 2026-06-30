import { useMemo, useEffect, useRef } from 'react'
import { findCurrentCue } from '../utils/subtitleParser'
import './ImmersiveView.css'

export default function ImmersiveView({
  work,
  currentCues,
  currentTime,
  subtitleFontSize,
  playerRef,
  onClose,
}) {
  const immersiveLyricRef = useRef(null)

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

  useEffect(() => {
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
  }, [currentCueIndex])

  const lyricFontSize = subtitleFontSize ? subtitleFontSize * 1.2 : 22
  const activeFontSize = subtitleFontSize ? subtitleFontSize * 1.8 : 34

  if (!work) return null

  return (
    <div
      className="immersive-overlay"
      style={{
        '--immersive-lyric-font-size': `${lyricFontSize}px`,
        '--immersive-lyric-active-font-size': `${activeFontSize}px`,
      }}
    >
      <div className="immersive-bg" style={{ backgroundImage: `url(${work.cover})` }} />
      <button className="immersive-close-btn" onClick={onClose} title="关闭 (ESC)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="immersive-cover-wrapper">
        <img src={work.cover} alt="" className="immersive-cover" loading="lazy" decoding="async" />
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
                onClick={() => playerRef.current?.seekTo(cue.time)}
              >
                {cue.text.split('\n').map((line, lineIdx) => (
                  <div key={lineIdx}>{line}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
