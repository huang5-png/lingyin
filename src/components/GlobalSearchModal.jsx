import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './GlobalSearchModal.css'

// 搜索结果类型
const RESULT_TYPE = {
  WORK: 'work',
  AUDIO: 'audio',
  PLAYING: 'playing',
}

export default function GlobalSearchModal({ isOpen, onClose, works, currentAudio, currentWork, onSelectWork, onPlayAudio }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // 正在播放的曲目（无搜索词时显示）
  const playingResult = useMemo(() => {
    if (!currentAudio || !currentWork) return null
    return {
      type: RESULT_TYPE.PLAYING,
      audio: currentAudio,
      work: currentWork,
      displayTitle: currentAudio.name || '未知曲目',
      displaySub: currentWork.title || currentWork.folderName || '未知作品',
    }
  }, [currentAudio, currentWork])

  // 搜索本地作品
  const localResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const results = []

    for (const work of works) {
      const title = (work.title || work.folderName || '').toLowerCase()
      const rjCode = (work.rjCode || '').toLowerCase()
      const cvs = (work.cvs || []).join(' ').toLowerCase()
      const circle = (work.circle || '').toLowerCase()
      const tags = (work.tags || []).join(' ').toLowerCase()

      // 匹配作品
      if (title.includes(q) || rjCode.includes(q) || cvs.includes(q) || circle.includes(q) || tags.includes(q)) {
        results.push({
          type: RESULT_TYPE.WORK,
          work,
          matchField: title.includes(q) ? 'title' : rjCode.includes(q) ? 'rjCode' : cvs.includes(q) ? 'cv' : circle.includes(q) ? 'circle' : 'tag',
          displayTitle: work.title || work.folderName,
          displaySub: work.rjCode ? `RJ${work.rjCode}` : work.circle || '',
        })
      }
    }

    return results.slice(0, 10)
  }, [works, query])

  // 搜索曲目（在匹配作品中的音频）
  const audioResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    if (q.length < 2) return [] // 至少2个字符才搜索曲目
    const results = []

    for (const work of works) {
      // 如果作品标题已经匹配，跳过其曲目（避免重复）
      const title = (work.title || work.folderName || '').toLowerCase()
      if (title.includes(q)) continue

      // 搜索音频名（需要 work 有 audioFiles 或能获取）
      // 由于 GlobalSearchModal 无法直接访问 audioFiles，这里只搜索已加载的作品
      // 实际上，对于本地作品，audioFiles 是动态加载的，我们只能搜索 work 信息
    }

    return results.slice(0, 5)
  }, [works, query])

  const allResults = useMemo(() => {
    return [...localResults]
  }, [localResults, audioResults])

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // 滚动到选中项
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.querySelector(`[data-index="${selectedIndex}"]`)
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allResults[selectedIndex]) {
          handleSelect(allResults[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [isOpen, allResults, selectedIndex, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSelect = useCallback((result) => {
    if (result.type === RESULT_TYPE.WORK) {
      onSelectWork(result.work)
      onClose()
    } else if (result.type === RESULT_TYPE.PLAYING) {
      // 正在播放的曲目，调用 onPlayAudio 跳转到当前播放
      if (onPlayAudio) {
        onPlayAudio(result.audio, result.work)
      }
      onClose()
    }
  }, [onSelectWork, onPlayAudio, onClose])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="global-search-overlay" onClick={handleOverlayClick}>
      <div className="global-search-modal">
        <div className="global-search-header">
          <svg className="global-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="搜索作品、RJ号、CV、社团..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="global-search-kbd">ESC</kbd>
        </div>

        {query.trim() && (
          <div className="global-search-results" ref={listRef}>
            {allResults.length === 0 ? (
              <div className="global-search-empty">
                <span>未找到匹配的结果</span>
              </div>
            ) : (
              allResults.map((result, index) => (
                <div
                  key={result.type === RESULT_TYPE.WORK ? `work-${result.work.id}` : `audio-${result.work.id}-${result.audio?.path}`}
                  data-index={index}
                  className={`global-search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="result-icon">
                    {result.type === RESULT_TYPE.WORK ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="result-info">
                    <div className="result-title">
                      {result.type === RESULT_TYPE.WORK ? result.displayTitle : result.audio?.name}
                    </div>
                    <div className="result-sub">
                      {result.type === RESULT_TYPE.WORK && (
                        <>
                          <span className="result-badge">{result.matchField === 'title' ? '作品' : result.matchField === 'rjCode' ? 'RJ号' : result.matchField === 'cv' ? 'CV' : result.matchField === 'circle' ? '社团' : '标签'}</span>
                          {result.displaySub && <span className="result-sub-text">{result.displaySub}</span>}
                        </>
                      )}
                      {result.type === RESULT_TYPE.AUDIO && (
                        <>
                          <span className="result-badge">曲目</span>
                          <span className="result-sub-text">{result.work?.title || result.work?.folderName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {result.type === RESULT_TYPE.WORK && result.work?.cover && (
                    <img
                      src={result.work.cover}
                      alt=""
                      className="result-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {!query.trim() && playingResult && (
          <div className="global-search-results" ref={listRef}>
            <div className="results-section-title">正在播放</div>
            <div
              key="playing"
              data-index={0}
              className={`global-search-result-item playing ${selectedIndex === 0 ? 'selected' : ''}`}
              onClick={() => handleSelect(playingResult)}
              onMouseEnter={() => setSelectedIndex(0)}
            >
              <div className="result-icon playing-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
              </div>
              <div className="result-info">
                <div className="result-title">{playingResult.displayTitle}</div>
                <div className="result-sub">
                  <span className="result-badge playing-badge">播放中</span>
                  <span className="result-sub-text">{playingResult.displaySub}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!query.trim() && !playingResult && (
          <div className="global-search-hint">
            <div className="hint-item">
              <kbd>↑</kbd><kbd>↓</kbd>
              <span>选择</span>
            </div>
            <div className="hint-item">
              <kbd>Enter</kbd>
              <span>跳转</span>
            </div>
            <div className="hint-item">
              <kbd>ESC</kbd>
              <span>关闭</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
