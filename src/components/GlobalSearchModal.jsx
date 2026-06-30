import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './GlobalSearchModal.css'
import StateView from './StateView'

const RESULT_TYPE = {
  WORK: 'work',
  FAVORITE: 'favorite',
  PLAYING: 'playing',
  PLAYLIST: 'playlist',
  HISTORY: 'history',
  TRACK: 'track',
  ONLINE_WORK: 'onlineWork',
}

const SEARCH_HISTORY_KEY = 'lingyin_search_history'
const MAX_HISTORY = 10
const DEBOUNCE_DELAY = 300

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text, query) {
  if (!query || !text) return text
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="search-highlight">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  works,
  audioFilesMap,
  currentAudio,
  currentWork,
  favoriteIds,
  onSelectWork,
  onPlayAudio,
  onSelectPlaylist,
  onSelectOnlineWork,
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playlists, setPlaylists] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [onlineWorks, setOnlineWorks] = useState([])
  const [isOnlineLoading, setIsOnlineLoading] = useState(false)
  const [onlineError, setOnlineError] = useState(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const debounceTimerRef = useRef(null)
  const onlineAbortRef = useRef(null)

  useEffect(() => {
    if (query.trim() === debouncedQuery.trim()) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, debouncedQuery])

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

  const favoriteWorks = useMemo(() => {
    if (!favoriteIds || favoriteIds.size === 0) return []
    return works.filter(w => favoriteIds.has(w.id))
  }, [works, favoriteIds])

  const localResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase().trim()
    const results = []

    for (const work of works) {
      const title = (work.title || work.folderName || '').toLowerCase()
      const rjCode = (work.rjCode || '').toLowerCase()
      const cvs = (work.cvs || []).join(' ').toLowerCase()
      const circle = (work.circle || '').toLowerCase()
      const tags = (work.tags || []).join(' ').toLowerCase()

      if (title.includes(q) || rjCode.includes(q) || cvs.includes(q) || circle.includes(q) || tags.includes(q)) {
        let matchField = 'title'
        if (rjCode.includes(q)) matchField = 'rjCode'
        else if (cvs.includes(q)) matchField = 'cv'
        else if (circle.includes(q)) matchField = 'circle'
        else if (tags.includes(q)) matchField = 'tag'

        results.push({
          type: RESULT_TYPE.WORK,
          work,
          matchField,
          displayTitle: work.title || work.folderName,
          displaySub: work.rjCode ? `RJ${work.rjCode}` : work.circle || '',
        })
      }
    }

    return results.slice(0, 10)
  }, [works, debouncedQuery])

  const trackResults = useMemo(() => {
    if (!debouncedQuery.trim() || !audioFilesMap) return []
    const q = debouncedQuery.toLowerCase().trim()
    const results = []

    for (const [workId, audios] of Object.entries(audioFilesMap)) {
      const work = works.find(w => w.id === workId)
      if (!work || !audios) continue

      for (const audio of audios) {
        const audioName = (audio.name || '').toLowerCase()
        if (audioName.includes(q)) {
          results.push({
            type: RESULT_TYPE.TRACK,
            audio,
            work,
            displayTitle: audio.name,
            displaySub: work.title || work.folderName || '',
          })
          if (results.length >= 8) break
        }
      }
      if (results.length >= 8) break
    }

    return results
  }, [audioFilesMap, works, debouncedQuery])

  const favoriteResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase().trim()
    const results = []

    for (const work of favoriteWorks) {
      const title = (work.title || work.folderName || '').toLowerCase()
      const rjCode = (work.rjCode || '').toLowerCase()
      const cvs = (work.cvs || []).join(' ').toLowerCase()
      const circle = (work.circle || '').toLowerCase()

      if (title.includes(q) || rjCode.includes(q) || cvs.includes(q) || circle.includes(q)) {
        let matchField = 'title'
        if (rjCode.includes(q)) matchField = 'rjCode'
        else if (cvs.includes(q)) matchField = 'cv'
        else if (circle.includes(q)) matchField = 'circle'

        results.push({
          type: RESULT_TYPE.FAVORITE,
          work,
          matchField,
          displayTitle: work.title || work.folderName,
          displaySub: work.rjCode ? `RJ${work.rjCode}` : work.circle || '',
        })
      }
    }

    return results.slice(0, 5)
  }, [favoriteWorks, debouncedQuery])

  const playlistResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase().trim()
    const results = []

    for (const pl of playlists) {
      const name = (pl.name || '').toLowerCase()
      if (name.includes(q)) {
        results.push({
          type: RESULT_TYPE.PLAYLIST,
          playlist: pl,
          displayTitle: pl.name,
          displaySub: `${pl.items?.length || 0} 首曲目`,
        })
      }
    }

    return results.slice(0, 5)
  }, [playlists, debouncedQuery])

  const historyResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase().trim()
    return searchHistory
      .filter(h => h.toLowerCase().includes(q))
      .slice(0, 5)
      .map(h => ({
        type: RESULT_TYPE.HISTORY,
        query: h,
        displayTitle: h,
        displaySub: '搜索历史',
      }))
  }, [searchHistory, debouncedQuery])

  const onlineResults = useMemo(() => {
    if (!debouncedQuery.trim() || onlineWorks.length === 0) return []
    return onlineWorks.map(work => ({
      type: RESULT_TYPE.ONLINE_WORK,
      work,
      displayTitle: work.title,
      displaySub: work.name || '',
      cover: work.mainCoverUrl,
    }))
  }, [onlineWorks, debouncedQuery])

  const allResults = useMemo(() => {
    return [
      ...historyResults,
      ...localResults,
      ...trackResults,
      ...favoriteResults,
      ...playlistResults,
      ...onlineResults,
    ]
  }, [historyResults, localResults, trackResults, favoriteResults, playlistResults, onlineResults])

  const groupedResults = useMemo(() => {
    const groups = []
    if (historyResults.length > 0) {
      groups.push({ title: '搜索历史', items: historyResults })
    }
    if (localResults.length > 0) {
      groups.push({ title: '本地作品', items: localResults })
    }
    if (trackResults.length > 0) {
      groups.push({ title: '曲目', items: trackResults })
    }
    if (favoriteResults.length > 0) {
      groups.push({ title: '收藏', items: favoriteResults })
    }
    if (playlistResults.length > 0) {
      groups.push({ title: '播放列表', items: playlistResults })
    }
    if (onlineResults.length > 0) {
      groups.push({ title: '在线作品', items: onlineResults })
    }
    return groups
  }, [historyResults, localResults, trackResults, favoriteResults, playlistResults, onlineResults])

  useEffect(() => {
    setSelectedIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setDebouncedQuery('')
      setSelectedIndex(0)
      setOnlineWorks([])
      setOnlineError(null)
      setIsOnlineLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
      loadPlaylists()
      loadSearchHistory()
    }
  }, [isOpen])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setOnlineWorks([])
      setIsOnlineLoading(false)
      setOnlineError(null)
      return
    }

    let cancelled = false
    setIsOnlineLoading(true)
    setOnlineError(null)

    const fetchOnline = async () => {
      try {
        const result = await window.electronAPI.asmrOneGetWorks({
          keyword: debouncedQuery,
          page: 1,
          pageSize: 8,
          order: 'create_date',
          sort: 'desc',
        })
        if (!cancelled && result?.works) {
          setOnlineWorks(result.works)
        }
      } catch (e) {
        if (!cancelled) {
          setOnlineError(e.message || '搜索失败')
          setOnlineWorks([])
        }
      } finally {
        if (!cancelled) {
          setIsOnlineLoading(false)
        }
      }
    }

    fetchOnline()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await window.electronAPI.playlistGetAll()
      setPlaylists(data || [])
    } catch (e) {
      console.error('Failed to load playlists for search:', e)
    }
  }, [])

  const loadSearchHistory = useCallback(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (saved) {
        setSearchHistory(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load search history:', e)
    }
  }, [])

  const saveSearchHistory = useCallback((history) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
      setSearchHistory(history)
    } catch (e) {
      console.error('Failed to save search history:', e)
    }
  }, [])

  const addToHistory = useCallback((text) => {
    if (!text || !text.trim()) return
    const trimmed = text.trim()
    const filtered = searchHistory.filter(h => h.toLowerCase() !== trimmed.toLowerCase())
    const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY)
    saveSearchHistory(newHistory)
  }, [searchHistory, saveSearchHistory])

  const clearHistory = useCallback(() => {
    saveSearchHistory([])
  }, [saveSearchHistory])

  const removeHistoryItem = useCallback((text, e) => {
    e.stopPropagation()
    const filtered = searchHistory.filter(h => h !== text)
    saveSearchHistory(filtered)
  }, [searchHistory, saveSearchHistory])

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
        } else if (query.trim()) {
          addToHistory(query)
        }
        break
      case 'Escape':
        e.preventDefault()
        if (query.trim()) {
          setQuery('')
          setDebouncedQuery('')
        } else {
          onClose()
        }
        break
    }
  }, [isOpen, allResults, selectedIndex, query, onClose, addToHistory])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSelect = useCallback((result) => {
    if (result.type === RESULT_TYPE.WORK || result.type === RESULT_TYPE.FAVORITE) {
      addToHistory(debouncedQuery)
      onSelectWork(result.work)
      onClose()
    } else if (result.type === RESULT_TYPE.ONLINE_WORK) {
      addToHistory(debouncedQuery)
      if (onSelectOnlineWork) {
        onSelectOnlineWork(result.work)
      }
      onClose()
    } else if (result.type === RESULT_TYPE.TRACK) {
      addToHistory(debouncedQuery)
      if (onPlayAudio && result.audio && result.work) {
        onPlayAudio(result.audio, result.work)
      }
      onClose()
    } else if (result.type === RESULT_TYPE.PLAYING) {
      if (onPlayAudio) {
        onPlayAudio(result.audio, result.work)
      }
      onClose()
    } else if (result.type === RESULT_TYPE.PLAYLIST) {
      if (onSelectPlaylist) {
        onSelectPlaylist(result.playlist)
      }
      onClose()
    } else if (result.type === RESULT_TYPE.HISTORY) {
      setQuery(result.query)
      setDebouncedQuery(result.query)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [debouncedQuery, addToHistory, onSelectWork, onPlayAudio, onSelectPlaylist, onSelectOnlineWork, onClose])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  const showEmptyState = debouncedQuery.trim() && allResults.length === 0 && !isOnlineLoading
  const showHistoryEmpty = !debouncedQuery.trim() && searchHistory.length === 0 && !playingResult
  const showHistory = !debouncedQuery.trim() && (searchHistory.length > 0 || playingResult)
  const showLoadingMore = isOnlineLoading && debouncedQuery.trim()

  let flatIndex = -1
  const getFlatIndex = () => {
    flatIndex++
    return flatIndex
  }

  const getResultIcon = (type) => {
    switch (type) {
      case RESULT_TYPE.WORK:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )
      case RESULT_TYPE.FAVORITE:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )
      case RESULT_TYPE.PLAYLIST:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        )
      case RESULT_TYPE.HISTORY:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )
      case RESULT_TYPE.TRACK:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )
      case RESULT_TYPE.ONLINE_WORK:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
        )
    }
  }

  const renderResultItem = (result, idx) => {
    const isTrack = result.type === RESULT_TYPE.TRACK
    const isOnline = result.type === RESULT_TYPE.ONLINE_WORK

    return (
      <div
        key={
          result.type === RESULT_TYPE.WORK || result.type === RESULT_TYPE.FAVORITE ? `work-${result.work.id}` :
          result.type === RESULT_TYPE.ONLINE_WORK ? `online-${result.work.id}` :
          result.type === RESULT_TYPE.PLAYLIST ? `playlist-${result.playlist.id}` :
          result.type === RESULT_TYPE.HISTORY ? `history-${result.query}` :
          result.type === RESULT_TYPE.TRACK ? `track-${result.work?.id}-${result.audio?.path}` :
          `audio-${result.work?.id}-${result.audio?.path}`
        }
        data-index={idx}
        className={`global-search-result-item ${idx === selectedIndex ? 'selected' : ''} ${result.type === RESULT_TYPE.PLAYING ? 'playing' : ''} ${isOnline ? 'online-result' : ''}`}
        onClick={() => handleSelect(result)}
        onMouseEnter={() => setSelectedIndex(idx)}
      >
        <div className={`result-icon ${result.type === RESULT_TYPE.PLAYING ? 'playing-icon' : ''} ${isOnline ? 'online-icon' : ''}`}>
          {getResultIcon(result.type)}
        </div>
        <div className="result-info">
          <div className="result-title">
            {result.type === RESULT_TYPE.HISTORY ? (
              highlightText(result.query, debouncedQuery)
            ) : result.type === RESULT_TYPE.WORK || result.type === RESULT_TYPE.FAVORITE || result.type === RESULT_TYPE.ONLINE_WORK ? (
              highlightText(result.displayTitle, debouncedQuery)
            ) : result.type === RESULT_TYPE.PLAYLIST ? (
              highlightText(result.displayTitle, debouncedQuery)
            ) : result.type === RESULT_TYPE.TRACK ? (
              highlightText(result.displayTitle, debouncedQuery)
            ) : (
              result.audio?.name
            )}
          </div>
          <div className="result-sub">
            {(result.type === RESULT_TYPE.WORK || result.type === RESULT_TYPE.FAVORITE) && (
              <>
                <span className="result-badge">
                  {result.matchField === 'title' ? '作品' :
                   result.matchField === 'rjCode' ? 'RJ号' :
                   result.matchField === 'cv' ? 'CV' :
                   result.matchField === 'circle' ? '社团' : '标签'}
                </span>
                {result.displaySub && <span className="result-sub-text">{result.displaySub}</span>}
              </>
            )}
            {result.type === RESULT_TYPE.ONLINE_WORK && (
              <>
                <span className="result-badge online-badge">在线</span>
                {result.displaySub && <span className="result-sub-text">{result.displaySub}</span>}
              </>
            )}
            {result.type === RESULT_TYPE.PLAYLIST && (
              <>
                <span className="result-badge">播放列表</span>
                <span className="result-sub-text">{result.displaySub}</span>
              </>
            )}
            {result.type === RESULT_TYPE.HISTORY && (
              <>
                <span className="result-badge history-badge">历史</span>
                <span className="result-sub-text">点击重新搜索</span>
              </>
            )}
            {result.type === RESULT_TYPE.TRACK && (
              <>
                <span className="result-badge track-badge">曲目</span>
                <span className="result-sub-text">{result.displaySub}</span>
              </>
            )}
            {result.type === RESULT_TYPE.PLAYING && (
              <>
                <span className="result-badge playing-badge">播放中</span>
                <span className="result-sub-text">{result.displaySub}</span>
              </>
            )}
          </div>
        </div>
        {result.type === RESULT_TYPE.HISTORY && (
          <button
            className="history-remove-btn"
            onClick={(e) => removeHistoryItem(result.query, e)}
            title="删除历史记录"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {(result.type === RESULT_TYPE.WORK || result.type === RESULT_TYPE.FAVORITE || result.type === RESULT_TYPE.ONLINE_WORK) && (result.work?.cover || result.cover) && (
          <img
            src={result.cover || result.work.cover}
            alt=""
            className="result-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    )
  }

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
            placeholder="搜索作品、曲目、RJ号、CV、社团、播放列表..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isOnlineLoading && (
            <div className="search-loading-spinner" title="搜索中...">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
          )}
          {query.trim() && !isOnlineLoading && (
            <button
              className="search-clear-btn"
              onClick={() => { setQuery(''); setDebouncedQuery('') }}
              title="清除"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <kbd className="global-search-kbd">ESC</kbd>
        </div>

        {showEmptyState && (
          <div className="global-search-results">
            <StateView
              type="empty"
              iconType="search"
              title="未找到匹配的结果"
              size="sm"
              className="global-search-empty"
            />
          </div>
        )}

        {debouncedQuery.trim() && (allResults.length > 0 || showLoadingMore) && (
          <div className="global-search-results" ref={listRef}>
            {groupedResults.map((group, gi) => (
              <div key={gi} className="search-results-group">
                <div className="results-section-title">
                  {group.title}
                  <span className="results-count">{group.items.length}</span>
                </div>
                {group.items.map((result) => {
                  const idx = getFlatIndex()
                  return renderResultItem(result, idx)
                })}
              </div>
            ))}
            {showLoadingMore && (
              <div className="search-loading-more">
                <div className="loading-spinner-small"></div>
                <span>正在搜索在线作品...</span>
              </div>
            )}
            {onlineError && onlineWorks.length === 0 && !isOnlineLoading && (
              <div className="search-online-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>在线搜索失败：{onlineError}</span>
              </div>
            )}
          </div>
        )}

        {showHistory && (
          <div className="global-search-results" ref={listRef}>
            {playingResult && (
              <div className="search-results-group">
                <div className="results-section-title">正在播放</div>
                {renderResultItem(playingResult, 0)}
              </div>
            )}
            {searchHistory.length > 0 && (
              <div className="search-results-group">
                <div className="results-section-title">
                  搜索历史
                  <button
                    className="clear-history-btn"
                    onClick={clearHistory}
                    title="清除全部历史"
                  >
                    清除全部
                  </button>
                </div>
                {searchHistory.map((h, i) => {
                  const idx = playingResult ? i + 1 : i
                  return (
                    <div
                      key={`history-${h}-${i}`}
                      data-index={idx}
                      className={`global-search-result-item history-item ${selectedIndex === idx ? 'selected' : ''}`}
                      onClick={() => {
                        setQuery(h)
                        setDebouncedQuery(h)
                        setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="result-icon">
                        {getResultIcon(RESULT_TYPE.HISTORY)}
                      </div>
                      <div className="result-info">
                        <div className="result-title">{h}</div>
                        <div className="result-sub">
                          <span className="result-badge history-badge">历史</span>
                          <span className="result-sub-text">点击重新搜索</span>
                        </div>
                      </div>
                      <button
                        className="history-remove-btn"
                        onClick={(e) => removeHistoryItem(h, e)}
                        title="删除历史记录"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {showHistoryEmpty && (
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
