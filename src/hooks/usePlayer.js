import { useState, useRef, useCallback } from 'react'
import { getExtension } from '../utils/scanner'
import { parseSubtitle } from '../utils/subtitleParser'

const PROGRESS_SAVE_INTERVAL = 5000 // 每 5 秒保存一次播放进度

export function usePlayer({
  selectedWork,
  audioFiles,
  settings,
  playerRef,
  showToast,
  findMatchedSubtitles,
  detectSubtitleLanguagesAsync,
  loadSavedSubtitle,
  selectSubtitleByPriority,
  handleAutoTranslate,
  setSubtitleOptions,
  setSelectedSubtitleIndex,
  queueIndex,
  playQueue,
  advanceQueue,
  recordHistoryIfNeeded,
  handleSelectAudioRef: externalHandleSelectAudioRef,
}) {
  const [playingWork, setPlayingWork] = useState(null)
  const [currentAudio, setCurrentAudio] = useState(null)
  const [currentCues, setCurrentCues] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const lastSaveTimeRef = useRef(0)
  const durationRef = useRef(0)
  const internalHandleSelectAudioRef = useRef(null)
  const handleSelectAudioRef = externalHandleSelectAudioRef || internalHandleSelectAudioRef

  const handleSelectAudio = useCallback(
    async (audio) => {
      if (!selectedWork) return

      setPlayingWork(selectedWork)
      setCurrentAudio(audio)
      setCurrentCues([])

      let foundSubtitleOptions = []

      if (!audio.isOnline) {
        foundSubtitleOptions = findMatchedSubtitles(audio.name, audio.path)
        detectSubtitleLanguagesAsync(foundSubtitleOptions)
      }

      setSubtitleOptions(foundSubtitleOptions)

      const { savedIndex, updatedOptions } = await loadSavedSubtitle(foundSubtitleOptions)
      if (updatedOptions !== foundSubtitleOptions) {
        setSubtitleOptions(updatedOptions)
      }

      const selectedIndex = selectSubtitleByPriority(updatedOptions, savedIndex)
      setSelectedSubtitleIndex(selectedIndex)

      if (selectedIndex >= 0 && updatedOptions[selectedIndex]) {
        try {
          const sub = updatedOptions[selectedIndex]
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            let cues = parseSubtitle(content, ext)

            handleAutoTranslate(cues, sub, setCurrentCues)

            setCurrentCues(cues)
          }
        } catch (e) {
          console.error('Failed to load subtitle:', e)
          if (window.electronAPI?.logError) {
            window.electronAPI.logError('Failed to load subtitle:', e.message)
          }
        }
      }

      if (!audio.isOnline) {
        try {
          const progress = await window.electronAPI.dbGetProgress(selectedWork.id, audio.path)
          if (progress && progress.currentTime > 5 && progress.duration > 0) {
            const targetTime = progress.currentTime
            const checkAndSeek = setInterval(() => {
              if (playerRef.current && playerRef.current.getDuration?.() > 0) {
                playerRef.current.seekTo?.(targetTime)
                clearInterval(checkAndSeek)
              }
            }, 200)
            setTimeout(() => clearInterval(checkAndSeek), 10000)
          }
        } catch (e) {
          console.error('Failed to load progress:', e)
        }
      }
    },
    [
      selectedWork,
      findMatchedSubtitles,
      detectSubtitleLanguagesAsync,
      loadSavedSubtitle,
      selectSubtitleByPriority,
      handleAutoTranslate,
      setSubtitleOptions,
      setSelectedSubtitleIndex,
      playerRef,
    ],
  )

  handleSelectAudioRef.current = handleSelectAudio

  const handleTimeUpdate = useCallback(
    (time) => {
      setCurrentTime(time)

      if (selectedWork && currentAudio && time > 0) {
        const now = Date.now()
        if (!currentAudio.isOnline && now - lastSaveTimeRef.current > PROGRESS_SAVE_INTERVAL) {
          lastSaveTimeRef.current = now
          window.electronAPI.dbSaveProgress(selectedWork.id, currentAudio.path, {
            currentTime: time,
            duration: durationRef.current,
          })
        }
        recordHistoryIfNeeded(selectedWork, currentAudio, now)
      }
    },
    [selectedWork, currentAudio, recordHistoryIfNeeded],
  )

  const handleReady = useCallback((dur) => {
    setDuration(dur)
    durationRef.current = dur
  }, [])

  const handleSeek = useCallback((time) => {
    if (playerRef.current) {
      playerRef.current.seekTo?.(time)
    }
  }, [playerRef])

  const handlePrevAudio = useCallback(() => {
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(-1, false)) return
    }
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex <= 0) return
    handleSelectAudio(audioFiles[currentIndex - 1])
  }, [queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  const handleNextAudio = useCallback(() => {
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(1, false)) return
    }
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  const handleFinish = useCallback(() => {
    if (!settings?.autoPlayNext) return
    if (queueIndex >= 0 && playQueue.length > 0) {
      if (advanceQueue(1, true)) return
    }
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [settings, queueIndex, playQueue, advanceQueue, currentAudio, audioFiles, handleSelectAudio])

  return {
    playingWork,
    setPlayingWork,
    currentAudio,
    setCurrentAudio,
    currentCues,
    setCurrentCues,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    handleSelectAudio,
    handleSelectAudioRef,
    handleTimeUpdate,
    handleReady,
    handleSeek,
    handlePrevAudio,
    handleNextAudio,
    handleFinish,
    durationRef,
  }
}
