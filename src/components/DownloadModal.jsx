import { useState, useEffect, useMemo, useCallback } from 'react'
import './DownloadModal.css'

// 从 tracks 树形结构里提取所有音频文件，按顶层文件夹分组
// tracks API 返回: [{type:'folder', title:'mp3', children:[...]}, {type:'folder', title:'wav', children:[...]}]
function flattenTracks(tracks, parentPath = '') {
  const result = []
  if (!tracks) return result
  
  let trackList = tracks
  if (!Array.isArray(tracks)) {
    if (tracks.tracks && Array.isArray(tracks.tracks)) {
      trackList = tracks.tracks
    } else if (tracks.data && Array.isArray(tracks.data)) {
      trackList = tracks.data
    } else {
      return result
    }
  }
  
  for (const node of trackList) {
    if (node.type === 'audio') {
      result.push({
        title: node.title,
        url: node.mediaDownloadUrl || node.mediaStreamUrl,
        duration: node.duration,
        size: node.size,
        path: parentPath,
      })
    } else if (node.type === 'folder' && node.children) {
      const subPath = parentPath ? `${parentPath}/${node.title}` : node.title
      result.push(...flattenTracks(node.children, subPath))
    }
  }
  return result
}

// 按顶层文件夹（如 mp3 / wav）分组
function groupByTopFolder(files) {
  const groups = new Map()
  for (const f of files) {
    const top = f.path.split('/')[0] || '根目录'
    if (!groups.has(top)) groups.set(top, [])
    groups.get(top).push(f)
  }
  return [...groups.entries()].map(([name, files]) => ({ name, files }))
}

