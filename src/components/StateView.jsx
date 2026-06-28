import './StateView.css'

// 预置图标 SVG 组件
const icons = {
  empty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  loading: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner-icon">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  playlist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
}

/**
 * StateView - 统一空态/加载态/错误状态组件
 * @param {Object} props
 * @param {'empty'|'loading'|'error'} props.type - 状态类型
 * @param {React.ReactNode} [props.icon] - 自定义图标，优先级高于 iconType
 * @param {string} [props.iconType] - 预置图标类型: empty|loading|error|playlist|download|folder
 * @param {string} [props.title] - 标题文字
 * @param {string} [props.description] - 描述文字
 * @param {React.ReactNode} [props.action] - 操作按钮区域
 * @param {string} [props.className] - 额外类名
 */
export default function StateView({
  type = 'empty',
  icon,
  iconType,
  title,
  description,
  action,
  className = '',
}) {
  // 确定图标
  const renderIcon = () => {
    if (icon) return icon
    if (iconType && icons[iconType]) return icons[iconType]
    if (type === 'loading') return icons.loading
    if (type === 'error') return icons.error
    return icons.empty
  }

  // 默认文案
  const defaults = {
    empty: { title: '暂无内容', description: '这里还没有任何内容' },
    loading: { title: '加载中...', description: '' },
    error: { title: '出错了', description: '加载失败，请稍后重试' },
  }

  const defaultConfig = defaults[type] || defaults.empty

  return (
    <div className={`state-view state-view-${type} ${className}`}>
      <div className="state-view-icon">
        {renderIcon()}
      </div>
      {title !== undefined && (
        <h3 className="state-view-title">{title || defaultConfig.title}</h3>
      )}
      {description !== undefined && description && (
        <p className="state-view-description">{description}</p>
      )}
      {description === undefined && defaultConfig.description && (
        <p className="state-view-description">{defaultConfig.description}</p>
      )}
      {action && (
        <div className="state-view-action">{action}</div>
      )}
    </div>
  )
}
