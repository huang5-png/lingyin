import { useRef, useCallback } from 'react'

const HISTORY_INTERVAL = 60000 // 每 60 秒记录一次播放历史

/**
 * 播放历史记录 Hook
 * 封装历史记录的定时记录逻辑，每 60 秒向数据库追加一条播放记录
 */
export function usePlaybackHistory() {
  // 上次记录历史的时间戳（用于节流）
  const lastHistoryTimeRef = useRef(0)

  /**
   * 检查是否需要记录历史，并在必要时记录
   * @param {object} currentWork - 当前播放的作品
   * @param {object} currentAudio - 当前播放的音频
   * @param {number} now - 当前时间戳（由调用方传入，避免依赖 Date.now()）
   */
  const recordHistoryIfNeeded = useCallback((currentWork, currentAudio, now) => {
    if (!currentWork || !currentAudio) return

    if (now - lastHistoryTimeRef.current < HISTORY_INTERVAL) return

    lastHistoryTimeRef.current = now

    window.electronAPI.dbAppendHistory({
      ts: now,
      workId: currentWork.id,
      audioFile: currentAudio.path || currentAudio.name || '',
      seconds: 60,
      title: currentWork.title || currentWork.folderName || '',
      cover: currentWork.cover || '',
      circle: currentWork.circle || '',
      cvs: currentWork.cvs || [],
      tags: currentWork.tags || [],
    }).catch(() => {})
  }, [])

  return {
    recordHistoryIfNeeded,
    lastHistoryTimeRef,
  }
}
