import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  isScriptFile,
  scoreScriptMatch,
  parseScriptContent,
  calculateCruiseProgress,
  findActiveScriptLine,
} from '../utils/scriptParser'

/**
 * 递归扫描目录下的所有台本文档
 */
async function scanScriptFilesRecursively(dirPath, baseDir) {
  if (!dirPath || !window.electronAPI?.readDir) return []
  const results = []

  try {
    const entries = await window.electronAPI.readDir(dirPath)
    for (const entry of entries) {
      if (entry.isDirectory) {
        const subResults = await scanScriptFilesRecursively(entry.path, baseDir)
        results.push(...subResults)
      } else if (isScriptFile(entry.name)) {
        const rel = baseDir ? entry.path.slice(baseDir.length + 1) : entry.name
        results.push({
          name: entry.name,
          path: entry.path,
          relativePath: rel,
        })
      }
    }
  } catch (err) {
    console.error('Failed to scan scripts in:', dirPath, err)
  }

  return results
}

export function useVoiceScript({
  work,
  currentAudio,
  currentTime = 0,
  duration = 0,
  cues = [],
  onToast,
  onOpenStampModal,
}) {
  const [scriptFiles, setScriptFiles] = useState([])
  const [selectedScriptPath, setSelectedScriptPath] = useState(null)
  const [rawText, setRawText] = useState('')
  const [loadingScript, setLoadingScript] = useState(false)
  const [theaterMode, setTheaterMode] = useState(true)
  const [autoCruise, setAutoCruise] = useState(true)
  const [fontSize, setFontSize] = useState(14)
  const [isUserScrolling, setIsUserScrolling] = useState(false)

  const userScrollTimeoutRef = useRef(null)

  // 1. 扫描当前作品的所有台本文本文件
  useEffect(() => {
    let cancelled = false

    async function loadScripts() {
      if (!work || !work.folderPath || work.isOnline) {
        setScriptFiles([])
        setSelectedScriptPath(null)
        setRawText('')
        return
      }

      try {
        const files = await scanScriptFilesRecursively(work.folderPath, work.folderPath)
        if (cancelled) return
        setScriptFiles(files)

        // 如果找到了台本且当前未选择，自动匹配最佳台本
        if (files.length > 0) {
          const audioName = currentAudio?.name || ''
          const sorted = [...files].sort((a, b) => {
            const scoreB = scoreScriptMatch(b.name, audioName)
            const scoreA = scoreScriptMatch(a.name, audioName)
            return scoreB - scoreA
          })
          setSelectedScriptPath(sorted[0].path)
        } else {
          setSelectedScriptPath(null)
          setRawText('')
        }
      } catch (e) {
        console.error('Failed to load scripts:', e)
      }
    }

    loadScripts()

    return () => {
      cancelled = true
    }
  }, [work?.id, work?.folderPath, work?.isOnline])

  // 2. 当切曲目时，重新智能挑选最匹配当前音频的台本
  useEffect(() => {
    if (!currentAudio || scriptFiles.length <= 1) return
    const audioName = currentAudio.name || ''
    const best = [...scriptFiles].sort((a, b) => {
      const scoreB = scoreScriptMatch(b.name, audioName)
      const scoreA = scoreScriptMatch(a.name, audioName)
      return scoreB - scoreA
    })[0]

    if (best && best.path !== selectedScriptPath) {
      setSelectedScriptPath(best.path)
    }
  }, [currentAudio?.path, scriptFiles])

  // 3. 读取并加载选中的台本内容
  useEffect(() => {
    let isMounted = true

    async function fetchContent() {
      if (!selectedScriptPath || !window.electronAPI?.readFile) {
        setRawText('')
        return
      }

      setLoadingScript(true)
      try {
        const content = await window.electronAPI.readFile(selectedScriptPath, 'utf-8')
        if (isMounted) {
          setRawText(content || '')
        }
      } catch (e) {
        console.error('Error reading script content:', e)
        if (isMounted) {
          onToast?.('读取台本文档失败', 'error')
        }
      } finally {
        if (isMounted) {
          setLoadingScript(false)
        }
      }
    }

    fetchContent()

    return () => {
      isMounted = false
    }
  }, [selectedScriptPath, onToast])

  // 4. 解析结构化剧本数据
  const scriptLines = useMemo(() => {
    return parseScriptContent(rawText)
  }, [rawText])

  // 5. 实时计算当前激活的高亮行
  const activeLineIndex = useMemo(() => {
    if (!scriptLines || scriptLines.length === 0) return -1
    // 优先时间戳与字幕比对
    const matched = findActiveScriptLine(currentTime, scriptLines, cues)
    if (matched !== -1) return matched

    // 若无匹配且开启了自动巡航，使用非线性进度推算
    if (autoCruise && duration > 0) {
      const cruise = calculateCruiseProgress(currentTime, duration, scriptLines.length)
      return cruise.targetIndex
    }

    return -1
  }, [currentTime, duration, scriptLines, cues, autoCruise])

  // 用户滚动接管机制
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 6000)
  }, [])

  const handleResumeSync = useCallback(() => {
    setIsUserScrolling(false)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
  }, [])

  // 导入外部台本文件
  const handleImportScriptFile = useCallback(async () => {
    if (!window.electronAPI?.openTextFile) return
    try {
      const res = await window.electronAPI.openTextFile('剧本文档', ['txt', 'md', 'text'])
      if (res && res.content) {
        const customItem = {
          name: res.filePath ? res.filePath.replace(/^.*[\\/]/, '') : '导入台本.txt',
          path: res.filePath || `custom_${Date.now()}`,
          relativePath: '外部导入',
        }
        setScriptFiles((prev) => [customItem, ...prev])
        setSelectedScriptPath(customItem.path)
        setRawText(res.content)
        onToast?.('已加载外部台本文档', 'success')
      }
    } catch (e) {
      onToast?.('导入台本失败：' + (e.message || ''), 'error')
    }
  }, [onToast])

  // 将指定台词存入感官心动印记
  const handleQuoteToStamp = useCallback((lineText) => {
    if (!lineText) return
    if (onOpenStampModal) {
      onOpenStampModal({ initialNote: lineText })
    }
  }, [onOpenStampModal])

  // 复制台词到剪贴板
  const handleCopyLine = useCallback((text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      onToast?.('台词已复制到剪贴板', 'success')
    }).catch(() => {
      onToast?.('复制失败', 'error')
    })
  }, [onToast])

  return {
    scriptFiles,
    selectedScriptPath,
    setSelectedScriptPath,
    rawText,
    scriptLines,
    loadingScript,
    theaterMode,
    setTheaterMode,
    autoCruise,
    setAutoCruise,
    fontSize,
    setFontSize,
    activeLineIndex,
    isUserScrolling,
    handleUserScroll,
    handleResumeSync,
    handleImportScriptFile,
    handleQuoteToStamp,
    handleCopyLine,
  }
}
