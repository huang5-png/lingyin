import { useState, useCallback } from 'react'

/**
 * Toast 通知 Hook
 * 管理 Toast 通知的状态和操作函数
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    toasts,
    showToast,
    removeToast,
  }
}
