import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, CaptureAction, CaptureImagePayload, CaptureRect } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import { t } from '../shared/i18n'
import { createRect, eventMatchesShortcut, type Point } from './captureUtils'
import { ToolIcon, type EditorTool } from './icons'
import { clampWebcamPosition, createWebcamVideo, RegionRecorder } from './recordEngine'
import { SettingsPanel, type SettingsTab } from './SettingsPanel'

const initialRecordMode = (new URLSearchParams(window.location.search).get('mode') ?? 'region') as 'region' | 'fullscreen'
const recordTools: EditorTool[] = ['pen', 'arrow', 'numStamp']

type RecordPhase = 'select' | 'ready' | 'recording' | 'paused' | 'stopping'

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
  const [tool, setTool] = useState<EditorTool>('pen')
  const [color, setColor] = useState('#d94cff')
  const [size, setSize] = useState(4)
  const [actions, setActions] = useState<CaptureAction[]>([])
  const [draftAction, setDraftAction] = useState<CaptureAction | null>(null)
  const [nextNumStamp, setNextNumStamp] = useState(1)
  const [webcamPoint, setWebcamPoint] = useState<Point>({ x: 48, y: 48 })
  const [webcamDrag, setWebcamDrag] = useState<Point | null>(null)
  const [status, setStatus] = useState('')
  const recorderRef = useRef<RegionRecorder | null>(null)
  const actionsRef = useRef<CaptureAction[]>([])
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null)
  const webcamPreviewRef = useRef<HTMLVideoElement | null>(null)

  const language = settings.language

  useEffect(() => {
    void window.gcpshot.getSettings().then(setSettings)
    return window.gcpshot.onCaptureImage((nextPayload) => {
      setPayload(nextPayload)
      setBackdropDataUrl(null)
    })
  }, [])

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

    const rect = {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight
    }
    setSelectedRect(rect)
    setPhase('ready')
    setStatus(t(language, 'recordReady'))
  }, [language, payload])

  useEffect(() => {
    if (!settings.webcamEnabled || phase === 'select') {
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

  const activeRect = useMemo(() => {
    if (selectedRect) {
      return selectedRect
    }

    if (start && current) {
      return createRect(start, current)
    }

    return null
  }, [current, selectedRect, start])

  const visibleActions = draftAction ? [...actions, draftAction] : actions
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
      const canvasStream = await recorder.attachScreenStream(payload.screenSourceId, selectedRect)
      const audioStream = await recorder.attachAudio()
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
      setPhase('recording')
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
        return
      }

      setPhase('paused')
      setStatus(result.error ?? t(language, 'recordFailed'))
    } catch (error) {
      recorderRef.current = null
      setPhase('paused')
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
      setStatus(t(language, 'recordPaused'))
      return
    }

    recorder.resume()
    setPhase('recording')
    setStatus(t(language, 'recordActive'))
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
      tool: 'arrow',
      color,
      size,
      from: point,
      to: point
    })
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    if (isRecordControlTarget(event.target)) {
      return
    }

    const point = { x: event.clientX, y: event.clientY }

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

    setDraftAction({ ...draftAction, to: point })
  }

  function onMouseUp(event: React.MouseEvent<HTMLDivElement>): void {
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
    <main className="capture-overlay record-overlay" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      {backdropDataUrl && <img className="screen-backdrop" src={backdropDataUrl} alt="" draggable={false} />}
      <div className="capture-scrim" />

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
                <line
                  key={action.id}
                  x1={action.from.x}
                  y1={action.from.y}
                  x2={action.to.x}
                  y2={action.to.y}
                  stroke={action.color}
                  strokeWidth={action.size}
                />
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

      {settings.webcamEnabled && phase !== 'select' && (
        <div
          className={`webcam-bubble webcam-${settings.webcamShape}`}
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

      {phase === 'recording' || phase === 'paused' ? (
        <div
          className="record-dock"
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <strong>{t(language, 'recordTitle')}</strong>

          <div className="record-dock-tools">
            {recordTools.map((item) => (
              <button
                key={item}
                className={tool === item ? 'active icon-tool' : 'icon-tool'}
                onClick={() => setTool(item)}
                type="button"
                title={t(language, item === 'numStamp' ? 'toolNumStamp' : item === 'pen' ? 'toolPen' : 'toolArrow')}
              >
                <ToolIcon tool={item} />
              </button>
            ))}
            <label className="custom-color record-color">
              <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
            </label>
          </div>

          <div className="record-dock-actions">
            <button className="ghost-button large" type="button" onClick={togglePause} disabled={phase === 'stopping'}>
              {phase === 'paused' ? t(language, 'recordResume') : t(language, 'recordPause')}
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void stopRecording()}
              disabled={phase === 'stopping'}
            >
              {phase === 'stopping' ? t(language, 'recordSaving') : t(language, 'recordStop')}
            </button>
            <button className="ghost-button large" type="button" onClick={clearAnnotations} disabled={phase === 'stopping'}>
              {t(language, 'recordClear')}
            </button>
            <button
              className="ghost-button large"
              type="button"
              onClick={() => void window.gcpshot.cancelRecord()}
              disabled={phase === 'stopping'}
            >
              {t(language, 'cancelAction')}
            </button>
            <button className="ghost-button compact" type="button" onClick={() => setSettingsOpen(true)} disabled={phase === 'stopping'}>
              {t(language, 'settings')}
            </button>
          </div>
          <p>{status}</p>
        </div>
      ) : null}

      {phase === 'ready' && (
        <div
          className="record-dock record-dock-ready"
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <strong>{t(language, 'recordTitle')}</strong>
          <div className="record-dock-actions">
            <button className="primary-button" type="button" onClick={() => void startRecording()}>
              {t(language, 'recordStart')}
            </button>
            <button className="ghost-button large" type="button" onClick={() => void window.gcpshot.cancelRecord()}>
              {t(language, 'cancelAction')}
            </button>
          </div>
          <p>{status}</p>
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
