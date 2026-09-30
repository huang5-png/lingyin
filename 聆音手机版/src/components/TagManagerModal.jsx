import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import './TagManagerModal.css'
import StateView from './StateView'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#475569',
]

const TagManagerModal = memo(function TagManagerModal({
  isOpen,
  onClose,
  allTags,
  loading,
  onSetColor,
  onRename,
  onMerge,
  onDelete,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState(new Set())
  const [editingTag, setEditingTag] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const colorPickerRef = useRef(null)
  const inputRef = useRef(null)

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return allTags
    const q = searchQuery.toLowerCase()
    return allTags.filter(t => 
      t.name.toLowerCase().includes(q)
    )
  }, [allTags, searchQuery])

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedTag(new Set())
      setEditingTag(null)
      setMergeMode(false)
      setMergeTarget('')
      onRefresh?.()
    }
  }, [isOpen, onRefresh])

  useEffect(() => {
    if (!editingTag && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTag])

  useEffect(() => {
    if (!showColorPicker) return
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showColorPicker])

  const toggleSelect = useCallback((tagName) => {
    setSelectedTag(prev => {
      const next = new Set(prev)
      if (next.has(tagName)) {
        next.delete(tagName)
      } else {
        next.add(tagName)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedTag(new Set(filteredTags.map(t => t.name)))
  }, [filteredTags])

  const clearSelection = useCallback(() => {
    setSelectedTag(new Set())
  }, [])

  const handleStartRename = useCallback((tagName) => {
    setEditingTag(tagName)
    setEditValue(tagName)
  }, [])

  const handleConfirmRename = useCallback(async () => {
    if (!editingTag || !editValue.trim() || editValue.trim() === editingTag) {
      setEditingTag(null)
      return
    }
    const newName = editValue.trim()
    await onRename?.(editingTag, newName)
    setEditingTag(null)
    setEditValue('')
  }, [editingTag, editValue, onRename])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleConfirmRename()
    } else if (e.key === 'Escape') {
      setEditingTag(null)
      setEditValue('')
    }
  }, [handleConfirmRename])

  const handleSetColor = useCallback(async (tagName, color) => {
    await onSetColor?.(tagName, color)
    setShowColorPicker(null)
  }, [onSetColor])

  const handleDeleteTag = useCallback((tagName, e) => {
    e.stopPropagation()
    if (!confirm(`确定删除标签「${tagName}」吗？\n该标签将从所有作品中移除。`)) return
    onDelete?.(tagName)
    setSelectedTag(prev => {
      const next = new Set(prev)
      next.delete(tagName)
      return next
    })
  }, [onDelete])

  const handleMerge = useCallback(async () => {
    const sources = Array.from(selectedTag)
    if (sources.length < 2) {
      alert('请至少选择 2 个标签进行合并')
      return
    }
    const target = mergeTarget.trim()
    if (!target) {
      alert('请输入目标标签名称')
      return
    }
    if (!confirm(`确定将选中的 ${sources.length} 个标签合并到「${target}」吗？`)) return
    await onMerge?.(sources, target)
    setSelectedTag(new Set())
    setMergeMode(false)
    setMergeTarget('')
  }, [selectedTag, mergeTarget, onMerge])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose?.()
    }
  }, [onClose])

  useEffect(() => {
    const handleKey = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        if (editingTag) {
          setEditingTag(null)
          setEditValue('')
        } else if (mergeMode) {
          setMergeMode(false)
          setMergeTarget('')
        } else {
          onClose?.()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, editingTag, mergeMode, onClose])

  if (!isOpen) return null

  return (
    <div className="tag-manager-overlay" onClick={handleOverlayClick}>
      <div className="tag-manager-modal">
        <div className="tag-manager-header">
        <h2>标签管理</h2>
        <div className="tag-manager-header-actions">
          <span className="tag-count-badge">共 {allTags.length} 个标签</span>
          <button className="tm-close-btn" onClick={onClose} title="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="tag-manager-toolbar">
        <div className="tm-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="tm-toolbar-actions">
          {selectedTag.size > 0 && (
            <>
              <span className="selected-count">已选 {selectedTag.size} 个</span>
              <button className="tm-btn tm-btn-secondary" onClick={clearSelection}>
                取消选择
              </button>
              <button className="tm-btn tm-btn-primary" onClick={() => setMergeMode(true)}>
                合并选中
              </button>
            </>
          )}
          {filteredTags.length > 0 && selectedTag.size < filteredTags.length && (
            <button className="tm-btn tm-btn-ghost" onClick={selectAll}>
              全选
            </button>
          )}
        </div>
      </div>

      {mergeMode && (
        <div className="merge-mode-bar">
          <span className="merge-hint">将选中的 {selectedTag.size} 个标签合并到：</span>
          <input
            type="text"
            className="merge-target-input"
            placeholder="输入目标标签名称"
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
          />
          <button className="tm-btn tm-btn-primary" onClick={handleMerge}>
            确认合并
          </button>
          <button className="tm-btn tm-btn-ghost" onClick={() => { setMergeMode(false); setMergeTarget('') }}>
            取消
          </button>
        </div>
      )}

      <div className="tag-list-container">
        {loading && (
          <StateView type="loading" title="加载中..." size="sm" />
        )}
        {!loading && filteredTags.length === 0 && (
          <StateView type="empty" iconType="search" title="没有找到标签" size="sm" />
        )}
        {!loading && filteredTags.map((tag) => (
          <div
            key={tag.name}
            className={`tag-item ${selectedTag.has(tag.name) ? 'selected' : ''} ${editingTag === tag.name ? 'editing' : ''}`}
          >
            <div className="tag-item-left">
              <input
                type="checkbox"
                className="tag-checkbox"
                checked={selectedTag.has(tag.name)}
                onChange={() => toggleSelect(tag.name)}
              />
              <div
                className="tag-color-dot"
                style={{ backgroundColor: tag.color || '#888' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowColorPicker(showColorPicker === tag.name ? null : tag.name)
                }}
                title="点击设置颜色"
              />
              {editingTag === tag.name ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="tag-edit-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleConfirmRename}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <span className="tag-name" onDoubleClick={() => handleStartRename(tag.name)}>
                  {tag.name}
                </span>
              )}
            </div>
            <div className="tag-item-right">
              <span className="tag-count">{tag.count} 作品</span>
              <button
                className="tag-action-btn"
                onClick={(e) => { e.stopPropagation(); handleStartRename(tag.name) }}
                title="重命名"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                className="tag-action-btn delete-btn"
                onClick={(e) => handleDeleteTag(tag.name, e)}
                title="删除"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              {showColorPicker === tag.name && (
                <div className="color-picker-popover" ref={colorPickerRef} onClick={(e) => e.stopPropagation()}>
                  <div className="color-picker-grid">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className="color-swatch"
                        style={{ backgroundColor: color }}
                        onClick={() => handleSetColor(tag.name, color)}
                        title={color}
                      />
                    ))}
                  </div>
                  <button
                    className="color-clear-btn"
                    onClick={() => handleSetColor(tag.name, '')}
                  >
                    清除颜色
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="tag-manager-footer">
        <div className="tm-tip">提示：双击标签名可重命名，点击色点可设置颜色</div>
      </div>
    </div>
    </div>
  )
})

export default TagManagerModal
