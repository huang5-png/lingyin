import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { formatTime } from '../utils/subtitleParser'
import { PLAYBACK_RATES } from '../utils/playback'
import QueuePanel from './QueuePanel'
import SpectrumVisualizer from './SpectrumVisualizer'
import './AudioPlayer.css'



function pathToFileURL(filePath) {
  if (!filePath) return ''
  let normalizedPath = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return 'file:///' + normalizedPath.split('/').map((part, i) => {
      if (i === 0) return part
      return encodeURIComponent(part)
    }).join('/')
  }
  if (normalizedPath.startsWith('/')) {
    return 'file://' + normalizedPath.split('/').map((part, i) => {
      if (i === 0) return ''
      return encodeURIComponent(part)
    }).join('/')
  }
  return 'file:///' + normalizedPath.split('/').map(encodeURIComponent).join('/')
}

const AudioPlayer = memo(forwardRef(function AudioPlayer(
  {
    audioPath, title, cover, onTimeUpdate, onReady, onFinish, workId,
    waveformHeight = 70, defaultVolume = 80, skipSeconds = 5,
    onPrev, onNext, onToggleImmersive, onToast,
    // 播放队列相关
    queue = [], queueIndex = -1, loopMode = 'none', shuffle = false, showQueuePanel = false,
    onToggleQueue, onToggleLoop, onToggleShuffle,
    onPlayFromQueue, onRemoveFromQueue, onClearQueue, onReorderQueue, onCloseQueuePanel,
    // 睡眠定时器相关
    sleepTimerMode, sleepTimerActive = false, sleepTimerFading = false,
    sleepTimerRemaining = 0, sleepTimerFadeEnabled = true, sleepTimerFadeSeconds = 30,
    onSetSleepTimerFadeEnabled, onSetSleepTimerFadeSeconds,
    onSetCountdownTimer, onSetTrackEndTimer, onSetTimePointTimer,
    onCancelSleepTimer, onSleepTimerTrackFinish,
    formatSleepTimerRemaining, getSleepTimerStatusText,
    sleepTimerOptions, sleepTimerModes, sleepTimerPresets, sleepTimerFadeOptions,
    // 播放速度相关
    playbackRate = 1, onPlaybackRateChange,
    // 书签相关
    onAddBookmark, hasCurrentBookmark = false, bookmarkCount = 0, onToggleBookmarksTab,
    // 频谱可视化相关
    showSpectrum = true,
    spectrumMode = 'bars',
    spectrumSensitivity = 1.5,
  },
  ref,
) {
  const waveformRef = useRef(null)
  const waveformContainerRef = useRef(null)
  const wavesurferRef = useRef(null)
  const audioElementRef = useRef(null)
  const [audioElementReady, setAudioElementReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(defaultVolume / 100)
  // 静音只影响实际输出音量，volume 始终保留静音前的记忆值，取消静音即可还原
  const [muted, setMuted] = useState(false)
  const effectiveVolume = muted ? 0 : volume
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipTime, setTooltipTime] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState(0)
  const volumeSliderRef = useRef(null)
  const [showSleepTimer, setShowSleepTimer] = useState(false)
  const [showPlaybackRate, setShowPlaybackRate] = useState(false)
  const [sleepTab, setSleepTab] = useState('countdown')
  const [customMinutes, setCustomMinutes] = useState('30')
  const [timePointInput, setTimePointInput] = useState('23:00')
  // A-B 片段循环：a/b 为秒数，enabled 表示已开始循环；按曲目维度使用，换曲自动清空
  const [abLoop, setAbLoop] = useState({ a: null, b: null, enabled: false })
  const abLoopRef = useRef(abLoop)

  useEffect(() => {
    abLoopRef.current = abLoop
  }, [abLoop])

  // 切换音频时清空 A-B 循环（区间只对当前曲目有意义）
  useEffect(() => {
    setAbLoop((prev) => (
      prev.a === null && prev.b === null && !prev.enabled
        ? prev
        : { a: null, b: null, enabled: false }
    ))
  }, [audioPath])

  // 过滤 wavesurfer.js 内部的 AbortError 未捕获 Promise rejection
  useEffect(() => {
    const handler = (e) => {
      if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('signal is aborted')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (useSimpleMode && simpleAudioRef.current && duration > 0) {
        simpleAudioRef.current.currentTime = Math.max(0, Math.min(time, duration))
      } else if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(time / duration)
      }
    },
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    playPause: () => {
      if (useSimpleMode && simpleAudioRef.current) {
        if (simpleAudioRef.current.paused) {
          simpleAudioRef.current.play()
        } else {
          simpleAudioRef.current.pause()
        }
      } else if (wavesurferRef.current) {
        wavesurferRef.current.playPause()
      }
    },
    pause: () => {
      if (useSimpleMode && simpleAudioRef.current) {
        if (!simpleAudioRef.current.paused) {
          simpleAudioRef.current.pause()
        }
      } else if (wavesurferRef.current) {
        if (wavesurferRef.current.isPlaying?.()) {
          wavesurferRef.current.pause()
        }
      }
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(1, v))
      setVolume(clamped)
      // 调到非零音量时自动解除静音，让快捷键/睡眠定时器恢复音量即可出声
      if (clamped > 0) setMuted(false)
      if (useSimpleMode && simpleAudioRef.current) {
        simpleAudioRef.current.volume = clamped
      } else if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(clamped)
      }
    },
    getVolume: () => volume,
    toggleMute: () => setMuted((prev) => !prev),
    setMuted: (v) => setMuted(!!v),
    getMuted: () => muted,
    skipBackward: (seconds) => {
      if (useSimpleMode && simpleAudioRef.current && currentTime > 0) {
        simpleAudioRef.current.currentTime = Math.max(0, simpleAudioRef.current.currentTime - (seconds || skipSeconds))
      } else if (wavesurferRef.current && currentTime > 0) {
        wavesurferRef.current.skip(-(seconds || skipSeconds))
      }
    },
    skipForward: (seconds) => {
      if (useSimpleMode && simpleAudioRef.current && currentTime < duration) {
        simpleAudioRef.current.currentTime = Math.min(duration, simpleAudioRef.current.currentTime + (seconds || skipSeconds))
      } else if (wavesurferRef.current && currentTime < duration) {
        wavesurferRef.current.skip(seconds || skipSeconds)
      }
    },
    setPlaybackRate: (rate) => {
      if (useSimpleMode && simpleAudioRef.current) {
        simpleAudioRef.current.playbackRate = rate
      } else if (wavesurferRef.current) {
        wavesurferRef.current.setPlaybackRate(rate)
      }
    },
    getPlaybackRate: () => playbackRate,
    isPlaying: () => isPlaying,
    getAudioElement: () => audioElementRef.current,
    // A-B 循环：供沉浸模式等外部调用
    cycleAbLoop: () => cycleAbLoop(),
    getAbLoop: () => abLoopRef.current,
  }))

  const handlePlayPause = () => {
    if (useSimpleMode && simpleAudioRef.current) {
      if (simpleAudioRef.current.paused) {
        simpleAudioRef.current.play()
      } else {
        simpleAudioRef.current.pause()
      }
    } else if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    // 拖动音量条到非零值即视为解除静音
    if (v > 0) setMuted(false)
    if (useSimpleMode && simpleAudioRef.current) {
      simpleAudioRef.current.volume = v
    } else if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(v)
    }
  }

  const skipBackward = () => {
    if (useSimpleMode && simpleAudioRef.current && currentTime > 0) {
      simpleAudioRef.current.currentTime = Math.max(0, simpleAudioRef.current.currentTime - skipSeconds)
    } else if (wavesurferRef.current && currentTime > 0) {
      wavesurferRef.current.skip(-skipSeconds)
    }
  }

  const skipForward = () => {
    if (useSimpleMode && simpleAudioRef.current && currentTime < duration) {
      simpleAudioRef.current.currentTime = Math.min(duration, simpleAudioRef.current.currentTime + skipSeconds)
    } else if (wavesurferRef.current && currentTime < duration) {
      wavesurferRef.current.skip(skipSeconds)
    }
  }

  const handleWaveformMouseMove = (e) => {
    if (!waveformContainerRef.current || !isReady || duration <= 0) return

    const rect = waveformContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const time = percentage * duration

    // 使用百分比定位，避免大窗口下像素偏差
    setTooltipPosition(percentage * 100)
    setTooltipTime(time)
    setShowTooltip(true)
  }

  const handleWaveformMouseLeave = () => {
    setShowTooltip(false)
  }

  const handleWaveformClick = (e) => {
    if (!isReady) return
    if (duration <= 0) return

    const container = waveformContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const clampedPercentage = Math.max(0, Math.min(1, percentage))

    if (useSimpleMode && simpleAudioRef.current) {
      simpleAudioRef.current.currentTime = clampedPercentage * duration
    } else if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(clampedPercentage)
    }
  }

  const [useSimpleMode, setUseSimpleMode] = useState(false)
  const simpleAudioRef = useRef(null)

  // 读取播放器当前真实时间（优先从底层媒体元素取，避免依赖节流后的 state）
  const getLiveTime = useCallback(() => {
    if (useSimpleMode && simpleAudioRef.current) {
      return simpleAudioRef.current.currentTime || 0
    }
    const ws = wavesurferRef.current
    if (ws && typeof ws.getCurrentTime === 'function') {
      return ws.getCurrentTime() || 0
    }
    return currentTime
  }, [useSimpleMode, currentTime])

  // A-B 循环三态切换：设置 A 点 → 设置 B 点并开启 → 关闭
  const cycleAbLoop = useCallback(() => {
    const cur = abLoopRef.current
    const t = getLiveTime()

    if (cur.enabled) {
      const next = { a: null, b: null, enabled: false }
      abLoopRef.current = next
      setAbLoop(next)
      onToast?.('A-B 循环已关闭', 'info')
      return
    }

    if (cur.a == null) {
      const next = { a: t, b: null, enabled: false }
      abLoopRef.current = next
      setAbLoop(next)
      onToast?.(`已设置 A 点：${formatTime(t)}，再次点击设置 B 点`, 'success')
      return
    }

    if (t <= cur.a + 0.3) {
      onToast?.('B 点需在 A 点之后', 'warning')
      return
    }

    const next = { a: cur.a, b: t, enabled: true }
    abLoopRef.current = next
    setAbLoop(next)
    // 立即跳回 A 点开始循环
    if (useSimpleMode && simpleAudioRef.current) {
      simpleAudioRef.current.currentTime = cur.a
    } else if (wavesurferRef.current && duration > 0) {
      wavesurferRef.current.seekTo(cur.a / duration)
    }
    setCurrentTime(cur.a)
    onToast?.(`A-B 循环已开启：${formatTime(cur.a)} - ${formatTime(t)}`, 'success')
  }, [getLiveTime, onToast, useSimpleMode, duration])

  const abLoopTitle = abLoop.enabled
    ? `A-B 循环中：${formatTime(abLoop.a)} - ${formatTime(abLoop.b)}，点击关闭`
    : abLoop.a != null
      ? `A 点 ${formatTime(abLoop.a)}，点击设置 B 点`
      : 'A-B 片段循环：点击设置 A 点'

  // 波形上的 A-B 区间高亮（未设置 B 点时预览到当前播放位置）
  const abRegion = (() => {
    if (abLoop.a == null || duration <= 0) return null
    const end = abLoop.b != null ? abLoop.b : Math.max(currentTime, abLoop.a)
    const startPct = Math.max(0, Math.min(100, (abLoop.a / duration) * 100))
    const widthPct = Math.max(0, Math.min(100 - startPct, ((end - abLoop.a) / duration) * 100))
    return { startPct, widthPct, hasB: abLoop.b != null }
  })()

  useEffect(() => {
    let cancelled = false

    function loadAudio() {
      if (!audioPath) {
        return
      }

      const fileUrl = audioPath.startsWith('http') ? audioPath : pathToFileURL(audioPath)
      const isWav = /\.wav$/i.test(audioPath)
      const isOnline = audioPath.startsWith('http')

      // waveformRef 可能因为 useSimpleMode=true 而不在 DOM 中
      // 简单模式不需要 waveformRef，直接 fallbackToSimpleMode
      // 在线音频也强制走简单模式：WaveSurfer 会单独 fetch 音频 URL，容易被 CDN 403 拒绝
      // 简单模式用 <audio> 元素直接播放（走 session 拦截器注入 Referer），后再异步生成波形
      if (!waveformRef.current || isOnline) {
        fallbackToSimpleMode()
        return
      }

      setIsReady(false)
      setAudioElementReady(false)
      setCurrentTime(0)
      setDuration(0)
      setError(null)
      setIsLoading(true)
      setUseSimpleMode(false)

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }

      function fallbackToSimpleMode() {
        if (cancelled) return
        setUseSimpleMode(true)
        setIsLoading(false)

        const audio = new Audio()
        audio.preload = 'auto'
        audio.volume = effectiveVolume

        const handleLoadedMetadata = () => {
          if (cancelled) return
          if (audio.duration && audio.duration !== Infinity) {
            setDuration(audio.duration)
          }
          setIsReady(true)
        }
        const handleCanPlay = () => {
          if (cancelled) return
          setIsReady(true)
          audio.play().catch((e) => {
            console.warn('播放失败:', e.message, audioPath)
          })
        }
        const handleTimeUpdate = () => {
          if (cancelled) return
          // A-B 循环：到达 B 点立即回到 A 点
          const { a, b, enabled } = abLoopRef.current
          if (enabled && a != null && b != null && b > a && audio.currentTime >= b) {
            audio.currentTime = a
          }
          setCurrentTime(audio.currentTime)
          if (onTimeUpdate) onTimeUpdate(audio.currentTime)
        }
        const handleEnded = () => {
          if (cancelled) return
          setIsPlaying(false)
          if (onFinish) onFinish()
        }
        const handlePlay = () => { if (!cancelled) setIsPlaying(true) }
        const handlePause = () => { if (!cancelled) setIsPlaying(false) }
        const handleError = () => {
          if (cancelled) return
          setIsLoading(false)
          setError('音频加载失败')
          console.error('audio error 事件:', audio.error, 'audioPath=', audioPath)
        }
        const handleStalled = () => {
          if (!cancelled) console.warn('音频加载停滞（stalled）:', audioPath)
        }

        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('canplay', handleCanPlay)
        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('error', handleError)
        audio.addEventListener('stalled', handleStalled)

        simpleAudioRef.current = audio
        audioElementRef.current = audio
        setAudioElementReady(true)

        // 主进程获取 duration 作为兜底
        if (!audioPath.startsWith('http') && window.electronAPI?.getAudioDuration) {
          window.electronAPI.getAudioDuration(audioPath).then(dur => {
            if (cancelled) return
            if (dur && dur > 0) {
              setDuration(dur)
              setIsReady(true)
              if (onReady) onReady(dur)
            }
          }).catch((e) => {
            console.error('主进程 getAudioDuration 失败:', e, audioPath)
          })
        }

        audio.src = fileUrl
        audio.load()

        // 异步初始化 WaveSurfer 生成波形（不阻塞播放）
        // 复用同一个 audio 元素，不重新加载文件
        if (waveformRef.current && !cancelled) {
          // 用 setTimeout 确保不阻塞当前播放启动
          setTimeout(() => {
            if (cancelled || !simpleAudioRef.current) return
            try {
              const ws = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: 'rgba(201, 100, 66, 0.4)',
                progressColor: '#ec4899',
                cursorColor: 'rgba(255, 255, 255, 0.9)',
                cursorWidth: 2,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                height: waveformHeight,
                normalize: true,
                hideScrollbar: true,
                barAlign: 'center',
                backend: 'MediaElement',
                media: audio, // 复用同一 audio 元素
              })

              wavesurferRef.current = ws

              ws.on('ready', () => {
                if (cancelled) return
                // 波形生成完，切换到波形模式（隐藏简单进度条）
                setUseSimpleMode(false)
                setIsLoading(false)
              })

              ws.on('error', (err) => {
                const errMsg = err?.message || err || ''
                if (errMsg.includes('AbortError') || errMsg.includes('signal is aborted')) return
                console.warn('WaveSurfer 波形生成失败（不影响播放）:', errMsg, audioPath)
              })

              // 用已有的 media 元素加载（不会重新 fetch 文件）
              ws.load(fileUrl)
            } catch (e) {
              console.warn('WaveSurfer 初始化失败（不影响播放）:', e, audioPath)
            }
          }, 100)
        }
      }

      const checkSizeAndLoad = async () => {
        if (cancelled) return
        if (audioPath.startsWith('http')) {
          // 在线音频用 WaveSurfer（流式加载，可生成波形）
          loadWithWaveSurfer()
          return
        }
        // 本地音频：默认用简单模式，秒开播放（和 PotPlayer 一样）
        // 波形生成需要解码整个文件，对大文件不友好
        fallbackToSimpleMode()
      }
      checkSizeAndLoad()

      function loadWithWaveSurfer() {
        if (cancelled) return
        try {
          const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgba(201, 100, 66, 0.4)',
            progressColor: '#ec4899',
            cursorColor: 'rgba(255, 255, 255, 0.9)',
            cursorWidth: 2,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: waveformHeight,
            normalize: true,
            hideScrollbar: true,
            barAlign: 'center',
            backend: 'MediaElement',
            partialRender: true,
          })

          wavesurferRef.current = ws

          ws.load(fileUrl)
          ws.setVolume(effectiveVolume)

          ws.on('ready', () => {
            if (cancelled) return
            setIsLoading(false)
            setIsReady(true)
            const dur = ws.getDuration()
            setDuration(dur)

            const media = ws.getMediaElement?.()
            if (media) {
              audioElementRef.current = media
              setAudioElementReady(true)
            }

            ws.setPlaybackRate(playbackRate)
            ws.play()
            if (onReady) onReady(dur)
          })

          ws.on('error', (err) => {
            if (cancelled) return
            const errMsg = err?.message || err || ''
            if (errMsg.includes('AbortError') || errMsg.includes('signal is aborted')) {
              return
            }
            if (errMsg.includes('could not be read') || errMsg.includes('permission')) {
              fallbackToSimpleMode()
              return
            }
            setIsLoading(false)
            setError(errMsg || '加载失败')
            console.error('WaveSurfer error:', err)
          })

          let lastProcessTime = 0
          ws.on('audioprocess', (time) => {
            if (cancelled) return
            // A-B 循环：到达 B 点立即回到 A 点
            const { a, b, enabled } = abLoopRef.current
            if (enabled && a != null && b != null && b > a && time >= b) {
              const dur = ws.getDuration()
              if (dur > 0) {
                ws.seekTo(a / dur)
                setCurrentTime(a)
                if (onTimeUpdate) onTimeUpdate(a)
                return
              }
            }
            const now = performance.now()
            if (now - lastProcessTime < 66) return
            lastProcessTime = now
            setCurrentTime(time)
            if (onTimeUpdate) onTimeUpdate(time)
          })

          let lastSeekTime = 0
          ws.on('seek', (time) => {
            if (cancelled) return
            const now = performance.now()
            if (now - lastSeekTime < 66) return
            lastSeekTime = now
            setCurrentTime(time)
            if (onTimeUpdate) onTimeUpdate(time)
          })

          ws.on('play', () => !cancelled && setIsPlaying(true))
          ws.on('pause', () => !cancelled && setIsPlaying(false))
          ws.on('finish', () => {
            if (cancelled) return
            setIsPlaying(false)
            if (onSleepTimerTrackFinish) {
              const handled = onSleepTimerTrackFinish()
              if (handled) return
            }
            if (onFinish) onFinish()
          })
        } catch (e) {
          if (cancelled) return
          fallbackToSimpleMode()
        }
      }
    }

    loadAudio()

    return () => {
      cancelled = true
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
      // 完全销毁 audio 元素，释放所有资源
      if (simpleAudioRef.current) {
        simpleAudioRef.current.pause()
        simpleAudioRef.current.src = ''
        simpleAudioRef.current = null
      }
    }
  }, [audioPath, waveformHeight])

  useEffect(() => {
    if (useSimpleMode && simpleAudioRef.current) {
      simpleAudioRef.current.volume = effectiveVolume
    } else if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(effectiveVolume)
    }
    if (volumeSliderRef.current) {
      volumeSliderRef.current.style.backgroundSize = `${volume * 100}% 100%`
    }
  }, [effectiveVolume, volume, useSimpleMode])

  useEffect(() => {
    if (useSimpleMode && simpleAudioRef.current && isReady) {
      simpleAudioRef.current.playbackRate = playbackRate
    } else if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setPlaybackRate(playbackRate)
    }
  }, [playbackRate, isReady, useSimpleMode])

  return (
    <div className="audio-player">
      <div className="player-left">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="player-cover"
            onClick={onToggleImmersive}
            title="点击进入沉浸模式"
          />
        ) : (
          <div className="player-cover-placeholder" onClick={onToggleImmersive} title="点击进入沉浸模式">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="player-info-bar">
          <div className={`player-title ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`}>
            {isLoading && '加载中...'}
            {error && `错误: ${error}`}
            {!isLoading && !error && (title || '未选择音频')}
          </div>
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="waveform-wrapper">
          <div
            ref={waveformContainerRef}
            className={`waveform-container ${isLoading ? 'loading' : ''} ${isPlaying ? 'playing' : ''}`}
            style={{ height: `${waveformHeight}px` }}
            onMouseMove={handleWaveformMouseMove}
            onMouseLeave={handleWaveformMouseLeave}
            onClick={handleWaveformClick}
          >
            <div ref={waveformRef} className="waveform" />
            <div className="waveform-gradient-overlay" />
            {abRegion && (
              <>
                <div
                  className={`waveform-ab-region ${abLoop.enabled ? 'active' : ''}`}
                  style={{ left: `${abRegion.startPct}%`, width: `${abRegion.widthPct}%` }}
                />
                <div className="waveform-ab-marker a" style={{ left: `${abRegion.startPct}%` }} />
                {abRegion.hasB && (
                  <div
                    className="waveform-ab-marker b"
                    style={{ left: `${abRegion.startPct + abRegion.widthPct}%` }}
                  />
                )}
              </>
            )}
            {useSimpleMode && (
              <>
                <div className="simple-progress-bg" />
                <div
                  className="simple-progress-fill"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                <div
                  className="simple-progress-thumb"
                  style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </>
            )}
          </div>
          <div
            className={`waveform-tooltip ${showTooltip ? 'visible' : ''}`}
            style={{ left: `${tooltipPosition}%` }}
          >
            {formatTime(tooltipTime)}
          </div>
          {showSpectrum && audioElementReady && audioElementRef.current && (
            <div className="spectrum-container">
              <SpectrumVisualizer
                audioElement={audioElementRef.current}
                mode={spectrumMode}
                sensitivity={spectrumSensitivity}
                height={40}
                showBg={false}
                barCount={48}
              />
            </div>
          )}
        </div>

        <div className="player-controls">
          <button className="ctrl-btn prev-next-btn" onClick={onPrev} title="上一曲" disabled={!isReady || !onPrev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 20L9 12l10-8v16z"/>
              <rect x="5" y="4" width="2" height="16" rx="1"/>
            </svg>
          </button>
          <button className="ctrl-btn skip-btn" onClick={skipBackward} title={`后退${skipSeconds}秒`} disabled={!isReady}>
            -{skipSeconds}s
          </button>
          <button className="ctrl-btn play-btn" onClick={handlePlayPause} title="播放/暂停" disabled={!isReady}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3.5L19 12L6 20.5V3.5Z" />
              </svg>
            )}
          </button>
          <button className="ctrl-btn skip-btn" onClick={skipForward} title={`前进${skipSeconds}秒`} disabled={!isReady}>
            +{skipSeconds}s
          </button>
          <button className="ctrl-btn prev-next-btn" onClick={onNext} title="下一曲" disabled={!isReady || !onNext}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4l10 8-10 8V4z"/>
              <rect x="17" y="4" width="2" height="16" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="player-right">
        <div className="volume-control">
          <button
            className={`volume-icon ${muted ? 'muted' : ''}`}
            onClick={() => setMuted((prev) => !prev)}
            title={muted ? '取消静音' : '静音'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              {muted ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </>
              ) : (
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              )}
            </svg>
          </button>
          <input
            ref={volumeSliderRef}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
        <div className="queue-controls">
          <button
            className={`ctrl-btn loop-btn ${loopMode !== 'none' ? 'active' : ''}`}
            onClick={onToggleLoop}
            title={`循环模式：${loopMode === 'one' ? '单曲循环' : loopMode === 'list' ? '列表循环' : '顺序播放'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              {loopMode === 'one' && (
                <text x="12" y="14.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">1</text>
              )}
            </svg>
          </button>
          <button
            className={`ctrl-btn shuffle-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={shuffle ? '随机：开' : '随机：关'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>
          <button
            className={`ctrl-btn queue-btn ${showQueuePanel ? 'active' : ''}`}
            onClick={onToggleQueue}
            title="播放队列"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            {queue.length > 0 && <span className="queue-badge">{queue.length}</span>}
          </button>
        </div>
        <div className="bookmark-control">
          <button
            className={`ctrl-btn bookmark-btn ${hasCurrentBookmark ? 'active' : ''}`}
            onClick={() => onAddBookmark && onAddBookmark(currentTime)}
            title={hasCurrentBookmark ? '当前位置已有书签' : '在当前位置添加书签'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={hasCurrentBookmark ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            {bookmarkCount > 0 && <span className="bookmark-badge">{bookmarkCount}</span>}
          </button>
        </div>
        <div className="ab-loop-control">
          <button
            className={`ctrl-btn ab-loop-btn ${abLoop.enabled ? 'active' : ''} ${!abLoop.enabled && abLoop.a != null ? 'pending' : ''}`}
            onClick={cycleAbLoop}
            title={abLoopTitle}
          >
            <span className="ab-loop-text">A-B</span>
            {abLoop.a != null && (
              <span className="ab-loop-badge">
                {abLoop.enabled ? `${formatTime(abLoop.a)}-${formatTime(abLoop.b)}` : formatTime(abLoop.a)}
              </span>
            )}
          </button>
        </div>
        <div className="playback-rate-control">
          <button
            className={`ctrl-btn playback-rate-btn ${playbackRate !== 1 ? 'active' : ''}`}
            onClick={() => setShowPlaybackRate(!showPlaybackRate)}
            title={`播放速度：${playbackRate}x`}
          >
            <span className="playback-rate-text">{playbackRate}x</span>
          </button>
          {showPlaybackRate && (
            <div className="playback-rate-dropdown">
              <div className="playback-rate-header">播放速度</div>
              <div className="playback-rate-options">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    className={`playback-rate-option ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => {
                      if (onPlaybackRateChange) onPlaybackRateChange(rate)
                      setShowPlaybackRate(false)
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sleep-timer-control">
          <button
            className={`ctrl-btn sleep-timer-btn ${sleepTimerActive ? 'active' : ''} ${sleepTimerFading ? 'fading' : ''}`}
            onClick={() => setShowSleepTimer(!showSleepTimer)}
            title={sleepTimerActive ? `睡眠定时器：${getSleepTimerStatusText ? getSleepTimerStatusText() : formatSleepTimerRemaining?.(sleepTimerRemaining) || ''}` : '睡眠定时器'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            {sleepTimerActive && (
              <span className="sleep-timer-badge">{getSleepTimerStatusText ? getSleepTimerStatusText() : formatSleepTimerRemaining?.(sleepTimerRemaining)}</span>
            )}
          </button>
          {showSleepTimer && (
            <div className="sleep-timer-dropdown sleep-timer-dropdown-enhanced">
              <div className="sleep-timer-header">
                <span>睡眠定时器</span>
                {sleepTimerActive && (
                  <button
                    className="sleep-timer-cancel-btn"
                    onClick={() => { onCancelSleepTimer?.({ notify: true }); setShowSleepTimer(false) }}
                  >
                    关闭
                  </button>
                )}
              </div>

              <div className="sleep-timer-tabs">
                <button
                  className={`sleep-timer-tab ${sleepTab === 'countdown' ? 'active' : ''}`}
                  onClick={() => setSleepTab('countdown')}
                >
                  倒计时
                </button>
                <button
                  className={`sleep-timer-tab ${sleepTab === 'trackEnd' ? 'active' : ''}`}
                  onClick={() => setSleepTab('trackEnd')}
                >
                  曲目结束
                </button>
                <button
                  className={`sleep-timer-tab ${sleepTab === 'timePoint' ? 'active' : ''}`}
                  onClick={() => setSleepTab('timePoint')}
                >
                  指定时间
                </button>
              </div>

              {sleepTab === 'countdown' && (
                <>
                  <div className="sleep-timer-preset-grid">
                    {sleepTimerPresets?.map((min) => (
                      <button
                        key={min}
                        className={`sleep-timer-preset ${sleepTimerMode === sleepTimerModes?.COUNTDOWN && Math.floor(sleepTimerRemaining / 60) === min ? 'active' : ''}`}
                        onClick={() => { onSetCountdownTimer?.(min); setShowSleepTimer(false) }}
                      >
                        {min} 分
                      </button>
                    ))}
                  </div>
                  <div className="sleep-timer-custom">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="sleep-timer-custom-input"
                      placeholder="自定义分钟数"
                    />
                    <button
                      className="sleep-timer-custom-btn"
                      onClick={() => {
                        const mins = parseInt(customMinutes)
                        if (mins > 0 && mins <= 300) {
                          onSetCountdownTimer?.(mins)
                          setShowSleepTimer(false)
                        }
                      }}
                    >
                      设定
                    </button>
                  </div>
                </>
              )}

              {sleepTab === 'trackEnd' && (
                <div className="sleep-timer-track-end">
                  <div className="sleep-timer-track-end-desc">
                    当前曲目播放完毕后自动停止播放
                  </div>
                  <button
                    className={`sleep-timer-track-end-btn ${sleepTimerMode === sleepTimerModes?.TRACK_END ? 'active' : ''}`}
                    onClick={() => { onSetTrackEndTimer?.(true); setShowSleepTimer(false) }}
                  >
                    {sleepTimerMode === sleepTimerModes?.TRACK_END ? '已启用' : '启用曲目结束停止'}
                  </button>
                </div>
              )}

              {sleepTab === 'timePoint' && (
                <div className="sleep-timer-time-point">
                  <div className="sleep-timer-time-point-input-row">
                    <input
                      type="time"
                      value={timePointInput}
                      onChange={(e) => setTimePointInput(e.target.value)}
                      className="sleep-timer-time-input"
                    />
                    <button
                      className="sleep-timer-time-set-btn"
                      onClick={() => {
                        if (timePointInput) {
                          onSetTimePointTimer?.(timePointInput)
                          setShowSleepTimer(false)
                        }
                      }}
                    >
                      设定
                    </button>
                  </div>
                  <div className="sleep-timer-time-point-desc">
                    在设定的时间点自动停止播放
                  </div>
                </div>
              )}

              <div className="sleep-timer-fade-toggle">
                <label className="sleep-timer-fade-label">
                  <input
                    type="checkbox"
                    checked={sleepTimerFadeEnabled}
                    onChange={(e) => onSetSleepTimerFadeEnabled?.(e.target.checked)}
                  />
                  <span className="sleep-timer-fade-text">
                    渐弱音量
                    <span className="sleep-timer-fade-desc">
                      {sleepTimerFadeEnabled
                        ? `停止前 ${sleepTimerFadeSeconds} 秒逐渐降低音量`
                        : '到点后直接暂停播放'}
                    </span>
                  </span>
                </label>
                {sleepTimerFadeEnabled && (
                  <div className="sleep-timer-fade-options">
                    {sleepTimerFadeOptions?.map((opt) => (
                      <button
                        key={opt.value}
                        className={`sleep-timer-fade-option ${sleepTimerFadeSeconds === opt.value ? 'active' : ''}`}
                        onClick={() => onSetSleepTimerFadeSeconds?.(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mini-player-control">
          <button
            className="ctrl-btn mini-player-btn"
            onClick={() => {
              if (window.electronAPI?.miniPlayerOpen) {
                window.electronAPI.miniPlayerOpen()
              }
            }}
            title="迷你播放器模式"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="21" x2="9" y2="14" />
              <line x1="15" y1="21" x2="15" y2="14" />
              <line x1="9" y1="10" x2="9" y2="3" />
              <line x1="15" y1="10" x2="15" y2="3" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>
      </div>
      {showQueuePanel && (
        <QueuePanel
          queue={queue}
          queueIndex={queueIndex}
          loopMode={loopMode}
          shuffle={shuffle}
          onPlay={onPlayFromQueue}
          onRemove={onRemoveFromQueue}
          onClear={onClearQueue}
          onReorder={onReorderQueue}
          onToggleLoop={onToggleLoop}
          onToggleShuffle={onToggleShuffle}
          onClose={onCloseQueuePanel}
        />
      )}
    </div>
  )
}))

export default AudioPlayer
