import { useState, useEffect, useCallback } from 'react'
import './PlaylistView.css'

export default function AddToPlaylistModal({ target, onClose, onToast }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [creatingName, setCreatingName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await window.electronAPI.playlistGetAll()
      setPlaylists(data || [])
      if (data && data.length > 0) setSelectedId(data[0].id)
    } catch (e) {
      console.error('Failed to load playlists:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleConfirm = useCallback(async () => {
    if (!selectedId || !target?.audio) return
    setSubmitting(true)
    try {
      const { audio, work } = target
      const item = {
        workId: work?.id || '',
        workTitle: work?.title || work?.folderName || '',
        workCover: work?.cover || '',
        audioPath: audio.path,
        audioName: audio.name || '',
        isOnline: !!audio.isOnline,
      }
      const updated = await window.electronAPI.playlistAddItem(selectedId, item)
      if (updated) {
        const existsBefore = playlists.find((p) => p.id === selectedId)?.items?.some((it) => it.audioPath === audio.path)
        onToast?.(existsBefore ? '该曲目已在播放列表中' : `已加入播放列表`, existsBefore ? 'info' : 'success')
      }
      onClose()
    } catch (e) {
      onToast?.('加入失败：' + (e.message || ''), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [selectedId, target, playlists, onToast, onClose])

  const handleCreateAndAdd = useCallback(async () => {
    const name = (creatingName || '').trim()
    if (!name) {
      setShowCreate(false)
      setCreatingName('')
      return
    }
    setSubmitting(true)
    try {
      const created = await window.electronAPI.playlistCreate(name)
      const { audio, work } = target
      const item = {
        workId: work?.id || '',
        workTitle: work?.title || work?.folderName || '',
        workCover: work?.cover || '',
        audioPath: audio.path,
        audioName: audio.name || '',
        isOnline: !!audio.isOnline,
      }
      await window.electronAPI.playlistAddItem(created.id, item)
      onToast?.(`已创建并加入「${created.name}」`, 'success')
      onClose()
    } catch (e) {
      onToast?.('创建失败：' + (e.message || ''), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [creatingName, target, onToast, onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-to-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>加入播放列表</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="add-to-playlist-target-info">
            <span className="add-to-playlist-target-name">{target?.audio?.name || '未知曲目'}</span>
            {target?.work?.title && <span className="add-to-playlist-target-work">{target.work.title}</span>}
          </div>
          {loading ? (
            <div className="add-to-playlist-loading">加载中...</div>
          ) : playlists.length === 0 && !showCreate ? (
            <div className="add-to-playlist-empty">
              <p>还没有播放列表</p>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>新建播放列表</button>
            </div>
          ) : (
            <div className="add-to-playlist-list">
              {playlists.map((pl) => (
                <label
                  key={pl.id}
                  className={`add-to-playlist-option ${selectedId === pl.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="playlist-target"
                    checked={selectedId === pl.id}
                    onChange={() => setSelectedId(pl.id)}
                  />
                  <span className="add-to-playlist-option-name">{pl.name}</span>
                  <span className="add-to-playlist-option-count">{(pl.items || []).length} 首</span>
                </label>
              ))}
              {showCreate ? (
                <div className="add-to-playlist-create">
                  <input
                    type="text"
                    className="playlist-name-input"
                    placeholder="新播放列表名称"
                    value={creatingName}
                    autoFocus
                    onChange={(e) => setCreatingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateAndAdd()
                      else if (e.key === 'Escape') { setShowCreate(false); setCreatingName('') }
                    }}
                    maxLength={50}
                  />
                  <button className="btn-primary" onClick={handleCreateAndAdd} disabled={submitting}>创建并加入</button>
                </div>
              ) : (
                <button className="add-to-playlist-new-btn" onClick={() => setShowCreate(true)}>
                  + 新建播放列表
                </button>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!selectedId || submitting || loading}
          >
            {submitting ? '处理中...' : '加入'}
          </button>
        </div>
      </div>
    </div>
  )
}
