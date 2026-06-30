import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatTime } from '../utils/subtitleParser'
import { useTranslate } from './useTranslate'
import { usePlayQueue } from './usePlayQueue'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSleepTimer, SLEEP_TIMER_OPTIONS, SLEEP_TIMER_MODES, SLEEP_TIMER_PRESETS } from './useSleepTimer'
import { useSubtitle } from './useSubtitle'
import { useMediaLibrary } from './useMediaLibrary'
import { useOnlineWork } from './useOnlineWork'
import { usePlaybackHistory } from './usePlaybackHistory'
import { useFilters } from './useFilters'
import { useTheme } from './useTheme'
import { useToast } from './useToast'
import { useImmersive } from './useImmersive'
import { useSplitter } from './useSplitter'
import { usePlayer } from './usePlayer'
import { useWorkMetadata } from './useWorkMetadata'
import { useAppSettings } from './useAppSettings'
import { useViewNavigation } from './useViewNavigation'
import { usePlaylistPlayback } from './usePlaylistPlayback'
import { useSubtitleRefresh } from './useSubtitleRefresh'
import { useFavorites } from './useFavorites'
import { useFolderGroups } from './useFolderGroups'
import { useDownloadImport } from './useDownloadImport'
import { useBookmarks } from './useBookmarks'

