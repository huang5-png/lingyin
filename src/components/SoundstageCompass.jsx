import { useState, useCallback, memo } from 'react'
import { useSoundstage } from '../hooks/useSoundstage'
import StateView from './StateView'
import './SoundstageCompass.css'

const SoundstageCompass = memo(function SoundstageCompass({
  audioElement = null,
  compact = false,
  onOpenPanel = null,
  className = '',
}) {
  const [viewMode, setViewMode] = useState('compass') // 'compass' | 'meters'
  const soundstage = useSoundstage({
    audioElement,
    enabled: true,
    sensitivity: 1.2,
  })

  const {
    leftRms,
    rightRms,
    pan,
    azimuth,
    stereoWidth,
    bands,
    panText,
    isActive,
  } = soundstage

  // 紧凑模式（供播放栏等小位置展示）
  if (compact) {
    // pan 从 -1..1 映射到 0%..100%
    const cursorLeftPercent = Math.max(0, Math.min(100, ((pan + 1) / 2) * 100))
    return (
      <div
        className={`soundstage-compact ${className}`}
        onClick={onOpenPanel}
        title={`双耳立体声场：${panText}，立体声分离度 ${stereoWidth}%`}
      >
        <span style={{ fontSize: '11px', opacity: 0.8 }}>L</span>
        <div className="soundstage-compact-track">
          <div
            className="soundstage-compact-cursor"
            style={{ left: `${cursorLeftPercent}%` }}
          />
        </div>
        <span style={{ fontSize: '11px', opacity: 0.8 }}>R</span>
      </div>
    )
  }

  // 罗盘 SVG 几何计算 (中心 140, 115, 半径 90)
  const cx = 140
  const cy = 115
  const radius = 85

  // azimuth 范围是 -90° (左) 到 +90° (右)
  // 转换成圆弧角度：0°方位角对应正上方 (90°角, 即 x = cx, y = cy - radius)
  // azimuth = -90° -> 180°角 (x = cx - radius, y = cy)
  // azimuth = +90° -> 0°角 (x = cx + radius, y = cy)
  const rad = ((90 - azimuth) * Math.PI) / 180
  const cursorX = cx + radius * Math.cos(rad)
  const cursorY = cy - radius * Math.sin(rad)

  // 刻度线配置
  const ticks = [-90, -60, -30, 0, 30, 60, 90]

  return (
    <div className={`soundstage-compass-card ${className}`}>
      <div className="soundstage-header">
        <div className="soundstage-title-wrap">
          <span className="soundstage-icon">🎧</span>
          <h3 className="soundstage-title">双耳声场罗盘</h3>
          <span className="soundstage-badge">Binaural Radar</span>
        </div>
        <div className="soundstage-mode-tabs">
          <button
            className={`soundstage-mode-btn ${viewMode === 'compass' ? 'active' : ''}`}
            onClick={() => setViewMode('compass')}
          >
            罗盘
          </button>
          <button
            className={`soundstage-mode-btn ${viewMode === 'meters' ? 'active' : ''}`}
            onClick={() => setViewMode('meters')}
          >
            声能
          </button>
        </div>
      </div>

      {!audioElement ? (
        <StateView
          type="empty"
          iconType="music"
          size="sm"
          title="等待音频播放"
          description="播放带有立体声/双耳录音的音声以实时分析空间方位"
        />
      ) : (
        <div className="soundstage-dial-container">
          {viewMode === 'compass' ? (
            <svg
              className="soundstage-svg"
              viewBox="0 0 280 145"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="compass-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--accent, #c96442)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--accent, #c96442)" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="var(--accent, #c96442)" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>

              {/* 180° 半圆弧背景轨 */}
              <path
                d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* 动态声场弧高亮 */}
              <path
                d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                stroke="url(#arc-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity={isActive ? Math.min(1, Math.max(0.3, (leftRms + rightRms) * 1.5)) : 0.2}
              />

              {/* 刻度线与文字 */}
              {ticks.map((deg) => {
                const tickRad = ((90 - deg) * Math.PI) / 180
                const x1 = cx + (radius - 8) * Math.cos(tickRad)
                const y1 = cy - (radius - 8) * Math.sin(tickRad)
                const x2 = cx + (radius + 2) * Math.cos(tickRad)
                const y2 = cy - (radius + 2) * Math.sin(tickRad)
                const labelX = cx + (radius + 15) * Math.cos(tickRad)
                const labelY = cy - (radius + 15) * Math.sin(tickRad)

                let label = `${Math.abs(deg)}°`
                if (deg === -90) label = 'L'
                if (deg === 90) label = 'R'
                if (deg === 0) label = 'C'

                return (
                  <g key={deg}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth="1.5"
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      fill="var(--text-secondary, #a89f91)"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {label}
                    </text>
                  </g>
                )
              })}

              {/* 头部/双耳虚拟中心轮廓 */}
              <circle
                cx={cx}
                cy={cy}
                r="18"
                fill="rgba(0, 0, 0, 0.4)"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1.5"
              />
              <path
                d={`M ${cx - 7} ${cy - 5} C ${cx - 3} ${cy - 10}, ${cx + 3} ${cy - 10}, ${cx + 7} ${cy - 5} C ${cx + 10} ${cy}, ${cx + 5} ${cy + 8}, ${cx} ${cy + 9} C ${cx - 5} ${cy + 8}, ${cx - 10} ${cy}, ${cx - 7} ${cy - 5} Z`}
                fill="var(--accent, #c96442)"
                opacity="0.3"
              />
              {/* 耳机左右耳垫 */}
              <rect x={cx - 22} y={cy - 6} width="4" height="12" rx="2" fill="#38bdf8" opacity="0.7" />
              <rect x={cx + 18} y={cy - 6} width="4" height="12" rx="2" fill="#ec4899" opacity="0.7" />

              {/* 方位引导虚线 */}
              <line
                x1={cx}
                y1={cy}
                x2={cursorX}
                y2={cursorY}
                stroke="var(--accent, #c96442)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity={isActive ? 0.6 : 0.2}
              />

              {/* 灵动声源光斑与微光光晕 */}
              <circle
                cx={cursorX}
                cy={cursorY}
                r={isActive ? 12 : 6}
                fill="url(#compass-glow)"
              />
              <circle
                cx={cursorX}
                cy={cursorY}
                r={isActive ? 5 : 3}
                fill="#ffffff"
                stroke="var(--accent, #c96442)"
                strokeWidth="2"
              />
            </svg>
          ) : (
            /* 声能仪表视图 */
            <div style={{ width: '100%', padding: '10px 0' }}>
              <div className="soundstage-meters-row">
                <div className="soundstage-meter-col">
                  <div className="soundstage-meter-head">
                    <span>左耳声压 (L)</span>
                    <span>{Math.round(leftRms * 100)}%</span>
                  </div>
                  <div className="soundstage-meter-track">
                    <div
                      className="soundstage-meter-fill left"
                      style={{ width: `${Math.round(leftRms * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="soundstage-meter-col">
                  <div className="soundstage-meter-head">
                    <span>右耳声压 (R)</span>
                    <span>{Math.round(rightRms * 100)}%</span>
                  </div>
                  <div className="soundstage-meter-track">
                    <div
                      className="soundstage-meter-fill right"
                      style={{ width: `${Math.round(rightRms * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 实时状态提示 */}
          <div className="soundstage-status-bar">
            <div className="soundstage-pan-desc">
              <span className="soundstage-indicator-dot" />
              <span>{panText}</span>
            </div>
            <div className="soundstage-width-tag">
              分离度: <span className="soundstage-width-val">{stereoWidth}%</span>
            </div>
          </div>

          {/* 频段微徽标 */}
          <div className="soundstage-bands-row">
            <div className="soundstage-band-pill" title="低频共鸣">
              <span>低音</span>
              <div className="soundstage-band-bar">
                <div
                  className="soundstage-band-progress"
                  style={{ width: `${Math.round(bands.bass * 100)}%` }}
                />
              </div>
            </div>
            <div className="soundstage-band-pill" title="人声耳语/呼吸核心频段">
              <span>耳语</span>
              <div className="soundstage-band-bar">
                <div
                  className="soundstage-band-progress"
                  style={{ width: `${Math.round(bands.vocal * 100)}%` }}
                />
              </div>
            </div>
            <div className="soundstage-band-pill" title="高频空气感/摩擦微音">
              <span>空气感</span>
              <div className="soundstage-band-bar">
                <div
                  className="soundstage-band-progress"
                  style={{ width: `${Math.round(bands.air * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default SoundstageCompass
