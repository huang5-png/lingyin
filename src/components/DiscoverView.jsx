import { useState, useEffect, useCallback, useMemo, memo, forwardRef, useImperativeHandle, useRef } from 'react'
import './DiscoverView.css'
import StateView from './StateView'

const ADVANCED_COMMANDS = [
  { cmd: '$tag:', desc: '搜索标签', icon: 'tag' },
  { cmd: '$tagw:', desc: '包含低愿力标签', icon: 'tag' },
  { cmd: '$circle:', desc: '搜索社团', icon: 'users' },
  { cmd: '$va:', desc: '搜索声优', icon: 'mic' },
  { cmd: '$duration:', desc: '筛选作品时长（大于）', icon: 'clock' },
  { cmd: '$rate:', desc: '筛选评分（大于）', icon: 'star' },
  { cmd: '$price:', desc: '筛选价格（大于）', icon: 'coins' },
  { cmd: '$sell:', desc: '筛选销量（大于）', icon: 'bar-chart' },
  { cmd: '$age:', desc: '筛选年龄分级', icon: 'shield-alert' },
  { cmd: '$lang:', desc: '筛选语言', icon: 'globe' },
  { cmd: '$-tag:', desc: '排除标签', icon: 'ban' },
  { cmd: '$-tagw:', desc: '排除低愿力标签', icon: 'ban' },
  { cmd: '$-duration:', desc: '筛选作品时长（小于）', icon: 'clock' },
  { cmd: '$-circle:', desc: '排除社团', icon: 'ban' },
  { cmd: '$-va:', desc: '排除声优', icon: 'ban' },
]

const CommandIcon = ({ name, size = 16 }) => {
  const icons = {
    tag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    mic: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    coins: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.32.29a6 6 0 0 1-10.07 6.07L7 18.89"/></svg>,
    'bar-chart': <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
    'shield-alert': <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    globe: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    ban: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  }
  return icons[name] || null
}

const formatDuration = (seconds) => {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h${mins}m`
  }
  return `${mins}m`
}

const formatDLCount = (count) => {
  if (count == null) return '--'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
  return String(count)
}

const WorkCard = memo(({ work, selectedWorkId, activeTags, activeVas, onSelectWork, onVaClick, onTagClick, getTranslatedText }) => {
  return (
    <div
      className={`discover-work-card ${selectedWorkId === `online_${work.id}` ? 'selected' : ''}`}
      onClick={(e) => {
        if (onSelectWork) {
          onSelectWork(work, e)
        } else {
          window.electronAPI.openExternal(`https://asmr.one/work/${work.id}`)
        }
      }}
    >
      <div className="discover-card-cover">
        {work.mainCoverUrl ? (
          <img src={work.mainCoverUrl} alt={work.title} loading="lazy" decoding="async" data-work-cover data-work-id={`online_${work.id}`} />
        ) : (
          <div className="cover-placeholder">
            <svg className="cover-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}
        {work.has_subtitle && (
          <div className="subtitle-badge">字幕</div>
        )}
        <div className="duration-badge">{formatDuration(work.duration)}</div>
      </div>
      <div className="discover-card-info">
        <h3 className="discover-card-title">{getTranslatedText?.(work.title) || work.title}</h3>
        <p className="discover-card-circle">{getTranslatedText?.(work.name) || work.name}</p>
        <div className="discover-card-meta">
          {work.vas && work.vas.length > 0 && (
            <div className="discover-card-vas">
              {work.vas.map((va, i) => (
                <span
                  key={i}
                  className={`va-tag ${activeVas.includes(va.name) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onVaClick(va.name, e) }}
                  title="点击筛选此CV"
                >
                  {getTranslatedText?.(va.name) || va.name}
                </span>
              ))}
            </div>
          )}
          {work.tags && work.tags.length > 0 && (
            <div className="discover-card-tags">
              {work.tags.map((tag, i) => (
                <span
                  key={i}
                  className={`work-tag ${activeTags.includes(tag.name) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag.name, e) }}
                  title="点击筛选此标签"
                >
                  {getTranslatedText?.(tag.name) || tag.name}
                </span>
              ))}
            </div>
          )}
          <div className="discover-card-stats">
            {work.rate_average_2dp > 0 && (
              <span className="rating">
                <svg className="star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {work.rate_average_2dp}
              </span>
            )}
            <span className="dl-count">{work.dl_count != null ? formatDLCount(work.dl_count) : '--'}</span>
            <span className="price">¥{work.price}</span>
          </div>
        </div>
      </div>
    </div>
  )
})
WorkCard.displayName = 'WorkCard'

