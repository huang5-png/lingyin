import { useState, useEffect, useCallback } from 'react'
import './DownloadView.css'
import StateView from './StateView'

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

function getStatusText(status) {
  const map = {
    queued: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return map[status] || status
}

function getTotalDownloaded(task) {
  let downloaded = 0
  let total = 0
  let speed = 0
  for (const f of task.files) {
    downloaded += f.downloaded || 0
    total += f.size || f.totalLength || 0
    if (f.status === 'downloading') speed = f.speed || 0
  }
  return { downloaded, total, speed }
}

export default function DownloadView() {
  const [downloadState, setDownloadState] = useState({ queue: [], active: null })
  const [expandedTasks, setExpandedTasks] = useState(new Set())

  useEffect(() => {
    window.electronAPI.downloadGetState().then((state) => {
      if (state) setDownloadState(state)
    })
    const unsubscribe = window.electronAPI.onDownloadState((state) => {
      setDownloadState(state)
    })
    return unsubscribe
  }, [])

  const toggleExpand = useCallback((taskId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const handleCancel = useCallback(async (taskId) => {
    await window.electronAPI.downloadCancelTask(taskId)
  }, [])

  const handleRemove = useCallback(async (taskId) => {
    await window.electronAPI.downloadRemoveTask(taskId)
  }, [])

  const handleClearCompleted = useCallback(async () => {
    await window.electronAPI.downloadClearCompleted()
  }, [])

  const allTasks = []
  if (downloadState.active) allTasks.push(downloadState.active)
  for (const t of downloadState.queue) allTasks.push(t)

  const completedCount = allTasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  ).length

  const downloadingTask = downloadState.active
  const activeStats = downloadingTask ? getTotalDownloaded(downloadingTask) : { downloaded: 0, total: 0, speed: 0 }

  return (
    <div className="download-view">
      <div className="download-view-header">
        <div className="download-view-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <h2>下载管理</h2>
        </div>
        <div className="download-view-stats">
          <span>共 {allTasks.length} 个任务</span>
          {downloadingTask && (
            <span className="downloading-speed">
              下载中 · {formatSpeed(activeStats.speed)}
            </span>
          )}
          {completedCount > 0 && (
            <button className="clear-completed-btn" onClick={handleClearCompleted}>
              清空已完成
            </button>
          )}
        </div>
      </div>

      <div className="download-task-list">
        {allTasks.length === 0 ? (
          <StateView
            type="empty"
            iconType="download"
            title="暂无下载任务"
            description="去发现页选择作品下载吧"
            className="download-empty"
          />
        ) : (
          allTasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id)
            const { downloaded, total, speed } = getTotalDownloaded(task)
            const doneCount = task.files.filter((f) => f.status === 'done').length
            const failedCount = task.files.filter((f) => f.status === 'failed').length
            const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0
            const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'

            return (
              <div key={task.id} className={`download-task-card ${task.status}`}>
                <div className="task-header" onClick={() => toggleExpand(task.id)}>
                  <div className="task-cover">
                    {task.workCover ? (
                      <img src={task.workCover} alt="" />
                    ) : (
                      <div className="task-cover-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="task-info">
                    <div className="task-title-row">
                      <span className="task-title">{task.workTitle}</span>
                      <span className={`task-status ${task.status}`}>{getStatusText(task.status)}</span>
                    </div>
                    <div className="task-meta">
                      <span>{task.files.length} 个文件</span>
                      <span>·</span>
                      <span>{doneCount} 已完成</span>
                      {failedCount > 0 && <span className="fail-count">· {failedCount} 失败</span>}
                      {task.status === 'downloading' && (
                        <>
                          <span>·</span>
                          <span className="speed-text">{formatSpeed(speed)}</span>
                        </>
                      )}
                    </div>
                    <div className="task-progress-bar">
                      <div
                        className={`task-progress-fill ${task.status}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="task-progress-text">
                      <span>{formatSize(downloaded)} / {formatSize(total)}</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                  <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                    {!isFinished && (
                      <button className="task-action-btn cancel" onClick={() => handleCancel(task.id)} title="取消下载">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </button>
                    )}
                    {isFinished && (
                      <button className="task-action-btn remove" onClick={() => handleRemove(task.id)} title="删除任务">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                    <button className={`task-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="task-file-list">
                    {task.files.map((file, idx) => (
                      <div key={idx} className={`task-file-row ${file.status}`}>
                        <span className={`file-status-dot ${file.status}`} />
                        <span className="file-name" title={file.fileName}>{file.fileName}</span>
                        <span className="file-size">{formatSize(file.size || file.totalLength)}</span>
                        {file.status === 'downloading' && (
                          <span className="file-progress">
                            {file.progress}% · {formatSpeed(file.speed)}
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="file-error" title={file.error}>{file.error}</span>
                        )}
                        {file.status === 'done' && (
                          <span className="file-done">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
