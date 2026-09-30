import { useCallback } from 'react'
import { scanFolder, getExtension } from '../utils/scanner'
import { parseSubtitle } from '../utils/subtitleParser'

export function useSubtitleRefresh({
  selectedWork,
  currentAudio,
  subtitleOptions,
  selectedSubtitleIndex,
  findMatchedSubtitles,
  detectSubtitleLanguagesAsync,
  setAudioFiles,
  setAllSubtitleFiles,
  setSubtitleOptions,
  setSelectedSubtitleIndex,
  setCurrentCues,
  showToast,
}) {
  const handleRefreshSubtitles = useCallback(async () => {
    if (!selectedWork) return
    try {
      const r = await scanFolder(selectedWork.folderPath)
      const filesWithDuration = await Promise.all(
        r.audioFiles.map(async (f) => {
          try {
            const dur = await window.electronAPI.getAudioDuration(f.path)
            return { ...f, duration: dur ? Math.round(dur) : null }
          } catch {
            return f
          }
        })
      )
      setAudioFiles(filesWithDuration)
      setAllSubtitleFiles(r.subtitleFiles)

      if (currentAudio) {
        const newSubtitleOptions = findMatchedSubtitles(currentAudio.name, currentAudio.path)
        const currentSubPath = subtitleOptions[selectedSubtitleIndex]?.file?.path
        let newSelectedIndex = newSubtitleOptions.length > 0 ? 0 : -1

        if (currentSubPath && selectedSubtitleIndex >= 0) {
          const existingIndex = newSubtitleOptions.findIndex((s) => s.file.path === currentSubPath)
          if (existingIndex >= 0) {
            newSelectedIndex = existingIndex
          }
        }

        setSubtitleOptions(newSubtitleOptions)
        setSelectedSubtitleIndex(newSelectedIndex)
        detectSubtitleLanguagesAsync(newSubtitleOptions)

        if (newSelectedIndex >= 0) {
          const sub = newSubtitleOptions[newSelectedIndex]
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            const cues = parseSubtitle(content, ext)
            setCurrentCues(cues)
          }
        } else {
          setCurrentCues([])
        }
      }
    } catch (e) {
      console.error('Failed to refresh subtitles:', e)
      showToast('刷新字幕失败：' + e.message, 'error')
    }
  }, [
    selectedWork,
    currentAudio,
    subtitleOptions,
    selectedSubtitleIndex,
    findMatchedSubtitles,
    detectSubtitleLanguagesAsync,
    setAudioFiles,
    setAllSubtitleFiles,
    setSubtitleOptions,
    setSelectedSubtitleIndex,
    setCurrentCues,
    showToast,
  ])

  return {
    handleRefreshSubtitles,
  }
}
