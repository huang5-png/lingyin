import { useState, useRef, useEffect, memo } from 'react'
import './TrackVariantCapsule.css'

export const TrackVariantCapsule = memo(function TrackVariantCapsule({
  currentVariant = null,
  siblingVariants = [],
  onHotSwap = null,
  onOpenCompare = null,
  compact = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef(null)

  // 点击外部自动关闭下拉
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  if (!currentVariant || siblingVariants.length === 0) {
    return null
  }

  return (
    <div className={`variant-capsule-container ${compact ? 'compact' : ''}`} ref={containerRef}>
      <button
        type="button"
        className="variant-capsule-trigger"
        onClick={() => setDropdownOpen(prev => !prev)}
        title="当前声态变体（点击无缝热切其他录音/混音版本）"
      >
        <span className="variant-capsule-icon">{currentVariant.icon}</span>
        <span className="variant-capsule-label">{currentVariant.shortTag || currentVariant.label}</span>
        <span className="variant-capsule-arrow">{dropdownOpen ? '▴' : '▾'}</span>
      </button>

      {dropdownOpen && (
        <div className="variant-capsule-dropdown">
          <div className="variant-dropdown-header">
            <span className="variant-dropdown-title">声态同构 · 多版本无缝热切</span>
            <span className="variant-dropdown-tip">毫秒级同步播放进度</span>
          </div>

          <div className="variant-dropdown-list">
            {/* 当前版本 */}
            <div className="variant-dropdown-item active">
              <span className="variant-item-icon">{currentVariant.icon}</span>
              <div className="variant-item-info">
                <span className="variant-item-name">{currentVariant.label}</span>
                <span className="variant-item-badge">当前播放</span>
              </div>
              <span className="variant-item-check">✓</span>
            </div>

            {/* 其他备选变体 */}
            {siblingVariants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="variant-dropdown-item clickable"
                onClick={() => {
                  setDropdownOpen(false)
                  if (onHotSwap) onHotSwap(variant)
                }}
              >
                <span className="variant-item-icon">{variant.icon}</span>
                <div className="variant-item-info">
                  <span className="variant-item-name">{variant.label}</span>
                  <span className="variant-item-sub">{variant.rawName}</span>
                </div>
                <span className="variant-item-action">切换 ⇄</span>
              </button>
            ))}
          </div>

          {onOpenCompare && siblingVariants.length > 0 && (
            <div className="variant-dropdown-footer">
              <button
                type="button"
                className="variant-compare-btn"
                onClick={() => {
                  setDropdownOpen(false)
                  onOpenCompare(siblingVariants[0])
                }}
              >
                ⚖️ 对比多版本声学属性
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default TrackVariantCapsule
