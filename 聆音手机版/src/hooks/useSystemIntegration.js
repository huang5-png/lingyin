import { useEffect, useCallback, useRef } from 'react'

export function useSystemIntegration({
  playerRef,
  settings,
  currentAudio,
  selectedWork,
  handlePrevAudio,
  handleNextAudio,
}) {
  // ===== 系统托盘集成 =====
  const isPlayingRef = useRef(false)
  isPlayingRef.currentTitle = ''

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
  const lastNotifiedAudioRef = useRef('')

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
}