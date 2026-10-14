import { memo, useRef, useState, useEffect, useCallback } from 'react'
import {
  formatChroniclePosterPayload,
  calculateRadarPoints,
  pointsToSvgPolygon,
} from '../utils/chronicleHelpers.js'
import './ChroniclePosterModal.css'

const ChroniclePosterModal = memo(function ChroniclePosterModal({
  isOpen,
  work,
  chronicleData = {},
  stamps = [],
  onClose,
  onToast,
}) {
  const cardRef = useRef(null)
  const [themeMode, setThemeMode] = useState('dark') // 'dark' | 'vintage'
  const [isExporting, setIsExporting] = useState(false)

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const payload = formatChroniclePosterPayload({
    work,
    chronicleData,
    stamps,
  })

  // 雷达图计算 (海报中尺寸更大 180x180, 中心 90, 90, 半径 60)
  const radarPoints = calculateRadarPoints(payload.radar, 90, 90, 60)
  const polygonStr = pointsToSvgPolygon(radarPoints)

  // 绘制 Canvas 导出为图片
  const renderCardToCanvas = useCallback(async () => {
    const canvas = document.createElement('canvas')
    const width = 640
    const height = 940
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // 背景填充
    const isDark = themeMode === 'dark'
    if (isDark) {
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      grad.addColorStop(0, '#1c1917')
      grad.addColorStop(0.5, '#292524')
      grad.addColorStop(1, '#1c1917')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
    } else {
      // 暖纸复古色
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      grad.addColorStop(0, '#fbf8f1')
      grad.addColorStop(0.5, '#f5f0e6')
      grad.addColorStop(1, '#eee6d8')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
    }

    // 边框微光
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(180, 140, 100, 0.3)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(20, 20, width - 40, height - 40)

    // 头部作品标题与社团
    ctx.fillStyle = isDark ? '#ffffff' : '#292524'
    ctx.font = 'bold 22px Poppins, sans-serif'
    ctx.textAlign = 'left'
    const titleText = payload.title.length > 22 ? payload.title.slice(0, 22) + '...' : payload.title
    ctx.fillText(titleText, 40, 65)

    ctx.fillStyle = isDark ? '#a8a29e' : '#78716c'
    ctx.font = '14px Poppins, sans-serif'
    ctx.fillText(`${payload.circleText} · 声优: ${payload.cvText}`, 40, 92)

    if (payload.rjCode) {
      ctx.fillStyle = '#d97757'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(payload.rjCode, 40, 114)
    }

    // 评级徽章
    ctx.fillStyle = payload.tierDef.color || '#f59e0b'
    ctx.font = 'bold 14px Poppins, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(payload.tierDef.badge, width - 40, 65)

    // 封面图尝试绘制（若已缓存或跨域安全）
    const coverY = 135
    const coverH = 220
    const coverW = width - 80

    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(40, coverY, coverW, coverH)

    if (payload.coverUrl) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
          img.src = payload.coverUrl
        })
        if (img.width > 0) {
          ctx.drawImage(img, 40, coverY, coverW, coverH)
        }
      } catch (e) {
        // 忽略图片跨域失败，保持占位
      }
    }

    // 四维雷达图与装备
    const radarCenterY = 460
    ctx.fillStyle = isDark ? '#f5f5f4' : '#292524'
    ctx.font = 'bold 16px Poppins, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('四维听感图谱', 40, radarCenterY - 60)

    ctx.fillStyle = isDark ? '#a8a29e' : '#78716c'
    ctx.font = '13px Poppins, sans-serif'
    ctx.fillText(`耳机器材: ${payload.equipment}`, 40, radarCenterY - 35)

    // 雷达维度文字
    const cx = 130
    const cy = radarCenterY + 45
    const r = 50
    const rPoints = calculateRadarPoints(payload.radar, cx, cy, r)

    // 绘制雷达多边形
    ctx.beginPath()
    rPoints.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(217, 119, 87, 0.4)'
    ctx.fill()
    ctx.strokeStyle = '#d97757'
    ctx.lineWidth = 2
    ctx.stroke()

    // 维度分数列表
    ctx.font = '12px Poppins, sans-serif'
    ctx.fillStyle = isDark ? '#e7e5e4' : '#44403c'
    rPoints.forEach((p, i) => {
      ctx.fillText(`${p.label}: ${p.score}/10`, 240, radarCenterY + 15 + i * 22)
    })

    // 鉴赏短评
    const notesY = 610
    ctx.fillStyle = isDark ? '#f5f5f4' : '#292524'
    ctx.font = 'bold 15px Poppins, sans-serif'
    ctx.fillText('听风鉴赏感悟', 40, notesY)

    ctx.fillStyle = isDark ? '#d6d3d1' : '#57534e'
    ctx.font = 'italic 13px Lora, serif'
    const noteText = `"${payload.notes}"`
    ctx.fillText(noteText.slice(0, 48), 40, notesY + 28)
    if (noteText.length > 48) {
      ctx.fillText(noteText.slice(48, 96), 40, notesY + 50)
    }

    // 精选心动感官打点
    const stampsY = 705
    ctx.fillStyle = isDark ? '#f5f5f4' : '#292524'
    ctx.font = 'bold 15px Poppins, sans-serif'
    ctx.fillText(`精选感官印记 (${payload.stamps.length})`, 40, stampsY)

    payload.stamps.forEach((st, idx) => {
      const sy = stampsY + 26 + idx * 28
      ctx.fillStyle = st.color || '#ec4899'
      ctx.font = '13px Poppins, sans-serif'
      ctx.fillText(`${st.icon} ${st.typeLabel}`, 40, sy)

      ctx.fillStyle = isDark ? '#a8a29e' : '#78716c'
      ctx.font = '12px monospace'
      ctx.fillText(st.timeFormatted, 130, sy)

      ctx.fillStyle = '#f59e0b'
      ctx.font = '12px Poppins, sans-serif'
      ctx.fillText('★'.repeat(st.rating), 185, sy)

      if (st.note) {
        ctx.fillStyle = isDark ? '#78716c' : '#a8a29e'
        ctx.font = '11px sans-serif'
        ctx.fillText(`- ${st.note.slice(0, 22)}`, 240, sy)
      }
    })

    // 底部印章与日期
    ctx.fillStyle = '#c96442'
    ctx.font = 'bold 13px Poppins, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('聆音 · 沉浸式音声鉴赏手账', width - 40, height - 55)

    ctx.fillStyle = isDark ? '#78716c' : '#a8a29e'
    ctx.font = '11px monospace'
    ctx.fillText(`鉴赏印记日期: ${payload.dateText}`, width - 40, height - 36)

    return canvas
  }, [payload, themeMode])

  // 保存为 PNG
  const handleSaveImage = useCallback(async () => {
    setIsExporting(true)
    try {
      const canvas = await renderCardToCanvas()
      canvas.toBlob((blob) => {
        if (!blob) {
          onToast?.('生成图片失败', 'error')
          setIsExporting(false)
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const safeTitle = (payload.title || '音声手账').replace(/[\\/:*?"<>|]/g, '_')
        a.download = `【聆音鉴赏手账】${safeTitle}.png`
        a.href = url
        a.click()
        URL.revokeObjectURL(url)
        onToast?.('海报卡片已保存至下载目录', 'success')
        setIsExporting(false)
      }, 'image/png')
    } catch (e) {
      console.error(e)
      onToast?.('导出海报异常：' + (e.message || ''), 'error')
      setIsExporting(false)
    }
  }, [renderCardToCanvas, payload.title, onToast])

  // 复制到剪贴板
  const handleCopyClipboard = useCallback(async () => {
    setIsExporting(true)
    try {
      const canvas = await renderCardToCanvas()
      canvas.toBlob(async (blob) => {
        if (!blob) {
          onToast?.('图片转换失败', 'error')
          setIsExporting(false)
          return
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ])
          onToast?.('海报已复制到剪贴板！可直接粘贴分享', 'success')
        } catch (err) {
          onToast?.('剪贴板复制受限，已为你触发保存', 'info')
          handleSaveImage()
        }
        setIsExporting(false)
      }, 'image/png')
    } catch (e) {
      console.error(e)
      onToast?.('复制异常：' + (e.message || ''), 'error')
      setIsExporting(false)
    }
  }, [renderCardToCanvas, handleSaveImage, onToast])

  if (!isOpen) return null

  return (
    <div className="chronicle-poster-modal-backdrop" onClick={onClose}>
      <div
        className="chronicle-poster-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="poster-modal-top-bar">
          <div className="poster-title-text">
            <span>✨ 音声鉴赏手账海报预览</span>
          </div>
          <div className="poster-theme-toggle">
            <button
              className={`theme-toggle-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => setThemeMode('dark')}
            >
              极夜深空
            </button>
            <button
              className={`theme-toggle-btn ${themeMode === 'vintage' ? 'active' : ''}`}
              onClick={() => setThemeMode('vintage')}
            >
              典藏暖纸
            </button>
          </div>
          <button className="poster-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 卡片预览容器 */}
        <div className="poster-card-scroll">
          <div
            ref={cardRef}
            className={`chronicle-poster-card ${themeMode}`}
          >
            {/* 卡片头部 */}
            <div className="poster-card-header">
              <div className="poster-work-meta">
                <div className="poster-work-title" title={payload.title}>
                  {payload.title}
                </div>
                <div className="poster-work-sub">
                  <span>{payload.circleText}</span>
                  <span>·</span>
                  <span>声优: {payload.cvText}</span>
                  {payload.rjCode && <span className="poster-rj">{payload.rjCode}</span>}
                </div>
              </div>
              <div
                className="poster-tier-badge"
                style={{
                  color: payload.tierDef.color,
                  borderColor: `${payload.tierDef.color}55`,
                  backgroundColor: `${payload.tierDef.color}18`,
                }}
              >
                {payload.tierDef.badge}
              </div>
            </div>

            {/* 封面图 */}
            {payload.coverUrl && (
              <div className="poster-cover-wrap">
                <img
                  src={payload.coverUrl}
                  alt=""
                  className="poster-cover-img"
                  loading="lazy"
                />
              </div>
            )}

            {/* 四维听感图谱与器材 */}
            <div className="poster-middle-grid">
              <div className="poster-radar-box">
                <svg className="poster-radar-svg" viewBox="0 0 180 180">
                  <polygon
                    points={pointsToSvgPolygon(
                      calculateRadarPoints(
                        { intimacy: 10, sleepiness: 10, story: 10, spatial: 10 },
                        90,
                        90,
                        60,
                      ),
                    )}
                    className="poster-radar-grid"
                  />
                  <line x1="90" y1="30" x2="90" y2="150" className="poster-radar-axis" />
                  <line x1="30" y1="90" x2="150" y2="90" className="poster-radar-axis" />
                  <polygon points={polygonStr} className="poster-radar-polygon" />
                  {radarPoints.map((p) => (
                    <circle key={p.key} cx={p.x} cy={p.y} r="3" className="poster-radar-circle" />
                  ))}
                </svg>
              </div>

              <div className="poster-radar-details">
                <div className="poster-radar-title">四维听感风味图谱</div>
                <div className="poster-equipment-tag">
                  🎧 器材: {payload.equipment || '默认监听'}
                </div>
                <div className="poster-radar-scores">
                  {radarPoints.map((p) => (
                    <div key={p.key} className="score-badge">
                      <span className="score-name">{p.label}</span>
                      <span className="score-num">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 鉴赏笔记短评 */}
            <div className="poster-notes-block">
              <div className="notes-heading">听风鉴赏感悟</div>
              <p className="notes-quote">“{payload.notes}”</p>
            </div>

            {/* 精选心动感官印记 */}
            {payload.stamps.length > 0 && (
              <div className="poster-stamps-block">
                <div className="stamps-heading">精选心动感官瞬间</div>
                <div className="stamps-list">
                  {payload.stamps.map((st) => (
                    <div key={st.id} className="poster-stamp-pill">
                      <span className="pill-icon">{st.icon}</span>
                      <span className="pill-label">{st.typeLabel}</span>
                      <span className="pill-time">{st.timeFormatted}</span>
                      <span className="pill-stars">{'★'.repeat(st.rating)}</span>
                      {st.note && <span className="pill-note">- {st.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 底部落款 */}
            <div className="poster-footer-seal">
              <div className="seal-brand">聆音 · 沉浸式音声鉴赏手账</div>
              <div className="seal-date">鉴赏印记日期: {payload.dateText}</div>
            </div>
          </div>
        </div>

        {/* 底部操作工具栏 */}
        <div className="poster-modal-actions">
          <button
            className="btn-secondary"
            onClick={handleCopyClipboard}
            disabled={isExporting}
          >
            📋 复制图片至剪贴板
          </button>
          <button
            className="btn-primary"
            onClick={handleSaveImage}
            disabled={isExporting}
          >
            {isExporting ? '正在生成...' : '📥 保存为高清图片'}
          </button>
        </div>
      </div>
    </div>
  )
})

export default ChroniclePosterModal
