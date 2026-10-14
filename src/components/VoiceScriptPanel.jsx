import { memo, useRef, useEffect, useCallback } from 'react'
import StateView from './StateView'
import './VoiceScriptPanel.css'

const VoiceScriptPanel = memo(function VoiceScriptPanel({
  work,
  scriptFiles = [],
  selectedScriptPath,
  onSelectScriptPath,
  scriptLines = [],
  rawText = '',
  loadingScript = false,
  theaterMode = true,
  onToggleTheaterMode,
  autoCruise = true,
  onToggleAutoCruise,
  fontSize = 14,
  onChangeFontSize,
  activeLineIndex = -1,
  isUserScrolling = false,
  onUserScroll,
  onResumeSync,
  onImportScript,
  onQuoteToStamp,
  onCopyLine,
}) {
  const listRef = useRef(null)
  const activeLineRef = useRef(null)

  // 随播放自动平滑滚动到当前行
  useEffect(() => {
    if (isUserScrolling || activeLineIndex < 0 || !activeLineRef.current) return
    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [activeLineIndex, isUserScrolling])

  const handleDecreaseFont = useCallback(() => {
    onChangeFontSize?.(Math.max(12, fontSize - 1))
  }, [fontSize, onChangeFontSize])

  const handleIncreaseFont = useCallback(() => {
    onChangeFontSize?.(Math.min(22, fontSize + 1))
  }, [fontSize, onChangeFontSize])

  if (!work) {
    return (
      <div className="voice-script-empty">
        <StateView
          type="empty"
          iconType="subtitle"
          title="选择作品查看台本"
          description="从左侧列表中选择一部音声作品"
        />
      </div>
    )
  }

  return (
    <div className="voice-script-panel" style={{ '--script-font-size': `${fontSize}px` }}>
      {/* 顶部工具控制栏 */}
      <div className="script-toolbar">
        <div className="script-selector-group">
          <span className="script-tool-icon">📜</span>
          {scriptFiles.length > 0 ? (
            <select
              className="script-select"
              value={selectedScriptPath || ''}
              onChange={(e) => onSelectScriptPath?.(e.target.value)}
              title="切换台本文档"
            >
              {scriptFiles.map((sf) => (
                <option key={sf.path} value={sf.path}>
                  {sf.relativePath || sf.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="script-no-files">未检测到剧本文件</span>
          )}
        </div>

        <div className="script-tools-actions">
          <button
            className="script-tool-btn"
            onClick={onImportScript}
            title="导入外部台本文本文档 (.txt / .md)"
          >
            📂 导入
          </button>

          <button
            className={`script-tool-btn ${theaterMode ? 'active' : ''}`}
            onClick={onToggleTheaterMode}
            title={theaterMode ? '当前：剧场戏剧排版模式' : '当前：纯文本排版模式'}
          >
            {theaterMode ? '🎭 剧场' : '📝 纯文'}
          </button>

          <button
            className={`script-tool-btn ${autoCruise ? 'active' : ''}`}
            onClick={onToggleAutoCruise}
            title={autoCruise ? '声速自动随行巡航开启' : '声速自动随行巡航已暂停'}
          >
            {autoCruise ? '🌊 巡航中' : '⏸️ 巡航停'}
          </button>

          <div className="script-font-stepper">
            <button
              className="font-step-btn"
              onClick={handleDecreaseFont}
              disabled={fontSize <= 12}
              title="缩小字号"
            >
              A-
            </button>
            <span className="font-step-val">{fontSize}</span>
            <button
              className="font-step-btn"
              onClick={handleIncreaseFont}
              disabled={fontSize >= 22}
              title="放大字号"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div
        className="script-content-scroll"
        ref={listRef}
        onWheel={onUserScroll}
        onTouchMove={onUserScroll}
      >
        {loadingScript ? (
          <div className="script-loading-state">
            <StateView type="loading" title="正在装载台本文档..." />
          </div>
        ) : scriptFiles.length === 0 && !rawText ? (
          <div className="script-empty-prompt">
            <div className="empty-script-card">
              <span className="empty-script-icon">📖</span>
              <h4>未发现剧本文档</h4>
              <p>作品目录下暂无 .txt / .md 台本文稿。</p>
              <p className="empty-subtext">你可以点击上方「📂 导入」按钮，随时载入本地台本或剧情翻译！</p>
              <button className="btn-primary btn-sm import-prompt-btn" onClick={onImportScript}>
                导入台本文档
              </button>
            </div>
          </div>
        ) : theaterMode ? (
          <div className="script-theater-flow">
            {scriptLines.map((line, idx) => {
              const isActive = idx === activeLineIndex
              const isDialogue = line.type === 'dialogue'
              const isAction = line.type === 'action'
              const isSE = line.type === 'sound_effect'
              const isBlank = line.type === 'blank'

              if (isBlank) {
                return <div key={line.id} className="script-line-blank" />
              }

              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : null}
                  className={`script-flow-line line-${line.type} ${isActive ? 'is-active' : ''}`}
                >
                  {/* 音效行 */}
                  {isSE && (
                    <div className="line-se-badge">
                      <span className="se-icon">🔔</span>
                      <span className="se-label">SE: {line.content}</span>
                    </div>
                  )}

                  {/* 动作与情境微表情独占行 */}
                  {isAction && (
                    <div className="line-action-box">
                      <span className="action-bracket-icon">💭</span>
                      <span className="action-text">（{line.content}）</span>
                    </div>
                  )}

                  {/* 角色对话行 */}
                  {isDialogue && (
                    <div className="line-dialogue-box">
                      <div className="dialogue-header">
                        <span className="speaker-pill">{line.speaker}</span>
                        {line.timeCue !== null && (
                          <span className="dialogue-time-tag">
                            {Math.floor(line.timeCue / 60)}:
                            {String(line.timeCue % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <div className="dialogue-body">
                        <span className="dialogue-text">{line.text}</span>
                        {line.actions && line.actions.length > 0 && (
                          <div className="dialogue-sub-actions">
                            {line.actions.map((act, aIdx) => (
                              <span key={aIdx} className="sub-action-chip">
                                🌸 {act}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 旁白与普通叙事 */}
                  {line.type === 'narration' && (
                    <div className="line-narration-box">
                      <span className="narration-text">{line.text}</span>
                    </div>
                  )}

                  {/* 悬停操作胶囊 */}
                  <div className="script-line-actions">
                    <button
                      className="line-action-pill"
                      onClick={() => onQuoteToStamp?.(line.text || line.content || line.rawText)}
                      title="将此句存入心动印记"
                    >
                      💖 印记
                    </button>
                    <button
                      className="line-action-pill"
                      onClick={() => onCopyLine?.(line.text || line.content || line.rawText)}
                      title="复制本行文本"
                    >
                      📋 复制
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="script-raw-view">
            <pre className="script-raw-pre">{rawText}</pre>
          </div>
        )}
      </div>

      {/* 用户手动滚动时，浮现「回到当前播放进度」便捷按钮 */}
      {isUserScrolling && activeLineIndex >= 0 && (
        <button className="script-resume-float-btn" onClick={onResumeSync}>
          <span className="resume-icon">🎯</span>
          <span>回到音频进度</span>
        </button>
      )}
    </div>
  )
})

export default VoiceScriptPanel
