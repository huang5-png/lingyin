import { useState, useRef, useMemo, useEffect } from 'react'
import './WorkDetail.css'
import { buildDirectoryTree } from '@/utils/scanner'

export default function WorkDetail({ work, audioFiles, currentAudio, onSelectAudio, onEditMetadata, onRefreshMetadata, onRefreshSubtitles, onFilterCV, onFilterTag, activeCV, activeTag, onDownload, onReloadTracks }) {
  const [showEditor, setShowEditor] = useState(false)
  const [editData, setEditData] = useState(work || {})
  const [currentDirPath, setCurrentDirPath] = useState(null)
  const coverImgRef = useRef(null)

  useEffect(() => {
    setCurrentDirPath(null)
  }, [work?.id])

  const directoryTree = useMemo(() => {
    if (!work || !audioFiles || audioFiles.length === 0) return null
    return buildDirectoryTree(audioFiles, work.folderPath || work.title || '')
  }, [work, audioFiles])

  const currentDir = useMemo(() => {
    if (!directoryTree) return null
    if (!currentDirPath) return directoryTree
    
    const parts = currentDirPath.split(/[\\/]/).filter(Boolean)
    let node = directoryTree
    for (const part of parts) {
      const child = node.children.find(c => c.isDirectory && c.name === part)
      if (child) {
        node = child
      } else {
        return directoryTree
      }
    }
    return node
  }, [directoryTree, currentDirPath])

  const breadcrumbs = useMemo(() => {
    if (!currentDirPath || !work) return []
    const parts = currentDirPath.split(/[\\/]/).filter(Boolean)
    const result = []
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? currentPath + '/' + part : part
      result.push({ name: part, path: currentPath })
    }
    return result
  }, [currentDirPath, work])

  const handleEnterFolder = (folder) => {
    setCurrentDirPath((prev) => (prev ? `${prev}/${folder.name}` : folder.name))
  }

  const handleGoBack = () => {
    if (!currentDirPath) return
    const parts = currentDirPath.split(/[\\/]/).filter(Boolean)
    parts.pop()
    setCurrentDirPath(parts.length === 0 ? null : parts.join('/'))
  }

  const handleBreadcrumbClick = (index) => {
    if (index === -1) {
      setCurrentDirPath(null)
    } else {
      setCurrentDirPath(breadcrumbs[index].path)
    }
  }

  const handlePlayAll = () => {
    if (!currentDir || currentDir.children.length === 0) return
    const firstAudio = currentDir.children.find(c => !c.isDirectory)
    if (firstAudio) {
      onSelectAudio(firstAudio)
    }
  }

  if (!work) {
    return (
      <div className="work-detail empty">
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <div className="empty-icon">
              <img src="/icons/icon-music-note.png" alt="" className="cover-placeholder-icon" />
            </div>
          </div>
          <h2>选择一个作品开始播放</h2>
          <p>从左侧列表选择作品，或添加新文件夹</p>
        </div>
      </div>
    )
  }

  const isLoadingTracks = work._loadingTracks
  const hasTracksError = work._tracksError

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
              <div className="cover-placeholder">
                <img src="/icons/icon-music-note.png" alt="" className="cover-placeholder-icon" />
              </div>
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
              {work.rating > 0 && <span className="rating"><img src="/icons/icon-star.png" alt="" className="star-icon" /> {work.rating.toFixed(2)}</span>}
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
                <img src="/icons/icon-settings.png" alt="" className="btn-icon" /> 编辑元数据
              </button>
              <button className="action-btn" onClick={onRefreshMetadata}>
                🔄 重新刮削
              </button>
              <button className="action-btn" onClick={onRefreshSubtitles}>
                📝 刷新字幕
              </button>
              {work.isOnline && onDownload && (
              <button className="action-btn download" onClick={onDownload}>
                <img src="/icons/icon-download.png" alt="" className="btn-icon" /> 下载
              </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="audio-list-section">
        <div className="section-header">
          <div className="section-title-row">
            <h2 className="section-title">曲目列表</h2>
            <div className="breadcrumb-nav">
              <span className="breadcrumb-item" onClick={() => handleBreadcrumbClick(-1)}>
                📁 根目录
              </span>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="breadcrumb-sep">/</span>
              ))}
              {breadcrumbs.map((crumb, idx) => (
                <span
                  key={idx}
                  className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                  onClick={() => handleBreadcrumbClick(idx)}
                >
                  {crumb.name}
                </span>
              ))}
            </div>
          </div>
          <div className="section-header-right">
            <span className="section-count">
              {isLoadingTracks ? '加载中...' : hasTracksError ? '加载失败' : `${audioFiles.length} 首`}
            </span>
            {hasTracksError && onReloadTracks && (
              <button className="retry-btn" onClick={onReloadTracks}>
                重试
              </button>
            )}
            {currentDirPath && (
              <button className="back-btn" onClick={handleGoBack}>
                ← 返回上一级
              </button>
            )}
          </div>
        </div>
        <div className="audio-list">
          {isLoadingTracks ? (
            <div className="tracks-loading">
              <div className="loading-spinner" />
              <span>正在加载曲目列表...</span>
            </div>
          ) : hasTracksError ? (
            <div className="tracks-error">
              <span>曲目列表加载失败</span>
              {onReloadTracks && (
                <button className="retry-btn-large" onClick={onReloadTracks}>
                  点击重试
                </button>
              )}
            </div>
          ) : (
            currentDir?.children.map((item, idx) => (
              item.isDirectory ? (
                <div
                  key={item.path}
                  className="audio-item folder-item"
                  onClick={() => handleEnterFolder(item)}
                >
                  <div className="audio-indicator" />
                  <span className="audio-index">
                    <span className="folder-icon">📁</span>
                  </span>
                  <span className="audio-name">{item.name}</span>
                  <span className="audio-duration">{item.audioCount} 首</span>
                </div>
              ) : (
                <div
                  key={item.path}
                  className={`audio-item ${currentAudio?.path === item.path ? 'playing' : ''}`}
                  onClick={() => onSelectAudio(item)}
                >
                  <div className="audio-indicator" />
                  <span className="audio-index">
                    {currentAudio?.path === item.path ? (
                      <span className="playing-icon">
                        <span className="bar bar-1" />
                        <span className="bar bar-2" />
                        <span className="bar bar-3" />
                      </span>
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="audio-name">{item.name}</span>
                  {item.duration && <span className="audio-duration">{formatDuration(item.duration)}</span>}
                </div>
              )
            ))
          )}
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
