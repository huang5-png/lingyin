import { useState, useRef } from 'react'
import './WorkDetail.css'

export default function WorkDetail({ work, audioFiles, currentAudio, onSelectAudio, onEditMetadata, onRefreshMetadata, onRefreshSubtitles, onFilterCV, onFilterTag, activeCV, activeTag }) {
  const [showEditor, setShowEditor] = useState(false)
  const [editData, setEditData] = useState(work || {})
  const coverImgRef = useRef(null)

  if (!work) {
    return (
      <div className="work-detail empty">
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <div className="empty-icon">🎵</div>
          </div>
          <h2>选择一个作品开始播放</h2>
          <p>从左侧列表选择作品，或添加新文件夹</p>
        </div>
      </div>
    )
  }

  const handleEdit = () => {
    setEditData({
      title: work.title || '',
      cover: work.cover || '',
      cvs: work.cvs ? work.cvs.join(', ') : '',
      circle: work.circle || '',
      tags: work.tags ? work.tags.join(', ') : '',
      description: work.description || '',
    })
    setShowEditor(true)
  }

  const handleSave = () => {
    const data = {
      title: editData.title,
      cover: editData.cover,
      cvs: editData.cvs
        ? editData.cvs
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      circle: editData.circle,
      tags: editData.tags
        ? editData.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      description: editData.description,
    }
    onEditMetadata(data)
    setShowEditor(false)
  }

  const formatDuration = (seconds) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleOpenDLsite = () => {
    if (work.rjCode) {
      const url = `https://www.dlsite.com/maniax/work/=/product_id/${work.rjCode}.html`
      window.electronAPI.openExternal(url)
    }
  }

  return (
    <div className="work-detail">
      <div className="work-detail-content" key={work?.id}>
      <div className="work-hero">
        <div className="hero-content">
          <div className="work-cover-large" data-work-cover-target>
            {work.cover ? (
              <img ref={coverImgRef} src={work.cover} alt="" />
            ) : (
              <div className="cover-placeholder">🎵</div>
            )}
          </div>
          <div className="work-info-main">
            <h1 className="work-title-large">{work.title || work.folderName}</h1>
            {work.rjCode && (
              <div className="work-rj-row">
                <div className="work-rj">RJ 编号: {work.rjCode}</div>
                <button className="dlsite-btn" onClick={handleOpenDLsite}>
                  <span className="dlsite-icon">↗</span>
                  查看 DLsite
                </button>
              </div>
            )}
            <div className="work-meta-row">
              {work.rating > 0 && <span className="rating">⭐ {work.rating.toFixed(2)}</span>}
              {work.circle && <span className="circle">社团: {work.circle}</span>}
            </div>
            {work.cvs && work.cvs.length > 0 && (
              <div className="work-cvs">
                <span className="label">CV:</span>
                {work.cvs.map((cv, i) => (
                  <span
                    key={i}
                    className={`cv-tag ${activeCV === cv ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onFilterCV?.(activeCV === cv ? '' : cv) }}
                  >
                    {cv}
                  </span>
                ))}
              </div>
            )}
            {work.tags && work.tags.length > 0 && (
              <div className="work-tags">
                {work.tags.slice(0, 10).map((tag, i) => (
                  <span
                    key={i}
                    className={`tag ${activeTag === tag ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onFilterTag?.(activeTag === tag ? '' : tag) }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="work-actions">
              <button className="action-btn primary" onClick={handleEdit}>
                ✏️ 编辑元数据
              </button>
              <button className="action-btn" onClick={onRefreshMetadata}>
                🔄 重新刮削
              </button>
              <button className="action-btn" onClick={onRefreshSubtitles}>
                📝 刷新字幕
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="audio-list-section">
        <div className="section-header">
          <h2 className="section-title">曲目列表</h2>
          <span className="section-count">{audioFiles.length} 首</span>
        </div>
        <div className="audio-list">
          {audioFiles.map((audio, idx) => (
            <div
              key={audio.path}
              className={`audio-item ${currentAudio?.path === audio.path ? 'playing' : ''}`}
              onClick={() => onSelectAudio(audio)}
            >
              <div className="audio-indicator" />
              <span className="audio-index">
                {currentAudio?.path === audio.path ? (
                  <span className="playing-icon">
                    <span className="bar bar-1" />
                    <span className="bar bar-2" />
                    <span className="bar bar-3" />
                  </span>
                ) : (
                  idx + 1
                )}
              </span>
              <span className="audio-name">{audio.displayName || audio.name}</span>
              {audio.duration && <span className="audio-duration">{formatDuration(audio.duration)}</span>}
            </div>
          ))}
        </div>
      </div>
      </div>

      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑元数据</h3>
              <button className="close-btn" onClick={() => setShowEditor(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>标题</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>封面图片 URL</label>
                <input
                  type="text"
                  value={editData.cover}
                  onChange={(e) => setEditData({ ...editData, cover: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>CV (用逗号分隔)</label>
                <input
                  type="text"
                  value={editData.cvs}
                  onChange={(e) => setEditData({ ...editData, cvs: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>社团</label>
                <input
                  type="text"
                  value={editData.circle}
                  onChange={(e) => setEditData({ ...editData, circle: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>标签 (用逗号分隔)</label>
                <input
                  type="text"
                  value={editData.tags}
                  onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>简介</label>
                <textarea
                  rows="4"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditor(false)}>
                取消
              </button>
              <button className="btn-primary" onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