const DiscoverView = forwardRef(({ onSelectWork, selectedWorkId, onTranslate, onTranslateBatch, getTranslatedText, isTranslated, isTranslating, isAnyTranslating }, ref) => {
  const [works, setWorks] = useState([])
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [pageInput, setPageInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [excludeTags, setExcludeTags] = useState([])
  const [activeVas, setActiveVas] = useState([])
  const [excludeVas, setExcludeVas] = useState([])
  const [activeCircles, setActiveCircles] = useState([])
  const [excludeCircles, setExcludeCircles] = useState([])
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [ageRating, setAgeRating] = useState('')
  const [language, setLanguage] = useState('')
  const [sortBy, setSortBy] = useState('create_date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [hasSubtitle, setHasSubtitle] = useState(false)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [tagPickerMode, setTagPickerMode] = useState('include')
  const [tagSearch, setTagSearch] = useState('')
  const [visibleTagCount, setVisibleTagCount] = useState(50)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [activeFilterTab, setActiveFilterTab] = useState('tags')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const searchInputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const tagListRef = useRef(null)
  const contentRef = useRef(null)
  const buildSearchQueryRef = useRef(null)
  const debounceTimerRef = useRef(null)

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tags = await window.electronAPI.asmrOneGetTags()
        setAllTags(tags || [])
      } catch (e) {
        console.error('Failed to fetch tags:', e)
      } finally {
        setTagsLoading(false)
      }
    }
    fetchTags()
  }, [])

  const buildSearchQuery = useCallback(() => {
    const parts = []
    
    activeTags.forEach(tag => {
      parts.push(`$tag:${tag}$`)
    })
    excludeTags.forEach(tag => {
      parts.push(`$-tag:${tag}$`)
    })
    
    activeVas.forEach(va => {
      parts.push(`$va:${va}$`)
    })
    excludeVas.forEach(va => {
      parts.push(`$-va:${va}$`)
    })
    
    activeCircles.forEach(circle => {
      parts.push(`$circle:${circle}$`)
    })
    excludeCircles.forEach(circle => {
      parts.push(`$-circle:${circle}$`)
    })
    
    if (minDuration) {
      parts.push(`$duration:${minDuration}$`)
    }
    if (maxDuration) {
      parts.push(`$-duration:${maxDuration}$`)
    }
    
    if (minRate) {
      parts.push(`$rate:${minRate}$`)
    }
    
    if (minPrice) {
      parts.push(`$price:${minPrice}$`)
    }
    
    if (ageRating) {
      parts.push(`$age:${ageRating}$`)
    }
    
    if (language) {
      parts.push(`$lang:${language}$`)
    }
    
    if (searchKeyword.trim()) {
      parts.push(searchKeyword.trim())
    }
    
    return parts.join(' ')
  }, [activeTags, excludeTags, activeVas, excludeVas, activeCircles, excludeCircles, 
       minDuration, maxDuration, minRate, minPrice, ageRating, language, searchKeyword])

  // Keep buildSearchQuery ref in sync (breaks dependency chain from fetchWorks)
  buildSearchQueryRef.current = buildSearchQuery

  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  const fetchWorks = useCallback(async () => {
    if (works.length === 0) setLoading(true)
    setIsFetching(true)
    setError(null)
    try {
      const keyword = buildSearchQueryRef.current ? buildSearchQueryRef.current() : ''
      const data = await window.electronAPI.asmrOneGetWorks({
        page: pageRef.current,
        pageSize,
        order: sortBy,
        sort: sortOrder,
        subtitle: hasSubtitle ? 1 : 0,
        keyword
      })
      setWorks(data.works || [])
      if (data.pagination) {
        const total = Math.ceil((data.pagination.totalCount || 0) / pageSize)
        setTotalPages(total)
      }
    } catch (e) {
      console.error('Failed to fetch works:', e)
      if (works.length === 0) setError('加载失败，请检查网络连接')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, sortBy, sortOrder, hasSubtitle])

  // Unified debounced fetch: any dependency change (page, sort, filter, keyword)
  // triggers a debounced fetchWorks to prevent API spam
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => fetchWorks(), 150)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [page, pageSize, sortBy, sortOrder, hasSubtitle, 
      activeTags, excludeTags, activeVas, excludeVas,
      activeCircles, excludeCircles,
      minDuration, maxDuration, minRate, maxRate, minPrice, maxPrice,
      ageRating, language, searchKeyword])

  const suggestions = useMemo(() => {
    const keyword = searchKeyword.trim()
    
    if (keyword.startsWith('$')) {
      const filtered = ADVANCED_COMMANDS.filter(c => 
        c.cmd.toLowerCase().includes(keyword.toLowerCase())
      )
      return filtered.length > 0 ? [{ type: 'advanced', items: filtered }] : []
    }

    if (!keyword) {
      const hotTags = [...allTags]
        .filter(t => t.name && t.work_count)
        .sort((a, b) => (b.work_count || 0) - (a.work_count || 0))
        .slice(0, 10)
        .map(t => ({ name: t.name, count: t.work_count || 0 }))
      return hotTags.length > 0 ? [{ type: 'hot', items: hotTags }] : []
    }

    const tagMatches = allTags
      .filter(t => t.name && t.name.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => (b.work_count || 0) - (a.work_count || 0))
      .slice(0, 10)
      .map(t => ({ name: t.name, count: t.work_count || 0 }))

    return tagMatches.length > 0 ? [{ type: 'tag', items: tagMatches }] : []
  }, [searchKeyword, allTags])

  const totalSuggestions = useMemo(() => {
    return suggestions.reduce((sum, group) => sum + group.items.length, 0)
  }, [suggestions])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchInputRef.current && 
        !searchInputRef.current.contains(e.target) &&
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
        setSuggestionIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (showSuggestions && suggestionIndex >= 0) {
      return
    }
    setShowSuggestions(false)
    setPage(1)
  }

  const toggleTag = useCallback((tagName) => {
    setActiveTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName)
      }
      return [...prev, tagName]
    })
    setPage(1)
  }, [])

  const toggleVa = (vaName) => {
    setActiveVas(prev => {
      if (prev.includes(vaName)) {
        return prev.filter(v => v !== vaName)
      }
      return [...prev, vaName]
    })
    setPage(1)
  }

  const toggleExcludeTag = (tagName) => {
    setExcludeTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName)
      }
      return [...prev, tagName]
    })
    setPage(1)
  }

  const toggleExcludeVa = (vaName) => {
    setExcludeVas(prev => {
      if (prev.includes(vaName)) {
        return prev.filter(v => v !== vaName)
      }
      return [...prev, vaName]
    })
    setPage(1)
  }

  const toggleCircle = (circleName) => {
    setActiveCircles(prev => {
      if (prev.includes(circleName)) {
        return prev.filter(c => c !== circleName)
      }
      return [...prev, circleName]
    })
    setPage(1)
  }

  const toggleExcludeCircle = (circleName) => {
    setExcludeCircles(prev => {
      if (prev.includes(circleName)) {
        return prev.filter(c => c !== circleName)
      }
      return [...prev, circleName]
    })
    setPage(1)
  }

  const generatePageNumbers = (currentPage, totalPages) => {
    if (totalPages <= 0) return []
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      let start = Math.max(2, currentPage - 2)
      let end = Math.min(totalPages - 1, currentPage + 2)
      
      if (currentPage <= 3) {
        end = Math.min(maxVisible, totalPages - 1)
      }
      if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - maxVisible + 1)
      }
      
      if (start > 2) pages.push('...')
      for (let i = start; i <= end; i++) pages.push(i)
      if (end < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const num = parseInt(pageInput, 10)
      if (num >= 1 && num <= totalPages) {
        setPage(num)
        setPageInput('')
      } else if (num > totalPages) {
        setPage(totalPages)
        setPageInput('')
      }
    }
  }

  // 当 totalPages 变化时，确保 page 不超出范围
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [totalPages])

  const pageNumbers = useMemo(() => generatePageNumbers(page, totalPages), [page, totalPages])

  const handleTagPickerSelect = (tagName) => {
    if (tagPickerMode === 'include') {
      toggleTag(tagName)
    } else {
      toggleExcludeTag(tagName)
    }
  }

  const insertSuggestion = useCallback((item, type) => {
    if (type === 'advanced') {
      setSearchKeyword(item.cmd)
      setShowSuggestions(false)
      setSuggestionIndex(-1)
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 0)
    } else if (type === 'tag' || type === 'hot') {
      toggleTag(item.name)
      setSearchKeyword('')
      setShowSuggestions(false)
      setSuggestionIndex(-1)
    }
  }, [toggleTag])

  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions || totalSuggestions === 0) return

    let flatIndex = 0
    const flatItems = []
    suggestions.forEach(group => {
      group.items.forEach(item => {
        flatItems.push({ item, type: group.type, index: flatIndex })
        flatIndex++
      })
    })

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIndex(prev => 
        prev < totalSuggestions - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : totalSuggestions - 1
      )
    } else if (e.key === 'Enter' && suggestionIndex >= 0) {
      e.preventDefault()
      const selected = flatItems[suggestionIndex]
      if (selected) {
        insertSuggestion(selected.item, selected.type)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSuggestionIndex(-1)
    }
  }, [showSuggestions, totalSuggestions, suggestions, suggestionIndex, insertSuggestion])

  const clearAllFilters = () => {
    setActiveTags([])
    setExcludeTags([])
    setActiveVas([])
    setExcludeVas([])
    setActiveCircles([])
    setExcludeCircles([])
    setMinDuration('')
    setMaxDuration('')
    setMinRate('')
    setMaxRate('')
    setMinPrice('')
    setMaxPrice('')
    setAgeRating('')
    setLanguage('')
    setSearchKeyword('')
    setHasSubtitle(false)
    setPage(1)
  }

  const hasActiveFilters = activeTags.length > 0 || activeVas.length > 0 || 
    excludeTags.length > 0 || excludeVas.length > 0 ||
    activeCircles.length > 0 || excludeCircles.length > 0 ||
    minDuration || maxDuration || minRate || minPrice ||
    ageRating || language || hasSubtitle

  const activeFilterCount = activeTags.length + excludeTags.length + 
    activeVas.length + excludeVas.length +
    activeCircles.length + excludeCircles.length +
    (minDuration ? 1 : 0) + (maxDuration ? 1 : 0) +
    (minRate ? 1 : 0) + (minPrice ? 1 : 0) +
    (ageRating ? 1 : 0) + (language ? 1 : 0) +
    (hasSubtitle ? 1 : 0)

  useImperativeHandle(ref, () => ({
    toggleTag,
    toggleVa,
    toggleCircle,
    clearAllFilters,
  }))

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) {
      return [...allTags]
        .filter(t => t.name && t.work_count)
        .sort((a, b) => (b.work_count || 0) - (a.work_count || 0))
    }
    return allTags.filter(t =>
      t.name && t.name.toLowerCase().includes(tagSearch.toLowerCase())
    )
  }, [allTags, tagSearch])

  const visibleTags = useMemo(() => {
    return filteredTags.slice(0, visibleTagCount)
  }, [filteredTags, visibleTagCount])

  const handleTagScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      if (visibleTagCount < filteredTags.length) {
        setVisibleTagCount(prev => Math.min(prev + 50, filteredTags.length))
      }
    }
  }, [visibleTagCount, filteredTags.length])

  useEffect(() => {
    setVisibleTagCount(50)
    if (tagListRef.current) {
      tagListRef.current.scrollTop = 0
    }
  }, [tagSearch, showTagPicker])

  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleContentScroll = () => {
    if (contentRef.current) {
      setShowBackToTop(contentRef.current.scrollTop > 300)
    }
  }

  return (
    <div className="discover-view">
      <div className="discover-view-header">
        <div className="discover-header">
          <div>
            <h1 className="discover-title">发现</h1>
            <p className="discover-subtitle">探索 asmr.one 上的优质作品</p>
          </div>
          {onTranslateBatch && works.length > 0 && (
            <button
              className={`discover-translate-btn ${isAnyTranslating ? 'translating' : ''}`}
              onClick={() => {
                const texts = []
                works.forEach(w => {
                  if (w.title) texts.push(w.title)
                  if (w.name) texts.push(w.name)
                  if (w.vas) w.vas.forEach(v => { if (v.name) texts.push(v.name) })
                  if (w.tags) w.tags.forEach(t => { if (t.name) texts.push(t.name) })
                })
                if (texts.length > 0) onTranslateBatch(texts)
              }}
              title="翻译当前页面所有作品"
              disabled={isAnyTranslating}
            >
              {isAnyTranslating ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7"/><path d="M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/></svg>
              )}
              {isAnyTranslating ? '翻译中...' : '翻译全部'}
            </button>
          )}
        </div>

        <div className="discover-filters">
        <div className="search-box-wrapper">
          <form className="search-box" onSubmit={handleSearch}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索标签、作品、RJ号..."
              value={searchKeyword}
              onChange={(e) => { setSearchKeyword(e.target.value); setShowSuggestions(true); setSuggestionIndex(-1) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
            />
            <button type="submit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </form>
          {showSuggestions && totalSuggestions > 0 && (
            <div className="search-suggestions" ref={suggestionsRef}>
              {suggestions.map((group, groupIdx) => (
                <div key={groupIdx} className="suggestion-group">
                  <div className="suggestion-group-title">
                    {group.type === 'advanced' && '高级搜索命令'}
                    {group.type === 'tag' && '匹配标签（点击添加筛选）'}
                    {group.type === 'hot' && '热门标签'}
                  </div>
                  <div className="suggestion-list">
                    {group.items.map((item, itemIdx) => {
                      let flatIdx = 0
                      for (let i = 0; i < groupIdx; i++) {
                        flatIdx += suggestions[i].items.length
                      }
                      flatIdx += itemIdx
                      const isActive = flatIdx === suggestionIndex
                      
                      return (
                        <div
                          key={itemIdx}
                          className={`suggestion-item ${isActive ? 'active' : ''}`}
                          onMouseEnter={() => setSuggestionIndex(flatIdx)}
                          onClick={() => insertSuggestion(item, group.type)}
                        >
                          {group.type === 'advanced' ? (
                            <>
                              <span className="suggestion-icon"><CommandIcon name={item.icon} size={14} /></span>
                              <span className="suggestion-cmd">{item.cmd}</span>
                              <span className="suggestion-desc">{item.desc}</span>
                            </>
                          ) : (
                            <>
                              <span className="suggestion-icon"><CommandIcon name="tag" size={14} /></span>
                              <span className="suggestion-name">{item.name}</span>
                              {item.count > 0 && <span className="suggestion-count">{item.count} 作品</span>}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="filter-options">
          <button 
            className={`advanced-filter-btn ${showAdvancedFilter ? 'active' : ''}`} 
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> 高级筛选
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }}>
            <option value="create_date">最新收录</option>
            <option value="release">发售日期</option>
            <option value="dl_count">下载量</option>
            <option value="rate_average_2dp">评分</option>
            <option value="price">价格</option>
          </select>
          <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setPage(1) }}>
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hasSubtitle}
              onChange={(e) => { setHasSubtitle(e.target.checked); setPage(1) }}
            />
            带字幕
          </label>
        </div>
      </div>

      {showAdvancedFilter && (
        <div className="advanced-filter-panel">
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${activeFilterTab === 'tags' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('tags')}
            >
              <CommandIcon name="tag" size={14} /> 标签
            </button>
            <button 
              className={`filter-tab ${activeFilterTab === 'vas' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('vas')}
            >
              <CommandIcon name="mic" size={14} /> 声优
            </button>
            <button 
              className={`filter-tab ${activeFilterTab === 'circles' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('circles')}
            >
              <CommandIcon name="users" size={14} /> 社团
            </button>
            <button 
              className={`filter-tab ${activeFilterTab === 'numeric' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('numeric')}
            >
              <CommandIcon name="bar-chart" size={14} /> 数值
            </button>
            <button 
              className={`filter-tab ${activeFilterTab === 'other' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('other')}
            >
              <CommandIcon name="globe" size={14} /> 其他
            </button>
          </div>

          <div className="filter-content">
            {activeFilterTab === 'tags' && (
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">包含标签</label>
                    <div className="filter-tags-list">
                      {activeTags.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        activeTags.map(tag => (
                          <span key={tag} className="filter-chip include" onClick={() => toggleTag(tag)}>
                            {tag} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <button 
                      className="filter-add-btn"
                      onClick={() => { setTagPickerMode('include'); setShowTagPicker(true); }}
                    >
                      + 添加标签
                    </button>
                  </div>
                  <div className="filter-col">
                    <label className="filter-label">排除标签</label>
                    <div className="filter-tags-list">
                      {excludeTags.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        excludeTags.map(tag => (
                          <span key={tag} className="filter-chip exclude" onClick={() => toggleExcludeTag(tag)}>
                            {tag} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <button 
                      className="filter-add-btn"
                      onClick={() => { setTagPickerMode('exclude'); setShowTagPicker(true); }}
                    >
                      + 添加排除
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeFilterTab === 'vas' && (
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">包含声优</label>
                    <div className="filter-tags-list">
                      {activeVas.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        activeVas.map(va => (
                          <span key={va} className="filter-chip include" onClick={() => toggleVa(va)}>
                            {va} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <div className="filter-input-row">
                      <input
                        type="text"
                        placeholder="输入声优名..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            toggleVa(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                      <span className="filter-hint">回车添加</span>
                    </div>
                  </div>
                  <div className="filter-col">
                    <label className="filter-label">排除声优</label>
                    <div className="filter-tags-list">
                      {excludeVas.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        excludeVas.map(va => (
                          <span key={va} className="filter-chip exclude" onClick={() => toggleExcludeVa(va)}>
                            {va} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <div className="filter-input-row">
                      <input
                        type="text"
                        placeholder="输入声优名..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            toggleExcludeVa(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                      <span className="filter-hint">回车添加</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFilterTab === 'circles' && (
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">包含社团</label>
                    <div className="filter-tags-list">
                      {activeCircles.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        activeCircles.map(circle => (
                          <span key={circle} className="filter-chip include" onClick={() => toggleCircle(circle)}>
                            {circle} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <div className="filter-input-row">
                      <input
                        type="text"
                        placeholder="输入社团名..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            toggleCircle(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                      <span className="filter-hint">回车添加</span>
                    </div>
                  </div>
                  <div className="filter-col">
                    <label className="filter-label">排除社团</label>
                    <div className="filter-tags-list">
                      {excludeCircles.length === 0 ? (
                        <span className="filter-empty">未选择</span>
                      ) : (
                        excludeCircles.map(circle => (
                          <span key={circle} className="filter-chip exclude" onClick={() => toggleExcludeCircle(circle)}>
                            {circle} ✕
                          </span>
                        ))
                      )}
                    </div>
                    <div className="filter-input-row">
                      <input
                        type="text"
                        placeholder="输入社团名..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            toggleExcludeCircle(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                      <span className="filter-hint">回车添加</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFilterTab === 'numeric' && (
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">作品时长（分钟）</label>
                    <div className="filter-range">
                      <input
                        type="number"
                        placeholder="最短"
                        value={minDuration}
                        onChange={(e) => { setMinDuration(e.target.value); setPage(1) }}
                      />
                      <span className="range-sep">—</span>
                      <input
                        type="number"
                        placeholder="最长"
                        value={maxDuration}
                        onChange={(e) => { setMaxDuration(e.target.value); setPage(1) }}
                      />
                    </div>
                  </div>
                  <div className="filter-col">
                    <label className="filter-label">评分（0-5）</label>
                    <div className="filter-range">
                      <input
                        type="number"
                        placeholder="最低"
                        min="0"
                        max="5"
                        step="0.1"
                        value={minRate}
                        onChange={(e) => { setMinRate(e.target.value); setPage(1) }}
                      />
                      <span className="range-sep">+</span>
                    </div>
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">价格（日元）</label>
                    <div className="filter-range">
                      <input
                        type="number"
                        placeholder="最低"
                        value={minPrice}
                        onChange={(e) => { setMinPrice(e.target.value); setPage(1) }}
                      />
                      <span className="range-sep">+</span>
                    </div>
                  </div>
                  <div className="filter-col">
                  </div>
                </div>
              </div>
            )}

            {activeFilterTab === 'other' && (
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-col">
                    <label className="filter-label">年龄分级</label>
                    <select 
                      value={ageRating}
                      onChange={(e) => { setAgeRating(e.target.value); setPage(1) }}
                    >
                      <option value="">全部</option>
                      <option value="general">全年龄</option>
                      <option value="r15">R15</option>
                      <option value="r18">R18</option>
                    </select>
                  </div>
                  <div className="filter-col">
                    <label className="filter-label">语言</label>
                    <select 
                      value={language}
                      onChange={(e) => { setLanguage(e.target.value); setPage(1) }}
                    >
                      <option value="">全部</option>
                      <option value="zh">中文</option>
                      <option value="ja">日文</option>
                      <option value="en">英文</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="filter-footer">
            <button className="filter-clear-btn" onClick={clearAllFilters}>
              清除全部筛选
            </button>
            <button 
              className="filter-apply-btn"
              onClick={() => { setShowAdvancedFilter(false); setPage(1); }}
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {showTagPicker && (
        <div className="tag-picker">
          <div className="tag-picker-header">
            <span>{tagPickerMode === 'include' ? '选择包含标签' : '选择排除标签'}</span>
            <div className="tag-picker-actions">
              <span className="tag-count-text">共 {allTags.length} 个标签</span>
              <button className="close-btn" onClick={() => setShowTagPicker(false)}>✕</button>
            </div>
          </div>
          <div className="tag-picker-search">
            <input
              type="text"
              placeholder="搜索标签名称..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="tag-picker-list" ref={tagListRef} onScroll={handleTagScroll}>
            {tagsLoading ? (
              <StateView type="loading" className="state-view-compact" />
            ) : visibleTags.length === 0 ? (
              <StateView type="empty" iconType="empty" title="没有找到匹配的标签" className="state-view-compact" />
            ) : (
              <>
                {visibleTags.map(tag => {
                  const isActive = tagPickerMode === 'include' 
                    ? activeTags.includes(tag.name) 
                    : excludeTags.includes(tag.name)
                  return (
                    <button
                      key={tag.id}
                      className={`tag-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleTagPickerSelect(tag.name)}
                    >
                      <span className="tag-item-name">{tag.name}</span>
                      {tag.work_count > 0 && (
                        <span className="tag-item-count">{tag.work_count}</span>
                      )}
                    </button>
                  )
                })}
                {visibleTagCount < filteredTags.length && (
                  <div className="tag-picker-more">
                    向下滚动加载更多（{filteredTags.length - visibleTagCount} 个）
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="active-filters">
          <span className="filters-label">已选筛选：</span>
          <div className="filters-tags">
            {activeTags.map(tag => (
              <span key={tag} className="filter-tag" onClick={() => toggleTag(tag)}>
                {tag} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </span>
            ))}
            {activeVas.map(va => (
              <span key={va} className="filter-tag va" onClick={() => toggleVa(va)}>
                {va} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </span>
            ))}
          </div>
          <button className="clear-all-btn" onClick={clearAllFilters}>清除全部</button>
        </div>
      )}
      </div>

      <div className="discover-view-content" ref={contentRef} onScroll={handleContentScroll}>
      {loading && (
        <StateView type="loading" title="加载中..." />
      )}

      {!loading && error && works.length === 0 && (
        <StateView
          type="error"
          title={error}
          action={<button onClick={fetchWorks}>重试</button>}
        />
      )}

      {(works.length > 0 || (!loading && !error)) && (
        <>
          {isFetching && (
            <div className="discover-fetching-bar">
              <div className="fetching-spinner" />
              <span>正在刷新...</span>
            </div>
          )}
          <div className="discover-grid">
            {works.map((work) => (
              <WorkCard
                key={work.id}
                work={work}
                selectedWorkId={selectedWorkId}
                activeTags={activeTags}
                activeVas={activeVas}
                onSelectWork={onSelectWork}
                onVaClick={toggleVa}
                onTagClick={toggleTag}
                getTranslatedText={getTranslatedText}
              />
            ))}
          </div>

          <div className="discover-pagination">
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              上一页
            </button>
            {pageNumbers.map((p, i) => (
              p === '...' ? (
                <span key={`dots-${i}`} className="page-dots">...</span>
              ) : (
                <button
                  key={p}
                  className={`page-num-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            ))}
            <button
              className="page-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={totalPages > 0 ? page >= totalPages : works.length < pageSize}
            >
              下一页
            </button>
            <div className="page-jump">
              <span className="page-jump-label">跳转</span>
              <input
                className="page-jump-input"
                type="number"
                min="1"
                max={totalPages || 1}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handlePageInputKeyDown}
                placeholder={String(page)}
              />
              <span className="page-jump-total">/ 共 {totalPages > 0 ? totalPages : '?'} 页</span>
            </div>
          </div>
        </>
      )}
      </div>

      <button
        className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        title="回到顶部"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
      </button>
    </div>
  )
})

DiscoverView.displayName = 'DiscoverView'

export default DiscoverView
