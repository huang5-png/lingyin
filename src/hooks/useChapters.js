import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  extractChaptersFromText,
  normalizeChapters,
  findActiveChapter,
} from '../utils/chapterParser'

/**
 * 音频剧情章节与时间戳标记管理 Hook
 */
export function useChapters({ work, currentAudio, currentTime = 0, duration = 0, playerRef, onToast }) {
  const [customChapters, setCustomChapters] = useState([])

  const storageKey = useMemo(() => {
    if (!work?.id || !currentAudio?.path) return null
    return `lingyin_chapters_${work.id}_${encodeURIComponent(currentAudio.path)}`
  }, [work?.id, currentAudio?.path])

  // 读取持久化的自定义章节
  useEffect(() => {
    if (!storageKey) {
      setCustomChapters([])
      return
    }
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setCustomChapters(JSON.parse(saved))
      } else {
        setCustomChapters([])
      }
    } catch (e) {
      setCustomChapters([])
    }
  }, [storageKey])

  // 自动从作品描述与音频文件名等提取候选章节
  const autoExtractedChapters = useMemo(() => {
    const textSources = [
      work?.description,
      work?.dlsiteDetail?.description,
      work?.intro,
      currentAudio?.displayName,
      currentAudio?.name,
    ]
      .filter(Boolean)
      .join('\n')

    return extractChaptersFromText(textSources)
  }, [work?.description, work?.dlsiteDetail?.description, work?.intro, currentAudio?.displayName, currentAudio?.name])

  // 合并自动提取与用户自定义的章节并规范化
  const chapters = useMemo(() => {
    const combined = [...autoExtractedChapters, ...customChapters]
    return normalizeChapters(combined, duration)
  }, [autoExtractedChapters, customChapters, duration])

  // 当前处于的章节
  const activeChapter = useMemo(() => {
    return findActiveChapter(chapters, currentTime)
  }, [chapters, currentTime])

  // 跳转到指定章节
  const handleSeekToChapter = useCallback(
    (chapter) => {
      if (!chapter || typeof chapter.startTime !== 'number') return
      playerRef?.current?.seekTo(chapter.startTime)
      if (onToast) {
        onToast(`跳转至章节：${chapter.title} (${chapter.timeFormatted})`, 'info')
      }
    },
    [playerRef, onToast]
  )

  // 添加自定义章节
  const handleAddCustomChapter = useCallback(
    (time, title) => {
      if (!storageKey) return
      const newChapter = {
        id: `custom_${Date.now()}`,
        startTime: Math.max(0, time),
        title: (title || '').trim() || '新章节标记',
      }
      const updated = [...customChapters, newChapter]
      setCustomChapters(updated)
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
        if (onToast) onToast('章节标记已保存', 'success')
      } catch (e) {}
    },
    [storageKey, customChapters, onToast]
  )

  // 删除自定义章节
  const handleDeleteCustomChapter = useCallback(
    (chapterId) => {
      if (!storageKey) return
      const updated = customChapters.filter((ch) => ch.id !== chapterId)
      setCustomChapters(updated)
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
        if (onToast) onToast('章节标记已删除', 'info')
      } catch (e) {}
    },
    [storageKey, customChapters, onToast]
  )

  return {
    chapters,
    activeChapter,
    hasChapters: chapters.length > 0,
    seekToChapter: handleSeekToChapter,
    addCustomChapter: handleAddCustomChapter,
    deleteCustomChapter: handleDeleteCustomChapter,
  }
}
