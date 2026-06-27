import { useState } from 'react'
import './SubtitleSelector.css'

const formatLabels = {
  vtt: 'VTT',
  srt: 'SRT',
  lrc: 'LRC',
}

const languageLabels = {
  zh: '中文',
  ja: '日文',
  en: '英文',
  dual: '双语',
  unknown: '未知',
}

const PRESET_COLORS = [
  '#f472b6',
  '#c96442',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#ffffff',
]

export default function SubtitleSelector({ subtitles, selectedIndex, onSelect, settings, onSettingsChange, onAddSubtitleFile }) {
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleSelect = (index) => {
    onSelect && onSelect(index)
    setIsOpen(false)
  }

  const handleSettingChange = (key, value) => {
    if (onSettingsChange && settings) {
      onSettingsChange({ ...settings, [key]: value })
    }
  }

  const currentSubtitle = selectedIndex >= 0 && subtitles[selectedIndex]

  const fontSizePercent = settings ? ((settings.fontSize - 12) / (24 - 12)) * 100 : 100
  const offsetPercent = settings ? ((settings.timeOffset - (-5)) / (5 - (-5))) * 100 : 50

  return (
    <div className={`subtitle-selector ${isOpen ? 'open' : ''} ${settingsOpen ? 'settings-open' : ''}`}>
      <div className="selector-header">
        <button
          className="selector-trigger"
          onClick={() => {
            setIsOpen(!isOpen)
            setSettingsOpen(false)
          }}
        >
          <span className="selector-label">字幕</span>
          <span className="selector-value">
            {currentSubtitle ? currentSubtitle.displayName : '无字幕'}
          </span>
          <span className="selector-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
        <button
          className={`settings-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => {
            setSettingsOpen(!settingsOpen)
            setIsOpen(false)
          }}
          title="字幕设置"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="selector-dropdown">
          <div
            className={`subtitle-item ${selectedIndex === -1 ? 'active' : ''}`}
            onClick={() => handleSelect(-1)}
          >
            <span className="subtitle-name">无字幕</span>
          </div>

          {subtitles.map((sub, idx) => (
            <div
              key={idx}
              className={`subtitle-item ${selectedIndex === idx ? 'active' : ''}`}
              onClick={() => handleSelect(idx)}
            >
              <span className="subtitle-name">{sub.displayName}</span>
              <div className="subtitle-tags">
                {sub.format && (
                  <span className={`tag tag-format tag-${sub.format}`}>
                    {formatLabels[sub.format] || sub.format.toUpperCase()}
                  </span>
                )}
                {sub.language && (
                  <span className={`tag tag-lang tag-${sub.language}`}>
                    {languageLabels[sub.language] || sub.language}
                  </span>
                )}
              </div>
            </div>
          ))}

          <div className="subtitle-divider" />
          <div
            className="subtitle-item add-subtitle"
            onClick={async () => {
              if (onAddSubtitleFile) {
                await onAddSubtitleFile()
              }
            }}
          >
            <span className="subtitle-name">+ 添加字幕文件</span>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-header">
            <span className="settings-title">字幕设置</span>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>字体大小</span>
              <span className="setting-value">{settings?.fontSize || 14}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="24"
              step="1"
              value={settings?.fontSize || 14}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="setting-slider"
              style={{ backgroundSize: `${fontSizePercent}% 100%` }}
            />
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>字幕颜色</span>
            </div>
            <div className="color-presets">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={`color-preset ${settings?.color === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleSettingChange('color', color)}
                />
              ))}
              <label className="color-custom">
                <input
                  type="color"
                  value={settings?.color || '#f472b6'}
                  onChange={(e) => handleSettingChange('color', e.target.value)}
                />
                <span className="color-custom-icon">+</span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>时间轴偏移</span>
              <span className="setting-value">{settings?.timeOffset >= 0 ? '+' : ''}{(settings?.timeOffset || 0).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.1"
              value={settings?.timeOffset || 0}
              onChange={(e) => handleSettingChange('timeOffset', parseFloat(e.target.value))}
              className="setting-slider"
              style={{ backgroundSize: `${offsetPercent}% 100%` }}
            />
            <div className="slider-labels">
              <span>-5s</span>
              <span>+5s</span>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>显示模式</span>
            </div>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${settings?.displayMode === 'single' ? 'active' : ''}`}
                onClick={() => handleSettingChange('displayMode', 'single')}
              >
                单语
              </button>
              <button
                className={`mode-btn ${settings?.displayMode === 'dual' ? 'active' : ''}`}
                onClick={() => handleSettingChange('displayMode', 'dual')}
                disabled
              >
                双语
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
