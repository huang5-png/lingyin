import { useEffect, useRef } from 'react'
import { scanFolder } from '../utils/scanner'
import { buildIndexPayload, pickUnindexedWorks } from '../utils/audioIndex'

// 首次加载后延迟启动，避开首屏渲染与初始扫描
const START_DELAY = 1200
// 并发扫描的作品数，过高会阻塞主进程 readDir
const MAX_CONCURRENT = 3

// 为历史作品回填音频索引（work.audioFiles）
//
// 作用：旧版本作品记录只保存了 audioCount，导致智能播放列表恒为空、
// 全局搜索的「曲目」分组失效。这里在作品加载完成后，对尚未索引的本地
// 作品补扫目录并单次落盘，索引结果写入 db.json 后长期有效。
export function useAudioIndex({ works, isLoadingWorks, setWorks, showToast }) {
  const attemptedRef = useRef(new Set())
  const runningRef = useRef(false)

  useEffect(() => {
    if (isLoadingWorks) return
    if (runningRef.current) return

    const pending = pickUnindexedWorks(works, attemptedRef.current)
    if (pending.length === 0) return

    // 立即登记，避免 effect 重入时重复调度同一批作品
    for (const work of pending) {
      attemptedRef.current.add(work.id)
    }
    runningRef.current = true

    const run = async () => {
      const cursor = { index: 0 }
      const collected = []
      let failed = 0

      const worker = async () => {
        while (cursor.index < pending.length) {
          const work = pending[cursor.index]
          cursor.index++
          try {
            const result = await scanFolder(work.folderPath)
            const payload = buildIndexPayload(work.id, result)
            if (payload) collected.push(payload)
            else failed++
          } catch (e) {
            failed++
            console.warn('音频索引扫描失败:', work.folderPath, e?.message)
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, pending.length) }, worker))

      if (collected.length > 0) {
        try {
          await window.electronAPI.dbSetWorksAudioFiles(collected)
          const byId = new Map(collected.map((item) => [item.workId, item]))
          const now = Date.now()
          setWorks((prev) =>
            prev.map((w) => {
              const hit = byId.get(w.id)
              if (!hit) return w
              return {
                ...w,
                audioFiles: hit.audioFiles,
                audioCount: hit.audioCount,
                audioIndexUpdatedAt: now,
              }
            }),
          )
          showToast?.(`已为 ${collected.length} 个作品建立音频索引`, 'success')
        } catch (e) {
          console.warn('写入音频索引失败:', e?.message)
        }
      }

      if (failed > 0) {
        console.warn(`音频索引重建完成，${failed} 个作品无曲目或扫描失败`)
      }
    }

    // 扫描幂等且只跑一轮，因此不做 cleanup 取消：
    // React StrictMode 会「挂载→清理→再挂载」，取消会导致索引永远无法完成
    setTimeout(() => {
      run().finally(() => {
        runningRef.current = false
      })
    }, START_DELAY)
  }, [works, isLoadingWorks, setWorks, showToast])
}