export function useAppState() {
  const playerRef = useRef(null)
  const handleSelectAudioRef = useRef(null)
  const discoverViewRef = useRef(null)
  const contentAreaRef = useRef(null)

  // ===== Toast 通知 Hook =====
  const { toasts, showToast, removeToast } = useToast()

  // ===== 设置管理 Hook =====
  const {
    settings,
    setSettings,
    viewMode,
    showLyric,
    setShowLyric,
    handleSaveSettings,
    handleViewModeChange,
    handlePlaybackRateChange,
  } = useAppSettings({
    playerRef,
    showToast,
  })

  // ===== 视图导航 Hook =====
  const {
    selectedWork,
    setSelectedWork,
    currentView,
    setCurrentView,
    rightTab,
    setRightTab,
    showSettingsModal,
    setShowSettingsModal,
    showDownloadModal,
    setShowDownloadModal,
    showGlobalSearch,
    setShowGlobalSearch,
    settingsDefaultTab,
    handleOpenSettings,
    handleOpenSubtitleSettings,
    pendingAutoPlayRef,
    pendingContinueRef,
    handleSelectWork,
    handleRecentPlayAutoPlay,
    handleContinueListen: _handleContinueListen,
    handlePlayerCoverClick,
  } = useViewNavigation({ showToast })

  const handleContinueListen = useCallback(
    (item) => {
      _handleContinueListen(item, works)
    },
    [_handleContinueListen, works],
  )

  // ===== 右侧面板宽度拖拽 Hook =====
  const {
    width: rightPanelWidth,
    setWidth: setRightPanelWidth,
    isDragging: isDraggingSplitter,
    handleMouseDown: handleSplitterMouseDown,
  } = useSplitter({
    defaultWidth: 320,
    minWidth: 240,
    maxWidth: 600,
    containerRef: contentAreaRef,
  })

  // ===== 媒体库管理 Hook =====
  const {
    works,
    isLoadingWorks,
    setWorks,
    loadWorks,
    handleAddFolder,
    handleAddMediaLibrary,
    handleAddFoldersByPath,
    handleDeleteWork: mediaLibraryDeleteWork,
    audioFiles,
    setAudioFiles,
    allSubtitleFiles,
    setAllSubtitleFiles,
    latestAudioFilesRef,
  } = useMediaLibrary({
    showToast,
    setSelectedWork,
    selectedWork,
  })

  // ===== 收藏功能 Hook =====
  const {
    favoriteIds,
    showOnlyFavorites,
    setShowOnlyFavorites,
    toggleFavorite,
    isFavorite,
    filterFavorites,
  } = useFavorites({ showToast })

  // ===== 书签 Hook =====
  const {
    bookmarks,
    loadingBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    hasBookmarkAtTime,
    loadBookmarks,
  } = useBookmarks({ showToast })

  // ===== 文件夹分组 Hook =====
  const {
    folderGroups,
    activeGroupId,
    setActiveGroupId,
    groupMap,
    groupWorkCounts,
    filteredWorks: groupFilteredWorks,
    createGroup,
    renameGroup,
    deleteGroup,
    setWorkGroup,
  } = useFolderGroups({
    showToast,
    works,
    setWorks,
  })

  // ===== 筛选状态 Hook =====
  const {
    cvFilter,
    circleFilter,
    tagFilter,
    allCVs,
    allCircles,
    filteredWorks: filterByTagWorks,
    handleFilterChange,
  } = useFilters(groupFilteredWorks)

  const filteredWorks = useMemo(() => {
    return filterFavorites(filterByTagWorks)
  }, [filterByTagWorks, filterFavorites])

  // ===== 播放历史记录 Hook =====
  const { recordHistoryIfNeeded } = usePlaybackHistory()

  // ===== 翻译功能 Hook =====
  const {
    translateCacheRef,
    translateVersion,
    setTranslateVersion,
    translate: handleTranslate,
    translateBatch: handleTranslateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    toggleSubtitleTranslate,
  } = useTranslate(showToast)

  // ===== 播放队列 Hook =====
  const {
    playQueue,
    setPlayQueue,
    queueIndex,
    setQueueIndex,
    loopMode,
    setLoopMode,
    shuffle,
    setShuffle,
    showQueuePanel,
    setShowQueuePanel,
    pendingQueuePlayRef,
    playFromQueue: handlePlayFromQueue,
    advanceQueue,
    buildQueueItem,
    addToQueue: handleAddToQueue,
    playNext: handlePlayNext,
    removeFromQueue: handleRemoveFromQueue,
    clearQueue: handleClearQueue,
    reorderQueue: handleReorderQueue,
    toggleLoopMode: handleToggleLoopMode,
    toggleShuffle: handleToggleShuffle,
    toggleQueuePanel: handleToggleQueuePanel,
  } = usePlayQueue({
    selectedWork,
    audioFiles,
    settings,
    showToast,
    playerRef,
    handleSelectAudioRef,
    setCurrentView,
    setSelectedWork,
  })

  // ===== 睡眠定时器 Hook =====
  const {
    mode: sleepTimerMode,
    isActive: sleepTimerActive,
    isFading: sleepTimerFading,
    remainingSeconds: sleepTimerRemaining,
    fadeEnabled: sleepTimerFadeEnabled,
    setFadeEnabled: setSleepTimerFadeEnabled,
    setCountdownTimer: handleSetCountdownTimer,
    setTrackEndTimer: handleSetTrackEndTimer,
    setTimePointTimer: handleSetTimePointTimer,
    cancelSleepTimer: handleCancelSleepTimer,
    handleTrackFinish: handleSleepTimerTrackFinish,
    formatRemaining: formatSleepTimerRemaining,
    getStatusText: getSleepTimerStatusText,
  } = useSleepTimer({ playerRef, showToast })

  // ===== 字幕管理 Hook =====
  const {
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
  } = useSubtitle({
    selectedWork,
    allSubtitleFiles,
    settings,
    translateCacheRef,
    setTranslateVersion,
    showToast,
  })

  // ===== 核心播放控制 Hook =====
  const {
    playingWork,
    currentAudio,
    currentCues,
    currentTime,
    duration,
    handleSelectAudio,
    handleTimeUpdate,
    handleReady,
    handleSeek,
    handlePrevAudio,
    handleNextAudio,
    handleFinish,
    setCurrentCues,
    setCurrentTime,
    setDuration,
    setPlayingWork,
    setCurrentAudio,
    durationRef,
  } = usePlayer({
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
    handleSelectAudioRef,
  })

  const hasTranslation = useMemo(() => currentCues.some(cue => cue.translated && cue.translated.trim()), [currentCues])

  // ===== 上次播放状态保存（用于启动恢复） =====
  const lastPlaySaveTimerRef = useRef(null)

  const saveLastPlayState = useCallback(() => {
    if (!playingWork || !currentAudio) return
    const state = {
      workId: playingWork.id,
      workTitle: playingWork.title || playingWork.folderName || '',
      workCover: playingWork.cover || '',
      audioPath: currentAudio.path || '',
      audioName: currentAudio.name || '',
      currentTime: playerRef.current?.getCurrentTime?.() || currentTime || 0,
      duration: durationRef.current || duration || 0,
      isOnline: !!playingWork.isOnline,
    }
    try {
      window.electronAPI?.lastPlayStateSave?.(state)
    } catch (e) {}
  }, [playingWork, currentAudio, currentTime, duration, playerRef, durationRef])

  useEffect(() => {
    if (!playingWork || !currentAudio) return
    if (lastPlaySaveTimerRef.current) {
      clearInterval(lastPlaySaveTimerRef.current)
    }
    saveLastPlayState()
    lastPlaySaveTimerRef.current = setInterval(saveLastPlayState, 10000)
    return () => {
      if (lastPlaySaveTimerRef.current) {
        clearInterval(lastPlaySaveTimerRef.current)
      }
    }
  }, [playingWork, currentAudio, saveLastPlayState])

  // ===== 作品间连续播放 =====
  const handleFinishWithContinuousPlay = useCallback(() => {
    handleFinish()
    if (!settings?.continuousPlay) return
    if (queueIndex >= 0 && playQueue.length > 0) return
    if (!currentAudio || !selectedWork || audioFiles.length === 0) return
    const currentIndex = audioFiles.findIndex((f) => f.path === currentAudio.path)
    if (currentIndex < 0 || currentIndex < audioFiles.length - 1) return
    if (!filteredWorks || filteredWorks.length === 0) return
    const workIndex = filteredWorks.findIndex(w => w.id === selectedWork.id)
    if (workIndex < 0 || workIndex >= filteredWorks.length - 1) return
    const nextWork = filteredWorks[workIndex + 1]
    if (nextWork) {
      showToast?.(`连续播放：${nextWork.title || nextWork.folderName || '下一个作品'}`, 'info')
      setSelectedWork(nextWork)
      pendingAutoPlayRef.current = { startedAt: Date.now() }
    }
  }, [settings, queueIndex, playQueue, handleFinish, currentAudio, selectedWork, audioFiles, filteredWorks, showToast, setSelectedWork, pendingAutoPlayRef])

  const handleToggleTranslate = useCallback(() => {
    toggleSubtitleTranslate({
      selectedWork,
      currentAudio,
      currentCues,
      setCurrentCues,
    })
  }, [selectedWork, currentAudio, currentCues, toggleSubtitleTranslate])

  // 包装 handleDeleteWork，注入 selectedWork 和清理回调
  const handleDeleteWork = useCallback(
    async (work) => {
      const onDelete = () => {
        setSelectedWork(null)
        setCurrentAudio(null)
        setCurrentCues([])
      }
      await mediaLibraryDeleteWork(work, selectedWork, onDelete)
    },
    [mediaLibraryDeleteWork, selectedWork, setCurrentAudio, setCurrentCues],
  )

  // 收藏相关处理
  const handleToggleFavorite = useCallback(
    async (work) => {
      if (!work) return
      const workInfo = {
        title: work.title || work.folderName || '',
        cover: work.cover || '',
        circle: work.circle || '',
        isOnline: !!work.isOnline,
      }
      await toggleFavorite(work.id, workInfo)
    },
    [toggleFavorite],
  )

  const handleToggleFavoritesFilter = useCallback(() => {
    setShowOnlyFavorites(prev => !prev)
  }, [setShowOnlyFavorites])

  // 书签相关处理
  const handleAddBookmark = useCallback(
    async (time) => {
      if (!playingWork || !currentAudio) return null
      const bookmark = {
        workId: playingWork.id,
        workTitle: playingWork.title || playingWork.folderName || '',
        audioPath: currentAudio.path,
        audioName: currentAudio.name || '',
        time,
        name: `书签 ${formatTime(time)}`,
        color: '#c96442',
      }
      return await addBookmark(bookmark)
    },
    [playingWork, currentAudio, addBookmark],
  )

  const handleUpdateBookmark = useCallback(
    async (id, data) => {
      return await updateBookmark(id, data)
    },
    [updateBookmark],
  )

  const handleDeleteBookmark = useCallback(
    async (id) => {
      return await deleteBookmark(id)
    },
    [deleteBookmark],
  )

  // ===== 在线作品 Hook =====
  const {
    handleSelectOnlineWork,
    handleReloadOnlineTracks,
    extractAudiosFromTracks,
  } = useOnlineWork({
    showToast,
    setSelectedWork,
    setAudioFiles,
    setCurrentAudio,
    setCurrentCues,
    setCurrentTime,
    setDuration,
    setAllSubtitleFiles,
    setSubtitleOptions,
    setSelectedSubtitleIndex,
  })

  // ===== 元数据编辑与刷新 Hook =====
  const {
    handleEditMetadata,
    handleRefreshMetadata,
  } = useWorkMetadata({
    selectedWork,
    setSelectedWork,
    setWorks,
    showToast,
  })

  // ===== 沉浸式模式 Hook =====
  const {
    isImmersive,
    setIsImmersive,
    immersiveLyricRef,
    handleCloseImmersive,
    handleToggleImmersive,
  } = useImmersive()

  // 加载作品
  useEffect(() => {
    loadWorks()
  }, [])

  // ===== 启动恢复播放 =====
  const restorePlayOnStart = useCallback(async () => {
    if (!settings?.restorePlayOnStart) return
    try {
      const lastState = await window.electronAPI?.lastPlayStateGet?.()
      if (!lastState || !lastState.workId) return
      const work = works.find(w => w.id === lastState.workId)
      if (!work) return
      setSelectedWork(work)
      pendingAutoPlayRef.current = { startedAt: Date.now(), audioPath: lastState.audioPath }
    } catch (e) {
      console.error('Failed to restore play state:', e)
    }
  }, [settings?.restorePlayOnStart, works, setSelectedWork, pendingAutoPlayRef])

  useEffect(() => {
    if (!settings?.restorePlayOnStart) return
    if (!works || works.length === 0) return
    const timer = setTimeout(() => {
      restorePlayOnStart()
    }, 800)
    return () => clearTimeout(timer)
  }, [works, settings?.restorePlayOnStart, restorePlayOnStart])

  // ===== 继续听（最近未听完的音频） =====
  const [lastPlayedAudio, setLastPlayedAudio] = useState(null)

  const loadLastPlayedAudio = useCallback(async () => {
    try {
      const result = await window.electronAPI.dbGetLastPlayedAudio()
      setLastPlayedAudio(result)
    } catch (e) {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    loadLastPlayedAudio()
  }, [loadLastPlayedAudio])

  // ===== 下载完成通知与自动导入 Hook =====
  useDownloadImport({
    showToast,
    autoImportDownloaded: settings.autoImportDownloaded,
    works,
    loadWorks,
  })

  // ===== 主题与缩放 Hook =====
  useTheme({
    settings,
    setSettings,
    setShowLyric,
    showToast,
  })

  // 监听 audioFiles 加载完成后自动播放（最近播放 / 继续听）
  useEffect(() => {
    if (!pendingAutoPlayRef?.current || !audioFiles.length) return

    const pending = pendingAutoPlayRef.current
    const timeout = Date.now() - pending.startedAt > 10000
    if (timeout) {
      pendingAutoPlayRef.current = null
      return
    }

    let targetAudio = null
    if (pending.audioPath) {
      targetAudio = audioFiles.find(a => a.path === pending.audioPath)
    }
    if (!targetAudio && audioFiles.length > 0) {
      targetAudio = audioFiles[0]
    }

    if (targetAudio) {
      pendingAutoPlayRef.current = null
      handleSelectAudio(targetAudio)
    }
  }, [audioFiles, handleSelectAudio, pendingAutoPlayRef])

  // 监听 audioFiles 加载完成后继续听
  useEffect(() => {
    if (!pendingContinueRef?.current || !audioFiles.length) return

    const pending = pendingContinueRef.current
    const timeout = Date.now() - pending.startedAt > 10000
    if (timeout) {
      pendingContinueRef.current = null
      return
    }

    let targetAudio = null
    if (pending.audioFile) {
      targetAudio = audioFiles.find(a => a.path === pending.audioFile || a.name === pending.audioFile)
    }
    if (!targetAudio && audioFiles.length > 0) {
      targetAudio = audioFiles[0]
    }

    if (targetAudio) {
      pendingContinueRef.current = null
      handleSelectAudio(targetAudio)
    }
  }, [audioFiles, handleSelectAudio, pendingContinueRef])

  const handlePlayerCoverClickWrapped = useCallback(() => {
    handlePlayerCoverClick({
      playingWork,
      onToggleImmersive: handleToggleImmersive,
    })
  }, [playingWork, handleToggleImmersive, handlePlayerCoverClick])

  // ===== 快捷键 Hook =====
  useKeyboardShortcuts({
    settings,
    playerRef,
    isImmersive,
    setIsImmersive,
    showGlobalSearch,
    setShowGlobalSearch,
    showSettingsModal,
    setShowSettingsModal,
    showDownloadModal,
    setShowDownloadModal,
    showQueuePanel,
    setShowQueuePanel,
    currentAudio,
    handlePrevAudio,
    handleNextAudio,
  })

  // ===== 字幕刷新 Hook =====
  const {
    handleRefreshSubtitles,
  } = useSubtitleRefresh({
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
  })

  // ===== 播放列表播放 Hook =====
  const {
    addToPlaylistTarget,
    handleOpenAddToPlaylist,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
  } = usePlaylistPlayback({
    works,
    showToast,
    handleSelectAudio,
    setCurrentView,
    setSelectedWork,
    latestAudioFilesRef,
  })

  const handleOpenAddToPlaylistForAudio = useCallback((audio) => {
    handleOpenAddToPlaylist(audio, selectedWork)
  }, [handleOpenAddToPlaylist, selectedWork])

  // 发现页筛选回调
  const handleFilterCVInDiscover = useCallback((cv) => {
    if (cv && discoverViewRef.current) {
      discoverViewRef.current.toggleVa(cv)
    }
  }, [])

  const handleFilterTagInDiscover = useCallback((tag) => {
    if (tag && discoverViewRef.current) {
      discoverViewRef.current.toggleTag(tag)
    }
  }, [])

  const handleCircleClickInDiscover = useCallback((circle) => {
    if (circle && discoverViewRef.current) {
      discoverViewRef.current.toggleCircle(circle)
    }
  }, [])

  // ===== 系统托盘集成 =====
  const isPlayingRef = useRef(false)

  useEffect(() => {
    if (!window.electronAPI?.onTrayTogglePlay) return

    const cleanupToggle = window.electronAPI.onTrayTogglePlay(() => {
      if (playerRef.current) {
        playerRef.current.playPause?.()
      }
    })

    const cleanupPrev = window.electronAPI.onTrayPrevTrack(() => {
      handlePrevAudio()
    })

    const cleanupNext = window.electronAPI.onTrayNextTrack(() => {
      handleNextAudio()
    })

    return () => {
      cleanupToggle?.()
      cleanupPrev?.()
      cleanupNext?.()
    }
  }, [handlePrevAudio, handleNextAudio])

  useEffect(() => {
    if (!window.electronAPI?.trayUpdatePlayState) return

    const updateTrayState = () => {
      const isPlaying = playerRef.current?.isPlaying?.() || false
      const title = currentAudio?.name || ''
      if (isPlaying !== isPlayingRef.current || title !== isPlayingRef.currentTitle) {
        isPlayingRef.current = isPlaying
        isPlayingRef.currentTitle = title
        window.electronAPI.trayUpdatePlayState(isPlaying, title)
      }
    }

    const timer = setInterval(updateTrayState, 1000)
    updateTrayState()

    return () => clearInterval(timer)
  }, [currentAudio])

  // ===== 迷你播放器集成 =====
  const miniPlayerStateRef = useRef({
    isPlaying: false,
    title: '',
    cover: '',
    currentTime: 0,
    duration: 0,
    workTitle: '',
  })

  useEffect(() => {
    if (!window.electronAPI?.onMiniPlayerTogglePlay) return

    const cleanupToggle = window.electronAPI.onMiniPlayerTogglePlay(() => {
      if (playerRef.current) {
        playerRef.current.playPause?.()
      }
    })

    const cleanupPrev = window.electronAPI.onMiniPlayerPrevTrack(() => {
      handlePrevAudio()
    })

    const cleanupNext = window.electronAPI.onMiniPlayerNextTrack(() => {
      handleNextAudio()
    })

    return () => {
      cleanupToggle?.()
      cleanupPrev?.()
      cleanupNext?.()
    }
  }, [handlePrevAudio, handleNextAudio])

  useEffect(() => {
    if (!window.electronAPI?.miniPlayerUpdateState) return

    const updateMiniPlayerState = () => {
      const isPlaying = playerRef.current?.isPlaying?.() || false
      const title = currentAudio?.name || ''
      const cover = selectedWork?.cover || ''
      const currentTime = playerRef.current?.getCurrentTime?.() || 0
      const duration = playerRef.current?.getDuration?.() || 0
      const workTitle = selectedWork?.title || ''

      const prev = miniPlayerStateRef.current
      if (
        isPlaying !== prev.isPlaying ||
        title !== prev.title ||
        cover !== prev.cover ||
        Math.abs(currentTime - prev.currentTime) > 0.5 ||
        duration !== prev.duration ||
        workTitle !== prev.workTitle
      ) {
        miniPlayerStateRef.current = {
          isPlaying,
          title,
          cover,
          currentTime,
          duration,
          workTitle,
        }
        window.electronAPI.miniPlayerUpdateState(miniPlayerStateRef.current)
      }
    }

    const timer = setInterval(updateMiniPlayerState, 500)
    updateMiniPlayerState()

    return () => clearInterval(timer)
  }, [currentAudio, selectedWork])

  // ===== 系统媒体集成 =====
  const mediaSessionStateRef = useRef({
    title: '',
    artist: '',
    album: '',
    artwork: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  })
  const lastNotifiedAudioRef = useRef('')

  const updateMediaSession = useCallback(() => {
    if (!settings.enableMediaSession) return
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return

    const title = currentAudio?.name || ''
    const artist = selectedWork?.circle || ''
    const album = selectedWork?.title || ''
    const artwork = selectedWork?.cover || ''
    const isPlaying = playerRef.current?.isPlaying?.() || false
    const currentTime = playerRef.current?.getCurrentTime?.() || 0
    const duration = playerRef.current?.getDuration?.() || 0

    const prev = mediaSessionStateRef.current
    if (
      title === prev.title &&
      artist === prev.artist &&
      album === prev.album &&
      artwork === prev.artwork &&
      isPlaying === prev.isPlaying &&
      Math.abs(currentTime - prev.currentTime) < 1 &&
      duration === prev.duration
    ) {
      return
    }

    mediaSessionStateRef.current = {
      title,
      artist,
      album,
      artwork,
      isPlaying,
      currentTime,
      duration,
    }

    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || '聆音',
          artist: artist || '未知社团',
          album: album || '',
          artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : [],
        })

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

        if (duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: playerRef.current?.getPlaybackRate?.() || 1,
            position: currentTime,
          })
        }
      }
    } catch (e) {
      // 静默失败
    }
  }, [currentAudio, selectedWork, settings.enableMediaSession])

  useEffect(() => {
    if (!settings.enableMediaSession) return
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return

    const handlePlay = () => {
      if (playerRef.current) {
        playerRef.current.playPause?.()
      }
    }

    const handlePause = () => {
      if (playerRef.current) {
        playerRef.current.playPause?.()
      }
    }

    const handleNextTrack = () => {
      handleNextAudio()
    }

    const handlePrevTrack = () => {
      handlePrevAudio()
    }

    const handleSeekBackward = (details) => {
      if (playerRef.current) {
        const skipSeconds = details.seekOffset || 5
        playerRef.current.skipBackward?.(skipSeconds)
      }
    }

    const handleSeekForward = (details) => {
      if (playerRef.current) {
        const skipSeconds = details.seekOffset || 5
        playerRef.current.skipForward?.(skipSeconds)
      }
    }

    const handleSeekTo = (details) => {
      if (playerRef.current && details.seekTime !== undefined) {
        playerRef.current.seekTo?.(details.seekTime)
      }
    }

    try {
      navigator.mediaSession.setActionHandler('play', handlePlay)
      navigator.mediaSession.setActionHandler('pause', handlePause)
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack)
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack)
      navigator.mediaSession.setActionHandler('seekbackward', handleSeekBackward)
      navigator.mediaSession.setActionHandler('seekforward', handleSeekForward)
      navigator.mediaSession.setActionHandler('seekto', handleSeekTo)
    } catch (e) {
      // 部分浏览器/系统不支持所有 action
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      } catch (e) {}
    }
  }, [settings.enableMediaSession, handleNextAudio, handlePrevAudio])

  useEffect(() => {
    if (!settings.enableMediaSession) return

    const timer = setInterval(updateMediaSession, 1000)
    updateMediaSession()

    return () => clearInterval(timer)
  }, [updateMediaSession, settings.enableMediaSession])

  // ===== 全局媒体快捷键监听 =====
  useEffect(() => {
    if (!window.electronAPI?.onGlobalShortcutPlayPause) return

    const cleanupToggle = window.electronAPI.onGlobalShortcutPlayPause(() => {
      if (playerRef.current) {
        playerRef.current.playPause?.()
      }
    })

    const cleanupPrev = window.electronAPI.onGlobalShortcutPrevTrack(() => {
      handlePrevAudio()
    })

    const cleanupNext = window.electronAPI.onGlobalShortcutNextTrack(() => {
      handleNextAudio()
    })

    const cleanupStop = window.electronAPI.onGlobalShortcutStop(() => {
      if (playerRef.current) {
        playerRef.current.pause?.()
      }
    })

    return () => {
      cleanupToggle?.()
      cleanupPrev?.()
      cleanupNext?.()
      cleanupStop?.()
    }
  }, [handlePrevAudio, handleNextAudio])

  // ===== 曲目切换系统通知 =====
  useEffect(() => {
    if (!settings.trackChangeNotification) return
    if (!window.electronAPI?.notificationShow) return
    if (!currentAudio) return

    const audioKey = currentAudio.path || currentAudio.name
    if (lastNotifiedAudioRef.current === audioKey) return

    const isPlaying = playerRef.current?.isPlaying?.()
    if (!isPlaying) return

    lastNotifiedAudioRef.current = audioKey

    try {
      window.electronAPI.notificationShow({
        title: currentAudio.name || '正在播放',
        body: selectedWork?.title || selectedWork?.folderName || '',
        icon: selectedWork?.cover || '',
      })
    } catch (e) {
      // 静默失败
    }
  }, [currentAudio, selectedWork, settings.trackChangeNotification])

  // 全局搜索回调
  const handleGlobalSearchSelectWork = useCallback((work) => {
    setCurrentView('library')
    handleSelectWork(work)
  }, [handleSelectWork, setCurrentView])

  const handleGlobalSearchPlayAudio = useCallback((audio, work) => {
    if (work) {
      setCurrentView(work.isOnline ? 'discover' : 'library')
      if (work.isOnline) {
        handleSelectOnlineWork({ id: work.onlineId, title: work.title, mainCoverUrl: work.cover, name: work.circle, vas: (work.cvs || []).map(c => ({ name: c })), tags: (work.tags || []).map(t => ({ name: t })) })
      } else {
        handleSelectWork(work)
      }
    }
  }, [handleSelectOnlineWork, handleSelectWork, setCurrentView])

  const handleGlobalSearchSelectPlaylist = useCallback((playlist) => {
    setCurrentView('playlist')
    setShowGlobalSearch(false)
  }, [setCurrentView, setShowGlobalSearch])

  const handleGlobalSearchSelectOnlineWork = useCallback((work) => {
    setCurrentView('discover')
    setShowGlobalSearch(false)
    if (handleSelectOnlineWork && work?.id) {
      handleSelectOnlineWork(work)
    }
  }, [handleSelectOnlineWork, setCurrentView, setShowGlobalSearch])

  return {
    // Refs
    playerRef,
    discoverViewRef,
    contentAreaRef,

    // Toast
    toasts,
    showToast,
    removeToast,

    // 设置
    settings,
    setSettings,
    viewMode,
    showLyric,
    setShowLyric,
    handleSaveSettings,
    handleViewModeChange,
    handlePlaybackRateChange,

    // 视图导航
    selectedWork,
    setSelectedWork,
    currentView,
    setCurrentView,
    rightTab,
    setRightTab,
    showSettingsModal,
    setShowSettingsModal,
    showDownloadModal,
    setShowDownloadModal,
    showGlobalSearch,
    setShowGlobalSearch,
    settingsDefaultTab,
    handleOpenSettings,
    handleOpenSubtitleSettings,
    handleSelectWork,
    handleRecentPlayAutoPlay,
    handleContinueListen,
    lastPlayedAudio,
    loadLastPlayedAudio,

    // 右侧面板拖拽
    rightPanelWidth,
    setRightPanelWidth,
    isDraggingSplitter,
    handleSplitterMouseDown,

    // 媒体库
    works,
    isLoadingWorks,
    setWorks,
    audioFiles,
    setAudioFiles,
    allSubtitleFiles,
    setAllSubtitleFiles,
    handleAddFolder,
    handleAddMediaLibrary,
    handleAddFoldersByPath,
    handleDeleteWork,

    // 收藏
    favoriteIds,
    showOnlyFavorites,
    setShowOnlyFavorites,
    handleToggleFavorite,
    isFavorite,
    handleToggleFavoritesFilter,

    // 书签
    bookmarks,
    loadingBookmarks,
    addBookmark: handleAddBookmark,
    updateBookmark: handleUpdateBookmark,
    deleteBookmark: handleDeleteBookmark,
    hasBookmarkAtTime,

    // 文件夹分组
    folderGroups,
    activeGroupId,
    setActiveGroupId,
    groupWorkCounts,
    createGroup,
    renameGroup,
    deleteGroup,
    setWorkGroup,

    // 筛选
    cvFilter,
    circleFilter,
    tagFilter,
    allCVs,
    allCircles,
    filteredWorks,
    handleFilterChange,

    // 翻译
    translateCacheRef,
    translateVersion,
    setTranslateVersion,
    handleTranslate,
    handleTranslateBatch,
    getTranslatedText,
    isTranslated,
    isTranslating,
    isAnyTranslating,
    handleToggleTranslate,
    hasTranslation,

    // 播放队列
    playQueue,
    queueIndex,
    loopMode,
    shuffle,
    showQueuePanel,
    handlePlayFromQueue,
    handleAddToQueue,
    handlePlayNext,
    handleRemoveFromQueue,
    handleClearQueue,
    handleReorderQueue,
    handleToggleLoopMode,
    handleToggleShuffle,
    handleToggleQueuePanel,

    // 睡眠定时器
    sleepTimerMode,
    sleepTimerActive,
    sleepTimerFading,
    sleepTimerRemaining,
    sleepTimerFadeEnabled,
    setSleepTimerFadeEnabled,
    handleSetCountdownTimer,
    handleSetTrackEndTimer,
    handleSetTimePointTimer,
    handleCancelSleepTimer,
    handleSleepTimerTrackFinish,
    formatSleepTimerRemaining,
    getSleepTimerStatusText,
    SLEEP_TIMER_OPTIONS,
    SLEEP_TIMER_MODES,
    SLEEP_TIMER_PRESETS,

    // 字幕
    subtitleOptions,
    selectedSubtitleIndex,
    handleSelectSubtitle,
    handleAddSubtitleFile,

    // 播放控制
    playingWork,
    currentAudio,
    currentCues,
    currentTime,
    duration,
    handleSelectAudio,
    handleTimeUpdate,
    handleReady,
    handleSeek,
    handlePrevAudio,
    handleNextAudio,
    handleFinish: handleFinishWithContinuousPlay,
    durationRef,

    // 在线作品
    handleSelectOnlineWork,
    handleReloadOnlineTracks,

    // 元数据
    handleEditMetadata,
    handleRefreshMetadata,

    // 沉浸式
    isImmersive,
    setIsImmersive,
    immersiveLyricRef,
    handleCloseImmersive,
    handleToggleImmersive,
    handlePlayerCoverClickWrapped,

    // 字幕刷新
    handleRefreshSubtitles,

    // 播放列表
    addToPlaylistTarget,
    handleOpenAddToPlaylist,
    handleCloseAddToPlaylist,
    handlePlayPlaylistItem,
    handleNavigateToWorkFromPlaylist,
    handleOpenAddToPlaylistForAudio,

    // 发现页筛选
    handleFilterCVInDiscover,
    handleFilterTagInDiscover,
    handleCircleClickInDiscover,

    // 全局搜索
    handleGlobalSearchSelectWork,
    handleGlobalSearchPlayAudio,
    handleGlobalSearchSelectPlaylist,
    handleGlobalSearchSelectOnlineWork,
  }
}
