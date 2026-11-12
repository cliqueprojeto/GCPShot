import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, CaptureAction, CaptureImagePayload, CaptureRect } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import { t } from '../shared/i18n'
import { createRect, eventMatchesShortcut, type Point } from './captureUtils'
import { ActionIcon, ToolIcon, type EditorTool } from './icons'
import { clampWebcamPosition, createWebcamVideo, RegionRecorder } from './recordEngine'
import { SettingsPanel, type SettingsTab } from './SettingsPanel'

const initialRecordMode = (new URLSearchParams(window.location.search).get('mode') ?? 'region') as 'region' | 'fullscreen'
const recordTools: EditorTool[] = ['select', 'pen', 'arrow', 'rect', 'ellipse', 'line', 'magnifier', 'blur', 'pixelate', 'text', 'bubble', 'numStamp']

type RecordPhase = 'monitor' | 'select' | 'ready' | 'countdown' | 'recording' | 'paused' | 'stopping'

function isRecordControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      'button, input, select, textarea, label, a, .record-dock, .record-dock-tools, .settings-backdrop, .settings-window'
    )
  )
}

async function compositeSegments(
  segments: CaptureImagePayload['segments'],
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    return segments[0]?.dataUrl ?? ''
  }

  for (const segment of segments) {
    const image = new Image()
    image.src = segment.dataUrl
    await image.decode()
    context.drawImage(image, segment.x, segment.y, segment.width, segment.height)
  }

  return canvas.toDataURL('image/png')
}

