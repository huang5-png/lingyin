import { useState, useEffect, useCallback, memo } from 'react'
import { SENSORY_STAMP_TYPES } from '../utils/chronicleHelpers.js'
import { formatTime } from '../utils/subtitleParser.js'
import './SensoryStampModal.css'

const SensoryStampModal = memo(function SensoryStampModal({
  isOpen,
  currentTime = 0,
  currentAudio,
  onClose,
  onSaveStamp,
}) {
  const [selectedType, setSelectedType] = useState('whisper')
  const [rating, setRating] = useState(5)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSelectedType('whisper')
      setRating(5)
      setNote('')
    }
  }, [isOpen])

  // ESC 关闭弹窗
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault()
      onSaveStamp?.({
        type: selectedType,
        rating,
        note: note.trim(),
        time: currentTime,
      })
      onClose?.()
    },
    [selectedType, rating, note, currentTime, onSaveStamp, onClose],
  )

  if (!isOpen) return null

  return (
    <div className="sensory-stamp-modal-backdrop" onClick={onClose}>
      <div
        className="sensory-stamp-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stamp-modal-header">
          <div className="stamp-modal-title">
            <span className="stamp-modal-icon">💖</span>
            <span>记录心动瞬间 · 感官印记</span>
          </div>
          <button className="stamp-modal-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="stamp-modal-meta">
          <span className="stamp-meta-time">⏱️ {formatTime(currentTime)}</span>
          <span className="stamp-meta-audio" title={currentAudio?.displayName || currentAudio?.name}>
            🎵 {currentAudio?.displayName || currentAudio?.name || '当前曲目'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="stamp-modal-form">
          {/* 感官类型单选 */}
          <div className="stamp-form-group">
            <label className="stamp-form-label">感官触碰类型</label>
            <div className="stamp-types-grid">
              {SENSORY_STAMP_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.id}
                  className={`stamp-type-card ${selectedType === type.id ? 'active' : ''}`}
                  onClick={() => setSelectedType(type.id)}
                  style={{
                    '--card-color': type.color,
                  }}
                >
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-name">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 酥麻星级打分 */}
          <div className="stamp-form-group">
            <label className="stamp-form-label">酥麻心动强度</label>
            <div className="stamp-rating-selector">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  className={`stamp-star-btn ${rating >= star ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  title={`${star} 星`}
                >
                  ★
                </button>
              ))}
              <span className="stamp-rating-text">
                {rating === 5 && '🌟 极致酥麻·颅内共鸣'}
                {rating === 4 && '✨ 强烈触动·心跳加速'}
                {rating === 3 && '💫 温暖温润·舒适安抚'}
                {rating === 2 && '🍃 细腻微弱·轻柔拂耳'}
                {rating === 1 && '🌱 浅尝清静'}
              </span>
            </div>
          </div>

          {/* 灵感笔记 */}
          <div className="stamp-form-group">
            <label className="stamp-form-label">瞬间听感笔记 (可选)</label>
            <input
              type="text"
              className="stamp-note-input"
              placeholder="记录这句耳语台词或心动感受..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="stamp-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary">
              落印此刻
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})

export default SensoryStampModal
