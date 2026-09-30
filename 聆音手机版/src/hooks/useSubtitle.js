import { useState, useCallback } from 'react'
import { findAllSubtitlesForAudio, getExtension, detectLanguageFromContent } from '../utils/scanner'
import { parseSubtitle } from '../utils/subtitleParser'

export function useSubtitle({
  selectedWork,
  currentAudio,
  allSubtitleFiles,
  settings,
  translateCacheRef,
  setTranslateVersion,
  showToast,
}) {
  const [subtitleOptions, setSubtitleOptions] = useState([])
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1)

  // 异步检测字幕语言
  const detectSubtitleLanguagesAsync = useCallback(async (subOptions) => {
    if (!subOptions || subOptions.length === 0) return

    for (let i = 0; i < subOptions.length; i++) {
      const sub = subOptions[i]
      if (!sub || !sub.file || !sub.file.path) continue

      try {
        const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
        if (!content) continue

        const detectedLang = detectLanguageFromContent(content)
        if (detectedLang !== 'unknown' && sub.language !== detectedLang) {
          setSubtitleOptions((prev) => {
            const newOptions = [...prev]
            if (newOptions[i] && newOptions[i].file.path === sub.file.path) {
              newOptions[i] = { ...newOptions[i], language: detectedLang }
            }
            return newOptions
          })
        }
      } catch (e) {
        console.warn('Failed to detect language for subtitle:', sub.file?.name, e)
      }
    }
  }, [])

  // 查找匹配的字幕
  const findMatchedSubtitles = useCallback((audioName, audioPath) => {
    return findAllSubtitlesForAudio(audioName, allSubtitleFiles || [], audioPath)
  }, [allSubtitleFiles])

  // 加载保存的字幕选择
  const loadSavedSubtitle = useCallback(async (subtitleOptions) => {
    if (!selectedWork || !currentAudio) return { savedIndex: -1, updatedOptions: subtitleOptions }

    try {
      const savedSubtitle = await window.electronAPI.dbGetSubtitle(selectedWork.id, currentAudio.path)
      if (savedSubtitle && savedSubtitle.filePath) {
        const existingIndex = subtitleOptions.findIndex((s) => s.file.path === savedSubtitle.filePath)
        if (existingIndex >= 0) {
          return { savedIndex: existingIndex, updatedOptions: subtitleOptions }
        } else if (savedSubtitle.isManual) {
          const manualSub = {
            file: {
              name: savedSubtitle.fileName,
              path: savedSubtitle.filePath,
              isDirectory: false,
            },
            format: savedSubtitle.format,
            language: savedSubtitle.language || 'unknown',
            isTranslated: savedSubtitle.isTranslated || false,
            matchScore: 100,
            displayName: savedSubtitle.displayName || savedSubtitle.fileName,
            isManual: true,
          }
          const newOptions = [manualSub, ...subtitleOptions]
          return { savedIndex: 0, updatedOptions: newOptions }
        }
      }
    } catch (e) {
      console.error('Failed to load saved subtitle:', e)
    }
    return { savedIndex: -1, updatedOptions: subtitleOptions }
  }, [selectedWork, currentAudio])

  // 根据语言优先级选择字幕
  const selectSubtitleByPriority = useCallback((subtitleOptions, savedIndex) => {
    if (savedIndex >= 0) return savedIndex
    if (subtitleOptions.length === 0) return -1

    const langPriority = settings?.subtitleLangPriority || 'auto'
    if (langPriority !== 'auto') {
      const priorityIndex = subtitleOptions.findIndex((s) => s.language === langPriority)
      if (priorityIndex >= 0) return priorityIndex
      return 0
    }
    return 0
  }, [settings])

  // 选择字幕 - 返回需要的数据，由 App.jsx 设置状态
  const handleSelectSubtitle = useCallback(async (index) => {
    setSelectedSubtitleIndex(index)

    if (index < 0 || !subtitleOptions[index]) {
      // 清除字幕
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, null)
        } catch (e) {
          console.error('Failed to clear subtitle:', e)
        }
      }
      return { clearSubtitle: true }
    }

    try {
      const sub = subtitleOptions[index]
      const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
      if (!content) return { clearSubtitle: false }

      const ext = getExtension(sub.file.name)
      const cues = parseSubtitle(content, ext)

      // 检测语言是否变化
      const contentLanguage = detectLanguageFromContent(content)
      let updatedSub = sub
      if (contentLanguage !== 'unknown' && sub.language !== contentLanguage) {
        updatedSub = { ...sub, language: contentLanguage }
        const newOptions = [...subtitleOptions]
        newOptions[index] = updatedSub
        setSubtitleOptions(newOptions)
      }

      // 保存字幕选择
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
            filePath: updatedSub.file.path,
            fileName: updatedSub.file.name,
            format: updatedSub.format,
            language: updatedSub.language,
            isTranslated: updatedSub.isTranslated,
            displayName: updatedSub.displayName,
            isManual: updatedSub.isManual || false,
          })
        } catch (e) {
          console.error('Failed to save subtitle:', e)
        }
      }

      return { cues, sub: updatedSub, clearSubtitle: false }
    } catch (e) {
      console.error('Failed to load subtitle:', e)
      return { clearSubtitle: false }
    }
  }, [subtitleOptions, selectedWork, currentAudio])

  // 添加字幕文件 - 返回需要的数据
  const handleAddSubtitleFile = useCallback(async () => {
    try {
      const files = await window.electronAPI.openSubtitleFile()
      if (!files || files.length === 0) return null

      const newOptions = [...subtitleOptions]
      let newIndex = -1

      for (const file of files) {
        const ext = getExtension(file.name).slice(1).toLowerCase()
        const base = file.name.replace(/\.[^/.]+$/, '')

        let detectedLang = 'unknown'
        try {
          const content = await window.electronAPI.readFile(file.path, 'utf-8')
          if (content) {
            detectedLang = detectLanguageFromContent(content)
          }
        } catch (e) {
          console.warn('Failed to detect language for subtitle:', file.name, e)
        }

        const newSub = {
          file,
          format: ext,
          language: detectedLang,
          isTranslated: false,
          matchScore: 100,
          displayName: base,
          isManual: true,
        }
        newOptions.push(newSub)
        newIndex = newOptions.length - 1
      }

      setSubtitleOptions(newOptions)

      if (newIndex >= 0 && currentAudio && selectedWork) {
        const sub = newOptions[newIndex]
        try {
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            const cues = parseSubtitle(content, ext)
            setSelectedSubtitleIndex(newIndex)

            try {
              await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
                filePath: sub.file.path,
                fileName: sub.file.name,
                format: sub.format,
                language: sub.language,
                isTranslated: sub.isTranslated,
                displayName: sub.displayName,
                isManual: true,
              })
            } catch (e) {
              console.error('Failed to save subtitle:', e)
            }

            return { cues, newOptions, newIndex }
          }
        } catch (e) {
          console.error('Failed to load subtitle:', e)
        }
      }

      return { newOptions }
    } catch (e) {
      console.error('Failed to add subtitle file:', e)
      return null
    }
  }, [subtitleOptions, currentAudio, selectedWork])

  // 处理自动翻译 - 需要 setCurrentCues 回调
  const handleAutoTranslate = useCallback(async (cues, sub, setCurrentCues) => {
    if (!settings?.autoTranslateSubtitle || !selectedWork || !currentAudio) return cues
    if (sub?.language === 'zh' || sub?.language === 'dual') return cues

    const texts = cues.map(cue => cue.text).filter(t => t && t.trim())
    if (texts.length === 0) return cues

    try {
      // 先从数据库读取缓存
      const cachedCues = await window.electronAPI.translateGetCache(selectedWork.id, currentAudio.path)
      if (cachedCues && cachedCues.length > 0) {
        const cacheMap = new Map(cachedCues.map(c => [c.time, c.translated]))
        const updatedCues = cues.map(cue => ({
          ...cue,
          translated: cacheMap.get(cue.time) || undefined
        }))
        // 同步到内存缓存
        cachedCues.forEach(c => {
          if (c.translated) {
            const original = cues.find(cue => cue.time === c.time)
            if (original) {
              translateCacheRef?.current?.set(original.text, c.translated)
            }
          }
        })
        setCurrentCues?.(updatedCues)
        setTranslateVersion?.(v => v + 1)
        return updatedCues
      } else {
        // 没有缓存，异步翻译
        ;(async () => {
          try {
            const results = await window.electronAPI.translateBatch(texts, 'zh-CN')
            const resultMap = new Map()
            texts.forEach((text, i) => {
              if (results[i] && results[i] !== text) {
                resultMap.set(text, results[i])
                translateCacheRef?.current?.set(text, results[i])
              }
            })
            const updatedCues = cues.map(cue => {
              if (!cue.text || !cue.text.trim()) return cue
              const translated = resultMap.get(cue.text)
              if (translated) {
                return { ...cue, translated }
              }
              return cue
            })
            setCurrentCues?.(updatedCues)
            setTranslateVersion?.(v => v + 1)

            // 保存到数据库缓存
            try {
              const cacheData = updatedCues.map(cue => ({
                time: cue.time,
                text: cue.text,
                translated: cue.translated
              }))
              await window.electronAPI.translateSaveCache(selectedWork.id, currentAudio.path, cacheData)
            } catch (e) {
              console.error('Failed to save translate cache:', e)
            }
          } catch (e) {
            console.error('Auto translate failed:', e)
          }
        })()
      }
    } catch (e) {
      console.error('Auto translate init failed:', e)
    }

    return cues
  }, [settings, selectedWork, currentAudio, translateCacheRef, setTranslateVersion])

  return {
    subtitleOptions,
    setSubtitleOptions,
    selectedSubtitleIndex,
    setSelectedSubtitleIndex,
    detectSubtitleLanguagesAsync,
    findMatchedSubtitles,
    loadSavedSubtitle,
    selectSubtitleByPriority,
    handleSelectSubtitle,
    handleAddSubtitleFile,
    handleAutoTranslate,
  }
}