function formatSize(bytes) {
  if (!bytes) return '--'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatSpeed(bps) {
  if (!bps) return '--'
  if (bps < 1024) return bps + ' B/s'
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(1) + ' KB/s'
  return (bps / (1024 * 1024)).toFixed(1) + ' MB/s'
}

export default function DownloadModal({ work, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState(new Set()) // file url 作为 key
  const [added, setAdded] = useState(false)
  const [saveDir, setSaveDir] = useState('')

  const allFiles = useMemo(() => groups.flatMap((g) => g.files), [groups])

  useEffect(() => {
    if (!work?.onlineId) {
      setError('缺少作品 ID')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const tracks = await window.electronAPI.asmrOneGetTracks(work.onlineId)
        if (cancelled) return
        const flat = flattenTracks(tracks)
        const grouped = groupByTopFolder(flat)
        setGroups(grouped)
        // 默认选中所有 mp3 组（如果有），否则全选
        const mp3Group = grouped.find((g) => g.name.toLowerCase() === 'mp3')
        const initial = new Set()
        if (mp3Group) {
          for (const f of mp3Group.files) initial.add(f.url)
        } else if (grouped.length > 0) {
          for (const f of grouped[0].files) initial.add(f.url)
        }
        setSelected(initial)
      } catch (e) {
        if (!cancelled) setError(e.message || '加载曲目失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [work])

  const toggleFile = useCallback((url) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }, [])

  const toggleGroup = useCallback((groupName) => {
    const group = groups.find((g) => g.name === groupName)
    if (!group) return
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = group.files.every((f) => next.has(f.url))
      if (allIn) {
        for (const f of group.files) next.delete(f.url)
      } else {
        for (const f of group.files) next.add(f.url)
      }
      return next
    })
  }, [groups])

  const selectAll = useCallback(() => {
    setSelected(new Set(allFiles.map((f) => f.url)))
  }, [allFiles])

  const selectNone = useCallback(() => setSelected(new Set()), [])

  const totalSize = useMemo(() => {
    let sum = 0
    for (const f of allFiles) if (selected.has(f.url)) sum += f.size || 0
    return sum
  }, [allFiles, selected])

  const handleChooseDir = useCallback(async () => {
    const dir = await window.electronAPI.selectDownloadDir()
    if (dir) setSaveDir(dir)
  }, [])

  const handleDownload = useCallback(async () => {
    if (selected.size === 0) return
    if (!saveDir) {
      const dir = await window.electronAPI.selectDownloadDir()
      if (!dir) return
      setSaveDir(dir)
      await addToQueue(selected, dir)
      return
    }
    await addToQueue(selected, saveDir)
  }, [selected, saveDir])

  const addToQueue = useCallback(async (selectedSet, dir) => {
    const toDownload = allFiles.filter((f) => selectedSet.has(f.url))
    const taskId = await window.electronAPI.downloadAddTask({
      work,
      files: toDownload,
      saveDir: dir,
    })
    if (taskId) {
      setAdded(true)
    }
  }, [allFiles, work])

  return (
    <div className="modal-overlay download-modal-overlay" onClick={onClose}>
      <div className="download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="download-modal-header">
          <div className="download-modal-title">
            <span className="download-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
            <div>
              <h3>下载作品</h3>
              <p className="download-modal-subtitle">{work?.title}</p>
            </div>
          </div>
          <button className="download-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="download-modal-body">
          {loading ? (
            <div className="download-loading">
              <div className="loading-spinner" />
              <span>正在加载曲目列表...</span>
            </div>
          ) : error ? (
            <div className="download-error">{error}</div>
          ) : added ? (
            <div className="download-added-success">
              <div className="added-icon">✓</div>
              <h4>已添加到下载队列</h4>
              <p>已将 {selected.size} 个文件添加到下载队列</p>
              <p className="hint">关闭弹窗后将继续后台下载，可在下载管理页面查看进度</p>
            </div>
          ) : (
            <>
              <div className="download-toolbar">
                <div className="download-toolbar-left">
                  <button className="dl-chip-btn" onClick={selectAll}>全选</button>
                  <button className="dl-chip-btn" onClick={selectNone}>清空</button>
                </div>
                <div className="download-toolbar-right">
                  <span className="dl-count">{selected.size} / {allFiles.length} 个文件</span>
                  <span className="dl-size">总计 {formatSize(totalSize)}</span>
                </div>
              </div>

              <div className="download-groups">
                {groups.map((group) => {
                  const allSelected = group.files.every((f) => selected.has(f.url))
                  const someSelected = group.files.some((f) => selected.has(f.url))
                  const groupSize = group.files.reduce((s, f) => s + (f.size || 0), 0)
                  return (
                    <div key={group.name} className="download-group">
                      <div
                        className={`download-group-header ${allSelected ? 'all-selected' : someSelected ? 'some-selected' : ''}`}
                        onClick={() => toggleGroup(group.name)}
                      >
                        <span className={`dl-checkbox ${allSelected ? 'checked' : someSelected ? 'partial' : ''}`}>
                          {allSelected ? '✓' : someSelected ? '–' : ''}
                        </span>
                        <span className="dl-group-name">{group.name}</span>
                        <span className="dl-group-meta">{group.files.length} 首 · {formatSize(groupSize)}</span>
                      </div>
                      <div className="download-group-files">
                        {group.files.map((f) => {
                          const isSel = selected.has(f.url)
                          return (
                            <div
                              key={f.url}
                              className={`download-file-row ${isSel ? 'selected' : ''}`}
                              onClick={() => toggleFile(f.url)}
                            >
                              <span className={`dl-checkbox small ${isSel ? 'checked' : ''}`}>
                                {isSel ? '✓' : ''}
                              </span>
                              <span className="dl-file-name" title={f.title}>{f.title}</span>
                              <span className="dl-file-size">{formatSize(f.size)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="download-save-dir">
                <span className="dl-dir-label">保存到：</span>
                <span className="dl-dir-path" title={saveDir}>{saveDir || '未选择'}</span>
                <button className="dl-dir-btn" onClick={handleChooseDir}>选择目录</button>
              </div>
            </>
          )}
        </div>

        <div className="download-modal-footer">
          <button 
            className="dl-btn-secondary" 
            onClick={onClose} 
          >
            {added ? '关闭' : '取消'}
          </button>
          {!added && (
            <button
              className="dl-btn-primary"
              onClick={handleDownload}
              disabled={loading || !!error || selected.size === 0}
            >
              添加到下载队列
            </button>
          )}
          {added && (
            <button
              className="dl-btn-primary"
              onClick={onClose}
            >
              查看下载管理
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
