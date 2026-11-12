import { useEffect, useRef, useState } from 'react'

type Sample = { x: number; y: number; hex: string; r: number; g: number; b: number }

const GRID = 15 // pixels sampled around the cursor (odd, so there is a centre pixel)
const ZOOM = 10 // on-screen size of each sampled pixel
const LOUPE = GRID * ZOOM

const toHex = (value: number): string => value.toString(16).padStart(2, '0').toUpperCase()

/**
 * Live Color for Wayland sessions: the monitor is captured once (silently), then this overlay samples that
 * frame under the pointer in real time with a magnified pixel grid. Arrow keys nudge by one pixel for precision.
 */
export function LiveColorOverlay(): JSX.Element {
  const source = useRef<HTMLCanvasElement | null>(null)
  const loupe = useRef<HTMLCanvasElement | null>(null)
  const panel = useRef<HTMLDivElement | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [sample, setSample] = useState<Sample | null>(null)
  const finished = useRef(false)

  const finish = (hex: string | null): void => {
    if (finished.current) return
    finished.current = true
    window.gcpshot.finishLiveColor(hex)
  }

  useEffect(() => window.gcpshot.onLiveColorImage((payload) => setImage(payload.dataUrl)), [])

  useEffect(() => {
    if (!image) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0)
      source.current = canvas
      setPointer((current) => current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    }
    img.src = image
  }, [image])

  // Sample and draw the magnified grid whenever the pointer moves.
  useEffect(() => {
    const canvas = source.current, target = loupe.current
    if (!canvas || !target || !pointer) return
    const ratioX = canvas.width / window.innerWidth, ratioY = canvas.height / window.innerHeight
    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(pointer.x * ratioX)))
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(pointer.y * ratioY)))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const view = target.getContext('2d')
    if (!context || !view) return
    const half = Math.floor(GRID / 2)
    const area = context.getImageData(px - half, py - half, GRID, GRID).data
    view.imageSmoothingEnabled = false
    view.fillStyle = '#111520'
    view.fillRect(0, 0, LOUPE, LOUPE)
    for (let row = 0; row < GRID; row += 1) {
      for (let column = 0; column < GRID; column += 1) {
        const index = (row * GRID + column) * 4
        if (area[index + 3] === 0) continue
        view.fillStyle = `rgb(${area[index]}, ${area[index + 1]}, ${area[index + 2]})`
        view.fillRect(column * ZOOM, row * ZOOM, ZOOM, ZOOM)
      }
    }
    view.strokeStyle = 'rgba(255,255,255,0.08)'
    view.lineWidth = 1
    for (let line = 1; line < GRID; line += 1) {
      view.beginPath(); view.moveTo(line * ZOOM + 0.5, 0); view.lineTo(line * ZOOM + 0.5, LOUPE); view.stroke()
      view.beginPath(); view.moveTo(0, line * ZOOM + 0.5); view.lineTo(LOUPE, line * ZOOM + 0.5); view.stroke()
    }
    const centre = (half * GRID + half) * 4
    const [r, g, b] = [area[centre], area[centre + 1], area[centre + 2]]
    view.strokeStyle = '#000'; view.lineWidth = 3; view.strokeRect(half * ZOOM + 0.5, half * ZOOM + 0.5, ZOOM - 1, ZOOM - 1)
    view.strokeStyle = '#fff'; view.lineWidth = 1; view.strokeRect(half * ZOOM + 0.5, half * ZOOM + 0.5, ZOOM - 1, ZOOM - 1)
    setSample({ x: px, y: py, r, g, b, hex: `#${toHex(r)}${toHex(g)}${toHex(b)}` })
  }, [pointer])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); finish(null); return }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (sample) finish(sample.hex); return }
      const step = event.shiftKey ? 10 : 1
      const ratio = source.current ? window.innerWidth / source.current.width : 1
      const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (move) {
        event.preventDefault()
        setPointer((current) => current && {
          x: Math.min(window.innerWidth - 1, Math.max(0, current.x + move[0] * step * ratio)),
          y: Math.min(window.innerHeight - 1, Math.max(0, current.y + move[1] * step * ratio))
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sample])

  // Measure the real panel so it flips to the other side of the cursor instead of leaving the screen.
  const panelWidth = panel.current?.offsetWidth || LOUPE + 120, panelHeight = panel.current?.offsetHeight || LOUPE + 92
  const left = pointer ? (pointer.x + 28 + panelWidth > window.innerWidth ? pointer.x - 28 - panelWidth : pointer.x + 28) : 0
  const top = pointer ? (pointer.y + 28 + panelHeight > window.innerHeight ? pointer.y - 28 - panelHeight : pointer.y + 28) : 0

  return (
    <main
      className="live-color-overlay"
      onMouseMove={(event) => setPointer({ x: event.clientX, y: event.clientY })}
      onMouseDown={(event) => {
        event.preventDefault()
        if (event.button === 2) finish(null)
        else if (event.button === 0 && sample) finish(sample.hex)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {image && <img className="live-color-frame" src={image} alt="" draggable={false} />}
      {!image && <p className="live-color-loading">Preparando a amostragem…</p>}
      {pointer && image && (
        <div ref={panel} className="live-color-panel" style={{ left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)), top: Math.max(8, Math.min(top, window.innerHeight - panelHeight - 8)) }} aria-live="polite">
          <canvas ref={loupe} width={LOUPE} height={LOUPE} />
          <div className="live-color-readout">
            <span className="live-color-swatch" style={{ background: sample?.hex }} />
            <strong>{sample?.hex ?? '—'}</strong>
            <span>{sample ? `rgb(${sample.r}, ${sample.g}, ${sample.b})` : ''}</span>
          </div>
          <small>Clique ou Enter copia · setas ajustam 1 px · Esc cancela</small>
        </div>
      )}
    </main>
  )
}
