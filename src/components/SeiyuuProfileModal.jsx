import { memo, useEffect } from 'react'
import './SeiyuuProfileModal.css'

const SeiyuuProfileModal = memo(function SeiyuuProfileModal({
  isOpen,
  onClose,
  profileData,
  onStartRadio,
  onFilterThisCV,
  onSelectWork,
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !profileData) return null

  return (
    <div className="seiyuu-modal-backdrop" onClick={onClose}>
      <div className="seiyuu-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 背景星云微光装饰 */}
        <div className="seiyuu-astral-glow" />

        {/* 弹窗头部 */}
        <div className="seiyuu-modal-header">
          <div className="seiyuu-title-block">
            <span className="seiyuu-avatar-icon">🎙️</span>
            <div>
              <div className="seiyuu-role-badge">SEIYUU ASTRAL PROFILE</div>
              <h2 className="seiyuu-name-title">{profileData.cvName}</h2>
            </div>
          </div>
          <button className="seiyuu-close-btn" onClick={onClose} title="关闭 (Esc)">
            ✕
          </button>
        </div>

        {/* 核心指标统计卡片 */}
        <div className="seiyuu-stats-grid">
          <div className="seiyuu-stat-card card-gold">
            <span className="stat-label">陪伴时光</span>
            <span className="stat-val-huge">{profileData.formattedListeningTime}</span>
            <span className="stat-hint">历史累计聆听总时长</span>
          </div>
          <div className="seiyuu-stat-card">
            <span className="stat-label">收录作品</span>
            <span className="stat-val">{profileData.totalWorks} <span className="stat-unit">部</span></span>
            <span className="stat-hint">涵盖 {profileData.totalTracks} 首音声曲目</span>
          </div>
          <div className="seiyuu-stat-card">
            <span className="stat-label">心动瞬间</span>
            <span className="stat-val">{profileData.stampsCount} <span className="stat-unit">处</span></span>
            <span className="stat-hint">感官打点高能记忆</span>
          </div>
        </div>

        {/* 主体两栏布局 */}
        <div className="seiyuu-body-content">
          {/* 左栏：声线风味星云与社团足迹 */}
          <div className="seiyuu-content-left">
            {/* 声线风味特征星云 */}
            <div className="seiyuu-section">
              <h4 className="seiyuu-section-title">
                <span className="section-icon">✨</span>
                声线风味特征星云
              </h4>
              <div className="seiyuu-flavor-cloud">
                {profileData.flavorTags && profileData.flavorTags.length > 0 ? (
                  profileData.flavorTags.map((item) => (
                    <span
                      key={item.tag}
                      className={`flavor-tag-chip rank-${item.weightRank}`}
                      title={`收录作品占比约 ${item.percentage}%`}
                    >
                      {item.tag}
                      <span className="flavor-pct">{item.percentage}%</span>
                    </span>
                  ))
                ) : (
                  <span className="seiyuu-empty-sub">暂无标签特征</span>
                )}
              </div>
            </div>

            {/* 合作社团足迹 */}
            <div className="seiyuu-section">
              <h4 className="seiyuu-section-title">
                <span className="section-icon">🎪</span>
                常驻合作社团
              </h4>
              <div className="seiyuu-circles-list">
                {profileData.circles && profileData.circles.length > 0 ? (
                  profileData.circles.map((c) => (
                    <div key={c.circle} className="seiyuu-circle-row">
                      <span className="circle-name-text">{c.circle}</span>
                      <div className="circle-bar-track">
                        <div
                          className="circle-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(12, c.ratio))}%` }}
                        />
                      </div>
                      <span className="circle-count-badge">{c.count} 部</span>
                    </div>
                  ))
                ) : (
                  <span className="seiyuu-empty-sub">暂无社团记录</span>
                )}
              </div>
            </div>
          </div>

          {/* 右栏：殿堂代表作精选 */}
          <div className="seiyuu-content-right">
            <div className="seiyuu-section">
              <h4 className="seiyuu-section-title">
                <span className="section-icon">🏆</span>
                精选收录代表作
              </h4>
              <div className="seiyuu-works-grid">
                {profileData.topWorks.map((work) => (
                  <div
                    key={work.id}
                    className="seiyuu-work-mini-card"
                    onClick={() => {
                      onSelectWork?.(work)
                      onClose?.()
                    }}
                    title={`点击切换到作品：${work.title || work.folderName}`}
                  >
                    {work.cover ? (
                      <img src={work.cover} alt="cover" className="work-mini-thumb" />
                    ) : (
                      <div className="work-mini-thumb-fallback">🎙️</div>
                    )}
                    <div className="work-mini-info">
                      <div className="work-mini-title">{work.title || work.folderName}</div>
                      <div className="work-mini-meta">
                        {work.rjCode && <span className="work-mini-rj">{work.rjCode}</span>}
                        {work.circle && <span className="work-mini-circle">{work.circle}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作工具栏 */}
        <div className="seiyuu-modal-footer">
          <div className="seiyuu-footer-left">
            <button className="seiyuu-filter-btn" onClick={onFilterThisCV}>
              🔍 在媒体库中筛选该声优
            </button>
          </div>
          <div className="seiyuu-footer-right">
            <button className="btn-secondary" onClick={onClose}>
              关闭
            </button>
            <button className="btn-primary seiyuu-radio-btn" onClick={onStartRadio}>
              <span className="radio-wave-icon">📻</span>
              开启「{profileData.cvName}」心动专属电台
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default SeiyuuProfileModal
