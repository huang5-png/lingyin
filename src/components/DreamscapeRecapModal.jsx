import { memo, useCallback } from 'react'
import { formatTime } from '../utils/subtitleParser'
import './DreamscapeRecapModal.css'

export const DreamscapeRecapModal = memo(function DreamscapeRecapModal({
  isOpen = false,
  onClose = null,
  record = null,
  onContinueFromSlumber = null,
  onResumePlayback = null,
  onToast = null,
}) {
  const handleContinue = onContinueFromSlumber || onResumePlayback
  const handleCopyRecapText = useCallback(() => {
    if (!record) return
    const text = `🌅【聆音 · 晨光拂晓入眠手签】
━━━━━━━━━━━━━━━━━━
昨夜于 ${record.clockDisplay} 安然入梦
陪伴音声：《${record.workTitle}》
声优陪伴：${record.primaryCV}
入眠节点：第 ${formatTime(record.estimatedTrackSeconds)}
助眠时长：${record.slumberDurationMinutes} 分钟
意境签语：${record.mood?.quote || '夜色微澜，温柔沉淀。'}
━━━━━━━━━━━━━━━━━━
来自 聆音 Lingyin ASMR 播放器`

    navigator.clipboard?.writeText?.(text)
    if (onToast) {
      onToast({
        type: 'success',
        message: '晨曦入眠手账已复制到剪贴板 📋',
      })
    }
  }, [record, onToast])

  if (!isOpen || !record) return null

  return (
    <div className="dreamscape-modal-backdrop" onClick={onClose}>
      <div className="dreamscape-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* 顶部晨曦流光 */}
        <div className="dreamscape-header-glow" />

        <div className="dreamscape-modal-header">
          <div className="dreamscape-badge">🌅 晨光拂晓 · 梦境声纹记忆画卷</div>
          <button type="button" className="dreamscape-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dreamscape-content">
          {/* 核心入眠时刻大卡 */}
          <div className="dreamscape-hero">
            <div className="dreamscape-clock-tag">{record.clockDisplay} 安然入眠</div>
            <div className="dreamscape-hero-quote">{record.mood?.quote}</div>
          </div>

          {/* 音声与声优陪伴卡 */}
          <div className="dreamscape-work-row">
            {record.workCover && (
              <img src={record.workCover} alt="" className="dreamscape-work-cover" />
            )}
            <div className="dreamscape-work-info">
              <div className="dreamscape-work-title">{record.workTitle}</div>
              <div className="dreamscape-cv-badge">
                <span className="cv-icon">🎙️</span>
                <span className="cv-text">{record.primaryCV}</span>
                {record.circle && <span className="circle-text">· {record.circle}</span>}
              </div>
              <div className="dreamscape-track-info">
                入眠段落：{record.audioName} (约 {formatTime(record.estimatedTrackSeconds)})
              </div>
            </div>
          </div>

          {/* 三联梦境声学指数 */}
          <div className="dreamscape-stats-grid">
            <div className="stat-card">
              <span className="stat-label">深度伴眠时长</span>
              <span className="stat-value">{record.slumberDurationMinutes} <small>分钟</small></span>
            </div>
            <div className="stat-card">
              <span className="stat-label">入眠意境</span>
              <span className="stat-value">{record.mood?.icon} {record.mood?.title}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">心动感官印记</span>
              <span className="stat-value">{record.stampsCount} <small>处</small></span>
            </div>
          </div>
        </div>

        {/* 底部行动按钮 */}
        <div className="dreamscape-footer">
          <button
            type="button"
            className="dreamscape-copy-btn"
            onClick={handleCopyRecapText}
          >
            📋 复制晨曦手签
          </button>
          {handleContinue && (
            <button
              type="button"
              className="dreamscape-continue-btn"
              onClick={() => {
                handleContinue(record)
                if (onClose) onClose()
              }}
            >
              ▶ 从昨夜入眠点继续听 ({formatTime(record.estimatedTrackSeconds)})
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default DreamscapeRecapModal
