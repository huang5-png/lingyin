import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import WorkDetail from './components/WorkDetail'
import AudioPlayer from './components/AudioPlayer'
import LyricView from './components/LyricView'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import RightTabBar from './components/RightTabBar'
import DiscoverView from './components/DiscoverView'
import { scanFolder, scanMediaLibrary, findAllSubtitlesForAudio, extractRJCode, getExtension, detectLanguageFromContent } from './utils/scanner'
import { parseSubtitle, findCurrentCue } from './utils/subtitleParser'
import './App.css'

const DEFAULT_SETTINGS = {
  autoPlayNext: true,
  rememberProgress: true,
  autoPlayOnStart: false,
  defaultVolume: 80,
  sidebarWidth: 280,
  lyricWidth: 360,
  playerHeight: 120,
  showRatingStars: true,
  waveformHeight: 70,
  showLyric: true,
  autoScrollLyric: true,
  skipSeconds: 5,
  theme: 'dark',
  viewMode: 'grid',
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS }
}

export default function App() {
  const [works, setWorks] = useState([])
  const [selectedWork, setSelectedWork] = useState(null)
  const [currentAudio, setCurrentAudio] = useState(null)
  const [currentCues, setCurrentCues] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [cvFilter, setCvFilter] = useState('')
  const [circleFilter, setCircleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [settings, setSettings] = useState(loadSettings)
  const [viewMode, setViewMode] = useState(settings.viewMode || 'grid')
  const [showLyric, setShowLyric] = useState(settings.showLyric)
  const [audioFiles, setAudioFiles] = useState([])
  const [allSubtitleFiles, setAllSubtitleFiles] = useState([])
  const [subtitleOptions, setSubtitleOptions] = useState([])
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isImmersive, setIsImmersive] = useState(false)
  const [rightTab, setRightTab] = useState('details')
  const [currentView, setCurrentView] = useState('library')
  const [flipState, setFlipState] = useState({
    phase: 'idle',
    src: '',
    startRect: null,
    endRect: null,
    startBorderRadius: 0,
    endBorderRadius: 0,
  })
  const playerRef = useRef(null)
  const discoverViewRef = useRef(null)
  const lastSaveTimeRef = useRef(0)
  const flipRafRef = useRef(null)
  const flipTimeoutRef = useRef(null)
  const flipWorkIdRef = useRef(null)

  const currentCueIndex = useMemo(() => {
    return findCurrentCue(currentCues, currentTime)
  }, [currentCues, currentTime])

  const immersiveLyricCues = useMemo(() => {
    if (currentCues.length === 0) return []
    const start = Math.max(0, currentCueIndex - 2)
    const end = Math.min(currentCues.length, currentCueIndex + 3)
    return currentCues.slice(start, end).map((cue, idx) => ({
      ...cue,
      realIndex: start + idx,
      isActive: start + idx === currentCueIndex,
    }))
  }, [currentCues, currentCueIndex])

  const zoomRef = useRef(1)

  useEffect(() => {
    const BASE_WIDTH = 1400
    const BASE_HEIGHT = 900
    const MIN_ZOOM = 0.6
    const MAX_ZOOM = 1.2

    const updateZoom = () => {
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight
      const zoomX = winWidth / BASE_WIDTH
      const zoomY = winHeight / BASE_HEIGHT
      const zoom = Math.min(zoomX, zoomY)
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      document.body.style.zoom = clampedZoom
      zoomRef.current = clampedZoom
    }

    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  useEffect(() => {
    loadWorks()
    async function loadDbSettings() {
      try {
        const dbSettings = await window.electronAPI.dbGetSettings()
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          setSettings((prev) => ({ ...dbSettings, ...prev }))
          if (dbSettings.showLyric !== undefined) {
            setShowLyric(dbSettings.showLyric)
          }
        }
      } catch (e) {
        console.error('Failed to load settings from db:', e)
      }
    }
    loadDbSettings()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)
    root.style.setProperty('--lyric-width', `${settings.lyricWidth}px`)
    root.style.setProperty('--player-height', `${settings.playerHeight}px`)
    if (settings.theme) {
      root.setAttribute('data-theme', settings.theme)
    }
  }, [settings])

  const loadWorks = async () => {
    try {
      const data = await window.electronAPI.dbGetAllWorks()
      setWorks(data || [])
    } catch (e) {
      console.error('Failed to load works:', e)
    }
  }

  const allCVs = [...new Set(works.flatMap((w) => w.cvs || []))].sort()
  const allCircles = [...new Set(works.map((w) => w.circle).filter(Boolean))].sort()

  const filteredWorks = works.filter((w) => {
    if (cvFilter && !(w.cvs || []).includes(cvFilter)) return false
    if (circleFilter && w.circle !== circleFilter) return false
    if (tagFilter && !(w.tags || []).includes(tagFilter)) return false
    return true
  })

  const handleAddFolder = async () => {
    try {
      const folderPath = await window.electronAPI.openDirectory()
      if (!folderPath) return

      const scanResult = await scanFolder(folderPath)
      if (scanResult.audioFiles.length === 0) {
        alert('该文件夹中没有找到音频文件')
        return
      }

      const folderName = scanResult.folderName
      const rjCode = extractRJCode(folderName)

      let metadata = {
        id: folderPath,
        folderPath,
        folderName,
        rjCode,
        title: folderName,
        audioCount: scanResult.audioFiles.length,
        cover: '',
        rating: 0,
        tags: [],
        cvs: [],
        circle: '',
        description: '',
      }

      if (rjCode) {
        try {
          const detail = await window.electronAPI.dlsiteGetDetail(rjCode)
          if (detail) {
            metadata = { ...metadata, ...detail }
          }
        } catch (e) {
          console.error('Failed to fetch DLsite detail:', e)
        }
      }

      if (!metadata.cover) {
        try {
          const searchResults = await window.electronAPI.dlsiteSearch(folderName)
          if (searchResults.length > 0) {
            const first = searchResults[0]
            metadata.cover = first.cover
            metadata.title = first.title || metadata.title
            if (!metadata.rjCode && first.rjCode) {
              metadata.rjCode = first.rjCode
            }
          }
        } catch (e) {
          console.error('Failed to search DLsite:', e)
        }
      }

      const savedWork = await window.electronAPI.dbAddWork(metadata)
      setWorks((prev) => [...prev, savedWork])
      setSelectedWork(savedWork)
    } catch (e) {
      console.error('Failed to add folder:', e)
      alert('添加文件夹失败：' + e.message)
    }
  }

  const handleAddMediaLibrary = async () => {
    try {
      const rootPath = await window.electronAPI.openDirectory()
      if (!rootPath) return

      const existingWorks = await window.electronAPI.dbGetAllWorks()
      const existingPaths = new Set(existingWorks.map((w) => w.folderPath))

      const scanResults = await scanMediaLibrary(rootPath)
      if (scanResults.length === 0) {
        alert('在该目录下没有找到包含音频文件的文件夹')
        return
      }

      let addedCount = 0
      const newWorks = []

      for (const result of scanResults) {
        if (existingPaths.has(result.folderPath)) {
          continue
        }

        const folderName = result.folderName
        const rjCode = extractRJCode(folderName)

        let metadata = {
          id: result.folderPath,
          folderPath: result.folderPath,
          folderName,
          rjCode,
          title: folderName,
          audioCount: result.audioFiles.length,
          cover: '',
          rating: 0,
          tags: [],
          cvs: [],
          circle: '',
          description: '',
        }

        if (rjCode) {
          try {
            const detail = await window.electronAPI.dlsiteGetDetail(rjCode)
            if (detail) {
              metadata = { ...metadata, ...detail }
            }
          } catch (e) {
            console.error('Failed to fetch DLsite detail:', e)
          }
        }

        if (!metadata.cover) {
          try {
            const searchResults = await window.electronAPI.dlsiteSearch(folderName)
            if (searchResults.length > 0) {
              const first = searchResults[0]
              metadata.cover = first.cover
              metadata.title = first.title || metadata.title
              if (!metadata.rjCode && first.rjCode) {
                metadata.rjCode = first.rjCode
              }
            }
          } catch (e) {
            console.error('Failed to search DLsite:', e)
          }
        }

        const savedWork = await window.electronAPI.dbAddWork(metadata)
        newWorks.push(savedWork)
        addedCount++
      }

      if (newWorks.length > 0) {
        setWorks((prev) => [...prev, ...newWorks])
      }

      alert(`媒体库扫描完成！\n共找到 ${scanResults.length} 个作品文件夹\n成功添加 ${addedCount} 个新作品\n${scanResults.length - addedCount} 个已存在，已跳过`)
    } catch (e) {
      console.error('Failed to add media library:', e)
      alert('添加媒体库失败：' + e.message)
    }
  }

  const handleSelectWork = useCallback(
    (work, event) => {
      if (work?.id === selectedWork?.id) return

      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current)
        flipTimeoutRef.current = null
      }
      if (flipRafRef.current) {
        cancelAnimationFrame(flipRafRef.current)
        flipRafRef.current = null
      }

      setFlipState({ phase: 'idle', src: '', startRect: null, endRect: null, startBorderRadius: 0, endBorderRadius: 0 })

      let startRect = null
      let startBorderRadius = 0
      let sourceEl = null

      if (event && work?.cover) {
        sourceEl = event.target.closest('[data-work-cover]')
        if (!sourceEl && event.currentTarget) {
          sourceEl = event.currentTarget.querySelector('[data-work-cover]')
        }
        if (!sourceEl) {
          sourceEl = document.querySelector(`[data-work-cover][data-work-id="${work.id}"]`)
        }
      }

      if (work?.cover && sourceEl) {
        const rect = sourceEl.getBoundingClientRect()
        const zoom = zoomRef.current || 1
        const styles = window.getComputedStyle(sourceEl)
        startBorderRadius = parseFloat(styles.borderRadius) || 0
        startRect = {
          left: rect.left / zoom,
          top: rect.top / zoom,
          width: rect.width / zoom,
          height: rect.height / zoom,
        }
        flipWorkIdRef.current = work.id
      } else {
        flipWorkIdRef.current = null
      }

      setSelectedWork(work)
      setCurrentAudio(null)
      setCurrentCues([])
      setCurrentTime(0)
      setDuration(0)

      if (startRect) {
        setFlipState({
          phase: 'ready',
          src: work.cover,
          startRect,
          endRect: null,
          startBorderRadius,
          endBorderRadius: 0,
        })
      }
    },
    [selectedWork],
  )

  const extractAudiosFromTracks = useCallback((tracks, folderPath = '') => {
    const audios = []
    for (const track of tracks) {
      if (track.type === 'folder' && track.children) {
        const childAudios = extractAudiosFromTracks(track.children, folderPath ? `${folderPath}/${track.title}` : track.title)
        audios.push(...childAudios)
      } else if (track.type === 'audio') {
        audios.push({
          name: track.title,
          path: track.mediaStreamUrl,
          isOnline: true,
          duration: track.duration,
          size: track.size,
          folder: folderPath,
        })
      }
    }
    return audios
  }, [])

  const handleSelectOnlineWork = useCallback(
    async (workSummary, event) => {
      try {
        if (flipTimeoutRef.current) {
          clearTimeout(flipTimeoutRef.current)
          flipTimeoutRef.current = null
        }
        if (flipRafRef.current) {
          cancelAnimationFrame(flipRafRef.current)
          flipRafRef.current = null
        }

        setFlipState({ phase: 'idle', src: '', startRect: null, endRect: null, startBorderRadius: 0, endBorderRadius: 0 })

        let startRect = null
        let startBorderRadius = 0
        let sourceEl = null

        if (event && workSummary?.mainCoverUrl) {
          sourceEl = event.target.closest('[data-work-cover]')
          if (!sourceEl && event.currentTarget) {
            sourceEl = event.currentTarget.querySelector('[data-work-cover]')
          }
          if (!sourceEl) {
            sourceEl = document.querySelector(`[data-work-cover][data-work-id="online_${workSummary.id}"]`)
          }
        }

        if (workSummary?.mainCoverUrl && sourceEl) {
          const rect = sourceEl.getBoundingClientRect()
          const styles = window.getComputedStyle(sourceEl)
          startBorderRadius = parseFloat(styles.borderRadius) || 0
          startRect = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
          flipWorkIdRef.current = `online_${workSummary.id}`
        } else {
          flipWorkIdRef.current = null
        }

        const [workInfo, tracks] = await Promise.all([
          window.electronAPI.asmrOneGetWorkInfo(workSummary.id),
          window.electronAPI.asmrOneGetTracks(workSummary.id),
        ])

        const audioFiles = extractAudiosFromTracks(tracks)

        const work = {
          id: `online_${workInfo.id}`,
          rjCode: workInfo.source_id,
          title: workInfo.title,
          folderName: workInfo.title,
          circle: workInfo.name,
          cover: workInfo.mainCoverUrl,
          thumbnailCover: workInfo.thumbnailCoverUrl,
          samCover: workInfo.samCoverUrl,
          cvs: workInfo.vas?.map((v) => v.name) || [],
          tags: workInfo.tags?.map((t) => t.name) || [],
          price: workInfo.price,
          rate: workInfo.rate_average_2dp,
          dlCount: workInfo.dl_count,
          releaseDate: workInfo.release,
          nsfw: workInfo.nsfw,
          sourceUrl: workInfo.source_url,
          isOnline: true,
          onlineId: workInfo.id,
        }

        setSelectedWork(work)
        setAudioFiles(audioFiles)
        setCurrentAudio(null)
        setCurrentCues([])
        setCurrentTime(0)
        setDuration(0)
        setAllSubtitleFiles([])
        setSubtitleOptions([])
        setSelectedSubtitleIndex(-1)

        if (startRect) {
          setFlipState({
            phase: 'ready',
            src: work.cover,
            startRect,
            endRect: null,
            startBorderRadius,
            endBorderRadius: 0,
          })
        }
      } catch (e) {
        console.error('Failed to load online work:', e)
        alert('加载作品失败：' + (e.message || '未知错误'))
      }
    },
    [extractAudiosFromTracks],
  )

  useEffect(() => {
    if (flipState.phase !== 'ready') return

    let attempts = 0
    const maxAttempts = 40

    const poll = () => {
      attempts++
      if (attempts > maxAttempts) {
        setFlipState({ phase: 'idle', src: '', startRect: null, endRect: null, startBorderRadius: 0, endBorderRadius: 0 })
        return
      }

      const targetEl = document.querySelector('[data-work-cover-target]')
      if (!targetEl) {
        flipRafRef.current = requestAnimationFrame(poll)
        return
      }

      const endRect = targetEl.getBoundingClientRect()
      if (endRect.width === 0 || endRect.height === 0) {
        flipRafRef.current = requestAnimationFrame(poll)
        return
      }

      const endStyles = window.getComputedStyle(targetEl)
      const endBorderRadius = parseFloat(endStyles.borderRadius) || 0
      const zoom = zoomRef.current || 1

      setFlipState((prev) => ({
        ...prev,
        phase: 'invert',
        endRect: {
          left: endRect.left / zoom,
          top: endRect.top / zoom,
          width: endRect.width / zoom,
          height: endRect.height / zoom,
        },
        endBorderRadius,
      }))
    }

    flipRafRef.current = requestAnimationFrame(poll)

    return () => {
      if (flipRafRef.current) {
        cancelAnimationFrame(flipRafRef.current)
        flipRafRef.current = null
      }
    }
  }, [flipState.phase])

  useEffect(() => {
    if (flipState.phase !== 'invert') return

    flipRafRef.current = requestAnimationFrame(() => {
      flipRafRef.current = requestAnimationFrame(() => {
        setFlipState((prev) => ({ ...prev, phase: 'play' }))
      })
    })

    return () => {
      if (flipRafRef.current) {
        cancelAnimationFrame(flipRafRef.current)
        flipRafRef.current = null
      }
    }
  }, [flipState.phase])

  useEffect(() => {
    if (flipState.phase !== 'play') return

    flipTimeoutRef.current = setTimeout(() => {
      setFlipState({ phase: 'idle', src: '', startRect: null, endRect: null, startBorderRadius: 0, endBorderRadius: 0 })
      flipTimeoutRef.current = null
      flipWorkIdRef.current = null
    }, 400)

    return () => {
      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current)
        flipTimeoutRef.current = null
      }
    }
  }, [flipState.phase])

  const handleDeleteWork = useCallback(async (work) => {
    const confirmed = window.confirm(`确定要删除「${work.title || work.folderName}」吗？\n\n（只会删除记录，不会删除本地文件）`)
    if (!confirmed) return

    try {
      await window.electronAPI.dbDeleteWork(work.id)
      setWorks((prev) => prev.filter((w) => w.id !== work.id))
      if (selectedWork && selectedWork.id === work.id) {
        setSelectedWork(null)
        setCurrentAudio(null)
        setCurrentCues([])
        setAudioFiles([])
        setAllSubtitleFiles([])
      }
    } catch (e) {
      console.error('Failed to delete work:', e)
      alert('删除失败：' + e.message)
    }
  }, [selectedWork])

  useEffect(() => {
    let cancelled = false
    if (selectedWork) {
      scanFolder(selectedWork.folderPath).then(async (r) => {
        if (cancelled) return
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
        if (!cancelled) {
          setAudioFiles(filesWithDuration)
          setAllSubtitleFiles(r.subtitleFiles)
        }
      })
    } else {
      setAudioFiles([])
      setAllSubtitleFiles([])
    }
    return () => {
      cancelled = true
    }
  }, [selectedWork])

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
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }, [])

  const handleSelectAudio = useCallback(
    async (audio) => {
      if (!selectedWork) return

      setCurrentAudio(audio)
      setCurrentCues([])

      let subtitleOptions = []
      
      if (!audio.isOnline) {
        subtitleOptions = findAllSubtitlesForAudio(audio.name, allSubtitleFiles, audio.path)
        detectSubtitleLanguagesAsync(subtitleOptions)
      }
      
      setSubtitleOptions(subtitleOptions)

      let savedSubtitleIndex = subtitleOptions.length > 0 ? 0 : -1

      try {
        const savedSubtitle = await window.electronAPI.dbGetSubtitle(selectedWork.id, audio.path)
        if (savedSubtitle && savedSubtitle.filePath) {
          const existingIndex = subtitleOptions.findIndex((s) => s.file.path === savedSubtitle.filePath)
          if (existingIndex >= 0) {
            savedSubtitleIndex = existingIndex
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
            subtitleOptions.unshift(manualSub)
            savedSubtitleIndex = 0
            setSubtitleOptions([...subtitleOptions])
          }
        }
      } catch (e) {
        console.error('Failed to load saved subtitle:', e)
      }

      setSelectedSubtitleIndex(savedSubtitleIndex)

      if (savedSubtitleIndex >= 0 && subtitleOptions[savedSubtitleIndex]) {
        try {
          const sub = subtitleOptions[savedSubtitleIndex]
          const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
          if (content) {
            const ext = getExtension(sub.file.name)
            const cues = parseSubtitle(content, ext)
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
              if (playerRef.current && playerRef.current.getDuration() > 0) {
                playerRef.current.seekTo(targetTime)
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
    [selectedWork, allSubtitleFiles],
  )

  const handleTimeUpdate = useCallback(
    (time) => {
      setCurrentTime(time)

      if (selectedWork && currentAudio && time > 0 && !currentAudio.isOnline) {
        const now = Date.now()
        if (now - lastSaveTimeRef.current > 5000) {
          lastSaveTimeRef.current = now
          window.electronAPI.dbSaveProgress(selectedWork.id, currentAudio.path, {
            currentTime: time,
            duration: duration,
          })
        }
      }
    },
    [selectedWork, currentAudio, duration],
  )

  const handleReady = useCallback((dur) => {
    setDuration(dur)
  }, [])

  const handleSeek = useCallback((time) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time)
    }
  }, [])

  const handlePrevAudio = useCallback(() => {
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex <= 0) return
    handleSelectAudio(audioFiles[currentIndex - 1])
  }, [currentAudio, audioFiles, handleSelectAudio])

  const handleNextAudio = useCallback(() => {
    if (!currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [currentAudio, audioFiles, handleSelectAudio])

  const handleFinish = useCallback(() => {
    if (!settings.autoPlayNext || !currentAudio || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex >= audioFiles.length - 1) return
    handleSelectAudio(audioFiles[currentIndex + 1])
  }, [settings.autoPlayNext, currentAudio, audioFiles, handleSelectAudio])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (playerRef.current) {
            playerRef.current.playPause()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevAudio()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNextAudio()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevAudio, handleNextAudio])

  const handleSelectSubtitle = useCallback(async (index) => {
    setSelectedSubtitleIndex(index)
    if (index < 0 || !subtitleOptions[index]) {
      setCurrentCues([])
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, null)
        } catch (e) {
          console.error('Failed to clear subtitle:', e)
        }
      }
      return
    }
    try {
      const sub = subtitleOptions[index]
      const content = await window.electronAPI.readFile(sub.file.path, 'utf-8')
      if (content) {
        const ext = getExtension(sub.file.name)
        const cues = parseSubtitle(content, ext)
        setCurrentCues(cues)
        
        const contentLanguage = detectLanguageFromContent(content)
        if (contentLanguage !== 'unknown' && sub.language !== contentLanguage) {
          const updatedSub = { ...sub, language: contentLanguage }
          const newOptions = [...subtitleOptions]
          newOptions[index] = updatedSub
          setSubtitleOptions(newOptions)
          
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
              console.error('Failed to save updated subtitle language:', e)
            }
          }
          return
        }
      }
      if (selectedWork && currentAudio) {
        try {
          await window.electronAPI.dbSaveSubtitle(selectedWork.id, currentAudio.path, {
            filePath: sub.file.path,
            fileName: sub.file.name,
            format: sub.format,
            language: sub.language,
            isTranslated: sub.isTranslated,
            displayName: sub.displayName,
            isManual: sub.isManual || false,
          })
        } catch (e) {
          console.error('Failed to save subtitle:', e)
        }
      }
    } catch (e) {
      console.error('Failed to load subtitle:', e)
    }
  }, [subtitleOptions, selectedWork, currentAudio])

  const handleAddSubtitleFile = useCallback(async () => {
    try {
      const files = await window.electronAPI.openSubtitleFile()
      if (!files || files.length === 0) return

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
            setCurrentCues(cues)
            setSelectedSubtitleIndex(newIndex)
          }
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
          console.error('Failed to load subtitle:', e)
        }
      }
    } catch (e) {
      console.error('Failed to add subtitle file:', e)
    }
  }, [subtitleOptions, currentAudio, selectedWork])

  const handleOpenSubtitleSettings = useCallback(() => {
    // TODO: 打开字幕设置
  }, [])

  const handleEditMetadata = async (data) => {
    if (!selectedWork) return
    try {
      const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, data)
      if (updated) {
        setSelectedWork(updated)
        setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      }
    } catch (e) {
      console.error('Failed to update metadata:', e)
    }
  }

  const handleRefreshMetadata = async () => {
    if (!selectedWork) return
    try {
      const rjCode = selectedWork.rjCode || extractRJCode(selectedWork.folderName)
      if (rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
          return
        }
      }
      const results = await window.electronAPI.dlsiteSearch(selectedWork.folderName)
      if (results.length > 0 && results[0].rjCode) {
        const detail = await window.electronAPI.dlsiteGetDetail(results[0].rjCode)
        if (detail) {
          const updated = await window.electronAPI.dbUpdateWork(selectedWork.id, detail)
          if (updated) {
            setSelectedWork(updated)
            setWorks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
          }
        }
      }
    } catch (e) {
      console.error('Failed to refresh metadata:', e)
      alert('重新刮削失败：' + e.message)
    }
  }

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
        const newSubtitleOptions = findAllSubtitlesForAudio(currentAudio.name, r.subtitleFiles, currentAudio.path)
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
      alert('刷新字幕失败：' + e.message)
    }
  }, [selectedWork, currentAudio, subtitleOptions, selectedSubtitleIndex])

  const handleFilterChange = (type, value) => {
    if (type === 'cv') {
      setCvFilter(value)
    } else if (type === 'tag') {
      setTagFilter(value)
    } else {
      setCircleFilter(value)
    }
  }

  const handleClearFilter = (type) => {
    if (type === 'cv') {
      setCvFilter('')
    } else if (type === 'tag') {
      setTagFilter('')
    } else if (type === 'circle') {
      setCircleFilter('')
    }
  }

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    setSettings((prev) => {
      const newSettings = { ...prev, viewMode: mode }
      window.electronAPI?.dbSaveSettings(newSettings).catch(() => {})
      return newSettings
    })
  }, [])

  const handleOpenSettings = () => {
    setShowSettingsModal(true)
  }

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem('appSettings', JSON.stringify(newSettings))
    try {
      window.electronAPI.dbSaveSettings(newSettings)
    } catch (e) {
      console.error('Failed to save settings to db:', e)
    }
    if (newSettings.showLyric !== undefined) {
      setShowLyric(newSettings.showLyric)
    }
    if (newSettings.defaultVolume !== undefined && playerRef.current) {
      playerRef.current.setVolume?.(newSettings.defaultVolume / 100)
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        <div className="title-bar">
          <span className="title-bar-text">聆音 · 沉浸式 ASMR 音声播放器</span>
          <div className="window-controls">
            <button className="window-btn minimize-btn" onClick={() => window.electronAPI.windowMinimize()} title="最小化">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
              </svg>
            </button>
            <button className="window-btn maximize-btn" onClick={() => window.electronAPI.windowMaximize()} title="最大化">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button className="window-btn close-btn" onClick={() => window.electronAPI.windowClose()} title="关闭">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="app-main">
        <div className="left-nav-bar">
          <div className="nav-items">
            <div
              className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
              title="我的库"
              onClick={() => setCurrentView('library')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div
              className={`nav-item ${currentView === 'discover' ? 'active' : ''}`}
              title="发现"
              onClick={() => setCurrentView('discover')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <div className="nav-item" title="播放列表">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
          </div>
          <div className="nav-bottom">
            <div className="nav-item" title="设置" onClick={handleOpenSettings}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
          </div>
        </div>
      {currentView === 'library' && (
        <div className={`library-layout ${selectedWork ? 'has-detail' : ''}`}>
          <div className="library-main">
            <Sidebar
              works={filteredWorks}
              selectedWorkId={selectedWork?.id}
              onSelectWork={handleSelectWork}
              onAddFolder={handleAddFolder}
              onAddMediaLibrary={handleAddMediaLibrary}
              cvFilter={cvFilter}
              circleFilter={circleFilter}
              onFilterChange={handleFilterChange}
              allCVs={allCVs}
              allCircles={allCircles}
              onOpenSettings={handleOpenSettings}
              onDeleteWork={handleDeleteWork}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          </div>
          <div className="main-content">
            <div className="content-area">
              <div className="work-detail-wrapper library-work-detail">
                {selectedWork && (
                  <button 
                    className="detail-close-btn"
                    onClick={() => setSelectedWork(null)}
                    title="关闭详情"
                  >
                    ✕
                  </button>
                )}
              <WorkDetail
                work={selectedWork}
                audioFiles={audioFiles}
                currentAudio={currentAudio}
                onSelectAudio={handleSelectAudio}
                onEditMetadata={handleEditMetadata}
                onRefreshMetadata={handleRefreshMetadata}
                onRefreshSubtitles={handleRefreshSubtitles}
                onFilterCV={(cv) => handleFilterChange('cv', cv)}
                onFilterTag={(tag) => handleFilterChange('tag', tag)}
                activeCV={cvFilter}
                activeTag={tagFilter}
              />
              </div>
              <div className="right-tab-wrapper">
              <RightTabBar
                activeTab={rightTab}
                onTabChange={setRightTab}
                work={selectedWork}
                cues={currentCues}
                currentTime={currentTime}
                onSeek={handleSeek}
                subtitleOptions={subtitleOptions}
                selectedSubtitleIndex={selectedSubtitleIndex}
                onSelectSubtitle={handleSelectSubtitle}
                onAddSubtitleFile={handleAddSubtitleFile}
              />
              </div>
            </div>
            <div className="player-bar">
              <AudioPlayer
                ref={playerRef}
                audioPath={currentAudio?.path}
                title={currentAudio?.name}
                cover={selectedWork?.cover}
                onTimeUpdate={handleTimeUpdate}
                onReady={handleReady}
                onFinish={handleFinish}
                onPrev={handlePrevAudio}
                onNext={handleNextAudio}
                workId={selectedWork?.id}
                waveformHeight={settings.waveformHeight}
                defaultVolume={settings.defaultVolume}
                skipSeconds={settings.skipSeconds || 5}
                onToggleImmersive={() => setIsImmersive(!isImmersive)}
              />
            </div>
          </div>
        </div>
      )}
      {currentView === 'discover' && (
        <div className={`discover-layout ${selectedWork && selectedWork.isOnline ? 'has-detail' : ''}`}>
          <div className="discover-main">
            <DiscoverView 
              ref={discoverViewRef}
              onSelectWork={handleSelectOnlineWork} 
              selectedWorkId={selectedWork?.id} 
            />
          </div>
          {selectedWork && selectedWork.isOnline && (
            <div className="main-content discover-detail-content">
              <div className="content-area">
                <div className="work-detail-wrapper discover-work-detail">
                  <button 
                    className="detail-close-btn"
                    onClick={() => setSelectedWork(null)}
                    title="关闭详情"
                  >
                    ✕
                  </button>
                  <WorkDetail
                    work={selectedWork}
                    audioFiles={audioFiles}
                    currentAudio={currentAudio}
                    onSelectAudio={handleSelectAudio}
                    onEditMetadata={handleEditMetadata}
                    onRefreshMetadata={handleRefreshMetadata}
                    onRefreshSubtitles={handleRefreshSubtitles}
                    onFilterCV={(cv) => {
                      if (cv && discoverViewRef.current) {
                        discoverViewRef.current.toggleVa(cv)
                      }
                    }}
                    onFilterTag={(tag) => {
                      if (tag && discoverViewRef.current) {
                        discoverViewRef.current.toggleTag(tag)
                      }
                    }}
                    activeCV={''}
                    activeTag={''}
                  />
                </div>
                <div className="right-tab-wrapper discover-right-tab">
                  <RightTabBar
                    activeTab={rightTab}
                    onTabChange={setRightTab}
                    work={selectedWork}
                    cues={currentCues}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    subtitleOptions={subtitleOptions}
                    selectedSubtitleIndex={selectedSubtitleIndex}
                    onSelectSubtitle={handleSelectSubtitle}
                    onAddSubtitleFile={handleAddSubtitleFile}
                  />
                </div>
              </div>
              <div className="player-bar">
                <AudioPlayer
                  ref={playerRef}
                  audioPath={currentAudio?.path}
                  title={currentAudio?.name}
                  cover={selectedWork?.cover}
                  onTimeUpdate={handleTimeUpdate}
                  onReady={handleReady}
                  onFinish={handleFinish}
                  onPrev={handlePrevAudio}
                  onNext={handleNextAudio}
                  workId={selectedWork?.id}
                  waveformHeight={settings.waveformHeight}
                  defaultVolume={settings.defaultVolume}
                  skipSeconds={settings.skipSeconds || 5}
                  onToggleImmersive={() => setIsImmersive(!isImmersive)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      </div>

      {isImmersive && selectedWork && (
        <div className="immersive-overlay" onClick={() => setIsImmersive(false)}>
          <div className="immersive-bg" style={{ backgroundImage: `url(${selectedWork.cover})` }} />
          <div className="immersive-content">
            <img src={selectedWork.cover} alt="" className="immersive-cover" />
            <div className="immersive-title">{selectedWork.title || selectedWork.folderName}</div>
            <div className="immersive-subtitle">{selectedWork.circle || ''}</div>
          </div>
          {immersiveLyricCues.length > 0 && (
            <div className="immersive-lyrics">
              <div className="immersive-lyrics-container">
                {immersiveLyricCues.map((cue) => (
                  <div
                    key={cue.realIndex}
                    className={`immersive-lyric-line ${cue.isActive ? 'active' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cue.text.split('\n').map((line, lineIdx) => (
                      <div key={lineIdx}>{line}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="immersive-hint">点击任意位置退出</div>
        </div>
      )}

      {(flipState.phase === 'invert' || flipState.phase === 'play') && flipState.startRect && flipState.endRect && (
        <div
          className={`flip-cover ${flipState.phase === 'play' ? 'animating' : ''}`}
          style={{
            left: flipState.startRect.left,
            top: flipState.startRect.top,
            width: flipState.startRect.width,
            height: flipState.startRect.height,
            borderRadius: `${flipState.startBorderRadius}px`,
            '--translate-x': `${flipState.endRect.left - flipState.startRect.left}px`,
            '--translate-y': `${flipState.endRect.top - flipState.startRect.top}px`,
            '--scale-x': flipState.endRect.width / flipState.startRect.width,
            '--scale-y': flipState.endRect.height / flipState.startRect.height,
            '--end-border-radius': `${flipState.endBorderRadius}px`,
          }}
        >
          <img src={flipState.src} alt="" />
        </div>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
        currentSettings={settings}
      />
      </div>
    </ErrorBoundary>
  )
}
