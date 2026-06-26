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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#1a1a2e',
          color: '#fff',
          padding: 40,
          fontFamily: 'sans-serif',
          overflow: 'auto',
          zIndex: 99999,
        }}>
          <h2 style={{ color: '#e879a8' }}>出错了</h2>
          <p style={{ color: '#ccc' }}>应用遇到了一个错误：</p>
          <pre style={{
            background: '#16213e',
            padding: 20,
            borderRadius: 8,
            marginTop: 20,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #e879a8, #a78bfa)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
