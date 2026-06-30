import { useState, useRef, useCallback, useMemo } from 'react'

export function useTranslate(showToast) {
  const translateCacheRef = useRef(new Map())
  const [translateVersion, setTranslateVersion] = useState(0)
  const [translating, setTranslating] = useState(new Set())

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
      showToast?.('翻译失败: ' + (e.message || '未知错误'), 'error')
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
      showToast?.('批量翻译失败', 'error')
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
  }, [])

  const isTranslated = useCallback((text) => {
    if (!text) return false
    return translateCacheRef.current.has(text)
  }, [])

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

    setTranslating(new Set(texts))
    showToast?.(`开始翻译 ${texts.length} 条字幕...`, 'info')

    try {
      const results = await window.electronAPI.translateBatch(texts, 'zh-CN')
      const resultMap = new Map(texts.map((text, i) => [text, results[i]]))

      const updatedCues = currentCues.map(cue => {
        if (!cue.text || !cue.text.trim()) return cue
        const translated = resultMap.get(cue.text)
        if (translated && translated !== cue.text) {
          translateCacheRef.current.set(cue.text, translated)
          return { ...cue, translated }
        }
        return cue
      })

      setCurrentCues(updatedCues)
      setTranslateVersion(v => v + 1)

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

      const translatedCount = updatedCues.filter(c => c.translated).length
      showToast?.(`翻译完成！成功翻译 ${translatedCount} 条字幕`, 'success')
    } catch (e) {
      showToast?.('翻译失败: ' + (e.message || '未知错误'), 'error')
    } finally {
      setTranslating(new Set())
    }
  }, [showToast])

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
  }
}
