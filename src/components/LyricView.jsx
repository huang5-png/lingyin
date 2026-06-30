import { useEffect, useRef, useState, memo } from 'react'
import { findCurrentCue, formatTime } from '../utils/subtitleParser'
import SubtitleSelector from './SubtitleSelector'
import './LyricView.css'

const DEFAULT_LOCAL_SETTINGS = {
  timeOffset: 0,
  displayMode: 'single',
}

function loadLocalSettings() {
  try {
    const saved = localStorage.getItem('subtitleSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { timeOffset: parsed.timeOffset || 0, displayMode: parsed.displayMode || 'single' }
    }
  } catch (e) {}
  return { ...DEFAULT_LOCAL_SETTINGS }
}

const LyricView = memo(function LyricView({
  cues,
  currentTime,
  onSeek,
  subtitleOptions,
  selectedSubtitleIndex,
  onSelectSubtitle,
  onAddSubtitleFile,
  onToggleTranslate,
  isTranslating,
  hasTranslation,
  subtitleFontSize,
  subtitleColor,
  subtitleActiveColor,
  subtitleFontWeight,
  subtitleShadow,
  subtitleShadowBlur,
  subtitleStyleSettings,
}) {
  const containerRef = useRef(null)
  const [localSettings, setLocalSettings] = useState(loadLocalSettings)

  const styleSettings = subtitleStyleSettings || {
    fontSize: subtitleFontSize || 14,
    color: subtitleColor || '#e8e6e3',
    activeColor: subtitleActiveColor || '#c96442',
    fontWeight: subtitleFontWeight || 400,
    shadow: subtitleShadow !== false,
    shadowBlur: subtitleShadowBlur || 2,
  }

  const adjustedTime = currentTime + localSettings.timeOffset
  const currentIndex = findCurrentCue(cues, adjustedTime)

  useEffect(() => {
    if (currentIndex < 0 || !containerRef.current) return
    const activeEl = containerRef.current.querySelector(`[data-idx="${currentIndex}"]`)
    if (activeEl) {
      const container = containerRef.current
      const activeRect = activeEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const offsetTop = activeEl.offsetTop - container.offsetTop
      const targetScroll = offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }
  }, [currentIndex])

  const handleLocalSettingsChange = (newLocalSettings) => {
    setLocalSettings(newLocalSettings)
    try {
      const saved = localStorage.getItem('subtitleSettings')
      const existing = saved ? JSON.parse(saved) : {}
      localStorage.setItem('subtitleSettings', JSON.stringify({ ...existing, ...newLocalSettings }))
    } catch (e) {}
  }

  const shadowStyle = styleSettings.shadow
    ? `0 0 ${styleSettings.shadowBlur}px rgba(0, 0, 0, 0.5), 0 1px ${styleSettings.shadowBlur + 1}px rgba(0, 0, 0, 0.3)`
    : 'none'

  if (!cues || cues.length === 0) {
    return (
      <div className="lyric-view empty">
        <SubtitleSelector
          subtitles={subtitleOptions || []}
          selectedIndex={selectedSubtitleIndex ?? -1}
          onSelect={onSelectSubtitle}
          settings={localSettings}
          onSettingsChange={handleLocalSettingsChange}
          onAddSubtitleFile={onAddSubtitleFile}
          onToggleTranslate={onToggleTranslate}
          isTranslating={isTranslating}
          hasTranslation={hasTranslation}
        />
        <div className="empty-subtitle-content">
          <img src="/subtitle-illustration.png" alt="" className="subtitle-illustration" />
          <p>暂无字幕</p>
          <p className="hint">点击上方选择器添加字幕文件</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`lyric-view ${hasTranslation ? 'dual-mode' : ''}`}
      ref={containerRef}
      style={{
        '--lyric-font-size': `${styleSettings.fontSize}px`,
        '--lyric-color': styleSettings.color,
        '--lyric-active-color': styleSettings.activeColor,
        '--lyric-font-weight': styleSettings.fontWeight,
        '--lyric-text-shadow': shadowStyle,
      }}
    >
      <SubtitleSelector
        subtitles={subtitleOptions || []}
        selectedIndex={selectedSubtitleIndex ?? -1}
        onSelect={onSelectSubtitle}
        settings={localSettings}
        onSettingsChange={handleLocalSettingsChange}
        onAddSubtitleFile={onAddSubtitleFile}
        onToggleTranslate={onToggleTranslate}
        isTranslating={isTranslating}
        hasTranslation={hasTranslation}
      />
      <div className="lyric-title">歌词本</div>
      <div className="lyric-divider"></div>
      <div className="lyric-list">
        {cues.map((cue, idx) => (
          <div
            key={idx}
            data-idx={idx}
            className={`lyric-line ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'past' : ''}`}
            onClick={() => onSeek && onSeek(cue.time)}
          >
            <div className="lyric-indicator"></div>
            <span className="lyric-time">{formatTime(cue.time)}</span>
            <div className="lyric-text-container">
              <span className="lyric-text">{cue.text}</span>
              {hasTranslation && cue.translated && (
                <span className="lyric-translated">{cue.translated}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default LyricView
