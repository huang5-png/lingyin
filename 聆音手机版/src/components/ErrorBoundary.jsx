import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyError = () => {
    const { error } = this.state
    const errorText = [
      '=== 聆音错误报告 ===',
      `时间: ${new Date().toLocaleString('zh-CN')}`,
      `错误: ${error?.toString() || '未知错误'}`,
      '',
      '--- 错误堆栈 ---',
      error?.stack || '无堆栈信息',
    ].join('\n')

    navigator.clipboard.writeText(errorText).then(() => {
      alert('错误信息已复制到剪贴板')
    }).catch(() => {
      alert('复制失败，请手动选择错误信息')
    })
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.toString() || '未知错误'
      const errorStack = this.state.error?.stack || ''

      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            {/* Logo */}
            <div className="eb-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>

            {/* Title */}
            <h1 className="eb-title">出错了</h1>
            <p className="eb-subtitle">聆音遇到了一些问题，请尝试刷新页面</p>

            {/* Error display */}
            <div className="eb-error-box">
              <div className="eb-error-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{errorMessage}</span>
              </div>
              {errorStack && (
                <pre className="eb-error-stack">{errorStack}</pre>
              )}
            </div>

            {/* Actions */}
            <div className="eb-actions">
              <button className="eb-btn-primary" onClick={this.handleReload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                刷新页面
              </button>
              <button className="eb-btn-secondary" onClick={this.handleCopyError}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                复制错误
              </button>
            </div>

            {/* Footer */}
            <div className="eb-footer">
              如果问题持续存在，请联系开发者并提供错误信息
            </div>
          </div>

          <style>{`
            .error-boundary {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: var(--bg-primary, #faf9f5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 99999;
              font-family: var(--font-family, 'Lora', serif);
            }

            [data-theme="dark"] .error-boundary {
              background: var(--bg-primary, #262624);
            }

            .error-boundary::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(135deg, rgba(201, 100, 66, 0.03) 0%, rgba(176, 86, 47, 0.05) 100%);
              pointer-events: none;
            }

            .error-boundary-card {
              position: relative;
              background: var(--bg-primary, #faf9f5);
              border-radius: 16px;
              padding: 48px;
              max-width: 520px;
              width: 90%;
              box-shadow: var(--shadow-xl, 0 20px 40px rgba(0, 0, 0, 0.1));
              text-align: center;
            }

            [data-theme="dark"] .error-boundary-card {
              background: var(--bg-primary, #262624);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }

            .eb-logo {
              width: 80px;
              height: 80px;
              margin: 0 auto 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, rgba(201, 100, 66, 0.1), rgba(176, 86, 47, 0.15));
              border-radius: 20px;
              color: var(--accent-primary, #c96442);
            }

            [data-theme="dark"] .eb-logo {
              background: linear-gradient(135deg, rgba(217, 119, 87, 0.15), rgba(224, 141, 111, 0.2));
              color: var(--accent-primary, #d97757);
            }

            .eb-title {
              font-family: var(--font-heading, 'Poppins', sans-serif);
              font-size: 28px;
              font-weight: 600;
              color: var(--accent-primary, #c96442);
              margin: 0 0 8px;
            }

            [data-theme="dark"] .eb-title {
              color: var(--accent-primary, #d97757);
            }

            .eb-subtitle {
              font-size: 14px;
              color: var(--text-secondary, #6e6d68);
              margin: 0 0 32px;
            }

            .eb-error-box {
              background: rgba(239, 68, 68, 0.08);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 24px;
              text-align: left;
            }

            .eb-error-header {
              display: flex;
              align-items: center;
              gap: 8px;
              color: #ef4444;
              font-size: 14px;
              font-weight: 500;
              margin-bottom: 8px;
            }

            .eb-error-header svg {
              flex-shrink: 0;
            }

            .eb-error-stack {
              font-family: var(--font-mono, 'Geist Mono', monospace);
              font-size: 11px;
              color: var(--text-secondary, #6e6d68);
              background: transparent;
              margin: 0;
              padding: 0;
              white-space: pre-wrap;
              word-break: break-all;
              max-height: 200px;
              overflow-y: auto;
            }

            .eb-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              margin-bottom: 24px;
            }

            .eb-btn-primary,
            .eb-btn-secondary {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 12px 24px;
              border-radius: 8px;
              font-family: var(--font-heading, 'Poppins', sans-serif);
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              border: none;
            }

            .eb-btn-primary {
              background: linear-gradient(135deg, var(--accent-primary, #c96442), var(--accent-secondary, #b0562f));
              color: #fff;
            }

            .eb-btn-primary:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(201, 100, 66, 0.3);
            }

            [data-theme="dark"] .eb-btn-primary {
              background: linear-gradient(135deg, var(--accent-primary, #d97757), #e08d6f);
            }

            [data-theme="dark"] .eb-btn-primary:hover {
              box-shadow: 0 4px 12px rgba(217, 119, 87, 0.4);
            }

            .eb-btn-secondary {
              background: transparent;
              color: var(--text-secondary, #6e6d68);
              border: 1px solid var(--border-color, #e5e4e0);
            }

            .eb-btn-secondary:hover {
              background: rgba(201, 100, 66, 0.05);
              color: var(--accent-primary, #c96442);
              border-color: var(--accent-primary, #c96442);
            }

            [data-theme="dark"] .eb-btn-secondary {
              color: var(--text-secondary, #8c959e);
              border-color: #3a3a38;
            }

            [data-theme="dark"] .eb-btn-secondary:hover {
              background: rgba(217, 119, 87, 0.1);
              color: var(--accent-primary, #d97757);
              border-color: var(--accent-primary, #d97757);
            }

            .eb-footer {
              font-size: 12px;
              color: var(--text-secondary, #6e6d68);
            }

            @media (max-width: 480px) {
              .error-boundary-card {
                padding: 32px 24px;
              }

              .eb-title {
                font-size: 24px;
              }

              .eb-actions {
                flex-direction: column;
              }

              .eb-btn-primary,
              .eb-btn-secondary {
                width: 100%;
                justify-content: center;
              }
            }
          `}</style>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
