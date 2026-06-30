import { useState, useCallback, useRef } from 'react'

export function useOnlineWork({ showToast, setSelectedWork, setAudioFiles, setCurrentAudio, setCurrentCues, setCurrentTime, setDuration, setAllSubtitleFiles, setSubtitleOptions, setSelectedSubtitleIndex }) {
  // 从 tracks 数据中提取音频文件列表
  const extractAudiosFromTracks = useCallback((tracks, folderPath = '') => {
    const audios = []
    if (!tracks) return audios

    let trackList = tracks
    if (!Array.isArray(tracks)) {
      if (tracks.tracks && Array.isArray(tracks.tracks)) {
        trackList = tracks.tracks
      } else if (tracks.data && Array.isArray(tracks.data)) {
        trackList = tracks.data
      } else if (tracks.list && Array.isArray(tracks.list)) {
        trackList = tracks.list
      } else {
        return audios
      }
    }

    for (const track of trackList) {
      if (!track) continue

      if (track.type === 'folder' && track.children) {
        const childAudios = extractAudiosFromTracks(track.children, folderPath ? `${folderPath}/${track.title}` : track.title)
        audios.push(...childAudios)
      } else if (track.type === 'audio') {
        const relPath = folderPath ? `${folderPath}/${track.title}` : track.title
        audios.push({
          name: track.title,
          path: track.mediaStreamUrl,
          isOnline: true,
          duration: track.duration,
          size: track.size,
          folder: folderPath,
          relativePath: relPath,
          displayName: relPath.replace(/\//g, ' / '),
        })
      }
    }
    return audios
  }, [])

  const loadingWorkIdRef = useRef(null)

  // 选择在线作品
  const handleSelectOnlineWork = useCallback(
    async (workSummary) => {
      try {
        loadingWorkIdRef.current = workSummary.id

        const clickedWorkId = workSummary.id

        // 先显示搜索结果数据（不等待 API）
        const searchWork = {
          id: `online_${clickedWorkId}`,
          rjCode: workSummary.source_id || '',
          title: workSummary.title || '',
          folderName: workSummary.title || '',
          circle: workSummary.name || '',
          cover: workSummary.mainCoverUrl || workSummary.thumbnailCoverUrl || '',
          thumbnailCover: workSummary.thumbnailCoverUrl || '',
          samCover: workSummary.samCoverUrl || '',
          cvs: workSummary.vas?.map((v) => v.name) || [],
          tags: workSummary.tags?.map((t) => t.name) || [],
          price: workSummary.price || 0,
          rate: workSummary.rate_average_2dp || 0,
          dlCount: workSummary.dl_count || 0,
          releaseDate: workSummary.release || '',
          nsfw: workSummary.nsfw || false,
          sourceUrl: workSummary.source_url || '',
          isOnline: true,
          onlineId: workSummary.id,
          _loadingTracks: true,
        }
        setSelectedWork(searchWork)
        setAudioFiles([])
        setCurrentAudio(null)
        setCurrentCues([])
        setCurrentTime(0)
        setDuration(0)
        setAllSubtitleFiles([])
        setSubtitleOptions([])
        setSelectedSubtitleIndex(-1)

        // 后台获取 tracks（播放必需）和 workInfo（补充元数据）
        const [workInfo, tracks] = await Promise.all([
          window.electronAPI.asmrOneGetWorkInfo(clickedWorkId).catch(() => null),
          window.electronAPI.asmrOneGetTracks(clickedWorkId),
        ])

        // Guard: 如果用户在此期间点击了其他作品，丢弃过期结果
        if (String(clickedWorkId) !== String(loadingWorkIdRef.current)) return

        const audioFiles = extractAudiosFromTracks(tracks)
        const rjCode = workInfo?.source_id || searchWork.rjCode

        // 构建完整作品对象
        const fullWork = {
          id: `online_${(workInfo || workSummary).id}`,
          rjCode,
          title: workInfo?.title || searchWork.title,
          folderName: workInfo?.title || searchWork.folderName,
          circle: workInfo?.name || searchWork.circle,
          cover: workInfo?.mainCoverUrl || searchWork.cover,
          thumbnailCover: workInfo?.thumbnailCoverUrl || searchWork.thumbnailCover,
          samCover: workInfo?.samCoverUrl || searchWork.samCover,
          cvs: workInfo?.vas?.map((v) => v.name) || searchWork.cvs,
          tags: workInfo?.tags?.map((t) => t.name) || searchWork.tags,
          price: workInfo?.price ?? searchWork.price,
          rate: workInfo?.rate_average_2dp ?? searchWork.rate,
          dlCount: workInfo?.dl_count ?? searchWork.dlCount,
          releaseDate: workInfo?.release || searchWork.releaseDate,
          nsfw: workInfo?.nsfw ?? searchWork.nsfw,
          sourceUrl: workInfo?.source_url || searchWork.sourceUrl,
          isOnline: true,
          onlineId: (workInfo || workSummary).id,
          _loadingTracks: false,
        }

        setSelectedWork(fullWork)
        setAudioFiles(audioFiles)
      } catch (e) {
        console.error('Failed to load online work tracks:', e)
        setSelectedWork((prev) => prev ? { ...prev, _loadingTracks: false, _tracksError: true } : prev)
      }
    },
    [extractAudiosFromTracks, setSelectedWork, setAudioFiles, setCurrentAudio, setCurrentCues, setCurrentTime, setDuration, setAllSubtitleFiles, setSubtitleOptions, setSelectedSubtitleIndex],
  )

  // 重新加载在线作品 tracks
  const handleReloadOnlineTracks = useCallback(async (selectedWork) => {
    if (!selectedWork?.isOnline || !selectedWork?.onlineId) return
    const workId = selectedWork.onlineId
    loadingWorkIdRef.current = workId
    setSelectedWork((prev) => prev ? { ...prev, _loadingTracks: true, _tracksError: false } : prev)
    try {
      const tracks = await window.electronAPI.asmrOneGetTracks(workId)
      if (String(workId) !== String(loadingWorkIdRef.current)) return
      const audioFiles = extractAudiosFromTracks(tracks)
      setSelectedWork((prev) => prev ? { ...prev, _loadingTracks: false, _tracksError: false } : prev)
      setAudioFiles(audioFiles)
    } catch (e) {
      console.error('Failed to reload online work tracks:', e)
      if (String(workId) !== String(loadingWorkIdRef.current)) return
      setSelectedWork((prev) => prev ? { ...prev, _loadingTracks: false, _tracksError: true } : prev)
    }
  }, [extractAudiosFromTracks, setSelectedWork, setAudioFiles])

  return {
    handleSelectOnlineWork,
    handleReloadOnlineTracks,
    extractAudiosFromTracks,
    loadingWorkIdRef,
  }
}
