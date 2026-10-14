import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DEFAULT_RADAR,
  normalizeSensoryStamp,
} from '../utils/chronicleHelpers.js'

/**
 * useVoiceChronicle Hook
 * 管理当前作品的音声手账档案、四维听感图谱与心动感官印记流
 */
export function useVoiceChronicle({
  work,
  currentAudio,
  currentTime,
  playerRef,
  onToast,
}) {
  const [chronicleData, setChronicleData] = useState({
    radar: { ...DEFAULT_RADAR },
    tier: 'masterpiece',
    equipment: '',
    notes: '',
  })
  const [stamps, setStamps] = useState([])
  const [isStampModalOpen, setIsStampModalOpen] = useState(false)
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false)

  const workId = work?.id || work?.folderName || 'default'

  // 从 localStorage 加载手账与打点数据
  useEffect(() => {
    if (!workId || workId === 'default') return

    try {
      const chronicleKey = `lingyin_chronicle_${workId}`
      const savedChronicle = localStorage.getItem(chronicleKey)
      if (savedChronicle) {
        const parsed = JSON.parse(savedChronicle)
        setChronicleData({
          radar: { ...DEFAULT_RADAR, ...(parsed.radar || {}) },
          tier: parsed.tier || 'masterpiece',
          equipment: parsed.equipment || '',
          notes: parsed.notes || '',
        })
      } else {
        setChronicleData({
          radar: { ...DEFAULT_RADAR },
          tier: 'masterpiece',
          equipment: '',
          notes: '',
        })
      }

      const stampsKey = `lingyin_stamps_${workId}`
      const savedStamps = localStorage.getItem(stampsKey)
      if (savedStamps) {
        const parsedStamps = JSON.parse(savedStamps)
        if (Array.isArray(parsedStamps)) {
          setStamps(parsedStamps.map(normalizeSensoryStamp).filter(Boolean))
        } else {
          setStamps([])
        }
      } else {
        setStamps([])
      }
    } catch (e) {
      console.warn('加载音声手账数据失败:', e)
    }
  }, [workId])

  // 更新手账信息并落盘
  const updateChronicle = useCallback(
    (patch) => {
      setChronicleData((prev) => {
        const next = { ...prev, ...patch, updatedAt: Date.now() }
        try {
          localStorage.setItem(`lingyin_chronicle_${workId}`, JSON.stringify(next))
        } catch (e) {
          console.warn('保存音声手账失败:', e)
        }
        return next
      })
      onToast?.('手账档案已更新', 'success')
    },
    [workId, onToast],
  )

  // 添加心动印记
  const addStamp = useCallback(
    ({ type, rating, note, time }) => {
      const markTime = time !== undefined ? time : currentTime || 0
      const newStamp = normalizeSensoryStamp({
        time: markTime,
        type,
        rating,
        note,
        audioPath: currentAudio?.path || '',
        audioName: currentAudio?.displayName || currentAudio?.name || '未知曲目',
      })

      if (!newStamp) return

      setStamps((prev) => {
        const next = [...prev, newStamp].sort((a, b) => a.time - b.time)
        try {
          localStorage.setItem(`lingyin_stamps_${workId}`, JSON.stringify(next))
        } catch (e) {
          console.warn('保存心动印记失败:', e)
        }
        return next
      })

      onToast?.(`已记录心动印记：${newStamp.typeLabel} (${newStamp.timeFormatted})`, 'success')
    },
    [workId, currentAudio, currentTime, onToast],
  )

  // 删除印记
  const deleteStamp = useCallback(
    (stampId) => {
      setStamps((prev) => {
        const next = prev.filter((s) => s.id !== stampId)
        try {
          localStorage.setItem(`lingyin_stamps_${workId}`, JSON.stringify(next))
        } catch (e) {
          console.warn('保存心动印记失败:', e)
        }
        return next
      })
      onToast?.('已移除心动印记', 'info')
    },
    [workId, onToast],
  )

  // 跳转到指定印记的时间点
  const seekToStamp = useCallback(
    (stamp) => {
      if (!stamp) return
      playerRef?.current?.seekTo?.(stamp.time)
      onToast?.(`已定位到感官印记：${stamp.typeLabel} (${stamp.timeFormatted})`, 'info')
    },
    [playerRef, onToast],
  )

  // 当前音轨对应的印记
  const currentAudioStamps = useMemo(() => {
    if (!currentAudio?.path) return []
    return stamps.filter((s) => !s.audioPath || s.audioPath === currentAudio.path)
  }, [stamps, currentAudio])

  return {
    chronicleData,
    stamps,
    currentAudioStamps,
    updateChronicle,
    addStamp,
    deleteStamp,
    seekToStamp,
    isStampModalOpen,
    openStampModal: () => setIsStampModalOpen(true),
    closeStampModal: () => setIsStampModalOpen(false),
    isPosterModalOpen,
    openPosterModal: () => setIsPosterModalOpen(true),
    closePosterModal: () => setIsPosterModalOpen(false),
  }
}
