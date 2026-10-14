import { memo, useState, useMemo } from 'react'
import './VariantComparisonModal.css'

export const VariantComparisonModal = memo(function VariantComparisonModal({
  isOpen = false,
  onClose = null,
  currentAudio = null,
  currentTrack = null,
  currentVariant = null,
  targetVariant = null,
  variantGroup = null,
  onHotSwap = null,
  onSelectTrack = null,
}) {
  const activeAudio = currentAudio || currentTrack

  // 计算当前变体与组内所有候选变体
  const groupVariants = useMemo(() => {
    if (variantGroup?.variants) {
      return variantGroup.variants.map(v => {
        const audioObj = v.track || v.audio
        return {
          id: audioObj?.path || v.id,
          audio: audioObj,
          label: v.variantInfo?.label || v.label,
          icon: v.variantInfo?.icon || v.icon,
          category: v.variantInfo?.category || v.category,
          subType: v.variantInfo?.subType || v.subType,
          rawName: audioObj?.displayName || audioObj?.name || v.rawName,
        }
      })
    }
    return []
  }, [variantGroup])

  // 内部选中的目标变体状态
  const [selectedTarget, setSelectedTarget] = useState(null)

  const effectiveTarget = useMemo(() => {
    if (selectedTarget) return selectedTarget
    if (targetVariant) {
      return {
        id: targetVariant.audio?.path || targetVariant.id,
        audio: targetVariant.audio || targetVariant.track,
        label: targetVariant.label,
        icon: targetVariant.icon,
        category: targetVariant.category,
        subType: targetVariant.subType,
        rawName: targetVariant.rawName || targetVariant.audio?.name,
      }
    }
    if (groupVariants.length > 0) {
      // 默认选择第一个非当前播放音轨的变体
      const candidate = groupVariants.find(v => v.audio?.path !== activeAudio?.path)
      return candidate || groupVariants[0]
    }
    return null
  }, [selectedTarget, targetVariant, groupVariants, activeAudio])

  if (!isOpen) return null

  const curFormat = activeAudio?.path?.split('.').pop()?.toUpperCase() || 'WAV'
  const tarFormat = effectiveTarget?.audio?.path?.split('.').pop()?.toUpperCase() || 'FLAC'

  const handleConfirmSwap = () => {
    if (!effectiveTarget) return
    if (onHotSwap) {
      onHotSwap(effectiveTarget)
    } else if (onSelectTrack && effectiveTarget.audio) {
      onSelectTrack(effectiveTarget.audio)
    }
    if (onClose) onClose()
  }

  return (
    <div className="variant-modal-backdrop" onClick={onClose}>
      <div className="variant-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="variant-modal-header">
          <div className="variant-modal-title-group">
            <span className="variant-modal-badge">A / B 声态异构</span>
            <h3 className="variant-modal-title">音轨多版本声学属性对比</h3>
          </div>
          <button type="button" className="variant-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 若场景包含 2 个以上备选，提供水平变体切换选择条 */}
        {groupVariants.length > 2 && (
          <div className="variant-selector-bar" style={{ padding: '8px 20px 0', display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {groupVariants.filter(v => v.audio?.path !== activeAudio?.path).map(v => (
              <button
                key={v.id}
                type="button"
                className={`variant-toggle-btn ${effectiveTarget?.id === v.id ? 'active' : ''}`}
                onClick={() => setSelectedTarget(v)}
                style={{ padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="variant-comparison-grid">
          {/* 当前版本 */}
          <div className="variant-side current-side">
            <div className="variant-side-badge">正在聆听</div>
            <div className="variant-side-icon">{currentVariant?.icon || '💿'}</div>
            <div className="variant-side-name">{currentVariant?.label || '当前版本'}</div>
            <div className="variant-side-filename">{activeAudio?.displayName || activeAudio?.name}</div>

            <div className="variant-meta-rows">
              <div className="variant-meta-row">
                <span className="meta-label">音频封装</span>
                <span className="meta-val">{curFormat}</span>
              </div>
              <div className="variant-meta-row">
                <span className="meta-label">声学偏好</span>
                <span className="meta-val">{currentVariant?.category || '标准母带'}</span>
              </div>
            </div>
          </div>

          <div className="variant-vs-divider">
            <span className="vs-badge">VS</span>
          </div>

          {/* 目标版本 */}
          {effectiveTarget ? (
            <div className="variant-side target-side">
              <div className="variant-side-badge target">目标备选</div>
              <div className="variant-side-icon">{effectiveTarget.icon || '🎧'}</div>
              <div className="variant-side-name">{effectiveTarget.label}</div>
              <div className="variant-side-filename">{effectiveTarget.rawName}</div>

              <div className="variant-meta-rows">
                <div className="variant-meta-row">
                  <span className="meta-label">音频封装</span>
                  <span className="meta-val">{tarFormat}</span>
                </div>
                <div className="variant-meta-row">
                  <span className="meta-label">声学偏好</span>
                  <span className="meta-val">{effectiveTarget.category || '衍生变体'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="variant-side target-side empty-side">
              <div className="variant-side-name" style={{ margin: 'auto', color: 'var(--text-muted)' }}>暂无其他衍生音轨</div>
            </div>
          )}
        </div>

        <div className="variant-comparison-footer">
          <div className="variant-tips">
            💡 点击立即切换将平滑保留当前播放进度，直通原生录音母带
          </div>
          <div className="variant-actions">
            <button type="button" className="variant-cancel-btn" onClick={onClose}>关闭</button>
            {effectiveTarget && (
              <button
                type="button"
                className="variant-swap-confirm-btn"
                onClick={handleConfirmSwap}
              >
                无缝热切至该版本 ⇄
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default VariantComparisonModal
