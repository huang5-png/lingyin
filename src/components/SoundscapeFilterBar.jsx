import { memo } from 'react'
import { SCENERY_PRESETS } from '../utils/soundscapeAnalyzer'
import './SoundscapeFilterBar.css'

export const SoundscapeFilterBar = memo(function SoundscapeFilterBar({
  activeSceneryId = null,
  activeScenery = null,
  onSelectScenery = null,
  onClearScenery = null,
  sceneryCounts = null,
}) {
  const currentActiveId = activeSceneryId || activeScenery

  const handleClear = () => {
    if (onClearScenery) {
      onClearScenery()
    } else if (onSelectScenery && currentActiveId) {
      onSelectScenery(currentActiveId) // toggle off
    }
  }

  return (
    <div className="soundscape-filter-container">
      <div className="soundscape-filter-header">
        <div className="soundscape-header-left">
          <span className="soundscape-title-icon">🧭</span>
          <span className="soundscape-title-text">声景情境漫游</span>
        </div>
        {currentActiveId && (
          <button
            type="button"
            className="soundscape-clear-btn"
            onClick={handleClear}
            title="清除声景筛选"
          >
            重置透镜 ✕
          </button>
        )}
      </div>

      <div className="soundscape-pills-scroll">
        {SCENERY_PRESETS.map((preset) => {
          const isActive = preset.id === currentActiveId
          const count = sceneryCounts?.[preset.id]
          return (
            <button
              key={preset.id}
              type="button"
              className={`soundscape-pill ${isActive ? 'active' : ''}`}
              style={{
                '--preset-color': preset.color,
                '--preset-bg': preset.bg,
              }}
              onClick={() => {
                if (onSelectScenery) onSelectScenery(preset.id)
              }}
              title={`${preset.name} · ${preset.description}${count !== undefined ? ` (共 ${count} 部作品)` : ''}`}
            >
              <span className="pill-icon">{preset.icon}</span>
              <span className="pill-name">{preset.name}</span>
              {typeof count === 'number' && count > 0 && (
                <span className="pill-count">{count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})

export default SoundscapeFilterBar
