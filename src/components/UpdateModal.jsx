import { useState, useEffect, useCallback, memo } from 'react'
import './UpdateModal.css'

const UpdateModal = memo(function UpdateModal({
  isOpen,
  updateInfo,
  onClose,
  showToast,
  mirrorUrl = '',
}) {
  const [downloadStatus, setDownloadStatus] = useState('idle') // 'idle' | 'downloading' | 'completed' | 'error'
  const [progressData, setProgressData] = useState(null)
  const [savedFilePath, setSavedFilePath] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [currentMirror, setCurrentMirror] = useState(mirrorUrl || 'https://ghfast.top/')

  useEffect(() => {
    if (isOpen) {
      setCurrentMirror(mirrorUrl || 'https://ghfast.top/')
    } else {
      setDownloadStatus('idle')
      setProgressData(null)
      setErrorMessage('')
    }
  }, [isOpen, mirrorUrl])

  // 监听下载进度
  useEffect(() => {
    if (!window.electronAPI?.onUpdateProgress) return
    const cleanup = window.electronAPI.onUpdateProgress((data) => {
      setProgressData(data)
    })
    return () => {
      cleanup?.()
    }
  }, [])

  const handleStartDownload = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      showToast?.('未找到更新包下载地址', 'warning')
      return
    }

    try {
      setDownloadStatus('downloading')
      setErrorMessage('')
      setProgressData({
        percent: 0,
        speedFormatted: '连接中...',
        downloadedFormatted: '0 B',
        totalFormatted: updateInfo.assetSizeFormatted || '未知大小',
      })

      const res = await window.electronAPI.updaterDownload({
        downloadUrl: updateInfo.rawDownloadUrl || updateInfo.downloadUrl,
        fileName: updateInfo.assetName || `Lingyin-${updateInfo.remoteVersion}-便携版.zip`,
        mirrorUrl: currentMirror,
      })

      if (res?.success) {
        setDownloadStatus('completed')
        setSavedFilePath(res.filePath || '')
        showToast?.('更新包下载完成！', 'success')
      } else {
        setDownloadStatus('error')
        setErrorMessage(res?.error || '下载未成功完成')
      }
    } catch (err) {
      if (err?.message?.includes('取消')) {
        setDownloadStatus('idle')
        showToast?.('已取消下载', 'info')
      } else {
        setDownloadStatus('error')
        setErrorMessage(err?.message || '下载过程中网络中断')
      }
    }
  }, [updateInfo, currentMirror, showToast])

  const handleCancelDownload = useCallback(async () => {
    try {
      await window.electronAPI?.updaterCancelDownload?.()
    } catch (_) {}
    setDownloadStatus('idle')
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (savedFilePath) {
      await window.electronAPI?.updaterShowInFolder?.(savedFilePath)
    }
  }, [savedFilePath])

  const handleOpenReleasePage = useCallback(async () => {
    if (updateInfo?.releaseUrl) {
      await window.electronAPI?.updaterOpenRelease?.(updateInfo.releaseUrl)
    }
  }, [updateInfo?.releaseUrl])

  if (!isOpen || !updateInfo) return null

  return (
    <div className="update-modal-overlay" onClick={downloadStatus === 'downloading' ? undefined : onClose}>
      <div className="update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-header">
          <div className="update-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="update-header-info">
            <div className="update-title">发现新版本 v{updateInfo.remoteVersion || ''}</div>
            <div className="update-subtitle">
              当前版本：v{updateInfo.currentVersion || ''}
              {updateInfo.publishedAt && (
                <span className="update-date"> · 发布于 {new Date(updateInfo.publishedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          {downloadStatus !== 'downloading' && (
            <button className="update-close-btn" onClick={onClose} aria-label="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="update-body">
          {downloadStatus === 'idle' && (
            <>
              {updateInfo.assetName && (
                <div className="update-asset-pill">
                  <span className="asset-label">安装包文件：</span>
                  <span className="asset-val">{updateInfo.assetName}</span>
                  {updateInfo.assetSizeFormatted && (
                    <span className="asset-size">({updateInfo.assetSizeFormatted})</span>
                  )}
                </div>
              )}

              <div className="update-mirror-row">
                <span className="mirror-label">下载加速源：</span>
                <select
                  className="update-mirror-select"
                  value={currentMirror}
                  onChange={(e) => setCurrentMirror(e.target.value)}
                >
                  <option value="https://ghfast.top/">ghfast.top (推荐加速)</option>
                  <option value="https://ghproxy.net/">ghproxy.net (备用镜像)</option>
                  <option value="direct">官方直连 (GitHub 直连)</option>
                </select>
              </div>

              <div className="update-notes-title">更新说明</div>
              <div className="update-notes-content">
                <pre>{updateInfo.releaseNotes || '暂无详细更新说明'}</pre>
              </div>
            </>
          )}

          {downloadStatus === 'downloading' && (
            <div className="update-downloading-view">
              <div className="download-status-text">
                正在下载最新更新包...
              </div>
              <div className="download-progress-bar-bg">
                <div
                  className="download-progress-bar-fill"
                  style={{ width: `${progressData?.percent || 0}%` }}
                />
              </div>
              <div className="download-metrics">
                <span>{progressData?.percent || 0}%</span>
                <span>{progressData?.speedFormatted || '计算中...'}</span>
                <span>
                  {progressData?.downloadedFormatted || '0 B'} / {progressData?.totalFormatted || updateInfo.assetSizeFormatted || '--'}
                </span>
              </div>
            </div>
          )}

          {downloadStatus === 'completed' && (
            <div className="update-completed-view">
              <div className="completed-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="completed-title">下载成功！</div>
              <div className="completed-desc">
                便携版压缩包已保存至您的系统下载文件夹。解压后即可直接使用新版「聆音」。
              </div>
            </div>
          )}

          {downloadStatus === 'error' && (
            <div className="update-error-view">
              <div className="error-title">下载失败</div>
              <div className="error-desc">{errorMessage}</div>
              <div className="update-mirror-row" style={{ marginTop: '16px', justifyContent: 'center' }}>
                <span className="mirror-label">更换加速源：</span>
                <select
                  className="update-mirror-select"
                  value={currentMirror}
                  onChange={(e) => setCurrentMirror(e.target.value)}
                >
                  <option value="https://ghfast.top/">ghfast.top (推荐加速)</option>
                  <option value="https://ghproxy.net/">ghproxy.net (备用镜像)</option>
                  <option value="direct">官方直连 (GitHub 直连)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="update-footer">
          {downloadStatus === 'idle' && (
            <>
              <button className="secondary-btn" onClick={handleOpenReleasePage}>
                GitHub 查看
              </button>
              <div className="update-footer-actions">
                <button className="secondary-btn" onClick={onClose}>
                  稍后提醒
                </button>
                <button className="primary-btn" onClick={handleStartDownload}>
                  立即下载更新
                </button>
              </div>
            </>
          )}

          {downloadStatus === 'downloading' && (
            <button className="secondary-btn cancel-btn-full" onClick={handleCancelDownload}>
              取消下载
            </button>
          )}

          {downloadStatus === 'completed' && (
            <>
              <button className="secondary-btn" onClick={onClose}>
                完成
              </button>
              <button className="primary-btn" onClick={handleOpenFolder}>
                打开所在文件夹
              </button>
            </>
          )}

          {downloadStatus === 'error' && (
            <>
              <button className="secondary-btn" onClick={onClose}>
                关闭
              </button>
              <button className="primary-btn" onClick={handleStartDownload}>
                重试下载
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
})

export default UpdateModal
