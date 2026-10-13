import { useState, useMemo, memo } from 'react'
import './WorkGallery.css'

const CATEGORY_TABS = [
  { id: 'all', label: '全部' },
  { id: 'cover', label: '封面' },
  { id: 'cg', label: 'CG插画' },
  { id: 'character', label: '立绘' },
  { id: 'bonus', label: '特典' },
  { id: 'comic', label: '台本漫画' },
]

const WorkGallery = memo(function WorkGallery({
  images = [],
  isLoading = false,
  onImageClick,
  onSetCustomCover,
}) {
  const [activeCategory, setActiveCategory] = useState('all')

  const availableCategories = useMemo(() => {
    const cats = new Set(images.map((img) => img.category))
    return CATEGORY_TABS.filter((tab) => tab.id === 'all' || cats.has(tab.id))
  }, [images])

  const filteredImages = useMemo(() => {
    if (activeCategory === 'all') return images
    return images.filter((img) => img.category === activeCategory)
  }, [images, activeCategory])

  if (isLoading) {
    return (
      <div className="work-gallery-loading">
        <div className="work-gallery-spinner" />
        <span>正在扫描作品画集与插画资源...</span>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="work-gallery-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <div className="work-gallery-empty-text">当前作品暂无插画或本地图片</div>
        <div className="work-gallery-empty-tip">若作品文件夹内包含 cg、特典或立绘图片，将自动在此收录展现</div>
      </div>
    )
  }

  return (
    <div className="work-gallery-container">
      {/* 顶部统计与分类过滤器 */}
      <div className="work-gallery-header">
        <div className="work-gallery-count">
          <span>共收录</span>
          <strong>{images.length}</strong>
          <span>张插画与海报</span>
        </div>

        {availableCategories.length > 2 && (
          <div className="work-gallery-tabs">
            {availableCategories.map((tab) => (
              <button
                key={tab.id}
                className={`work-gallery-tab ${activeCategory === tab.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 图片网格 */}
      <div className="work-gallery-grid">
        {filteredImages.map((img, idx) => {
          const originalIndex = images.indexOf(img)
          return (
            <div
              key={img.id || img.url || idx}
              className="work-gallery-card"
              onClick={() => onImageClick?.(originalIndex >= 0 ? originalIndex : idx)}
            >
              <div className="work-gallery-thumb-wrapper">
                <img
                  src={img.url}
                  alt={img.name}
                  className="work-gallery-img"
                  loading="lazy"
                />
                <div className="work-gallery-overlay">
                  <span className="work-gallery-view-hint">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    查看大图
                  </span>
                </div>
              </div>

              <div className="work-gallery-card-info">
                <span className="work-gallery-card-name" title={img.name}>
                  {img.name}
                </span>
                {img.categoryLabel && (
                  <span className="work-gallery-card-tag">{img.categoryLabel}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default WorkGallery
