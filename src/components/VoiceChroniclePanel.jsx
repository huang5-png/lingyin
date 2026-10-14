import { memo, useMemo, useState } from 'react'
import {
  CHRONICLE_TIERS,
  RADAR_DIMENSIONS,
  calculateRadarPoints,
  pointsToSvgPolygon,
} from '../utils/chronicleHelpers.js'
import StateView from './StateView'
import './VoiceChroniclePanel.css'

const VoiceChroniclePanel = memo(function VoiceChroniclePanel({
  work,
  currentAudio,
  currentTime,
  chronicleData = {},
  stamps = [],
  onUpdateChronicle,
  onOpenStampModal,
  onOpenPosterModal,
  onSeekToStamp,
  onDeleteStamp,
  onToast,
}) {
  const [equipmentInput, setEquipmentInput] = useState(chronicleData.equipment || '')
  const [notesInput, setNotesInput] = useState(chronicleData.notes || '')

  const radarScores = useMemo(() => {
    return chronicleData.radar || {}
  }, [chronicleData.radar])

  // 雷达图多边形顶点计算 (中心 90, 90, 半径 65)
  const radarPoints = useMemo(() => {
    return calculateRadarPoints(radarScores, 90, 90, 65)
  }, [radarScores])

  const polygonPointsStr = useMemo(() => {
    return pointsToSvgPolygon(radarPoints)
  }, [radarPoints])

  // 网格标尺多边形 (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0]

  if (!work) {
    return (
      <div className="empty-panel">
        <StateView
          type="empty"
          iconType="audio"
          size="sm"
          title="未选择作品"
          description="选择一个音声作品以开启专属听风手账档案"
        />
      </div>
    )
  }

  const handleRadarChange = (key, value) => {
    const nextScores = { ...radarScores, [key]: Number(value) }
    onUpdateChronicle?.({ radar: nextScores })
  }

  const handleTierChange = (tierId) => {
    onUpdateChronicle?.({ tier: tierId })
  }

  const handleSaveTextData = () => {
    onUpdateChronicle?.({
      equipment: equipmentInput.trim(),
      notes: notesInput.trim(),
    })
  }

  return (
    <div className="voice-chronicle-panel">
      {/* 头部评级选择器 */}
      <div className="chronicle-section">
        <div className="chronicle-section-header">
          <span className="section-title">🏆 鉴赏评级</span>
          <span className="section-badge">
            {CHRONICLE_TIERS.find((t) => t.id === chronicleData.tier)?.badge || '👑 殿堂级'}
          </span>
        </div>
        <div className="chronicle-tier-selector">
          {CHRONICLE_TIERS.map((tier) => (
            <button
              key={tier.id}
              className={`chronicle-tier-btn ${chronicleData.tier === tier.id ? 'active' : ''}`}
              style={{ '--tier-color': tier.color }}
              onClick={() => handleTierChange(tier.id)}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* 四维听感雷达图 */}
      <div className="chronicle-section">
        <div className="chronicle-section-header">
          <span className="section-title">🎨 四维音声听感图谱</span>
        </div>
        <div className="chronicle-radar-container">
          <svg className="chronicle-radar-svg" viewBox="0 0 180 180">
            {/* 网格背景线 */}
            {gridLevels.map((lvl, idx) => {
              const pts = calculateRadarPoints(
                { intimacy: 10 * lvl, sleepiness: 10 * lvl, story: 10 * lvl, spatial: 10 * lvl },
                90,
                90,
                65,
              )
              return (
                <polygon
                  key={idx}
                  points={pointsToSvgPolygon(pts)}
                  className="radar-grid-polygon"
                />
              )
            })}
            {/* 轴线 */}
            <line x1="90" y1="25" x2="90" y2="155" className="radar-axis-line" />
            <line x1="25" y1="90" x2="155" y2="90" className="radar-axis-line" />

            {/* 数据多边形 */}
            <polygon points={polygonPointsStr} className="radar-data-polygon" />

            {/* 数据节点与文字标签 */}
            {radarPoints.map((p) => (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r="3.5" className="radar-data-circle" />
                <text
                  x={p.key === 'intimacy' ? 90 : p.key === 'sleepiness' ? 168 : p.key === 'story' ? 90 : 12}
                  y={p.key === 'intimacy' ? 16 : p.key === 'sleepiness' ? 94 : p.key === 'story' ? 172 : 94}
                  textAnchor="middle"
                  className="radar-label-text"
                >
                  {p.short} {p.score}
                </text>
              </g>
            ))}
          </svg>

          {/* 维度微调滑块 */}
          <div className="radar-sliders-list">
            {RADAR_DIMENSIONS.map((dim) => {
              const val = radarScores[dim.key] !== undefined ? radarScores[dim.key] : 8
              return (
                <div key={dim.key} className="radar-slider-row">
                  <span className="slider-label">{dim.label}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={val}
                    onChange={(e) => handleRadarChange(dim.key, e.target.value)}
                    className="radar-range-input"
                  />
                  <span className="slider-val">{val}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 听音装备与短评 */}
      <div className="chronicle-section">
        <div className="chronicle-section-header">
          <span className="section-title">🎧 听风手账笔记</span>
        </div>
        <div className="chronicle-inputs">
          <div className="chronicle-input-group">
            <label className="input-label">鉴赏耳机器材</label>
            <input
              type="text"
              placeholder="例如：Final E500 / 索尼 WF-1000XM5"
              value={equipmentInput}
              onChange={(e) => setEquipmentInput(e.target.value)}
              onBlur={handleSaveTextData}
              className="chronicle-text-input"
              maxLength={40}
            />
          </div>
          <div className="chronicle-input-group">
            <label className="input-label">听后感悟与鉴赏评价</label>
            <textarea
              placeholder="记录这部音声的声优耳语表现、剧本情绪沉浸、助眠心境..."
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              onBlur={handleSaveTextData}
              className="chronicle-textarea"
              rows={3}
              maxLength={300}
            />
          </div>
        </div>
      </div>

      {/* 心动感官印记流 */}
      <div className="chronicle-section">
        <div className="chronicle-section-header">
          <span className="section-title">💖 感官心动瞬间 ({stamps.length})</span>
          <button
            className="chronicle-add-stamp-btn"
            onClick={onOpenStampModal}
            title="打点记录当前时刻"
          >
            + 打点此刻
          </button>
        </div>

        {stamps.length === 0 ? (
          <div className="chronicle-empty-stamps">
            <p>聆听中遇到心动耳语或酥麻高潮时，点击右上角「+ 打点此刻」记录下来吧</p>
          </div>
        ) : (
          <div className="chronicle-stamps-timeline">
            {stamps.map((st) => (
              <div
                key={st.id}
                className="chronicle-stamp-item"
                onClick={() => onSeekToStamp?.(st)}
                title="点击跳转播放"
              >
                <div
                  className="stamp-item-icon"
                  style={{ backgroundColor: `${st.color}22`, borderColor: st.color }}
                >
                  {st.icon}
                </div>
                <div className="stamp-item-content">
                  <div className="stamp-item-top">
                    <span className="stamp-item-name">{st.typeLabel}</span>
                    <span className="stamp-item-time">{st.timeFormatted}</span>
                    <span className="stamp-item-stars">{'★'.repeat(st.rating)}</span>
                  </div>
                  {st.note && <div className="stamp-item-note">"{st.note}"</div>}
                  <div className="stamp-item-audio">{st.audioName}</div>
                </div>
                <button
                  className="stamp-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteStamp?.(st.id)
                  }}
                  title="删除该打点"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部导出海报卡片大按钮 */}
      <div className="chronicle-footer">
        <button
          className="chronicle-export-poster-btn"
          onClick={onOpenPosterModal}
          title="生成精美的高清音声鉴赏海报手账卡片"
        >
          <span className="poster-sparkle">✨</span>
          <span>生成鉴赏手账海报卡</span>
        </button>
      </div>
    </div>
  )
})

export default VoiceChroniclePanel
