import { useEffect, useRef, useState } from 'react'
import { findCurrentCue, formatTime } from '../utils/subtitleParser'
import SubtitleSelector from './SubtitleSelector'
import './LyricView.css'

const DEFAULT_SETTINGS = {
  fontSize: 14,
  color: '#f472b6',
  timeOffset: 0,
  displayMode: 'single',
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('subtitleSettings')
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS }
}

export default function LyricView({ cues, currentTime, onSeek, subtitleOptions, selectedSubtitleIndex, onSelectSubtitle, onAddSubtitleFile, onToggleTranslate, isTranslating, hasTranslation }) {
  const containerRef = useRef(null)
  const [settings, setSettings] = useState(loadSettings)

  const adjustedTime = currentTime + settings.timeOffset
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

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings)
    try {
      localStorage.setItem('subtitleSettings', JSON.stringify(newSettings))
    } catch (e) {}
  }

  if (!cues || cues.length === 0) {
    return (
      <div className="lyric-view empty">
        <SubtitleSelector
          subtitles={subtitleOptions || []}
          selectedIndex={selectedSubtitleIndex ?? -1}
          onSelect={onSelectSubtitle}
          settings={settings}
          onSettingsChange={handleSettingsChange}
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
        '--lyric-font-size': `${settings.fontSize}px`,
        '--lyric-active-color': settings.color,
      }}
    >
      <SubtitleSelector
        subtitles={subtitleOptions || []}
        selectedIndex={selectedSubtitleIndex ?? -1}
        onSelect={onSelectSubtitle}
        settings={settings}
        onSettingsChange={handleSettingsChange}
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
}
