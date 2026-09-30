import { useEffect, useRef, useCallback, memo } from 'react'
import './SpectrumVisualizer.css'

const SpectrumVisualizer = memo(function SpectrumVisualizer({
  audioElement,
  mode = 'bars',
  barCount = 64,
  sensitivity = 1.5,
  colorStart = '#c96442',
  colorEnd = '#ec4899',
  height = 60,
  showBg = true,
  className = '',
}) {
  const canvasRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const animationRef = useRef(null)
  const dataArrayRef = useRef(null)

  const setupAudioContext = useCallback(() => {
    if (!audioElement || audioCtxRef.current) return

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return

      const audioCtx = new AudioCtx()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      const source = audioCtx.createMediaElementSource(audioElement)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)

      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      sourceRef.current = source

      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
    } catch (e) {
      console.warn('Spectrum visualizer setup failed:', e)
    }
  }, [audioElement])

  const drawRoundRect = (ctx, x, y, w, h, radii) => {
    const r = Array.isArray(radii) ? radii : [radii, radii, radii, radii]
    const [tl, tr, br, bl] = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r

    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, [tl, tr, br, bl])
    } else {
      ctx.moveTo(x + tl, y)
      ctx.lineTo(x + w - tr, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
      ctx.lineTo(x + w, y + h - br)
      ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
      ctx.lineTo(x + bl, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
      ctx.lineTo(x, y + tl)
      ctx.quadraticCurveTo(x, y, x + tl, y)
      ctx.closePath()
    }
  }

  const drawBars = useCallback((ctx, width, height, dataArray) => {
    const barCountVal = Math.min(barCount, dataArray.length)
    const barWidth = width / barCountVal
    const step = Math.floor(dataArray.length / barCountVal)

    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, colorStart)
    gradient.addColorStop(1, colorEnd)

    for (let i = 0; i < barCountVal; i++) {
      const dataIndex = i * step
      const value = dataArray[dataIndex] || 0
      const barHeight = Math.max(1, (value / 255) * height * sensitivity)
      const x = i * barWidth
      const y = height - barHeight

      ctx.fillStyle = gradient
      const radius = Math.min(barWidth * 0.3, 3)
      drawRoundRect(ctx, x + 1, y, barWidth - 2, barHeight, [radius, radius, 0, 0])
      ctx.fill()
    }
  }, [barCount, sensitivity, colorStart, colorEnd])

  const drawWave = useCallback((ctx, width, height, dataArray) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0)
    gradient.addColorStop(0, colorStart)
    gradient.addColorStop(1, colorEnd)

    ctx.lineWidth = 2
    ctx.strokeStyle = gradient
    ctx.beginPath()

    const sliceWidth = width / dataArray.length
    let x = 0

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * height * 0.5) / 2 * sensitivity + height * 0.25

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }, [sensitivity, colorStart, colorEnd])

  const drawCircle = useCallback((ctx, width, height, dataArray) => {
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.3

    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5)
    gradient.addColorStop(0, colorStart)
    gradient.addColorStop(1, colorEnd)

    ctx.strokeStyle = gradient
    ctx.lineWidth = 2

    const barCountVal = Math.min(barCount, dataArray.length)
    const angleStep = (Math.PI * 2) / barCountVal
    const step = Math.floor(dataArray.length / barCountVal)

    for (let i = 0; i < barCountVal; i++) {
      const dataIndex = i * step
      const value = dataArray[dataIndex] || 0
      const barHeight = (value / 255) * radius * 0.8 * sensitivity

      const angle = i * angleStep - Math.PI / 2
      const x1 = centerX + Math.cos(angle) * radius
      const y1 = centerY + Math.sin(angle) * radius
      const x2 = centerX + Math.cos(angle) * (radius + barHeight)
      const y2 = centerY + Math.sin(angle) * (radius + barHeight)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }, [barCount, sensitivity, colorStart, colorEnd])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current

    if (!canvas || !analyser || !dataArray) {
      animationRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    if (showBg) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, width, height)
    }

    analyser.getByteFrequencyData(dataArray)

    if (mode === 'bars') {
      drawBars(ctx, width, height, dataArray)
    } else if (mode === 'wave') {
      drawWave(ctx, width, height, dataArray)
    } else if (mode === 'circle') {
      drawCircle(ctx, width, height, dataArray)
    }

    animationRef.current = requestAnimationFrame(draw)
  }, [mode, showBg, drawBars, drawWave, drawCircle])

  useEffect(() => {
    if (audioElement) {
      setupAudioContext()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [audioElement, setupAudioContext])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()

    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`spectrum-visualizer spectrum-${mode} ${className}`}
      style={{ height: `${height}px` }}
    />
  )
})

export default SpectrumVisualizer
