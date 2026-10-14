import { memo, useEffect, useMemo } from 'react'
import { formatTime } from '../utils/subtitleParser'
import { getMoonPhase } from '../hooks/useBedsideSlumber'
import './BedsideClockModal.css'

export const BedsideClockModal = memo(function BedsideClockModal({
  isOpen = false,
  onClose = null,
  currentDate = new Date(),
  moonPhase = null,
  pixelShift = { x: 0, y: 0 },
  dimMode = false,
  onToggleDimMode = null,
  playingWork = null,
  currentWork = null,
  currentAudio = null,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  sleepTimerRemaining = 0,
  sleepTimerActive = false,
  onPlayPause = null,
  onExtend15Min = null,
  onExtendTimer = null,
}) {
  const activeWork = playingWork || currentWork
  const handleExtend = onExtend15Min || onExtendTimer
  const isTimerActive = sleepTimerActive || sleepTimerRemaining > 0

  const resolvedMoon = useMemo(() => {
    return moonPhase || getMoonPhase(currentDate)
  }, [moonPhase, currentDate])
  // ESC 键退出床头夜钟模式
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) onClose()
      } else if (e.code === 'Space') {
        e.preventDefault()
        if (onPlayPause) onPlayPause()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onPlayPause])

  if (!isOpen) return null

  const hours = currentDate.getHours().toString().padStart(2, '0')
  const minutes = currentDate.getMinutes().toString().padStart(2, '0')
  const seconds = currentDate.getSeconds().toString().padStart(2, '0')

  // 定时器倒数百分比（假设最大 60 分钟环）
  const timerMins = Math.ceil(sleepTimerRemaining / 60)
  const timerCircleProgress = sleepTimerActive ? Math.min(100, Math.max(0, (sleepTimerRemaining / 3600) * 100)) : 0

  return (
    <div
      className={`bedside-clock-overlay ${dimMode ? 'dimmed' : ''}`}
      onClick={onPlayPause}
      title="点击屏幕任意位置：播放 / 暂停"
    >
      <div
        className="bedside-clock-container"
        style={{
          transform: `translate(${pixelShift.x}px, ${pixelShift.y}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部月相与深眠状态栏 */}
        <div className="bedside-top-bar">
          <div className="bedside-moon-group" title={`今日月相：${resolvedMoon?.name} (月龄 ${resolvedMoon?.age} 天)`}>
            <span className="bedside-moon-icon">{resolvedMoon?.icon || '🌙'}</span>
            <span className="bedside-moon-name">{resolvedMoon?.name || '深眠之夜'}</span>
            <span className="bedside-moon-desc">{resolvedMoon?.desc}</span>
          </div>

          <div className="bedside-top-actions">
            <button
              type="button"
              className="bedside-btn dim-btn"
              onClick={onToggleDimMode}
              title={dimMode ? '恢复正常亮度' : '微光纯黑节能模式'}
            >
              {dimMode ? '☀️ 唤醒' : '🕯️ 沉暮'}
            </button>
            <button
              type="button"
              className="bedside-btn close-btn"
              onClick={onClose}
              title="退出夜钟模式 (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 核心大号呼吸时钟 */}
        <div className="bedside-time-display">
          <span className="bedside-digits hours">{hours}</span>
          <span className="bedside-colon">:</span>
          <span className="bedside-digits minutes">{minutes}</span>
          <span className="bedside-seconds">{seconds}</span>
        </div>

        {/* 正在伴眠的音声作品微标 */}
        {activeWork && (
          <div className="bedside-audio-card" onClick={onPlayPause}>
            {activeWork.cover && (
              <img
                src={activeWork.cover}
                alt=""
                className={`bedside-cover ${isPlaying ? 'rotating' : 'paused'}`}
              />
            )}
            <div className="bedside-audio-info">
              <div className="bedside-audio-title">{activeWork.title || activeWork.folderName}</div>
              <div className="bedside-audio-sub">
                <span className="cv-pill">{activeWork.cv || activeWork.cvs?.[0] || 'ASMR 伴眠'}</span>
                <span className="track-name">{currentAudio?.displayName || currentAudio?.name}</span>
              </div>
              <div className="bedside-audio-progress">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
            <div className="bedside-play-state">
              {isPlaying ? '❚❚ 播放中' : '▶ 已暂停'}
            </div>
          </div>
        )}

        {/* 环形休眠倒计时光圈与延时入眠按钮 */}
        <div className="bedside-timer-section">
          {isTimerActive ? (
            <div className="bedside-timer-indicator">
              <svg className="bedside-timer-svg" viewBox="0 0 100 100">
                <circle className="timer-bg-circle" cx="50" cy="50" r="42" />
                <circle
                  className="timer-active-circle"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray="264"
                  strokeDashoffset={264 - (264 * timerCircleProgress) / 100}
                />
              </svg>
              <div className="bedside-timer-text">
                <span className="timer-number">{timerMins}</span>
                <span className="timer-unit">分钟后安眠</span>
              </div>
            </div>
          ) : (
            <div className="bedside-timer-inactive">
              <span>💤 未设置休眠定时</span>
            </div>
          )}

          <div className="bedside-controls-row">
            <button
              type="button"
              className="bedside-action-pill"
              onClick={handleExtend}
              title="延长入眠定时器 15 分钟"
            >
              ⏳ +15分钟 延时入眠
            </button>
            <button
              type="button"
              className="bedside-action-pill play-toggle"
              onClick={onPlayPause}
            >
              {isPlaying ? '⏸ 暂停音声' : '▶ 继续播放'}
            </button>
          </div>
        </div>

        {/* 底部贴心手势提示 */}
        <div className="bedside-bottom-hint">
          轻触屏幕任意位置即可暂停/播放 · 键盘 Space / Esc 快捷操作
        </div>
      </div>
    </div>
  )
})

export default BedsideClockModal
