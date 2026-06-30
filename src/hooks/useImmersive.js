import { useState, useCallback, useRef } from 'react'

export function useImmersive() {
  const [isImmersive, setIsImmersive] = useState(false)
  const immersiveLyricRef = useRef(null)

  const handleCloseImmersive = useCallback(() => {
    setIsImmersive(false)
  }, [])

  const handleOpenImmersive = useCallback(() => {
    setIsImmersive(true)
  }, [])

  const handleToggleImmersive = useCallback(() => {
    setIsImmersive((prev) => !prev)
  }, [])

  return {
    isImmersive,
    setIsImmersive,
    immersiveLyricRef,
    handleCloseImmersive,
    handleOpenImmersive,
    handleToggleImmersive,
  }
}
