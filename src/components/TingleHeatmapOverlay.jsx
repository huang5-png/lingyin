import { memo } from 'react'
import './TingleHeatmapOverlay.css'

/**
 * TingleHeatmapOverlay 组件
 * 在波形上方以极度柔和的半透明光流展现 ASMR 酥麻能量热力带与感官心动图钉
 */
const TingleHeatmapOverlay = memo(function TingleHeatmapOverlay({
  heatmapData = [],
  duration = 0,
  peakMoments = [],
  stamps = [],
  onSeekToPeak,
  onSeekToStamp,
}) {
  if (duration <= 0) return null

  return (
    <div className="tingle-heatmap-overlay" pointer-events="none">
      {/* 酥麻声能热力流背景光带 */}
      {heatmapData.length > 0 && (
        <div className="tingle-heatmap-bars">
          {heatmapData.map((bin) => {
            const leftPct = (bin.time / duration) * 100
            const heightPct = Math.max(12, Math.min(100, bin.intensity * 100))
            const isHigh = bin.intensity >= 0.65
            return (
              <div
                key={bin.index}
                className={`tingle-bar ${isHigh ? 'high-energy' : ''}`}
                style={{
                  left: `${leftPct}%`,
                  height: `${heightPct}%`,
                  opacity: 0.2 + bin.intensity * 0.45,
                }}
              />
            )
          })}
        </div>
      )}

      {/* 高能峰值图钉 */}
      {peakMoments.length > 0 && (
        <div className="tingle-peaks-layer">
          {peakMoments.map((peak) => {
            const leftPct = Math.max(0, Math.min(100, (peak.time / duration) * 100))
            return (
              <div
                key={peak.id}
                className="tingle-peak-pin"
                style={{ left: `${leftPct}%` }}
                title={`${peak.label} (${peak.timeFormatted})，点击跳转`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSeekToPeak?.(peak)
                }}
              >
                <div className="peak-pin-sparkle">🔥</div>
                <div className="peak-pin-line" />
              </div>
            )
          })}
        </div>
      )}

      {/* 感官心动印记图钉 */}
      {stamps.length > 0 && (
        <div className="tingle-stamps-layer">
          {stamps.map((stamp) => {
            const leftPct = Math.max(0, Math.min(100, (stamp.time / duration) * 100))
            return (
              <div
                key={stamp.id}
                className="tingle-stamp-pin"
                style={{ left: `${leftPct}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSeekToStamp?.(stamp)
                }}
              >
                <div
                  className="stamp-pin-bubble"
                  style={{
                    boxShadow: `0 0 8px ${stamp.color || '#ec4899'}88`,
                    borderColor: stamp.color || '#ec4899',
                  }}
                  title={`${stamp.icon} ${stamp.typeLabel} (${stamp.timeFormatted}) ★${stamp.rating}${stamp.note ? `\n"${stamp.note}"` : ''}`}
                >
                  <span className="stamp-icon">{stamp.icon}</span>
                </div>
                <div
                  className="stamp-pin-line"
                  style={{ backgroundColor: stamp.color || '#ec4899' }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default TingleHeatmapOverlay