function drawRecordAction(context: CanvasRenderingContext2D, action: CaptureAction): void {
  context.save()
  context.strokeStyle = action.color
  context.fillStyle = action.color
  context.lineWidth = action.size
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (action.tool === 'pen') {
    context.beginPath()
    action.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y)
      } else {
        context.lineTo(point.x, point.y)
      }
    })
    context.stroke()
  }

  if (action.tool === 'line' || action.tool === 'arrow') {
    context.beginPath()
    context.moveTo(action.from.x, action.from.y)
    context.lineTo(action.to.x, action.to.y)
    context.stroke()

    if (action.tool === 'arrow') {
      const angle = Math.atan2(action.to.y - action.from.y, action.to.x - action.from.x)
      const headLength = Math.max(14, action.size * 4)
      context.beginPath()
      context.moveTo(action.to.x, action.to.y)
      context.lineTo(
        action.to.x - headLength * Math.cos(angle - Math.PI / 6),
        action.to.y - headLength * Math.sin(angle - Math.PI / 6)
      )
      context.moveTo(action.to.x, action.to.y)
      context.lineTo(
        action.to.x - headLength * Math.cos(angle + Math.PI / 6),
        action.to.y - headLength * Math.sin(angle + Math.PI / 6)
      )
      context.stroke()
    }
  }

  if (action.tool === 'rect' || action.tool === 'ellipse') {
    const x = Math.min(action.from.x, action.to.x)
    const y = Math.min(action.from.y, action.to.y)
    const width = Math.abs(action.to.x - action.from.x)
    const height = Math.abs(action.to.y - action.from.y)
    if (action.tool === 'ellipse') {
      context.beginPath()
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
      context.stroke()
    } else {
      context.beginPath()
      context.roundRect(x, y, width, height, 10)
      context.stroke()
    }
  }

  if (action.tool === 'magnifier' || action.tool === 'blur' || action.tool === 'pixelate') {
    const x = Math.max(0, Math.min(action.from.x, action.to.x))
    const y = Math.max(0, Math.min(action.from.y, action.to.y))
    const width = Math.min(context.canvas.width - x, Math.abs(action.to.x - action.from.x))
    const height = Math.min(context.canvas.height - y, Math.abs(action.to.y - action.from.y))

    if (width < 2 || height < 2) {
      context.restore()
      return
    }

    const snapshot = document.createElement('canvas')
    snapshot.width = Math.max(1, Math.round(width))
    snapshot.height = Math.max(1, Math.round(height))
    const snapshotContext = snapshot.getContext('2d')

    if (!snapshotContext) {
      context.restore()
      return
    }

    snapshotContext.drawImage(context.canvas, x, y, width, height, 0, 0, width, height)

    if (action.tool === 'magnifier') {
      const zoom = 1.65
      const sourceWidth = width / zoom
      const sourceHeight = height / zoom
      const sourceX = Math.max(0, (width - sourceWidth) / 2)
      const sourceY = Math.max(0, (height - sourceHeight) / 2)
      context.save()
      context.beginPath()
      context.roundRect(x, y, width, height, action.magnifierRounded ? action.magnifierCornerRadius ?? 18 : 4)
      context.clip()
      context.imageSmoothingEnabled = true
      context.drawImage(snapshot, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
      context.restore()
      context.lineWidth = Math.max(3, action.size)
      context.stroke()
    } else if (action.tool === 'blur') {
      context.save()
      context.beginPath()
      context.roundRect(x, y, width, height, 10)
      context.clip()
      context.filter = `blur(${Math.max(8, action.size * 2)}px)`
      context.drawImage(snapshot, -12, -12, width + 24, height + 24, x - 12, y - 12, width + 24, height + 24)
      context.filter = 'none'
      context.fillStyle = 'rgba(255,255,255,0.08)'
      context.fillRect(x, y, width, height)
      context.restore()
      context.lineWidth = Math.max(3, action.size)
      context.stroke()
    } else {
      const pixelCanvas = document.createElement('canvas')
      const pixelContext = pixelCanvas.getContext('2d')
      const pixelSize = Math.max(7, action.size * 3)
      pixelCanvas.width = Math.max(1, Math.ceil(width / pixelSize))
      pixelCanvas.height = Math.max(1, Math.ceil(height / pixelSize))
      if (pixelContext) {
        pixelContext.imageSmoothingEnabled = false
        pixelContext.drawImage(snapshot, 0, 0, pixelCanvas.width, pixelCanvas.height)
        context.save()
        context.beginPath()
        context.roundRect(x, y, width, height, 10)
        context.clip()
        context.imageSmoothingEnabled = false
        context.drawImage(pixelCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height, x, y, width, height)
        context.restore()
      }
      context.lineWidth = Math.max(3, action.size)
      context.stroke()
    }
  }

  if (action.tool === 'cursorHighlight' || action.tool === 'cursorSpotlight') {
    const radius = Math.max(18, action.size * 6)
    context.beginPath()
    context.arc(action.at.x, action.at.y, radius, 0, Math.PI * 2)
    context.fillStyle = action.tool === 'cursorSpotlight' ? 'rgba(255,255,255,0.2)' : `${action.color}55`
    context.fill()
    context.lineWidth = 2
    context.strokeStyle = action.color
    context.stroke()
  }

  if (action.tool === 'text' || action.tool === 'bubble') {
    const fontSize = Math.max(18, action.size * 4)
    context.font = `800 ${fontSize}px Segoe UI`
    context.textBaseline = 'top'

    if (action.tool === 'bubble') {
      const padding = 12
      const metrics = context.measureText(action.text)
      const width = metrics.width + padding * 2
      const height = fontSize + padding * 2
      context.fillStyle = action.backgroundMode === 'transparent' ? 'transparent' : 'rgba(255,255,255,0.94)'
      context.strokeStyle = action.color
      context.lineWidth = 3
      context.beginPath()
      context.roundRect(action.at.x, action.at.y, width, height, 14)
      if (action.backgroundMode !== 'transparent') {
        context.fill()
      }
      context.stroke()
      context.fillStyle = action.color
      context.fillText(action.text, action.at.x + padding, action.at.y + padding)
    } else {
      context.fillStyle = action.color
      context.fillText(action.text, action.at.x, action.at.y)
    }
  }

  if (action.tool === 'numStamp') {
    const radius = Math.max(16, action.size * 4)
    context.beginPath()
    context.arc(action.at.x, action.at.y, radius, 0, Math.PI * 2)
    context.fillStyle = action.color
    context.fill()
    context.lineWidth = 3
    context.strokeStyle = '#ffffff'
    context.stroke()
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.max(16, action.size * 3)}px Segoe UI`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(action.number), action.at.x, action.at.y + 1)
  }

  context.restore()
}

function getToolTitle(language: AppSettings['language'], item: EditorTool): string {
  if (item === 'numStamp') return t(language, 'toolNumStamp')
  if (item === 'select') return t(language, 'toolSelect')
  if (item === 'pen') return t(language, 'toolPen')
  if (item === 'arrow') return t(language, 'toolArrow')
  if (item === 'rect') return t(language, 'toolRect')
  if (item === 'ellipse') return t(language, 'toolEllipse')
  if (item === 'line') return t(language, 'toolLine')
  if (item === 'magnifier') return t(language, 'toolMagnifier')
  if (item === 'blur') return t(language, 'toolBlur')
  if (item === 'pixelate') return t(language, 'toolPixelate')
  if (item === 'text') return t(language, 'toolText')
  if (item === 'bubble') return t(language, 'toolBubble')
  return t(language, 'toolPen')
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getArrowHead(from: Point, to: Point, size: number): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const headLength = Math.max(14, size * 4)
  const left = {
    x: to.x - headLength * Math.cos(angle - Math.PI / 6),
    y: to.y - headLength * Math.sin(angle - Math.PI / 6)
  }
  const right = {
    x: to.x - headLength * Math.cos(angle + Math.PI / 6),
    y: to.y - headLength * Math.sin(angle + Math.PI / 6)
  }

  return `${left.x},${left.y} ${to.x},${to.y} ${right.x},${right.y}`
}

function findRecordingSegment(payload: CaptureImagePayload, rect: CaptureRect): CaptureImagePayload['segments'][number] | null {
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  }

  return (
    payload.segments.find(
      (segment) =>
        center.x >= segment.x &&
        center.x <= segment.x + segment.width &&
        center.y >= segment.y &&
        center.y <= segment.y + segment.height
    ) ??
    payload.segments.find((segment) => segment.isPrimary) ??
    payload.segments[0] ??
    null
  )
}

function rectInsideSegment(rect: CaptureRect, segment: CaptureImagePayload['segments'][number]): CaptureRect {
  const x = Math.max(segment.x, rect.x)
  const y = Math.max(segment.y, rect.y)
  const right = Math.min(segment.x + segment.width, rect.x + rect.width)
  const bottom = Math.min(segment.y + segment.height, rect.y + rect.height)

  return {
    x: Math.max(0, x - segment.x),
    y: Math.max(0, y - segment.y),
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y)
  }
}

function clampFloatingPosition(point: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(8, point.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, point.y), Math.max(8, window.innerHeight - height - 8))
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function RecordOverlay(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('video')
  const [payload, setPayload] = useState<CaptureImagePayload | null>(null)
  const [backdropDataUrl, setBackdropDataUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<RecordPhase>('select')
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<CaptureRect | null>(null)
  const [tool, setTool] = useState<EditorTool>('select')
  const [color, setColor] = useState('#d94cff')
  const [size, setSize] = useState(4)
  const [actions, setActions] = useState<CaptureAction[]>([])
  const [draftAction, setDraftAction] = useState<CaptureAction | null>(null)
  const [nextNumStamp, setNextNumStamp] = useState(1)
  const [webcamPoint, setWebcamPoint] = useState<Point>({ x: 48, y: 48 })
  const [webcamDrag, setWebcamDrag] = useState<Point | null>(null)
  const [dockPoint, setDockPoint] = useState<Point>({ x: 24, y: Math.max(24, window.innerHeight - 172) })
  const [dockDrag, setDockDrag] = useState<Point | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [pausedStartedAt, setPausedStartedAt] = useState<number | null>(null)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [controlHover, setControlHover] = useState(false)
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [cursorEffectEnabled, setCursorEffectEnabled] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const recorderRef = useRef<RegionRecorder | null>(null)
  const actionsRef = useRef<CaptureAction[]>([])
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null)
  const webcamPreviewRef = useRef<HTMLVideoElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const webcamRef = useRef<HTMLDivElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  const language = settings.language

  useEffect(() => {
    void window.gcpshot.getSettings().then(setSettings)
    return window.gcpshot.onCaptureImage((nextPayload) => {
      setPayload(nextPayload)
      setBackdropDataUrl(null)
    })
  }, [])

  useEffect(() => {
    const active = phase === 'countdown' || phase === 'recording' || phase === 'paused' || phase === 'stopping'
    document.documentElement.classList.toggle('recording-active', active)
    document.body.classList.toggle('recording-active', active)

    return () => {
      document.documentElement.classList.remove('recording-active')
      document.body.classList.remove('recording-active')
    }
  }, [phase])

  useEffect(() => {
    if (!payload?.segments.length) {
      setBackdropDataUrl(payload?.dataUrl || null)
      return
    }

    let cancelled = false
    void compositeSegments(payload.segments, payload.virtualDesktop.width, payload.virtualDesktop.height).then((url) => {
      if (!cancelled) {
        setBackdropDataUrl(url)
      }
    })

    return () => {
      cancelled = true
    }
  }, [payload])

  useEffect(() => {
    void window.gcpshot.setRecordPassthrough(false)
  }, [phase])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent): void => {
      if (phase !== 'recording' && phase !== 'paused') {
        if (controlHover) {
          setControlHover(false)
        }
        return
      }

      const point = { x: event.clientX, y: event.clientY }
      setCursorPoint(point)
      const dockRect = dockRef.current?.getBoundingClientRect()
      const webcamRect = webcamRef.current?.getBoundingClientRect()
      const overDock =
        Boolean(dockRect) &&
        point.x >= dockRect!.left &&
        point.x <= dockRect!.right &&
        point.y >= dockRect!.top &&
        point.y <= dockRect!.bottom
      const overWebcam =
        Boolean(webcamRect) &&
        point.x >= webcamRect!.left &&
        point.x <= webcamRect!.right &&
        point.y >= webcamRect!.top &&
        point.y <= webcamRect!.bottom
      const nextHover = overDock || overWebcam

      setControlHover((current) => (current === nextHover ? current : nextHover))
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [controlHover, phase])

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = previewStream
    }
  }, [previewStream])

  useEffect(() => {
    if (phase !== 'recording' || recordingStartedAt === null) {
      return
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - recordingStartedAt)
    }, 250)

    return () => window.clearInterval(timer)
  }, [phase, recordingStartedAt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (eventMatchesShortcut(event, settings.recordPauseShortcut) && (phase === 'recording' || phase === 'paused')) {
        event.preventDefault()
        togglePause()
      }

      if (eventMatchesShortcut(event, settings.cancelShortcut)) {
        event.preventDefault()
        void window.gcpshot.cancelRecord()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, settings.cancelShortcut, settings.recordPauseShortcut])

  useEffect(() => {
    if (!payload || initialRecordMode !== 'fullscreen') {
      return
    }

    setSelectedRect(null)
    setPhase('monitor')
    setStatus('Escolha o monitor que sera gravado.')
  }, [language, payload])

  useEffect(() => {
    if (!settings.webcamEnabled || phase === 'select' || phase === 'monitor') {
      return
    }

    let disposed = false
    void createWebcamVideo(settings.webcamDeviceId).then((video) => {
      if (disposed) {
        video.srcObject = null
        return
      }

      webcamVideoRef.current = video
      if (webcamPreviewRef.current) {
        webcamPreviewRef.current.srcObject = video.srcObject
      }
    })

    return () => {
      disposed = true
      webcamVideoRef.current = null
    }
  }, [phase, settings.webcamDeviceId, settings.webcamEnabled])

  useEffect(() => {
    if (!dockDrag && !webcamDrag) {
      return
    }

    const onWindowMouseMove = (event: MouseEvent): void => {
      if (dockDrag) {
        const rect = dockRef.current?.getBoundingClientRect()
        setDockPoint(
          clampFloatingPosition(
            { x: event.clientX - dockDrag.x, y: event.clientY - dockDrag.y },
            rect?.width ?? 440,
            rect?.height ?? 156
          )
        )
      }

      if (webcamDrag) {
        setWebcamPoint(clampWebcamPosition({ x: event.clientX - webcamDrag.x, y: event.clientY - webcamDrag.y }, settings.webcamSize, { width: window.innerWidth, height: window.innerHeight }))
      }
    }

    const onWindowMouseUp = (): void => {
      setDockDrag(null)
      setWebcamDrag(null)
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [dockDrag, settings.webcamSize, webcamDrag])

  const activeRect = useMemo(() => {
    if (selectedRect) {
      return selectedRect
    }

    if (start && current) {
      return createRect(start, current)
    }

    return null
  }, [current, selectedRect, start])

  const cursorAction: CaptureAction | null =
    cursorEffectEnabled && cursorPoint && (phase === 'recording' || phase === 'paused')
      ? {
          id: 'live-cursor-highlight',
          tool: 'cursorHighlight',
          color: '#ffeb3b',
          size: 5,
          at: cursorPoint
        }
      : null
  const visibleActions = [...(draftAction ? [...actions, draftAction] : actions), ...(cursorAction ? [cursorAction] : [])]
  actionsRef.current = visibleActions

  useEffect(() => {
    recorderRef.current?.setCompositorOptions({
      getActions: () => actionsRef.current,
      drawAction: (context, action) => drawRecordAction(context, action),
      webcamVideo: settings.webcamEnabled ? webcamVideoRef.current : null,
      webcamRect: settings.webcamEnabled
        ? {
            x: webcamPoint.x,
            y: webcamPoint.y,
            size: settings.webcamSize,
            shape: settings.webcamShape,
            color: settings.webcamFrameColor
          }
        : undefined
    })
  }, [settings.webcamEnabled, settings.webcamFrameColor, settings.webcamShape, settings.webcamSize, visibleActions, webcamPoint])

  async function startRecording(): Promise<void> {
    if (!payload || !selectedRect) {
      return
    }

    try {
      const recorder = new RegionRecorder(settings)
      recorderRef.current = recorder
      const segment = findRecordingSegment(payload, selectedRect)
      if (!segment) {
        throw new Error(t(language, 'recordFailed'))
      }
      const localRect = rectInsideSegment(selectedRect, segment)
      const canvasStream = await recorder.attachScreenStream(segment.screenSourceId || payload.screenSourceId, localRect, {
        x: segment.x,
        y: segment.y
      })
      const audioStream = await recorder.attachAudio(segment.screenSourceId || payload.screenSourceId)
      recorder.setCompositorOptions({
        getActions: () => actionsRef.current,
        drawAction: (context, action) => drawRecordAction(context, action),
        webcamVideo: settings.webcamEnabled ? webcamVideoRef.current : null,
        webcamRect: settings.webcamEnabled
          ? {
              x: webcamPoint.x,
              y: webcamPoint.y,
              size: settings.webcamSize,
              shape: settings.webcamShape,
              color: settings.webcamFrameColor
            }
          : undefined
      })
      await recorder.start(canvasStream, audioStream)
      setPreviewStream(canvasStream)
      setPhase('recording')
      setElapsedMs(0)
      setPausedStartedAt(null)
      setRecordingStartedAt(Date.now())
      const codecLabel = t(language, recorder.getSelectedCodec().labelKey)
      setStatus(
        t(language, 'recordActiveWithCodec', {
          codec: codecLabel,
          storage: recorder.getSelectedCodec().hardwarePreferred ? 'GPU' : 'CPU'
        })
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t(language, 'recordFailed'))
    }
  }

  async function stopRecording(): Promise<void> {
    const recorder = recorderRef.current
    if (!recorder || phase === 'stopping') {
      return
    }

    setPhase('stopping')
    setStatus(t(language, 'recordSaving'))

    try {
      const recording = await recorder.stop()
      recorderRef.current = null
      const buffer = await recording.blob.arrayBuffer()
      const result = await window.gcpshot.saveRecording(buffer, { extension: recording.extension })

      if (result.ok) {
        setStatus(t(language, 'recordSaved', { path: result.path ?? '' }))
        setPreviewStream(null)
        setRecordingStartedAt(null)
        setPausedStartedAt(null)
        setElapsedMs(0)
        return
      }

      setPhase('paused')
      setPreviewStream(null)
      setStatus(result.error ?? t(language, 'recordFailed'))
    } catch (error) {
      recorderRef.current = null
      setPhase('paused')
      setPreviewStream(null)
      setStatus(error instanceof Error ? error.message : t(language, 'recordFailed'))
    }
  }

  function togglePause(): void {
    const recorder = recorderRef.current
    if (!recorder) {
      return
    }

    if (phase === 'recording') {
      recorder.pause()
      setPhase('paused')
      setPausedStartedAt(Date.now())
      setStatus(t(language, 'recordPaused'))
      return
    }

    recorder.resume()
    setPhase('recording')
    if (pausedStartedAt !== null && recordingStartedAt !== null) {
      setRecordingStartedAt(recordingStartedAt + Date.now() - pausedStartedAt)
    }
    setPausedStartedAt(null)
    setStatus(t(language, 'recordActive'))
  }

  async function beginCountdownThenStart(): Promise<void> {
    if (phase === 'countdown') {
      return
    }

    setPhase('countdown')
    for (const value of [3, 2, 1]) {
      setCountdown(value)
      await wait(720)
    }
    setCountdown(null)
    await startRecording()
  }

  function clearAnnotations(): void {
    setActions([])
    setDraftAction(null)
    setNextNumStamp(1)
    setStatus(t(language, 'recordCleared'))
  }

  function onMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (isRecordControlTarget(event.target)) {
      return
    }

    if (event.button !== 0 || phase === 'select') {
      if (phase === 'select') {
        setStart({ x: event.clientX, y: event.clientY })
        setCurrent({ x: event.clientX, y: event.clientY })
      }
      return
    }

    if (phase !== 'recording' && phase !== 'paused') {
      return
    }

    if (tool === 'select') {
      return
    }

    const point = { x: event.clientX, y: event.clientY }

    if (settings.webcamEnabled) {
      const webcamSize = settings.webcamSize
      if (
        point.x >= webcamPoint.x &&
        point.x <= webcamPoint.x + webcamSize &&
        point.y >= webcamPoint.y &&
        point.y <= webcamPoint.y + webcamSize
      ) {
        setWebcamDrag({ x: point.x - webcamPoint.x, y: point.y - webcamPoint.y })
        return
      }
    }

    if (!selectedRect || point.x < selectedRect.x || point.x > selectedRect.x + selectedRect.width || point.y < selectedRect.y || point.y > selectedRect.y + selectedRect.height) {
      return
    }

    if (tool === 'numStamp') {
      setActions((currentActions) => [
        ...currentActions,
        {
          id: crypto.randomUUID(),
          tool: 'numStamp',
          color,
          size,
          at: point,
          number: nextNumStamp
        }
      ])
      setNextNumStamp((value) => value + 1)
      return
    }

    if (tool === 'text' || tool === 'bubble') {
      const text = window.prompt(t(language, tool === 'bubble' ? 'enterBubbleText' : 'enterText'))
      if (!text?.trim()) {
        return
      }

      setActions((currentActions) => [
        ...currentActions,
        {
          id: crypto.randomUUID(),
          tool,
          color,
          size,
          at: point,
          text: text.trim(),
          bubbleStyle: tool === 'bubble' ? 'speech' : undefined,
          backgroundMode: tool === 'bubble' ? 'filled' : undefined
        }
      ])
      return
    }

    if (tool === 'pen') {
      setDraftAction({
        id: crypto.randomUUID(),
        tool: 'pen',
        color,
        size,
        points: [point]
      })
      return
    }

    setDraftAction({
      id: crypto.randomUUID(),
      tool:
        tool === 'line' ||
        tool === 'rect' ||
        tool === 'ellipse' ||
        tool === 'magnifier' ||
        tool === 'blur' ||
        tool === 'pixelate'
          ? tool
          : 'arrow',
      color,
      size,
      from: point,
      to: point
    })
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    const point = { x: event.clientX, y: event.clientY }

    if (dockDrag) {
      setDockPoint(
        clampWebcamPosition(
          { x: point.x - dockDrag.x, y: point.y - dockDrag.y },
          320,
          { width: window.innerWidth, height: window.innerHeight }
        )
      )
      return
    }

    if (isRecordControlTarget(event.target)) {
      return
    }

    if (webcamDrag) {
      setWebcamPoint(
        clampWebcamPosition(
          { x: point.x - webcamDrag.x, y: point.y - webcamDrag.y },
          settings.webcamSize,
          { width: window.innerWidth, height: window.innerHeight }
        )
      )
      return
    }

    if (phase === 'select' && start) {
      setCurrent(point)
      return
    }

    if (!draftAction) {
      return
    }

    if (draftAction.tool === 'pen') {
      setDraftAction({ ...draftAction, points: [...draftAction.points, point] })
      return
    }

    if ('from' in draftAction) setDraftAction({ ...draftAction, to: point })
  }

  function onMouseUp(event: React.MouseEvent<HTMLDivElement>): void {
    if (dockDrag) {
      setDockDrag(null)
      return
    }

    if (isRecordControlTarget(event.target)) {
      return
    }

    if (webcamDrag) {
      setWebcamDrag(null)
      return
    }

    if (draftAction) {
      setActions((currentActions) => [...currentActions, draftAction])
      setDraftAction(null)
      return
    }

    if (phase !== 'select' || !start || !current) {
      return
    }

    const rect = createRect(start, current)
    setStart(null)
    setCurrent(null)

    if (rect.width < 12 || rect.height < 12) {
      setStatus(t(language, 'selectionTooSmall'))
      return
    }

    setSelectedRect(rect)
    setPhase('ready')
    setStatus(t(language, 'recordReady'))
  }

  return (
    <main
      className={phase === 'countdown' || phase === 'recording' || phase === 'paused' || phase === 'stopping' ? 'capture-overlay record-overlay recording-live' : 'capture-overlay record-overlay'}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {backdropDataUrl && phase !== 'countdown' && phase !== 'recording' && phase !== 'paused' && phase !== 'stopping' && (
        <img className="screen-backdrop" src={backdropDataUrl} alt="" draggable={false} />
      )}
      {phase !== 'countdown' && phase !== 'recording' && phase !== 'paused' && phase !== 'stopping' && <div className="capture-scrim" />}

      {(selectedRect ?? activeRect) && (
        <div
          className="selection-box"
          style={{
            left: (selectedRect ?? activeRect)!.x,
            top: (selectedRect ?? activeRect)!.y,
            width: (selectedRect ?? activeRect)!.width,
            height: (selectedRect ?? activeRect)!.height
          }}
        />
      )}

      {phase !== 'select' && (
        <svg className="annotation-layer">
          {visibleActions.map((action) => {
            if (action.tool === 'pen') {
              return (
                <polyline
                  key={action.id}
                  points={action.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={action.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={action.size}
                />
              )
            }

            if (action.tool === 'arrow' || action.tool === 'line') {
              return (
                <g key={action.id}>
                  <line
                    x1={action.from.x}
                    y1={action.from.y}
                    x2={action.to.x}
                    y2={action.to.y}
                    stroke={action.color}
                    strokeLinecap="round"
                    strokeWidth={action.size}
                  />
                  {action.tool === 'arrow' && (
                    <polyline
                      points={getArrowHead(action.from, action.to, action.size)}
                      fill="none"
                      stroke={action.color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={action.size}
                    />
                  )}
                </g>
              )
            }

            if (action.tool === 'rect' || action.tool === 'ellipse') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)

              if (action.tool === 'ellipse') {
                return (
                  <ellipse
                    key={action.id}
                    cx={x + width / 2}
                    cy={y + height / 2}
                    rx={width / 2}
                    ry={height / 2}
                    fill="none"
                    stroke={action.color}
                    strokeWidth={action.size}
                  />
                )
              }

              return (
                <rect
                  key={action.id}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="10"
                  fill="none"
                  stroke={action.color}
                  strokeWidth={action.size}
                />
              )
            }

            if (action.tool === 'magnifier' || action.tool === 'blur' || action.tool === 'pixelate') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)

              return (
                <g key={action.id}>
                  <foreignObject x={x} y={y} width={width} height={height}>
                    <div
                      className={`record-live-effect record-live-${action.tool}`}
                      style={{ borderColor: action.color, borderWidth: Math.max(2, action.size) }}
                    />
                  </foreignObject>
                </g>
              )
            }

            if (action.tool === 'cursorHighlight' || action.tool === 'cursorSpotlight') {
              const radius = Math.max(18, action.size * 6)
              return (
                <circle
                  key={action.id}
                  cx={action.at.x}
                  cy={action.at.y}
                  r={radius}
                  fill={`${action.color}55`}
                  stroke={action.color}
                  strokeWidth="2"
                />
              )
            }

            if (action.tool === 'text' || action.tool === 'bubble') {
              const fontSize = Math.max(18, action.size * 4)
              const width = Math.max(120, action.text.length * fontSize * 0.58 + 24)
              const height = fontSize + 24

              return (
                <g key={action.id}>
                  {action.tool === 'bubble' && (
                    <rect
                      x={action.at.x}
                      y={action.at.y}
                      width={width}
                      height={height}
                      rx="14"
                      fill="rgba(255,255,255,0.94)"
                      stroke={action.color}
                      strokeWidth="3"
                    />
                  )}
                  <text
                    x={action.tool === 'bubble' ? action.at.x + 12 : action.at.x}
                    y={action.tool === 'bubble' ? action.at.y + 12 : action.at.y}
                    fill={action.color}
                    fontSize={fontSize}
                    fontWeight="800"
                    dominantBaseline="hanging"
                  >
                    {action.text}
                  </text>
                </g>
              )
            }

            if (action.tool === 'numStamp') {
              const radius = Math.max(16, action.size * 4)
              return (
                <g key={action.id}>
                  <circle cx={action.at.x} cy={action.at.y} r={radius} fill={action.color} stroke="#fff" strokeWidth="3" />
                  <text x={action.at.x} y={action.at.y + 1} fill="#fff" fontSize={Math.max(16, action.size * 3)} fontWeight="900" textAnchor="middle">
                    {action.number}
                  </text>
                </g>
              )
            }

            return null
          })}
        </svg>
      )}

      {settings.webcamEnabled && phase !== 'select' && phase !== 'monitor' && (
        <div
          ref={webcamRef}
          className={`webcam-bubble webcam-${settings.webcamShape}`}
          onMouseDown={(event) => {
            event.stopPropagation()
            setWebcamDrag({ x: event.clientX - webcamPoint.x, y: event.clientY - webcamPoint.y })
          }}
          style={{
            left: webcamPoint.x,
            top: webcamPoint.y,
            width: settings.webcamSize,
            height: settings.webcamSize,
            borderColor: settings.webcamFrameColor
          }}
        >
          <video ref={webcamPreviewRef} autoPlay muted playsInline />
        </div>
      )}

      {phase === 'recording' || phase === 'paused' || phase === 'stopping' ? (
        <div
          ref={dockRef}
          className={phase === 'paused' ? 'record-dock record-dock-live paused' : 'record-dock record-dock-live'}
          style={{ left: dockPoint.x, top: dockPoint.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <div className="record-dock-head">
            <button
              className="record-dock-grip"
              type="button"
              title={t(language, 'moveToolbar')}
              onMouseDown={(event) => {
                event.stopPropagation()
                const rect = dockRef.current?.getBoundingClientRect()
                if (rect) {
                  setDockDrag({ x: event.clientX - rect.left, y: event.clientY - rect.top })
                }
              }}
            >
              ⋮⋮
            </button>
            <span className="record-live-dot">rec</span>
            <strong>{phase === 'paused' ? t(language, 'recordPaused') : t(language, 'recordActive')}</strong>
            <time>{formatElapsed(elapsedMs)}</time>
          </div>

          <div className="record-dock-tools">
            {recordTools.map((item) => (
              <button
                key={item}
                className={tool === item ? 'active icon-tool' : 'icon-tool'}
                onClick={() => setTool(item)}
                type="button"
                title={getToolTitle(language, item)}
              >
                <ToolIcon tool={item} />
              </button>
            ))}
            <label className="custom-color record-color">
              <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
            </label>
            <button
              className={cursorEffectEnabled ? 'active icon-tool' : 'icon-tool'}
              type="button"
              title="Cursor effect"
              onClick={() => setCursorEffectEnabled((value) => !value)}
            >
              ●
            </button>
            <input
              className="record-size-slider"
              type="range"
              min="2"
              max="16"
              value={size}
              onChange={(event) => setSize(Number(event.currentTarget.value))}
              title={t(language, 'toolThickness')}
            />
          </div>

          <div className="record-dock-actions">
            <button className="ghost-button compact" type="button" onClick={togglePause} disabled={phase === 'stopping'}>
              {phase === 'paused' ? t(language, 'recordResume') : t(language, 'recordPause')}
            </button>
            <button
              className="record-stop-button"
              type="button"
              onClick={() => void stopRecording()}
              disabled={phase === 'stopping'}
            >
              {phase === 'stopping' ? t(language, 'recordSaving') : t(language, 'recordStop')}
            </button>
            <button className="ghost-button compact" type="button" onClick={clearAnnotations} disabled={phase === 'stopping'} title={t(language, 'recordClear')}>
              <ActionIcon type="undo" />
            </button>
            <button
              className="ghost-button compact"
              type="button"
              onClick={() => void window.gcpshot.cancelRecord()}
              disabled={phase === 'stopping'}
              title={t(language, 'cancelAction')}
            >
              <ActionIcon type="close" />
            </button>
            <button className="ghost-button compact" type="button" onClick={() => setSettingsOpen(true)} disabled={phase === 'stopping'}>
              <ActionIcon type="settings" />
            </button>
          </div>
          <p>{status}</p>
        </div>
      ) : null}

      {phase === 'ready' && (
        <div
          ref={dockRef}
          className="record-dock record-dock-live record-dock-ready"
          style={{ left: dockPoint.x, top: dockPoint.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <div className="record-dock-head">
            <button
              className="record-dock-grip"
              type="button"
              title={t(language, 'moveToolbar')}
              onMouseDown={(event) => {
                event.stopPropagation()
                const rect = dockRef.current?.getBoundingClientRect()
                if (rect) {
                  setDockDrag({ x: event.clientX - rect.left, y: event.clientY - rect.top })
                }
              }}
            >
              ::
            </button>
            <span className="record-live-dot">rec</span>
            <strong>{t(language, 'recordTitle')}</strong>
            <time>00:00</time>
          </div>
          <div className="record-dock-actions">
            <button className="primary-button" type="button" onClick={() => void beginCountdownThenStart()}>
              {t(language, 'recordStart')}
            </button>
            <button className="ghost-button large" type="button" onClick={() => void window.gcpshot.cancelRecord()}>
              {t(language, 'cancelAction')}
            </button>
          </div>
          <p>{status}</p>
        </div>
      )}

      {phase === 'countdown' && countdown !== null && (
        <div className="record-countdown" aria-live="assertive">
          <span>{countdown}</span>
        </div>
      )}

      {phase === 'monitor' && payload && (
        <div className="monitor-picker">
          <strong>Escolha qual monitor gravar</strong>
          <span>A tela real continuara visivel durante a gravacao.</span>
          <div>
            {payload.segments.map((segment, index) => (
              <button
                key={`${segment.x}-${segment.y}-${segment.width}-${segment.height}`}
                type="button"
                onClick={() => {
                  setSelectedRect({ x: segment.x, y: segment.y, width: segment.width, height: segment.height })
                  setPhase('ready')
                  setStatus(t(language, 'recordReady'))
                }}
              >
                <img src={segment.dataUrl} alt="" />
                <span>{segment.isPrimary ? `Monitor ${index + 1} - principal` : `Monitor ${index + 1}`}</span>
                <small>{segment.width} x {segment.height}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'select' && (
        <div className="capture-help">
          <strong>{t(language, 'recordSelectArea')}</strong>
          <span>{status || t(language, 'dragSelect')}</span>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          language={language}
          settingsTab={settingsTab}
          recordingShortcut={null}
          overlay
          onTabChange={setSettingsTab}
          onClose={() => setSettingsOpen(false)}
          onUpdateSetting={(patch) => void window.gcpshot.updateSettings(patch).then(setSettings)}
          onReset={() => void window.gcpshot.resetSettings().then(setSettings)}
          onRecordingShortcutChange={() => undefined}
        />
      )}
    </main>
  )
}
