import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatTime } from '../utils/subtitleParser'
import { useTranslate } from './useTranslate'
import { usePlayQueue } from './usePlayQueue'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSubtitle } from './useSubtitle'
import { useMediaLibrary } from './useMediaLibrary'
import { useAudioIndex } from './useAudioIndex'
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
import { useBulkSelection } from './useBulkSelection'
import { useSystemIntegration } from './useSystemIntegration'
import { useWorkGallery } from './useWorkGallery'
import { useChapters } from './useChapters'
import { useTingleHeatmap } from './useTingleHeatmap'
import { useVoiceChronicle } from './useVoiceChronicle'
import { useVoiceScript } from './useVoiceScript'
import { useSeiyuuProfile } from './useSeiyuuProfile'
import { useTrackVariants } from './useTrackVariants'
import { useSoundscape } from './useSoundscape'
import { detectWorkScenery } from '../utils/soundscapeAnalyzer'

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
    updateSettings,
    handleViewModeChange,
    handlePlaybackRateChange,
    handleLibrarySortChange,
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

  const handleContinueListen = useCallback(
    (item) => {
      _handleContinueListen(item, works)
    },
    [_handleContinueListen, works],
  )

  // ===== 音频索引回填（智能播放列表 / 曲目搜索依赖）=====
  useAudioIndex({ works, isLoadingWorks, setWorks, showToast })

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
    tagFilterMode,
    setTagFilterMode,
    allCVs,
    allCircles,
    allTags,
    filteredWorks: filterByTagWorks,
    handleFilterChange,
    handleClearFilter,
    handleToggleTagFilter,
  } = useFilters(groupFilteredWorks)

  const filteredWorks = useMemo(() => {
    const works = filterFavorites(filterByTagWorks)
    const sortBy = settings?.librarySortBy || 'createdAt'
    const sortOrder = settings?.librarySortOrder || 'desc'

    const sorted = [...works]
    sorted.sort((a, b) => {
      let valA, valB
      switch (sortBy) {
        case 'title':
          valA = (a.title || a.folderName || '').toLowerCase()
          valB = (b.title || b.folderName || '').toLowerCase()
          break
        case 'createdAt':
          valA = a.createdAt || 0
          valB = b.createdAt || 0
          break
        case 'updatedAt':
          valA = a.updatedAt || 0
          valB = b.updatedAt || 0
          break
        case 'duration':
          valA = a.totalDuration || 0
          valB = b.totalDuration || 0
          break
        case 'rating':
          valA = a.rating || 0
          valB = b.rating || 0
          break
        case 'release':
          valA = a.releaseDate || a.createdAt || 0
          valB = b.releaseDate || b.createdAt || 0
          break
        default:
          valA = a.createdAt || 0
          valB = b.createdAt || 0
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB, 'zh-CN')
          : valB.localeCompare(valA, 'zh-CN')
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return sorted
  }, [filterByTagWorks, filterFavorites, settings?.librarySortBy, settings?.librarySortOrder])

  // ===== 声景心境全景漫游透镜 Hook =====
  const {
    presets: soundscapePresets,
    activeSceneryId,
    activePreset: activeSceneryPreset,
    handleSelectScenery,
    handleClearScenery,
    sceneryCounts,
    sceneryFilteredWorks,
  } = useSoundscape(filteredWorks)

  // ===== 批量选择 Hook =====
  const {
    bulkMode,
    setBulkMode,
    toggleBulkMode,
    selectedIds: bulkSelectedIds,
    selectedCount: bulkSelectedCount,
    allSelected: bulkAllSelected,
    someSelected: bulkSomeSelected,
    toggleSelect: toggleBulkSelect,
    selectAll: selectAllBulk,
    clearSelection: clearBulkSelection,
    toggleSelectAll: toggleSelectAllBulk,
    getSelectedWorks: getBulkSelectedWorks,
    handleBulkFavorite,
    handleBulkDelete,
    handleBulkMoveToGroup,
  } = useBulkSelection({
    works: sceneryFilteredWorks,
    onToggleFavorite: toggleFavorite,
    onDeleteWork: mediaLibraryDeleteWork,
    onSetWorkGroup: setWorkGroup,
    showToast,
  })

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
    shuffle,
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
    updateSettings,
  })


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
    handleSelectSubtitle: rawHandleSelectSubtitle,
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

  const currentWorkScenery = useMemo(() => {
    const target = playingWork || selectedWork
    if (!target) return null
    return detectWorkScenery(target)
  }, [playingWork, selectedWork])

  // ===== 作品画集管理 Hook =====
  const {
    galleryImages,
    isLoading: loadingGallery,
    lightboxIndex,
    isLightboxOpen,
    currentLightboxImage,
    openLightbox,
    closeLightbox,
    nextImage: nextLightboxImage,
    prevImage: prevLightboxImage,
    setLightboxIndex,
  } = useWorkGallery({
    work: selectedWork || playingWork,
    onToast: showToast,
  })

  // ===== 剧情章节分段 Hook =====
  const {
    chapters,
    activeChapter,
    hasChapters,
    seekToChapter,
    addCustomChapter,
    deleteCustomChapter,
  } = useChapters({
    work: playingWork || selectedWork,
    currentAudio,
    currentTime,
    duration,
    playerRef,
    onToast: showToast,
  })

  // ===== ASMR 酥麻声能热力流与高能峰值 Hook =====
  const {
    heatmapData,
    peakMoments,
    currentIntensity: currentTingleIntensity,
    isAnalyzing: isAnalyzingHeatmap,
    syncCurrentIntensity,
    jumpNextPeak,
    jumpPrevPeak,
  } = useTingleHeatmap({
    audioPath: currentAudio?.path,
    duration,
    playerRef,
    onToast: showToast,
  })

  // 同步瞬时酥麻强度
  useEffect(() => {
    syncCurrentIntensity(currentTime)
  }, [currentTime, syncCurrentIntensity])

  // ===== 声之手账档案与感官心动印记 Hook =====
  const {
    chronicleData,
    stamps,
    currentAudioStamps,
    updateChronicle,
    addStamp,
    deleteStamp,
    seekToStamp,
    isStampModalOpen,
    openStampModal,
    closeStampModal,
    isPosterModalOpen,
    openPosterModal,
    closePosterModal,
  } = useVoiceChronicle({
    work: playingWork || selectedWork,
    currentAudio,
    currentTime,
    playerRef,
    onToast: showToast,
  })

  const handleToggleChronicleTab = useCallback(() => {
    setRightTab((prev) => (prev === 'chronicle' ? 'details' : 'chronicle'))
  }, [setRightTab])

  // ===== 音声台本与剧本随行 Hook =====
  const {
    scriptFiles,
    selectedScriptPath,
    setSelectedScriptPath,
    rawText: rawScriptText,
    scriptLines,
    loadingScript,
    theaterMode,
    setTheaterMode,
    autoCruise,
    setAutoCruise,
    fontSize: scriptFontSize,
    setFontSize: setScriptFontSize,
    activeLineIndex: activeScriptLineIndex,
    isUserScrolling: isUserScrollingScript,
    handleUserScroll: handleUserScrollScript,
    handleResumeSync: handleResumeScriptSync,
    handleImportScriptFile,
    handleQuoteToStamp,
    handleCopyLine: handleCopyScriptLine,
  } = useVoiceScript({
    work: playingWork || selectedWork,
    currentAudio,
    currentTime,
    duration,
    cues: currentCues,
    onToast: showToast,
    onOpenStampModal: openStampModal,
  })

  const handleToggleScriptTab = useCallback(() => {
    setRightTab((prev) => (prev === 'script' ? 'details' : 'script'))
  }, [setRightTab])

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

  // ===== 双耳声场状态 =====
  const [currentAudioElement, setCurrentAudioElement] = useState(null)

  useEffect(() => {
    const el = playerRef.current?.getAudioElement?.()
    if (el && el !== currentAudioElement) {
      setCurrentAudioElement(el)
    }
  }, [currentAudio, currentTime, playerRef, currentAudioElement])

  const handleToggleCompassTab = useCallback(() => {
    if (selectedWork || playingWork) {
      if (!selectedWork && playingWork) {
        setSelectedWork(playingWork)
      }
      setRightTab('compass')
    } else {
      showToast?.('请先选择或播放一部作品', 'info')
    }
  }, [selectedWork, playingWork, setSelectedWork, setRightTab, showToast])

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

  // 包装手动字幕切换：原始版本只更新选中索引并返回 cues，
  // 这里补上 setCurrentCues 与自动翻译触发，与切歌时的字幕加载行为保持一致
  const handleSelectSubtitle = useCallback(async (index) => {
    const result = await rawHandleSelectSubtitle(index)
    if (!result) return
    if (result.clearSubtitle) {
      setCurrentCues([])
      return
    }
    if (result.cues) {
      handleAutoTranslate(result.cues, result.sub, setCurrentCues)
      setCurrentCues(result.cues)
    }
  }, [rawHandleSelectSubtitle, handleAutoTranslate, setCurrentCues])

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
  }, [loadWorks])

  // 启动静默同步媒体库增量变化
  useEffect(() => {
    if (settings?.autoSyncLibraryOnStart === false) return
    const timer = setTimeout(async () => {
      try {
        const res = await window.electronAPI?.mediaSyncLibrary?.()
        if (res && (res.updatedCount > 0 || res.missingCount > 0)) {
          loadWorks()
        }
      } catch (err) {
        console.warn('启动自动同步媒体库跳过或失败:', err)
      }
    }, 4500)
    return () => clearTimeout(timer)
  }, [settings?.autoSyncLibraryOnStart, loadWorks])

  // 当媒体库列表更新时，若当前选中的本地作品在 works 中有更新，联动同步最新作品属性（如封面、CV、标签、曲目数）
  useEffect(() => {
    if (!selectedWork || selectedWork.isOnline) return
    const updated = works.find((w) => w.id === selectedWork.id)
    if (!updated || updated === selectedWork) return

    const hasMetaChanged =
      updated.cover !== selectedWork.cover ||
      updated.title !== selectedWork.title ||
      updated.circle !== selectedWork.circle ||
      updated.audioCount !== selectedWork.audioCount ||
      updated.pathMissing !== selectedWork.pathMissing ||
      updated.rjCode !== selectedWork.rjCode ||
      updated.updatedAt !== selectedWork.updatedAt ||
      JSON.stringify(updated.cvs || []) !== JSON.stringify(selectedWork.cvs || []) ||
      JSON.stringify(updated.tags || []) !== JSON.stringify(selectedWork.tags || [])

    if (hasMetaChanged) {
      setSelectedWork(updated)
    }
  }, [works, selectedWork, setSelectedWork])

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
    handlePlayPlaylist,
    handleAddPlaylistToQueue,
  } = usePlaylistPlayback({
    works,
    showToast,
    handleSelectAudio,
    setCurrentView,
    setSelectedWork,
    latestAudioFilesRef,
    buildQueueItem,
    playQueue,
    setPlayQueue,
    playFromQueue: handlePlayFromQueue,
  })

  const handleOpenAddToPlaylistForAudio = useCallback((audio) => {
    handleOpenAddToPlaylist(audio, selectedWork)
  }, [handleOpenAddToPlaylist, selectedWork])

  // 筛选指定 CV 快捷函数
  const handleFilterCV = useCallback((cv) => {
    handleFilterChange('cv', cv)
  }, [handleFilterChange])

  // ===== 声优宇宙星盘 Hook =====
  const {
    isOpen: isSeiyuuProfileOpen,
    activeCV: activeSeiyuuCV,
    profileData: seiyuuProfileData,
    openSeiyuuProfile,
    closeSeiyuuProfile,
    handleStartRadio: handleStartSeiyuuRadio,
    handleFilterThisCV,
  } = useSeiyuuProfile({
    allWorks: works,
    stamps,
    onPlayPlaylist: handlePlayPlaylist,
    onFilterCV: handleFilterCV,
    onToast: showToast,
  })

  // ===== 声态异构 · 音轨同态变体与无缝热切 Hook =====
  const {
    variantAnalysis,
    hasVariants: hasTrackVariants,
    currentVariant: currentTrackVariant,
    siblingVariants: siblingTrackVariants,
    collapseVariants,
    toggleCollapseVariants,
    handleHotSwapVariant,
    isComparisonOpen: isVariantCompareOpen,
    comparisonTarget: variantCompareTarget,
    comparisonSummary: variantCompareSummary,
    openComparisonModal: openVariantCompareModal,
    closeComparisonModal: closeVariantCompareModal,
  } = useTrackVariants({
    audioFiles,
    currentAudio,
    currentTime,
    playerRef,
    onSelectAudio: handleSelectAudio,
    onToast: showToast,
  })

  const handleCycleNextVariant = useCallback(() => {
    if (siblingTrackVariants.length > 0) {
      handleHotSwapVariant(siblingTrackVariants[0])
    } else {
      showToast?.({
        type: 'info',
        message: '当前音频暂无其他同态变体（如BGM/麦克风版本）',
      })
    }
  }, [siblingTrackVariants, handleHotSwapVariant, showToast])

  // ===== 枕畔微光 · 床头夜钟助眠座舱 Hook =====
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
    onPlaybackRateChange: handlePlaybackRateChange,
    onToggleCompass: handleToggleCompassTab,
    onToggleChronicle: handleToggleChronicleTab,
    onJumpNextPeak: jumpNextPeak,
    onOpenStampModal: openStampModal,
    onToggleScript: handleToggleScriptTab,
    onHotSwapVariant: handleCycleNextVariant,
  })

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

  // ===== 系统集成 Hook（托盘、迷你播放器、媒体会话、全局快捷键）=====
  useSystemIntegration({
    playerRef,
    settings,
    currentAudio,
    selectedWork,
    handlePrevAudio,
    handleNextAudio,
  })

  // 全局搜索回调
  const handleGlobalSearchSelectWork = useCallback((work) => {
    setCurrentView('library')
    handleSelectWork(work)
  }, [handleSelectWork, setCurrentView])

  const handleGlobalSearchPlayAudio = useCallback((audio, work) => {
    if (work?.isOnline) {
      setCurrentView('discover')
      handleSelectOnlineWork({ id: work.onlineId, title: work.title, mainCoverUrl: work.cover, name: work.circle, vas: (work.cvs || []).map(c => ({ name: c })), tags: (work.tags || []).map(t => ({ name: t })) })
      return
    }
    if (!work) return

    setCurrentView('library')

    // 目标曲目已在当前作品的扫描结果里：直接播放，避免重复扫描等待
    const target = audio?.path ? audioFiles.find((a) => a.path === audio.path) : null
    if (target) {
      handleSelectAudio(target)
      return
    }

    // 跨作品：登记待播放曲目，等作品扫描完成后由自动播放 effect 接管
    if (audio?.path) {
      pendingAutoPlayRef.current = { audioPath: audio.path, startedAt: Date.now() }
    }
    handleSelectWork(work)
  }, [audioFiles, handleSelectAudio, handleSelectWork, handleSelectOnlineWork, pendingAutoPlayRef, setCurrentView])

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
    loadWorks,
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

    // 批量选择
    bulkMode,
    setBulkMode,
    toggleBulkMode,
    bulkSelectedIds,
    bulkSelectedCount,
    bulkAllSelected,
    bulkSomeSelected,
    toggleBulkSelect,
    selectAllBulk,
    clearBulkSelection,
    toggleSelectAllBulk,
    getBulkSelectedWorks,
    handleBulkFavorite,
    handleBulkDelete,
    handleBulkMoveToGroup,

    // 筛选
    cvFilter,
    circleFilter,
    tagFilter,
    tagFilterMode,
    setTagFilterMode,
    allCVs,
    allCircles,
    allTags,
    filteredWorks: sceneryFilteredWorks,
    rawFilteredWorks: filteredWorks,
    handleFilterChange,
    handleClearFilter,
    handleToggleTagFilter,

    // 排序
    librarySortBy: settings?.librarySortBy || 'createdAt',
    librarySortOrder: settings?.librarySortOrder || 'desc',
    handleLibrarySortChange,

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
    setShowQueuePanel,
    handlePlayFromQueue,
    handleAddToQueue,
    handlePlayNext,
    handleRemoveFromQueue,
    handleClearQueue,
    handleReorderQueue,
    handleToggleLoopMode,
    handleToggleShuffle,
    handleToggleQueuePanel,

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
    handlePlayPlaylist,
    handleAddPlaylistToQueue,
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

    // 作品画集
    galleryImages,
    loadingGallery,
    lightboxIndex,
    isLightboxOpen,
    currentLightboxImage,
    openLightbox,
    closeLightbox,
    nextLightboxImage,
    prevLightboxImage,
    setLightboxIndex,

    // 剧情章节
    chapters,
    activeChapter,
    hasChapters,
    seekToChapter,
    addCustomChapter,
    deleteCustomChapter,

    // 双耳声场
    handleToggleCompassTab,
    currentAudioElement,

    // 酥麻声能热力流与高能峰值
    heatmapData,
    peakMoments,
    currentTingleIntensity,
    isAnalyzingHeatmap,
    jumpNextPeak,
    jumpPrevPeak,

    // 声之手账与感官心动印记
    chronicleData,
    stamps,
    currentAudioStamps,
    updateChronicle,
    addStamp,
    deleteStamp,
    seekToStamp,
    isStampModalOpen,
    openStampModal,
    closeStampModal,
    isPosterModalOpen,
    openPosterModal,
    closePosterModal,
    handleToggleChronicleTab,

    // 音声台本与随行剧场
    scriptFiles,
    selectedScriptPath,
    setSelectedScriptPath,
    rawScriptText,
    scriptLines,
    loadingScript,
    theaterMode,
    setTheaterMode,
    autoCruise,
    setAutoCruise,
    scriptFontSize,
    setScriptFontSize,
    activeScriptLineIndex,
    isUserScrollingScript,
    handleUserScrollScript,
    handleResumeScriptSync,
    handleImportScriptFile,
    handleQuoteToStamp,
    handleCopyScriptLine,
    handleToggleScriptTab,

    // 声优宇宙星盘
    isSeiyuuProfileOpen,
    activeSeiyuuCV,
    seiyuuProfileData,
    openSeiyuuProfile,
    closeSeiyuuProfile,
    handleStartSeiyuuRadio,
    handleFilterThisCV,

    // 声态异构 · 音轨同态变体与无缝热切
    variantAnalysis,
    hasTrackVariants,
    currentTrackVariant,
    currentVariantInfo: currentTrackVariant,
    siblingTrackVariants,
    activeSiblingVariants: siblingTrackVariants,
    collapseVariants,
    toggleCollapseVariants,
    handleHotSwapVariant,
    handleCycleNextVariant,
    isVariantCompareOpen,
    isVariantModalOpen: isVariantCompareOpen,
    variantCompareTarget,
    variantCompareSummary,
    openVariantCompareModal,
    openVariantModal: openVariantCompareModal,
    closeVariantCompareModal,
    closeVariantModal: closeVariantCompareModal,

    // 声景心境全景漫游透镜
    soundscapePresets,
    activeSceneryId,
    activeScenery: activeSceneryId,
    activeSceneryPreset,
    sceneryCounts,
    currentWorkScenery,
    handleSelectScenery,
    setActiveScenery: handleSelectScenery,
    handleClearScenery,
    sceneryFilteredWorks,
  }
}
