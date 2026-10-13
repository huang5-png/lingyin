import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useBreathingGuide } from '../hooks/useBreathingGuide'
import './SleepSanctuaryModal.css'

const CYCLE_OPTIONS = [
  { value: 0, label: '无限循环' },
  { value: 4, label: '4 轮入眠' },
  { value: 8, label: '8 轮入眠' },
  { value: 12, label: '12 轮入眠' },
]

const SleepSanctuaryModal = memo(function SleepSanctuaryModal({
  isOpen = false,
  onClose,
  work = null,
  currentAudio = null,
  isPlaying = false,
  onPlayPause,
  onPrev,
  onNext,
  onSleepTrigger,
  onToast,
}) {
  const [isIdle, setIsIdle] = useState(false)
  const idleTimerRef = useRef(null)

  const {
    isActive,
    patternId,
    currentPattern,
    isDarkRoom,
    cycleLimit,
    breathingState,
    start,
    stop,
    setPatternId,
    toggleDarkRoom,
    setCycleLimit,
    availablePatterns,
  } = useBreathingGuide({
    onSleepTrigger,
    onToast,
  })

  // 弹窗打开/关闭生命周期控制
  useEffect(() => {
    if (isOpen) {
      start()
    } else {
      stop()
      setIsIdle(false)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [isOpen, start, stop])

  // ESC 键退出
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 暗房模式下的空闲隐退防打扰机制
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

    if (isDarkRoom) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true)
      }, 3500)
    }
  }, [isDarkRoom])

  useEffect(() => {
    resetIdleTimer()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [isDarkRoom, resetIdleTimer])

  // 计算当前光环样式
  const haloStyle = useMemo(() => {
    const scale = breathingState?.scale || 1
    const opacity = breathingState?.opacity || 0.8
    const color = currentPattern?.themeColor || '#e08865'

    return {
      '--halo-color': color,
      transform: `scale(${scale})`,
      opacity: opacity,
    }
  }, [breathingState?.scale, breathingState?.opacity, currentPattern?.themeColor])

  if (!isOpen) return null

  const countdownSeconds = Math.ceil(breathingState.phaseRemaining || 0)
  const trackTitle = currentAudio?.displayName || currentAudio?.name || '静享纯粹自然之声'
  const trackSub = work?.circle || work?.title || '微澜助眠座舱'

  return (
    <div
      className={`sleep-sanctuary-overlay ${isDarkRoom ? 'dark-room' : ''} ${isIdle ? 'idle' : ''}`}
      onMouseMove={resetIdleTimer}
      onClick={resetIdleTimer}
      style={{ '--halo-color': currentPattern?.themeColor || '#e08865' }}
    >
      {/* 顶部状态与控制栏 */}
      <div className="sanctuary-top-bar" onClick={(e) => e.stopPropagation()}>
        <div className="sanctuary-brand">
          <span className="sanctuary-brand-icon">🌙</span>
          <span className="sanctuary-brand-title">微澜深眠座舱</span>
        </div>

        <div className="sanctuary-top-actions">
          {/* 呼吸轮数目标选择 */}
          {CYCLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`sanctuary-btn-pill ${cycleLimit === opt.value ? 'active' : ''}`}
              onClick={() => {
                setCycleLimit(opt.value)
                onToast?.(opt.value > 0 ? `已设定 ${opt.value} 轮后自动安稳入眠` : '已切换为无限呼吸循环', 'info')
              }}
              title={opt.value > 0 ? `${opt.value} 轮呼吸后自动停止音频播放` : '持续呼吸导引'}
            >
              {opt.label}
            </button>
          ))}

          {/* 极夜纯黑暗室开关 */}
          <button
            className={`sanctuary-btn-pill ${isDarkRoom ? 'active' : ''}`}
            onClick={toggleDarkRoom}
            title={isDarkRoom ? '退出极夜纯黑暗室' : '开启 OLED 极夜纯黑暗室，消除光污染'}
          >
            {isDarkRoom ? '🌓 暗室中' : '🌑 极夜暗室'}
          </button>

          {/* 关闭退出按钮 */}
          <button
            className="sanctuary-close-btn"
            onClick={onClose}
            title="退出助眠座舱 (ESC)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 中央呼吸导引舞台 */}
      <div className="sanctuary-center-stage">
        <div className="sanctuary-halo-wrapper">
          <div className="sanctuary-outer-halo" style={haloStyle} />
          <div className="sanctuary-inner-core" style={haloStyle} />

          <div className="sanctuary-halo-content">
            <h2 className="sanctuary-phase-title">{breathingState.phaseName}</h2>
            <div className="sanctuary-phase-countdown">{countdownSeconds}s</div>
            <div className="sanctuary-phase-cycle">
              第 {breathingState.cycleIndex} 轮 · {currentPattern.name}
            </div>
          </div>
        </div>

        <div className="sanctuary-prompt-text">
          {breathingState.prompt}
        </div>
      </div>

      {/* 底部模式切换与音频控制条 */}
      <div className="sanctuary-bottom-bar" onClick={(e) => e.stopPropagation()}>
        {/* 呼吸模式选择器 */}
        <div className="sanctuary-patterns-row">
          {Object.values(availablePatterns).map((pattern) => (
            <button
              key={pattern.id}
              className={`sanctuary-pattern-chip ${patternId === pattern.id ? 'active' : ''}`}
              onClick={() => setPatternId(pattern.id)}
              title={pattern.description}
            >
              {pattern.name}
            </button>
          ))}
        </div>

        {/* 底部轻量音频控制条 */}
        <div className="sanctuary-audio-strip">
          <div className="sanctuary-track-info" title={`${trackTitle} - ${trackSub}`}>
            <span className="sanctuary-track-title">{trackTitle}</span>
            <span className="sanctuary-track-meta">{trackSub}</span>
          </div>

          <div className="sanctuary-player-actions">
            {onPrev && (
              <button
                className="sanctuary-ctrl-btn"
                onClick={onPrev}
                title="上一曲"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>
            )}

            {onPlayPause && (
              <button
                className="sanctuary-ctrl-btn play"
                onClick={onPlayPause}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            )}

            {onNext && (
              <button
                className="sanctuary-ctrl-btn"
                onClick={onNext}
                title="下一曲"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M6 18 14.5 12 6 6zM16 6h2v12h-2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SleepSanctuaryModal
