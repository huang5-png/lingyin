import { memo } from 'react'
import './DiscoverView.css'

const WorkCard = memo(function WorkCard({
  work,
  selectedWorkId,
  getTranslatedText,
  favoriteIds,
  onSelectWork,
  onToggleFavorite,
  onDeleteWork,
  bulkMode,
  selectedIds,
  onToggleSelect,
  workProgressMap,
  onFilterTag,
  activeTag,
  getTagColor,
}) {
  const isActive = selectedWorkId === work.id
  const isFavorited = favoriteIds?.has(work.id)
  const isSelected = selectedIds?.has(work.id)
  const progress = workProgressMap?.[work.id]

  const formatDate = (dateInput) => {
    if (!dateInput) return ''
    let date
    if (typeof dateInput === 'number') {
      date = new Date(dateInput)
    } else {
      date = new Date(dateInput)
    }
    if (isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const displayDate = formatDate(work.release || work.createdAt || work.create_date)

  return (
    <div
      className={`discover-work-card ${isActive ? 'selected' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (bulkMode) {
          onToggleSelect?.(work.id)
        } else {
          onSelectWork(work)
        }
      }}
    >
      {bulkMode && (
        <div className="bulk-select-checkbox">
          <button
            className={`item-checkbox ${isSelected ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.(work.id)
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      )}
      <div className="discover-card-cover">
        {work.cover ? (
          <img src={work.cover} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="cover-placeholder">
            <svg className="cover-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}
        {work.rating > 0 && (
          <div className="duration-badge">
            <svg className="star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {work.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="discover-card-info">
        <h3 className="discover-card-title">{getTranslatedText?.(work.title || work.folderName) || work.title || work.folderName}</h3>
        <p className="discover-card-circle">
          {work.cvs && work.cvs.length > 0
            ? work.cvs.map(cv => getTranslatedText?.(cv) || cv).join('、')
            : work.circle || ''}
        </p>
        <div className="discover-card-meta">
          {displayDate && (
            <p className="discover-card-date">{displayDate}</p>
          )}
          {work.tags && work.tags.length > 0 && (
            <div className="discover-card-tags">
              {work.tags.map((tag, i) => {
                const tagIsActive = Array.isArray(activeTag) ? activeTag.includes(tag) : activeTag === tag
                const tagColor = getTagColor?.(tag) || ''
                return (
                  <span
                    key={i}
                    className={`work-tag ${tagIsActive ? 'active' : ''}`}
                    style={tagColor ? { '--tag-color': tagColor } : {}}
                    onClick={(e) => {
                      e.stopPropagation()
                      onFilterTag?.(tagIsActive ? '' : tag)
                    }}
                    title={tagIsActive ? '取消此标签筛选' : '按此标签筛选'}
                  >
                    {getTranslatedText?.(tag) || tag}
                  </span>
                )
              })}
            </div>
          )}
          {progress && progress.percentage > 0 && (
            <div className="card-progress">
              <div className="card-progress-bar" style={{ width: `${progress.percentage}%` }} />
            </div>
          )}
        </div>
      </div>
      <button
        className={`work-favorite-btn card-favorite ${isFavorited ? 'favorited' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite?.(work)
        }}
        title={isFavorited ? '取消收藏' : '添加收藏'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <button
        className="work-delete-btn card-delete"
        onClick={(e) => {
          e.stopPropagation()
          onDeleteWork(work)
        }}
        title="删除"
      >
        ×
      </button>
    </div>
  )
}, (prev, next) => {
  return (
    prev.work.id === next.work.id &&
    prev.selectedWorkId === next.selectedWorkId &&
    prev.favoriteIds === next.favoriteIds &&
    prev.bulkMode === next.bulkMode &&
    prev.selectedIds === next.selectedIds &&
    prev.workProgressMap === next.workProgressMap &&
    prev.getTranslatedText === next.getTranslatedText &&
    prev.onSelectWork === next.onSelectWork &&
    prev.onToggleFavorite === next.onToggleFavorite &&
    prev.onDeleteWork === next.onDeleteWork &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onFilterTag === next.onFilterTag &&
    prev.activeTag === next.activeTag &&
    prev.getTagColor === next.getTagColor &&
    prev.work.title === next.work.title &&
    prev.work.cover === next.work.cover &&
    prev.work.rating === next.work.rating &&
    prev.work.cvs === next.work.cvs &&
    prev.work.tags === next.work.tags &&
    prev.work.folderName === next.work.folderName
  )
})

export default WorkCard
