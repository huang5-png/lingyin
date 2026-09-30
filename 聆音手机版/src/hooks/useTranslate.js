import { useState, useRef, useCallback, useMemo } from 'react'

export function useTranslate(showToast) {
  const translateCacheRef = useRef(new Map())
  const [translateVersion, setTranslateVersion] = useState(0)
  const [translating, setTranslating] = useState(new Set())
  const cancelRef = useRef({ cancelled: false, cancelId: null, isTranslating: false })

  const cancelTranslation = useCallback(() => {
    cancelRef.current.cancelled = true
    cancelRef.current.isTranslating = false
    if (cancelRef.current.cancelId) {
      window.electronAPI?.translateCancel?.(cancelRef.current.cancelId)
    }
    setTranslating(new Set())
    showToast?.('已取消翻译', 'info')
  }, [showToast])

  const startTranslation = useCallback(() => {
    cancelRef.current.cancelled = false
    cancelRef.current.isTranslating = true
    cancelRef.current.cancelId = Date.now().toString()
    return cancelRef.current.cancelId
  }, [])

  const isCancelled = useCallback(() => {
    return cancelRef.current.cancelled
  }, [])

  const getIsTranslating = useCallback(() => {
    return cancelRef.current.isTranslating
  }, [])

  const translate = useCallback(async (text) => {
    if (!text || !text.trim()) return text

    const cache = translateCacheRef.current

    if (cache.has(text)) {
      cache.delete(text)
      setTranslateVersion(v => v + 1)
      return text
    }

    setTranslating(prev => new Set([...prev, text]))

    try {
      const translated = await window.electronAPI.translateText(text, 'zh-CN')
      if (translated && translated !== text) {
        cache.set(text, translated)
        setTranslateVersion(v => v + 1)
        return translated
      } else {
        showToast?.('翻译失败，可能已是中文或网络错误', 'warning')
      }
    } catch (e) {
      if (e.message === 'cancelled') {
        showToast?.('翻译已取消', 'info')
      } else {
        showToast?.('翻译失败: ' + (e.message || '未知错误'), 'error')
      }
    } finally {
      setTranslating(prev => {
        const next = new Set(prev)
        next.delete(text)
        return next
      })
    }
    return text
  }, [showToast])

  const translateBatch = useCallback(async (texts) => {
    const validTexts = texts.filter(t => t && t.trim())
    if (validTexts.length === 0) return

    const cache = translateCacheRef.current
    const needTranslate = validTexts.filter(t => !cache.has(t))
    if (needTranslate.length === 0) {
      validTexts.forEach(t => cache.delete(t))
      setTranslateVersion(v => v + 1)
      return
    }

    setTranslating(prev => new Set([...prev, ...needTranslate]))
    try {
      const results = await window.electronAPI.translateBatch(needTranslate, 'zh-CN')
      needTranslate.forEach((text, i) => {
        if (results[i] && results[i] !== text) {
          cache.set(text, results[i])
        }
      })
      setTranslateVersion(v => v + 1)
    } catch (e) {
      console.error('翻译失败:', e)
      if (e.message === 'cancelled') {
        showToast?.('翻译已取消', 'info')
      } else {
        showToast?.('批量翻译失败: ' + (e.message || '未知错误'), 'error')
      }
    } finally {
      setTranslating(prev => {
        const next = new Set(prev)
        needTranslate.forEach(t => next.delete(t))
        return next
      })
    }
  }, [showToast])

  const getTranslatedText = useCallback((text) => {
    if (!text) return text
    return translateCacheRef.current.get(text) || text
  }, [translateVersion])

  const isTranslated = useCallback((text) => {
    if (!text) return false
    return translateCacheRef.current.has(text)
  }, [translateVersion])

  const isTranslating = useCallback((text) => {
    if (!text) return false
    return translating.has(text)
  }, [translating])

  const isAnyTranslating = useMemo(() => translating.size > 0, [translating])

  const toggleSubtitleTranslate = useCallback(async ({ selectedWork, currentAudio, currentCues, setCurrentCues }) => {
    if (!selectedWork || !currentAudio || currentCues.length === 0) {
      showToast?.('请先选择字幕', 'warning')
      return
    }

    if (getIsTranslating()) {
      cancelTranslation()
      return
    }

    const hasTranslation = currentCues.some(cue => cue.translated && cue.translated.trim())

    if (hasTranslation) {
      const newCues = currentCues.map(cue => {
        const newCue = { ...cue }
        delete newCue.translated
        return newCue
      })
      setCurrentCues(newCues)

      currentCues.forEach(cue => {
        translateCacheRef.current.delete(cue.text)
      })
      setTranslateVersion(v => v + 1)

      try {
        await window.electronAPI.translateSaveCache(selectedWork.id, currentAudio.path, [])
      } catch (e) {
        console.error('Failed to clear translate cache:', e)
      }
      showToast?.('已关闭双语显示', 'info')
      return
    }

    try {
      const cachedCues = await window.electronAPI.translateGetCache(selectedWork.id, currentAudio.path)
      if (cachedCues && cachedCues.length > 0) {
        setCurrentCues(prev => {
          const cacheMap = new Map(cachedCues.map(c => [c.time, c.translated]))
          return prev.map(cue => ({
            ...cue,
            translated: cacheMap.get(cue.time) || undefined
          }))
        })
        cachedCues.forEach(c => {
          if (c.translated) {
            const original = currentCues.find(cue => cue.time === c.time)
            if (original) {
              translateCacheRef.current.set(original.text, c.translated)
            }
          }
        })
        setTranslateVersion(v => v + 1)
        showToast?.('已加载缓存翻译', 'success')
        return
      }
    } catch (e) {
      console.error('Failed to load translate cache:', e)
    }

    const texts = currentCues.map(cue => cue.text).filter(t => t && t.trim())
    if (texts.length === 0) {
      showToast?.('没有可翻译的文本', 'info')
      return
    }

    const cancelId = startTranslation()
    setTranslating(new Set(texts))
    showToast?.(`开始翻译 ${texts.length} 条字幕...`, 'info')

    const BATCH_SIZE = 10

    try {
      const allResults = new Map()
      const total = texts.length
      let completed = 0
      let failedBatches = 0

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        if (isCancelled()) {
          break
        }

        const batch = texts.slice(i, i + BATCH_SIZE)
        const batchCancelId = `${cancelId}_${i}`

        try {
          const results = await window.electronAPI.translateBatch(batch, 'zh-CN', batchCancelId)

          if (isCancelled()) {
            break
          }

          let batchSuccessCount = 0
          batch.forEach((text, j) => {
            if (results[j] && results[j] !== text) {
              translateCacheRef.current.set(text, results[j])
              allResults.set(text, results[j])
              batchSuccessCount++
            }
          })

          completed += batch.length

          if (batchSuccessCount === 0) {
            failedBatches++
          }

          setCurrentCues(prevCues => {
            return prevCues.map(cue => {
              if (!cue.text || !cue.text.trim()) return cue
              if (cue.translated) return cue
              const translated = allResults.get(cue.text)
              if (translated) {
                return { ...cue, translated }
              }
              return cue
            })
          })
          setTranslateVersion(v => v + 1)

          if (completed < total) {
            showToast?.(`已翻译 ${allResults.size}/${total} 条...`, 'info')
          }
        } catch (batchErr) {
          if (batchErr.message === 'cancelled') {
            break
          }
          failedBatches++
          console.warn(`批次 ${i / BATCH_SIZE + 1} 翻译失败:`, batchErr.message)
        }
      }

      if (isCancelled()) {
        return
      }

      setCurrentCues(prevCues => {
        const finalCues = prevCues.map(cue => {
          if (!cue.text || !cue.text.trim()) return cue
          const translated = allResults.get(cue.text)
          if (translated) {
            return { ...cue, translated }
          }
          return cue
        })

        const saveData = finalCues.map(cue => ({
          time: cue.time,
          text: cue.text,
          translated: cue.translated
        }))
        window.electronAPI.translateSaveCache(selectedWork.id, currentAudio.path, saveData).catch(() => {})

        return finalCues
      })

      setTranslateVersion(v => v + 1)

      const translatedCount = allResults.size
      if (translatedCount === 0) {
        showToast?.('翻译失败，请检查网络或翻译引擎配置', 'error')
      } else if (failedBatches > 0) {
        showToast?.(`翻译完成！成功 ${translatedCount}/${total} 条，${failedBatches} 个批次失败`, 'warning')
      } else {
        showToast?.(`翻译完成！成功翻译 ${translatedCount}/${total} 条字幕`, 'success')
      }
    } catch (e) {
      if (e.message === 'cancelled') {
        showToast?.('翻译已取消', 'info')
      } else {
        showToast?.('翻译失败: ' + (e.message || '未知错误'), 'error')
      }
    } finally {
      setTranslating(new Set())
      cancelRef.current.cancelled = false
      cancelRef.current.isTranslating = false
      cancelRef.current.cancelId = null
    }
  }, [showToast, cancelTranslation, startTranslation, isCancelled, getIsTranslating])

  return {
    translateCacheRef,
    translateVersion,
    setTranslateVersion,
    translating,
    translate,
    translateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    toggleSubtitleTranslate,
    cancelTranslation,
  }
}
