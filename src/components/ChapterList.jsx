import { useState, memo } from 'react'
import { formatSecondsToTimestamp } from '../utils/chapterParser'
import './ChapterList.css'

const ChapterList = memo(function ChapterList({
  chapters = [],
  activeChapter = null,
  currentTime = 0,
  duration = 0,
  onSeekToChapter,
  onAddCustomChapter,
  onDeleteCustomChapter,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleAddSubmit = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    onAddCustomChapter?.(currentTime, newTitle.trim())
    setNewTitle('')
    setShowAddForm(false)
  }

  return (
    <div className="chapter-list-container">
      {/* 顶部标题与添加按钮 */}
      <div className="chapter-list-header">
        <div className="chapter-header-info">
          <span className="chapter-count-badge">{chapters.length}</span>
          <span className="chapter-header-title">剧情章节分段</span>
        </div>

        <button
          className={`chapter-add-btn ${showAddForm ? 'active' : ''}`}
          onClick={() => setShowAddForm(!showAddForm)}
          title="在当前播放位置添加章节标记"
        >
          {showAddForm ? '取消' : '+ 标记当前'}
        </button>
      </div>

      {/* 新增章节表单 */}
      {showAddForm && (
        <form className="chapter-add-form" onSubmit={handleAddSubmit}>
          <div className="chapter-form-time">
            当前时间：<strong>{formatSecondsToTimestamp(currentTime)}</strong>
          </div>
          <div className="chapter-form-row">
            <input
              type="text"
              placeholder="输入章节/段落名称（如：掏耳、私语）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="chapter-input"
              autoFocus
            />
            <button type="submit" className="chapter-submit-btn">
              保存
            </button>
          </div>
        </form>
      )}

      {/* 章节列表 */}
      {chapters.length === 0 ? (
        <div className="chapter-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <div className="chapter-empty-text">当前曲目暂无章节标记</div>
          <div className="chapter-empty-tip">
            系统会自动识别作品描述中的时间戳章节；您也可以点击上方「+ 标记当前」手动添加章节剧情点。
          </div>
        </div>
      ) : (
        <div className="chapter-items-scroll">
          {chapters.map((ch, idx) => {
            const isActive = activeChapter && activeChapter.id === ch.id
            const isCustom = ch.id && String(ch.id).startsWith('custom_')

            return (
              <div
                key={ch.id || idx}
                className={`chapter-item ${isActive ? 'active' : ''}`}
                onClick={() => onSeekToChapter?.(ch)}
              >
                <div className="chapter-item-left">
                  <span className="chapter-index">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="chapter-item-info">
                    <div className="chapter-title" title={ch.title}>
                      {ch.title}
                    </div>
                    <div className="chapter-time-range">
                      <span>{ch.timeFormatted}</span>
                      {ch.duration > 0 && (
                        <span className="chapter-duration">（{ch.durationFormatted}）</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="chapter-item-right">
                  {isActive && (
                    <span className="chapter-playing-tag">
                      <span className="chapter-wave-bar" />
                      <span className="chapter-wave-bar" />
                      <span className="chapter-wave-bar" />
                    </span>
                  )}
                  {isCustom && (
                    <button
                      className="chapter-del-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteCustomChapter?.(ch.id)
                      }}
                      title="删除此自定义标记"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default ChapterList
