import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  CaptureAction,
  CaptureExportPayload,
  CaptureImagePayload,
  CaptureMode,
  CaptureRect,
  CaptureSegment,
  SettingsShortcutKey
} from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import type { AppLanguage } from '../shared/i18n'
import { t } from '../shared/i18n'
import packageJson from '../../package.json'
import logoGcp from './assets/logo-gcp.png'
import { ContributionPanel, GCP_SITE_URL } from './ContributionPanel'
import { LandingButton } from './LandingButton'
import { Studio } from './Studio'
import { pushCaptureToStudioAsync } from './studioStorage'
import {
  clampToolbarPosition,
  cursorForResizeHandle,
  eventMatchesShortcut,
  getSelectionHandlePositions,
  getSelectionResizeHandle,
  getToolbarPositionForRect,
  resizeSelectionRect,
  type Point,
  type ResizeHandle
} from './captureUtils'
import { ActionIcon, ToolIcon, type EditorTool } from './icons'
import { SettingsPanel, type SettingsTab } from './SettingsPanel'

type StampTone = Extract<CaptureAction, { tool: 'stamp' }>['tone']
type PendingText = {
  tool: 'text' | 'bubble'
  at: Point
  value: string
}
type ToolbarMenu = 'shapes' | 'colors' | 'size' | 'tool-options' | null
type SelectionAdjustState = {
  handle: ResizeHandle
  startPoint: Point
  originRect: CaptureRect
  originActions: CaptureAction[]
}

const isCaptureMode = new URLSearchParams(window.location.search).get('capture') === '1'
const initialCaptureMode = (new URLSearchParams(window.location.search).get('mode') ?? 'region') as CaptureMode
const palettes = {
  GCP: ['#7b2ff7', '#d94cff', '#ffcf70', '#ffffff', '#2b0f43'],
  Lightshot: ['#ff3b58', '#ffcf70', '#48e59b', '#52a8ff', '#ffffff'],
  Snagit: ['#ef4444', '#f97316', '#22c55e', '#2563eb', '#111827'],
  Neutros: ['#ffffff', '#d1d5db', '#6b7280', '#111827', '#000000']
}
const toolOptions = [
  'select',
  'move',
  'pen',
  'arrow',
  'magnifier',
  'blur',
  'pixelate',
  'text',
  'bubble',
  'stamp',
  'numStamp'
] as const
const shapeOptions = ['rect', 'ellipse', 'line', 'star'] as const
const stampPresets = [
  { label: 'APROVADO', tone: 'approved' },
  { label: 'REVISAR', tone: 'review' },
  { label: 'CONFIDENCIAL', tone: 'private' },
  { label: 'ATENÇÃO', tone: 'warning' },
  { label: 'GCP', tone: 'custom' }
] as const

type StampPreset = {
  label: string
  tone: StampTone
}

const toolsWithOptions: EditorTool[] = ['bubble', 'stamp', 'magnifier', 'blur', 'pixelate']
const toolsWithOutlineToggle: EditorTool[] = ['blur', 'pixelate', 'magnifier']

function getMagnifierCornerRadius(
  action: { magnifierMode?: 'ellipse' | 'rectangle'; magnifierCornerRadius?: number; magnifierRounded?: boolean },
  width: number,
  height: number
): number {
  if (action.magnifierMode !== 'rectangle') {
    return 0
  }

  if (typeof action.magnifierCornerRadius === 'number') {
    return Math.min(action.magnifierCornerRadius, width / 2, height / 2)
  }

  if (action.magnifierRounded) {
    return Math.min(22, width / 5, height / 5)
  }

  return 0
}

function clampMagnifierAnchor(anchor: Point, rect: CaptureRect, width: number, height: number): Point {
  return {
    x: Math.max(rect.x, Math.min(anchor.x, rect.x + rect.width - width)),
    y: Math.max(rect.y, Math.min(anchor.y, rect.y + rect.height - height))
  }
}

function magnifierAnchorFromPoint(point: Point, rect: CaptureRect, width: number, height: number): Point {
  return clampMagnifierAnchor(
    {
      x: point.x - width / 2,
      y: point.y - height / 2
    },
    rect,
    width,
    height
  )
}

async function compositeCaptureSegments(segments: CaptureSegment[], width: number, height: number): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
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

function createRect(start: Point, end: Point): CaptureRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

const editorToolShortcutMap: Array<[SettingsShortcutKey, EditorTool]> = [
  ['selectShortcut', 'select'],
  ['moveShortcut', 'move'],
  ['penShortcut', 'pen'],
  ['arrowShortcut', 'arrow'],
  ['magnifierShortcut', 'magnifier'],
  ['blurShortcut', 'blur'],
  ['pixelateShortcut', 'pixelate'],
  ['textShortcut', 'text'],
  ['bubbleShortcut', 'bubble'],
  ['stampShortcut', 'stamp'],
  ['numStampShortcut', 'numStamp'],
  ['rectShortcut', 'rect'],
  ['ellipseShortcut', 'ellipse'],
  ['lineShortcut', 'line'],
  ['starShortcut', 'star']
]

const editorToolToShortcutKey = Object.fromEntries(
  editorToolShortcutMap.map(([shortcutKey, editorTool]) => [editorTool, shortcutKey])
) as Partial<Record<EditorTool, SettingsShortcutKey>>

function formatTooltip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}

function toolTooltip(language: AppLanguage, tool: EditorTool, settings: AppSettings): string {
  const shortcutKey = editorToolToShortcutKey[tool]
  return formatTooltip(toolLabel(language, tool), shortcutKey ? settings[shortcutKey] : undefined)
}

function actionTooltip(
  language: AppLanguage,
  labelKey: Parameters<typeof t>[1],
  shortcutKey: SettingsShortcutKey,
  settings: AppSettings
): string {
  return formatTooltip(t(language, labelKey), settings[shortcutKey])
}

function toolLabel(language: AppLanguage, tool: EditorTool): string {
  const map: Partial<Record<EditorTool, Parameters<typeof t>[1]>> = {
    select: 'toolSelect',
    move: 'toolMove',
    pen: 'toolPen',
    arrow: 'toolArrow',
    magnifier: 'toolMagnifier',
    blur: 'toolBlur',
    pixelate: 'toolPixelate',
    text: 'toolText',
    bubble: 'toolBubble',
    stamp: 'toolStamp',
    numStamp: 'toolNumStamp',
    rect: 'toolRect',
    ellipse: 'toolEllipse',
    line: 'toolLine',
    star: 'toolStar'
  }

  const key = map[tool]
  return key ? t(language, key) : tool
}

function Landing(): JSX.Element {
  const [view, setView] = useState<'home' | 'studio'>('home')
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [recordingShortcut, setRecordingShortcut] = useState<SettingsShortcutKey | null>(null)
  const [status, setStatus] = useState('')

  const language = settings.language

  useEffect(() => {
    void window.gcpshot.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    setStatus(t(language, 'readyToCapture', { shortcut: settings.captureShortcut }))
  }, [language, settings.captureShortcut])

  useEffect(() => {
    return window.gcpshot.onOpenSettings(() => setSettingsOpen(true))
  }, [])

  async function startCapture(mode: CaptureMode): Promise<void> {
    const result = await window.gcpshot.beginCapture(mode)
    setStatus(
      result.ok
        ? mode === 'fullscreen'
          ? t(language, 'fullscreenSelected')
          : t(language, 'dragSelect')
        : result.error ?? t(language, 'copyFailed')
    )
  }

  async function openStudio(): Promise<void> {
    setView('studio')
  }

  async function updateSetting(patch: Partial<AppSettings>): Promise<void> {
    const nextSettings = await window.gcpshot.updateSettings(patch)
    setSettings(nextSettings)
    setStatus(t(nextSettings.language, 'settingsUpdated'))
  }

  async function resetSettings(): Promise<void> {
    const nextSettings = await window.gcpshot.resetSettings()
    setSettings(nextSettings)
    setRecordingShortcut(null)
    setStatus(t(nextSettings.language, 'settingsReset'))
  }

  if (view === 'studio') {
    return (
      <>
        <Studio
          language={language}
          settings={settings}
          onBack={() => setView('home')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            language={language}
            settingsTab={settingsTab}
            recordingShortcut={recordingShortcut}
            onTabChange={setSettingsTab}
            onClose={() => setSettingsOpen(false)}
            onUpdateSetting={(patch) => void updateSetting(patch)}
            onReset={() => void resetSettings()}
            onRecordingShortcutChange={setRecordingShortcut}
          />
        )}
      </>
    )
  }

  return (
    <main className="app-shell">
      <section className="product-panel">
        <header className="top-nav">
          <div className="brand-row">
            <a className="brand-mark logo-mark" href={GCP_SITE_URL} target="_blank" rel="noreferrer" aria-label="Gestão Cultural Pro">
              <img src={logoGcp} alt="Gestão Cultural Pro" />
            </a>
            <div>
              <p className="eyebrow">
                <a href={GCP_SITE_URL} target="_blank" rel="noreferrer">
                  Gestão Cultural Pro
                </a>{' '}
                Shot
              </p>
              <h1>{t(language, 'appName')}</h1>
              <p className="developer-line">{t(language, 'developedBy')}</p>
            </div>
          </div>
          <div className="nav-actions settings-nav-actions">
            <span className="settings-pointer" aria-hidden="true">
              <span className="settings-pointer-arrow" />
              <span className="settings-pointer-label">{t(language, 'settingsArrowHint')}</span>
            </span>
            <button className="ghost-button settings-target-button" onClick={() => setSettingsOpen(true)}>
              {t(language, 'settings')}
            </button>
            <LandingButton
              label={t(language, 'openStudio')}
              shortcut={settings.studioShortcut}
              className="compact"
              onClick={() => void openStudio()}
            />
          </div>
        </header>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="tag">{t(language, 'heroTag')}</p>
            <h2>{t(language, 'heroTitle')}</h2>
            <p className="subtitle">{t(language, 'heroSubtitle')}</p>

            <div className="action-row">
              <LandingButton
                label={t(language, 'captureRegion')}
                shortcut={settings.captureShortcut}
                variant="primary"
                onClick={() => void startCapture('region')}
              />
              <LandingButton
                label={t(language, 'captureFullscreen')}
                shortcut={settings.fullscreenShortcut}
                onClick={() => void startCapture('fullscreen')}
              />
              {settings.printScreenShortcut && <span className="shortcut-pill">Print Screen</span>}
            </div>

            <p className="status-line">{status}</p>
          </div>

          <ContributionPanel language={language} />
        </div>

        <section className="feature-strip">
          <article>
            <strong>{t(language, 'featureTray')}</strong>
            <span>{t(language, 'featureTrayDesc')}</span>
          </article>
          <article>
            <strong>{t(language, 'featureAnnotate')}</strong>
            <span>{t(language, 'featureAnnotateDesc')}</span>
          </article>
          <article>
            <strong>{t(language, 'featureExport')}</strong>
            <span>{t(language, 'featureExportDesc')}</span>
          </article>
          <article>
            <strong>{t(language, 'featureStudio')}</strong>
            <span>{t(language, 'featureStudioDesc')}</span>
          </article>
        </section>

        <p className="credit-line">
          {t(language, 'credit')} · v{packageJson.version} ·{' '}
          <a href={GCP_SITE_URL} target="_blank" rel="noreferrer">
            gestaoculturalpro.com.br
          </a>
        </p>
      </section>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          language={language}
          settingsTab={settingsTab}
          recordingShortcut={recordingShortcut}
          onTabChange={setSettingsTab}
          onClose={() => setSettingsOpen(false)}
          onUpdateSetting={(patch) => void updateSetting(patch)}
          onReset={() => void resetSettings()}
          onRecordingShortcutChange={setRecordingShortcut}
        />
      )}
    </main>
  )
}

function CaptureOverlay(): JSX.Element {
  const [payload, setPayload] = useState<CaptureImagePayload | null>(null)
  const [backdropDataUrl, setBackdropDataUrl] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [recordingShortcut, setRecordingShortcut] = useState<SettingsShortcutKey | null>(null)
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<CaptureRect | null>(null)
  const [tool, setTool] = useState<EditorTool>('select')
  const [openMenu, setOpenMenu] = useState<ToolbarMenu>(null)
  const [paletteName, setPaletteName] = useState<keyof typeof palettes>('GCP')
  const [color, setColor] = useState('#d94cff')
  const [size, setSize] = useState(4)
  const [privacyIntensity, setPrivacyIntensity] = useState(8)
  const [bubbleStyle, setBubbleStyle] = useState<'speech' | 'caption' | 'thought'>('speech')
  const [bubbleBackground, setBubbleBackground] = useState<'filled' | 'transparent' | 'outline'>('filled')
  const [magnifierMode, setMagnifierMode] = useState<'ellipse' | 'rectangle'>('rectangle')
  const [magnifierCornerRadius, setMagnifierCornerRadius] = useState(18)
  const [magnifierWidth, setMagnifierWidth] = useState(260)
  const [magnifierHeight, setMagnifierHeight] = useState(160)
  const [showToolOutline, setShowToolOutline] = useState(true)
  const [magnifierHover, setMagnifierHover] = useState<Point | null>(null)
  const [stampLabel, setStampLabel] = useState('APROVADO')
  const [stampTone, setStampTone] = useState<StampTone>('approved')
  const [stampSize, setStampSize] = useState(34)
  const [customStampPresets, setCustomStampPresets] = useState<StampPreset[]>([])
  const [nextNumStamp, setNextNumStamp] = useState(1)
  const [actions, setActions] = useState<CaptureAction[]>([])
  const [redoStack, setRedoStack] = useState<CaptureAction[]>([])
  const [draftAction, setDraftAction] = useState<CaptureAction | null>(null)
  const [movingLast, setMovingLast] = useState<{ point: Point; action: CaptureAction } | null>(null)
  const [selectionAdjust, setSelectionAdjust] = useState<SelectionAdjustState | null>(null)
  const [selectionHoverHandle, setSelectionHoverHandle] = useState<ResizeHandle | null>(null)
  const [toolbarPosition, setToolbarPosition] = useState<Point | null>(null)
  const [toolbarDrag, setToolbarDrag] = useState<{ origin: Point; start: Point } | null>(null)
  const [pendingText, setPendingText] = useState<PendingText | null>(null)
  const [status, setStatus] = useState('')

  const language = settings.language
  const showToolOptions = toolsWithOptions.includes(tool)
  const showOutlineToggle = toolsWithOutlineToggle.includes(tool)
  const hasOptionsRow = openMenu === 'tool-options' && showToolOptions
  const allStampPresets = useMemo<StampPreset[]>(
    () => [
      ...stampPresets,
      ...customStampPresets.filter(
        (custom) => !stampPresets.some((preset) => preset.label === custom.label && preset.tone === custom.tone)
      )
    ],
    [customStampPresets]
  )

  const activeRect = useMemo(() => {
    if (selectedRect) {
      return selectedRect
    }

    if (start && current) {
      return createRect(start, current)
    }

    return null
  }, [current, selectedRect, start])

  useEffect(() => {
    void window.gcpshot.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
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

    void compositeCaptureSegments(
      payload.segments,
      payload.virtualDesktop.width,
      payload.virtualDesktop.height
    ).then((dataUrl) => {
      if (!cancelled) {
        setBackdropDataUrl(dataUrl)
      }
    })

    return () => {
      cancelled = true
    }
  }, [payload])

  const captureBackdrop = backdropDataUrl ?? payload?.dataUrl ?? ''

  useEffect(() => {
    setStatus(t(language, 'dragSelect'))
  }, [language])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gcpshot-editor-settings') ?? '{}') as Partial<{
        paletteName: keyof typeof palettes
        color: string
        size: number
        privacyIntensity: number
        bubbleStyle: typeof bubbleStyle
        bubbleBackground: typeof bubbleBackground
        magnifierMode: typeof magnifierMode
        magnifierCornerRadius: number
        magnifierRounded: boolean
        showToolOutline: boolean
        magnifierWidth: number
        magnifierHeight: number
        stampLabel: string
        stampTone: StampTone
        stampSize: number
        customStampPresets: StampPreset[]
      }>

      if (saved.paletteName && palettes[saved.paletteName]) {
        setPaletteName(saved.paletteName)
      }
      if (saved.color) {
        setColor(saved.color)
      }
      if (saved.size) {
        setSize(saved.size)
      }
      if (saved.privacyIntensity) {
        setPrivacyIntensity(saved.privacyIntensity)
      }
      if (saved.bubbleStyle) {
        setBubbleStyle(saved.bubbleStyle)
      }
      if (saved.bubbleBackground) {
        setBubbleBackground(saved.bubbleBackground)
      }
      if (saved.magnifierMode) {
        setMagnifierMode(saved.magnifierMode)
      }
      if (typeof saved.magnifierCornerRadius === 'number') {
        setMagnifierCornerRadius(saved.magnifierCornerRadius)
      } else if (typeof saved.magnifierRounded === 'boolean') {
        setMagnifierCornerRadius(saved.magnifierRounded ? 18 : 0)
      }
      if (typeof saved.showToolOutline === 'boolean') {
        setShowToolOutline(saved.showToolOutline)
      }
      if (saved.magnifierWidth) {
        setMagnifierWidth(saved.magnifierWidth)
      }
      if (saved.magnifierHeight) {
        setMagnifierHeight(saved.magnifierHeight)
      }
      if (saved.stampLabel) {
        setStampLabel(saved.stampLabel)
      }
      if (saved.stampTone) {
        setStampTone(saved.stampTone)
      }
      if (saved.stampSize) {
        setStampSize(saved.stampSize)
      }
      if (Array.isArray(saved.customStampPresets)) {
        setCustomStampPresets(saved.customStampPresets)
      }
    } catch {
      // Keep defaults if persisted editor settings are malformed.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      'gcpshot-editor-settings',
      JSON.stringify({
        paletteName,
        color,
        size,
        privacyIntensity,
        bubbleStyle,
        bubbleBackground,
        magnifierMode,
        magnifierCornerRadius,
        showToolOutline,
        magnifierWidth,
        magnifierHeight,
        stampLabel,
        stampTone,
        stampSize,
        customStampPresets
      })
    )
  }, [
    bubbleBackground,
    bubbleStyle,
    color,
    magnifierCornerRadius,
    magnifierHeight,
    magnifierMode,
    showToolOutline,
    magnifierWidth,
    paletteName,
    privacyIntensity,
    size,
    stampLabel,
    stampSize,
    customStampPresets,
    stampTone
  ])

  useEffect(() => {
    if (!payload || initialCaptureMode !== 'fullscreen') {
      return
    }

    if (payload.segments.length > 1) {
      if (selectedRect) {
        return
      }
      setStatus('Escolha qual monitor capturar.')
      return
    }

    setSelectedRect({
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight
    })
    setToolbarPosition(getToolbarPositionForRect({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }))
    setTool('pen')
    setOpenMenu(null)
    setStatus(t(language, 'fullscreenSelected'))
  }, [payload, language, selectedRect])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (settingsOpen) {
        return
      }

      if (eventMatchesShortcut(event, settings.cancelShortcut)) {
        void window.gcpshot.cancelCapture()
        return
      }

      if (event.key === 'Enter' && pendingText) {
        event.preventDefault()
        commitPendingText()
        return
      }

      if (event.key === 'Delete' && event.altKey && selectedRect) {
        event.preventDefault()
        clearAllActions()
        return
      }

      if (eventMatchesShortcut(event, settings.copyShortcut) && selectedRect && payload) {
        event.preventDefault()
        void copySelection()
        return
      }

      if (eventMatchesShortcut(event, settings.saveShortcut) && selectedRect && payload) {
        event.preventDefault()
        void saveSelection()
        return
      }

      if (eventMatchesShortcut(event, settings.printShortcut) && selectedRect && payload) {
        event.preventDefault()
        void printSelection()
        return
      }

      if (eventMatchesShortcut(event, settings.whatsappShortcut) && selectedRect && payload) {
        event.preventDefault()
        void shareWhatsApp()
        return
      }

      if (eventMatchesShortcut(event, settings.undoShortcut)) {
        event.preventDefault()
        undo()
        return
      }

      if (eventMatchesShortcut(event, settings.redoShortcut)) {
        event.preventDefault()
        redo()
        return
      }

      if (!selectedRect || pendingText) {
        return
      }

      const toolShortcutMap = editorToolShortcutMap

      for (const [shortcutKey, nextTool] of toolShortcutMap) {
        if (eventMatchesShortcut(event, settings[shortcutKey])) {
          event.preventDefault()
          chooseTool(nextTool)
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [language, payload, pendingText, redoStack, selectedRect, settings, settingsOpen])

  function chooseTool(nextTool: EditorTool): void {
    setTool((currentTool) => {
      if (currentTool === nextTool) {
        setOpenMenu(null)
        if (selectedRect && !toolbarDrag) {
          setToolbarPosition(getToolbarPositionForRect(selectedRect, false))
        }
        return 'select'
      }

      syncPrivacyIntensityFromActions(nextTool, actions)

      if (nextTool === 'select' && selectedRect) {
        setStatus(t(language, 'adjustSelection'))
      }

      if (toolsWithOptions.includes(nextTool)) {
        setOpenMenu('tool-options')
        if (selectedRect && !toolbarDrag) {
          setToolbarPosition(getToolbarPositionForRect(selectedRect, true))
        }
      } else {
        setOpenMenu(null)
        if (selectedRect && !toolbarDrag) {
          setToolbarPosition(getToolbarPositionForRect(selectedRect, false))
        }
      }

      return nextTool
    })
  }

  function toggleMenu(menu: ToolbarMenu): void {
    setOpenMenu((current) => {
      const next = current === menu ? null : menu

      if (selectedRect && !toolbarDrag && (menu === 'tool-options' || current === 'tool-options')) {
        setToolbarPosition(getToolbarPositionForRect(selectedRect, next === 'tool-options'))
      }

      return next
    })
  }

  function repositionToolbar(rect: CaptureRect, optionsOpen = false): void {
    setToolbarPosition(getToolbarPositionForRect(rect, optionsOpen))
  }

  async function updateSetting(patch: Partial<AppSettings>): Promise<void> {
    const nextSettings = await window.gcpshot.updateSettings(patch)
    setSettings(nextSettings)
  }

  async function resetSettings(): Promise<void> {
    const nextSettings = await window.gcpshot.resetSettings()
    setSettings(nextSettings)
    setRecordingShortcut(null)
  }

  function saveCurrentStampPreset(): void {
    const label = stampLabel.trim().toUpperCase()
    if (!label) {
      return
    }

    setStampLabel(label)
    setStampTone('custom')
    setCustomStampPresets((current) => {
      if (current.some((preset) => preset.label === label)) {
        return current
      }

      return [...current, { label, tone: 'custom' }]
    })
  }

  function pointInsideSelection(point: Point): boolean {
    if (!selectedRect) {
      return false
    }

    return (
      point.x >= selectedRect.x &&
      point.x <= selectedRect.x + selectedRect.width &&
      point.y >= selectedRect.y &&
      point.y <= selectedRect.y + selectedRect.height
    )
  }

  function createAction(point: Point): CaptureAction | null {
    if (!selectedRect || tool === 'select' || tool === 'move' || !pointInsideSelection(point)) {
      return null
    }

    if (tool === 'stamp') {
      return {
        id: crypto.randomUUID(),
        tool,
        color,
        size: stampSize,
        at: point,
        label: stampLabel,
        tone: stampTone
      }
    }

    if (tool === 'numStamp') {
      return {
        id: crypto.randomUUID(),
        tool: 'numStamp',
        color,
        size,
        at: point,
        number: nextNumStamp
      }
    }

    if (tool === 'pen') {
      return {
        id: crypto.randomUUID(),
        tool,
        color,
        size,
        points: [point]
      }
    }

    if (tool === 'magnifier') {
      const anchor = magnifierAnchorFromPoint(point, selectedRect, magnifierWidth, magnifierHeight)

      return {
        id: crypto.randomUUID(),
        tool,
        color,
        size,
        from: anchor,
        to: {
          x: anchor.x + magnifierWidth,
          y: anchor.y + magnifierHeight
        },
        magnifierMode,
        magnifierCornerRadius: magnifierMode === 'rectangle' ? magnifierCornerRadius : 0,
        showOutline: showToolOutline
      }
    }

    return {
      id: crypto.randomUUID(),
      tool,
      color,
      size: tool === 'blur' || tool === 'pixelate' ? privacyIntensity : size,
      from: point,
      to: point,
      showOutline: tool === 'blur' || tool === 'pixelate' ? showToolOutline : undefined
    }
  }

  function updatePrivacyIntensity(nextIntensity: number): void {
    setPrivacyIntensity(nextIntensity)
    setDraftAction((currentDraft) => {
      if (!currentDraft || (currentDraft.tool !== 'blur' && currentDraft.tool !== 'pixelate')) {
        return currentDraft
      }

      return { ...currentDraft, size: nextIntensity }
    })

    if (tool !== 'blur' && tool !== 'pixelate') {
      return
    }

    setActions((currentActions) =>
      currentActions.map((action) =>
        action.tool === tool ? { ...action, size: nextIntensity } : action
      )
    )
  }

  function syncPrivacyIntensityFromActions(nextTool: EditorTool, currentActions: CaptureAction[]): void {
    if (nextTool !== 'blur' && nextTool !== 'pixelate') {
      return
    }

    const lastMatch = [...currentActions].reverse().find((action) => action.tool === nextTool)
    if (lastMatch && (lastMatch.tool === 'blur' || lastMatch.tool === 'pixelate')) {
      setPrivacyIntensity(lastMatch.size)
    }
  }

  function onMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return
    }

    const point = { x: event.clientX, y: event.clientY }

    if (selectedRect && tool === 'select') {
      const handle = getSelectionResizeHandle(point, selectedRect)
      if (!handle) {
        return
      }

      setSelectionAdjust({
        handle,
        startPoint: point,
        originRect: selectedRect,
        originActions: actions
      })
      setStatus(t(language, 'adjustSelection'))
      return
    }

    if (selectedRect && tool === 'move') {
      const lastAction = actions.at(-1)
      if (lastAction && pointInsideSelection(point)) {
        setMovingLast({ point, action: lastAction })
        setStatus(t(language, 'moveElement'))
      }
      return
    }

    if (selectedRect && tool !== 'select') {
      if (tool === 'text' || tool === 'bubble') {
        if (pointInsideSelection(point)) {
          setPendingText({ tool, at: point, value: '' })
          setStatus(tool === 'bubble' ? t(language, 'enterBubbleText') : t(language, 'enterText'))
        }
        return
      }

      if (tool === 'magnifier') {
        const action = createAction(point)
        if (!action) {
          return
        }

        setActions((currentActions) => [...currentActions, action])
        setRedoStack([])
        setStatus(t(language, 'annotationAdded'))
        return
      }

      const action = createAction(point)
      if (!action) {
        return
      }

      if (action.tool === 'text' || action.tool === 'bubble' || action.tool === 'stamp' || action.tool === 'numStamp') {
        setActions((currentActions) => [...currentActions, action])
        setRedoStack([])
        if (action.tool === 'numStamp') {
          setNextNumStamp((current) => current + 1)
        }
        setStatus(t(language, 'annotationAdded'))
        return
      }

      setDraftAction(action)
      setStatus(t(language, 'drawing'))
      return
    }

    if (selectedRect) {
      return
    }

    setStart(point)
    setCurrent(point)
    setSelectedRect(null)
    setActions([])
    setRedoStack([])
    setDraftAction(null)
    setNextNumStamp(1)
    setStatus(t(language, 'confirmArea'))
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    const point = { x: event.clientX, y: event.clientY }

    if (selectedRect && tool === 'magnifier' && pointInsideSelection(point)) {
      setMagnifierHover(point)
    } else if (magnifierHover) {
      setMagnifierHover(null)
    }

    if (toolbarDrag) {
      const dx = event.clientX - toolbarDrag.start.x
      const dy = event.clientY - toolbarDrag.start.y
      setToolbarPosition(clampToolbarPosition({ x: toolbarDrag.origin.x + dx, y: toolbarDrag.origin.y + dy }, hasOptionsRow))
      return
    }

    if (selectionAdjust) {
      const dx = point.x - selectionAdjust.startPoint.x
      const dy = point.y - selectionAdjust.startPoint.y
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const nextRect = resizeSelectionRect(
        selectionAdjust.originRect,
        selectionAdjust.handle,
        dx,
        dy,
        viewport
      )

      setSelectedRect(nextRect)

      if (selectionAdjust.handle === 'move') {
        setActions(
          selectionAdjust.originActions.map((action) => translateAction(action, dx, dy))
        )
      }

      repositionToolbar(nextRect, openMenu === 'tool-options')
      return
    }

    if (selectedRect && tool === 'select' && !selectionAdjust) {
      setSelectionHoverHandle(getSelectionResizeHandle(point, selectedRect))
    } else if (selectionHoverHandle) {
      setSelectionHoverHandle(null)
    }

    if (movingLast) {
      const point = { x: event.clientX, y: event.clientY }
      const dx = point.x - movingLast.point.x
      const dy = point.y - movingLast.point.y
      setActions((currentActions) => {
        if (!currentActions.length) {
          return currentActions
        }

        return [...currentActions.slice(0, -1), translateAction(movingLast.action, dx, dy)]
      })
      return
    }

    if (draftAction) {
      const point = { x: event.clientX, y: event.clientY }

      setDraftAction((currentDraft) => {
        if (!currentDraft) {
          return null
        }

        if (currentDraft.tool === 'pen') {
          return { ...currentDraft, points: [...currentDraft.points, point] }
        }

        if (currentDraft.tool === 'text' || currentDraft.tool === 'bubble' || currentDraft.tool === 'stamp' || currentDraft.tool === 'numStamp') {
          return currentDraft
        }

        return { ...currentDraft, to: point }
      })
      return
    }

    if (!start) {
      return
    }

    setCurrent({ x: event.clientX, y: event.clientY })
  }

  function onMouseUp(): void {
    if (toolbarDrag) {
      setToolbarDrag(null)
      return
    }

    if (selectionAdjust) {
      setSelectionAdjust(null)
      setStatus(t(language, 'selectionResizeDone'))
      return
    }

    if (movingLast) {
      setMovingLast(null)
      setStatus(t(language, 'elementMoved'))
      return
    }

    if (draftAction) {
      setActions((currentActions) => [...currentActions, draftAction])
      setRedoStack([])
      setDraftAction(null)
      setStatus(t(language, 'annotationAdded'))
      return
    }

    if (!start || !current) {
      return
    }

    const rect = createRect(start, current)
    setStart(null)
    setCurrent(null)

    if (rect.width < 12 || rect.height < 12) {
      setSelectedRect(null)
      setStatus(t(language, 'selectionTooSmall'))
      return
    }

    setSelectedRect(rect)
    repositionToolbar(rect, false)
    setTool('pen')
    setOpenMenu(null)
    setStatus(t(language, 'areaSelected'))
  }

  function undo(): void {
    setActions((currentActions) => {
      const lastAction = currentActions.at(-1)
      if (lastAction) {
        setRedoStack((currentRedoStack) => [...currentRedoStack, lastAction])
      }
      return currentActions.slice(0, -1)
    })
    setStatus(t(language, 'undoDone'))
  }

  function redo(): void {
    setRedoStack((currentRedoStack) => {
      const action = currentRedoStack.at(-1)
      if (action) {
        setActions((currentActions) => [...currentActions, action])
      }
      return currentRedoStack.slice(0, -1)
    })
    setStatus(t(language, 'redoDone'))
  }

  function clearAllActions(): void {
    if (actions.length === 0 && redoStack.length === 0 && !pendingText) {
      return
    }

    setActions([])
    setRedoStack([])
    setDraftAction(null)
    setPendingText(null)
    setMagnifierHover(null)
    setStatus(t(language, 'clearAllDone'))
  }

  function translateAction(action: CaptureAction, dx: number, dy: number): CaptureAction {
    const movePoint = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy })

    if (action.tool === 'pen') {
      return { ...action, points: action.points.map(movePoint) }
    }

    if (action.tool === 'text' || action.tool === 'bubble' || action.tool === 'stamp' || action.tool === 'numStamp') {
      return { ...action, at: movePoint(action.at) }
    }

    return { ...action, from: movePoint(action.from), to: movePoint(action.to) }
  }

  function commitPendingText(): void {
    if (!pendingText || !pendingText.value.trim()) {
      setPendingText(null)
      return
    }

    const action: CaptureAction = {
      id: crypto.randomUUID(),
      tool: pendingText.tool,
      color,
      size: Math.max(16, size * 4),
      at: pendingText.at,
      text: pendingText.value.trim(),
      bubbleStyle: pendingText.tool === 'bubble' ? bubbleStyle : undefined,
      backgroundMode: pendingText.tool === 'bubble' ? bubbleBackground : undefined
    }

    setActions((currentActions) => [...currentActions, action])
    setRedoStack([])
    setPendingText(null)
    setTool('move')
    setStatus(t(language, 'annotationAdded'))
  }

  function drawBubble(
    context: CanvasRenderingContext2D,
    action: Extract<CaptureAction, { tool: 'bubble' }>,
    point: Point,
    scale: number
  ): void {
    const padding = 12 * scale
    const tail = 18 * scale
    context.font = `700 ${action.size * scale}px Segoe UI`
    const width = Math.max(130 * scale, context.measureText(action.text).width + padding * 2)
    const height = action.size * scale + padding * 2
    const x = point.x
    const y = point.y - height
    const radius = 15 * scale
    const fill = action.backgroundMode === 'transparent' || action.backgroundMode === 'outline'
      ? 'rgba(255,255,255,0)'
      : 'rgba(255,255,255,0.96)'

    context.save()
    context.fillStyle = fill
    context.strokeStyle = action.color
    context.lineWidth = Math.max(2, action.size * 0.18 * scale)
    context.beginPath()
    context.roundRect(x, y, width, height, radius)
    if (action.backgroundMode !== 'outline') {
      context.fill()
    }
    context.stroke()

    if (action.bubbleStyle === 'speech') {
      context.beginPath()
      context.moveTo(x + 28 * scale, y + height - 2)
      context.lineTo(x + 16 * scale, y + height + tail)
      context.lineTo(x + 54 * scale, y + height - 2)
      context.closePath()
      if (action.backgroundMode !== 'outline') {
        context.fill()
      }
      context.stroke()
    }

    if (action.bubbleStyle === 'thought') {
      context.beginPath()
      context.arc(x + 32 * scale, y + height + 12 * scale, 7 * scale, 0, Math.PI * 2)
      context.arc(x + 18 * scale, y + height + 25 * scale, 4 * scale, 0, Math.PI * 2)
      if (action.backgroundMode !== 'outline') {
        context.fill()
      }
      context.stroke()
    }

    context.fillStyle = '#1d1028'
    context.fillText(action.text, x + padding, y + padding + action.size * scale)
    context.restore()
  }

  function getCanvasRect(from: Point, to: Point): CaptureRect {
    return {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.max(1, Math.abs(to.x - from.x)),
      height: Math.max(1, Math.abs(to.y - from.y))
    }
  }

  function getStarPoints(centerX: number, centerY: number, radius: number): Point[] {
    return Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5
      const currentRadius = index % 2 === 0 ? radius : radius * 0.45

      return {
        x: centerX + Math.cos(angle) * currentRadius,
        y: centerY + Math.sin(angle) * currentRadius
      }
    })
  }

  function drawNumStamp(
    context: CanvasRenderingContext2D,
    action: Extract<CaptureAction, { tool: 'numStamp' }>,
    point: Point,
    scale: number
  ): void {
    const radius = Math.max(16 * scale, action.size * 4 * scale)
    context.save()
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fillStyle = action.color
    context.fill()
    context.lineWidth = Math.max(3, 3 * scale)
    context.strokeStyle = '#ffffff'
    context.stroke()
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.max(16, action.size * 3) * scale}px Segoe UI`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(action.number), point.x, point.y + 1)
    context.restore()
  }

  function drawStamp(context: CanvasRenderingContext2D, action: Extract<CaptureAction, { tool: 'stamp' }>, point: Point, scale: number): void {
    const paddingX = 14 * scale
    const paddingY = 9 * scale
    const angle = -9 * (Math.PI / 180)
    context.save()
    context.font = `900 ${action.size * scale}px Segoe UI`
    const textWidth = context.measureText(action.label).width
    const width = textWidth + paddingX * 2
    const height = action.size * scale + paddingY * 2
    context.translate(point.x, point.y)
    context.rotate(angle)
    context.globalAlpha = 0.94
    context.strokeStyle = action.color
    context.fillStyle = 'rgba(255,255,255,0.08)'
    context.lineWidth = Math.max(3, action.size * 0.18 * scale)
    context.beginPath()
    context.roundRect(0, -height, width, height, 8 * scale)
    context.fill()
    context.stroke()
    context.fillStyle = action.color
    context.fillText(action.label, paddingX, -paddingY)
    context.restore()
  }

  function applyPrivacyEffect(
    context: CanvasRenderingContext2D,
    rect: CaptureRect,
    effect: 'blur' | 'pixelate',
    strength: number
  ): void {
    const x = Math.max(0, Math.round(rect.x))
    const y = Math.max(0, Math.round(rect.y))
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const temp = document.createElement('canvas')
    temp.width = width
    temp.height = height
    const tempContext = temp.getContext('2d')

    if (!tempContext) {
      return
    }

    tempContext.drawImage(context.canvas, x, y, width, height, 0, 0, width, height)

    if (effect === 'blur') {
      context.save()
      context.filter = `blur(${Math.max(4, strength * 1.6)}px)`
      context.drawImage(temp, x, y)
      context.restore()
      return
    }

    const pixelSize = Math.max(6, strength * 3)
    const smallWidth = Math.max(1, Math.ceil(width / pixelSize))
    const smallHeight = Math.max(1, Math.ceil(height / pixelSize))
    const mosaic = document.createElement('canvas')
    mosaic.width = smallWidth
    mosaic.height = smallHeight
    const mosaicContext = mosaic.getContext('2d')

    if (!mosaicContext) {
      return
    }

    mosaicContext.imageSmoothingEnabled = false
    mosaicContext.drawImage(temp, 0, 0, smallWidth, smallHeight)
    context.save()
    context.imageSmoothingEnabled = false
    context.drawImage(mosaic, 0, 0, smallWidth, smallHeight, x, y, width, height)
    context.restore()
  }

  function drawAction(
    context: CanvasRenderingContext2D,
    action: CaptureAction,
    scaleX: number,
    scaleY: number,
    sourceImage: HTMLImageElement
  ): void {
    if (!selectedRect) {
      return
    }

    const toCanvas = (point: Point): Point => ({
      x: (point.x - selectedRect.x) * scaleX,
      y: (point.y - selectedRect.y) * scaleY
    })

    context.strokeStyle = action.color
    context.fillStyle = action.color
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = action.size * Math.max(scaleX, scaleY)

    if (action.tool === 'pen') {
      const [first, ...rest] = action.points.map(toCanvas)
      if (!first) {
        return
      }

      context.beginPath()
      context.moveTo(first.x, first.y)
      rest.forEach((point) => context.lineTo(point.x, point.y))
      context.stroke()
      return
    }

    const scale = Math.max(scaleX, scaleY)

    if (action.tool === 'text') {
      const point = toCanvas(action.at)
      context.font = `700 ${action.size * scale}px Segoe UI`
      context.fillText(action.text, point.x, point.y)
      return
    }

    if (action.tool === 'bubble') {
      drawBubble(context, action, toCanvas(action.at), scale)
      return
    }

    if (action.tool === 'stamp') {
      drawStamp(context, action, toCanvas(action.at), scale)
      return
    }

    if (action.tool === 'numStamp') {
      drawNumStamp(context, action, toCanvas(action.at), scale)
      return
    }

    const from = toCanvas(action.from)
    const to = toCanvas(action.to)

    if (action.tool === 'blur' || action.tool === 'pixelate') {
      applyPrivacyEffect(context, getCanvasRect(from, to), action.tool, action.size)
      if (action.showOutline !== false) {
        context.save()
        context.strokeStyle = action.color
        context.setLineDash([8 * scale, 6 * scale])
        context.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y))
        context.restore()
      }
      return
    }

    if (action.tool === 'rect') {
      context.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y)
      return
    }

    if (action.tool === 'star') {
      const centerX = (from.x + to.x) / 2
      const centerY = (from.y + to.y) / 2
      const radius = Math.max(10 * scale, Math.min(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / 2)
      const [firstPoint, ...points] = getStarPoints(centerX, centerY, radius)

      if (!firstPoint) {
        return
      }

      context.beginPath()
      context.moveTo(firstPoint.x, firstPoint.y)
      points.forEach((point) => context.lineTo(point.x, point.y))
      context.closePath()
      context.stroke()
      return
    }

    if (action.tool === 'magnifier') {
      const rect = getCanvasRect(from, to)
      const centerX = rect.x + rect.width / 2
      const centerY = rect.y + rect.height / 2
      const zoom = 2.15
      const sourceCenterX = selectedRect.x * scaleX + centerX
      const sourceCenterY = selectedRect.y * scaleY + centerY
      const screenWidth = Math.abs(to.x - from.x)
      const screenHeight = Math.abs(to.y - from.y)
      const radius = getMagnifierCornerRadius(action, screenWidth, screenHeight) * scale

      context.save()
      context.beginPath()

      if (action.magnifierMode === 'rectangle') {
        context.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
      } else {
        context.ellipse(centerX, centerY, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2)
      }

      context.clip()
      context.drawImage(
        sourceImage,
        sourceCenterX - rect.width / zoom / 2,
        sourceCenterY - rect.height / zoom / 2,
        rect.width / zoom,
        rect.height / zoom,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )
      context.restore()

      if (action.showOutline !== false) {
        context.beginPath()
        if (action.magnifierMode === 'rectangle') {
          context.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
        } else {
          context.ellipse(centerX, centerY, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2)
        }
        context.stroke()
      }
      return
    }

    if (action.tool === 'ellipse') {
      const centerX = (from.x + to.x) / 2
      const centerY = (from.y + to.y) / 2
      const radiusX = Math.max(10 * scale, Math.abs(to.x - from.x) / 2)
      const radiusY = Math.max(10 * scale, Math.abs(to.y - from.y) / 2)

      context.beginPath()
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
      context.stroke()
      return
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    if (action.tool === 'arrow') {
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const headLength = Math.max(18 * scale, action.size * 4 * scale)
      const headAngle = Math.PI / 7
      context.save()
      context.fillStyle = action.color
      context.beginPath()
      context.moveTo(to.x, to.y)
      context.lineTo(to.x - headLength * Math.cos(angle - headAngle), to.y - headLength * Math.sin(angle - headAngle))
      context.lineTo(to.x - headLength * 0.52 * Math.cos(angle), to.y - headLength * 0.52 * Math.sin(angle))
      context.lineTo(to.x - headLength * Math.cos(angle + headAngle), to.y - headLength * Math.sin(angle + headAngle))
      context.closePath()
      context.fill()
      context.stroke()
      context.restore()
    }
  }

  async function composeExport(): Promise<CaptureExportPayload | null> {
    if (!payload || !selectedRect || !captureBackdrop) {
      return null
    }

    const image = new Image()
    image.src = captureBackdrop
    await image.decode()

    const sourceScaleX = image.naturalWidth / window.innerWidth
    const sourceScaleY = image.naturalHeight / window.innerHeight
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(selectedRect.width * sourceScaleX))
    canvas.height = Math.max(1, Math.round(selectedRect.height * sourceScaleY))

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(
      image,
      selectedRect.x * sourceScaleX,
      selectedRect.y * sourceScaleY,
      selectedRect.width * sourceScaleX,
      selectedRect.height * sourceScaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )

    actions.forEach((action) => drawAction(context, action, sourceScaleX, sourceScaleY, image))

    return {
      dataUrl: captureBackdrop,
      rect: selectedRect,
      actions,
      exportedDataUrl: canvas.toDataURL('image/png'),
      display: payload.display
    }
  }

  async function copySelection(): Promise<void> {
    const exportPayload = await composeExport()
    if (!exportPayload) {
      return
    }

    setStatus(t(language, 'copying'))
    const result = await window.gcpshot.copyCapture(exportPayload)
    if (result.ok && exportPayload.exportedDataUrl) {
      await pushCaptureToStudioAsync(exportPayload.exportedDataUrl)
      setStatus(`${t(language, 'copied')} ${t(language, 'studioAddedFromCapture')}`)
    } else {
      setStatus(result.ok ? t(language, 'copied') : result.error ?? t(language, 'copyFailed'))
    }
  }

  async function saveSelection(): Promise<void> {
    const exportPayload = await composeExport()
    if (!exportPayload) {
      return
    }

    setStatus(t(language, 'saving'))
    const result = await window.gcpshot.saveCapture(exportPayload)
    if (result.ok && exportPayload.exportedDataUrl) {
      await pushCaptureToStudioAsync(exportPayload.exportedDataUrl)
      setStatus(`${t(language, 'saved', { path: result.path ?? '' })} · ${t(language, 'studioAddedFromCapture')}`)
    } else {
      setStatus(result.ok ? t(language, 'saved', { path: result.path ?? '' }) : result.error ?? t(language, 'saveFailed'))
    }
  }

  async function printSelection(): Promise<void> {
    const exportPayload = await composeExport()
    if (!exportPayload) {
      return
    }

    setStatus(t(language, 'printing'))
    const result = await window.gcpshot.printCapture(exportPayload)
    setStatus(result.ok ? t(language, 'printDone') : result.error ?? t(language, 'printFailed'))
  }

  async function shareWhatsApp(): Promise<void> {
    const exportPayload = await composeExport()
    if (!exportPayload) {
      return
    }

    setStatus(t(language, 'whatsappOpening'))
    const result = await window.gcpshot.shareWhatsApp(exportPayload)
    setStatus(result.ok ? t(language, 'whatsappReady') : result.error ?? t(language, 'whatsappFailed'))
  }

  const visibleActions = draftAction ? [...actions, draftAction] : actions

  const magnifierPreviewAction = useMemo((): CaptureAction | null => {
    if (tool !== 'magnifier' || !selectedRect || !magnifierHover) {
      return null
    }

    const anchor = magnifierAnchorFromPoint(magnifierHover, selectedRect, magnifierWidth, magnifierHeight)

    return {
      id: 'magnifier-preview',
      tool: 'magnifier',
      color,
      size,
      from: anchor,
      to: {
        x: anchor.x + magnifierWidth,
        y: anchor.y + magnifierHeight
      },
      magnifierMode,
      magnifierCornerRadius: magnifierMode === 'rectangle' ? magnifierCornerRadius : 0,
      showOutline: showToolOutline
    }
  }, [
    color,
    magnifierCornerRadius,
    magnifierHeight,
    magnifierHover,
    magnifierMode,
    magnifierWidth,
    selectedRect,
    showToolOutline,
    size,
    tool
  ])

  const renderedActions = magnifierPreviewAction ? [...visibleActions, magnifierPreviewAction] : visibleActions
  const overlayCursor =
    tool === 'select' && selectedRect && selectionHoverHandle
      ? cursorForResizeHandle(selectionHoverHandle)
      : undefined
  const scrimRect = selectedRect ?? activeRect

  return (
    <main
      className="capture-overlay"
      style={overlayCursor ? { cursor: overlayCursor } : undefined}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {payload && (
        <>
          {!backdropDataUrl &&
            payload.segments.map((segment) => (
              <img
                key={segment.displayId}
                className="screen-backdrop-segment"
                src={segment.dataUrl}
                alt=""
                draggable={false}
                style={{
                  left: segment.x,
                  top: segment.y,
                  width: segment.width,
                  height: segment.height
                }}
              />
            ))}
          {captureBackdrop && <img className="screen-backdrop" src={captureBackdrop} alt="" draggable={false} />}
        </>
      )}
      {scrimRect ? (
        <div className="capture-scrim-cutout" aria-hidden>
          <span style={{ left: 0, top: 0, width: '100vw', height: scrimRect.y }} />
          <span style={{ left: 0, top: scrimRect.y, width: scrimRect.x, height: scrimRect.height }} />
          <span
            style={{
              left: scrimRect.x + scrimRect.width,
              top: scrimRect.y,
              width: `calc(100vw - ${scrimRect.x + scrimRect.width}px)`,
              height: scrimRect.height
            }}
          />
          <span
            style={{
              left: 0,
              top: scrimRect.y + scrimRect.height,
              width: '100vw',
              height: `calc(100vh - ${scrimRect.y + scrimRect.height}px)`
            }}
          />
        </div>
      ) : (
        <div className="capture-scrim" />
      )}

      {scrimRect && (
        <div
          className="selection-box"
          style={{
            left: scrimRect.x,
            top: scrimRect.y,
            width: scrimRect.width,
            height: scrimRect.height
          }}
        />
      )}

      {selectedRect && tool === 'select' && (
        <div className="selection-adjust-layer" aria-hidden>
          {getSelectionHandlePositions(selectedRect).map((item) => (
            <span
              key={item.handle}
              className="selection-handle"
              data-handle={item.handle}
              style={{
                left: item.x,
                top: item.y,
                cursor: cursorForResizeHandle(item.handle)
              }}
            />
          ))}
          <span
            className="selection-size-label"
            style={{
              left: selectedRect.x + 8,
              top: Math.max(8, selectedRect.y - 28)
            }}
          >
            {Math.round(selectedRect.width)} × {Math.round(selectedRect.height)}
          </span>
        </div>
      )}

      {selectedRect && (
        <svg className="annotation-layer">
          <defs>
            <pattern id="pixel-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="rgba(255,255,255,0.28)" />
              <rect x="6" y="6" width="6" height="6" fill="rgba(255,255,255,0.18)" />
              <rect x="6" width="6" height="6" fill="rgba(16,7,25,0.28)" />
              <rect y="6" width="6" height="6" fill="rgba(16,7,25,0.18)" />
            </pattern>
          </defs>
          {renderedActions.map((action) => {
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

            if (action.tool === 'text') {
              return (
                <text key={action.id} x={action.at.x} y={action.at.y} fill={action.color} fontSize={action.size} fontWeight="800">
                  {action.text}
                </text>
              )
            }

            if (action.tool === 'bubble') {
              const width = Math.max(150, action.text.length * action.size * 0.62 + 28)
              const height = action.size + 26
              const x = action.at.x
              const y = action.at.y - height
              const bubbleFill =
                action.backgroundMode === 'transparent' || action.backgroundMode === 'outline'
                  ? 'rgba(255,255,255,0)'
                  : 'rgba(255,255,255,0.96)'

              return (
                <g key={action.id}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="14"
                    fill={bubbleFill}
                    stroke={action.color}
                    strokeWidth={Math.max(2, action.size * 0.14)}
                  />
                  {action.bubbleStyle === 'speech' && (
                    <path
                      d={`M ${x + 28} ${y + height - 1} L ${x + 16} ${y + height + 18} L ${x + 55} ${y + height - 1} Z`}
                      fill={bubbleFill}
                      stroke={action.color}
                      strokeWidth={Math.max(2, action.size * 0.14)}
                    />
                  )}
                  {action.bubbleStyle === 'thought' && (
                    <>
                      <circle cx={x + 34} cy={y + height + 12} r="7" fill={bubbleFill} stroke={action.color} strokeWidth="2" />
                      <circle cx={x + 19} cy={y + height + 25} r="4" fill={bubbleFill} stroke={action.color} strokeWidth="2" />
                    </>
                  )}
                  <text x={x + 14} y={y + 14 + action.size} fill="#1d1028" fontSize={action.size} fontWeight="800">
                    {action.text}
                  </text>
                </g>
              )
            }

            if (action.tool === 'stamp') {
              return (
                <g key={action.id} transform={`translate(${action.at.x} ${action.at.y}) rotate(-9)`}>
                  <rect
                    x="0"
                    y={-action.size - 18}
                    width={Math.max(92, action.label.length * action.size * 0.66 + 28)}
                    height={action.size + 18}
                    rx="8"
                    fill="rgba(255,255,255,0.08)"
                    stroke={action.color}
                    strokeWidth={Math.max(3, action.size * 0.18)}
                  />
                  <text x="14" y="-9" fill={action.color} fontSize={action.size} fontWeight="900">
                    {action.label}
                  </text>
                </g>
              )
            }

            if (action.tool === 'numStamp') {
              const radius = Math.max(16, action.size * 4)
              return (
                <g key={action.id}>
                  <circle cx={action.at.x} cy={action.at.y} r={radius} fill={action.color} stroke="#fff" strokeWidth="3" />
                  <text
                    x={action.at.x}
                    y={action.at.y + 1}
                    fill="#fff"
                    fontSize={Math.max(16, action.size * 3)}
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {action.number}
                  </text>
                </g>
              )
            }

            if (action.tool === 'blur' || action.tool === 'pixelate') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)
              const outlineProps =
                action.showOutline === false
                  ? {}
                  : {
                      stroke: action.color,
                      strokeDasharray: '8 6',
                      strokeWidth: Math.max(2, action.size * 0.6)
                    }

              return (
                <g key={action.id}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="none"
                    {...outlineProps}
                  />
                </g>
              )
            }

            if (action.tool === 'rect') {
              return (
                <rect
                  key={action.id}
                  x={Math.min(action.from.x, action.to.x)}
                  y={Math.min(action.from.y, action.to.y)}
                  width={Math.abs(action.to.x - action.from.x)}
                  height={Math.abs(action.to.y - action.from.y)}
                  fill="none"
                  stroke={action.color}
                  strokeWidth={action.size}
                  rx="3"
                />
              )
            }

            if (action.tool === 'star') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)
              const centerX = x + width / 2
              const centerY = y + height / 2
              const radius = Math.max(10, Math.min(width, height) / 2)

              return (
                <polygon
                  key={action.id}
                  points={getStarPoints(centerX, centerY, radius).map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={action.color}
                  strokeLinejoin="round"
                  strokeWidth={action.size}
                />
              )
            }

            if (action.tool === 'magnifier') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)
              const centerX = x + width / 2
              const centerY = y + height / 2
              const clipId = `magnifier-${action.id}`
              const radius = getMagnifierCornerRadius(action, width, height)
              const previewOpacity = action.id === 'magnifier-preview' ? 0.72 : 1

              if (!captureBackdrop) {
                return null
              }

              const zoom = 2.15
              const isRectangle = action.magnifierMode === 'rectangle'
              const outlineProps =
                action.showOutline === false
                  ? {}
                  : {
                      stroke: action.color,
                      strokeWidth: Math.max(3, action.size)
                    }

              return (
                <g key={action.id} opacity={previewOpacity}>
                  <defs>
                    <clipPath id={clipId}>
                      {isRectangle ? (
                        <rect x={x} y={y} width={width} height={height} rx={radius} />
                      ) : (
                        <ellipse cx={centerX} cy={centerY} rx={Math.max(10, width / 2)} ry={Math.max(10, height / 2)} />
                      )}
                    </clipPath>
                  </defs>
                  <image
                    href={captureBackdrop}
                    x={centerX - centerX * zoom}
                    y={centerY - centerY * zoom}
                    width={window.innerWidth * zoom}
                    height={window.innerHeight * zoom}
                    preserveAspectRatio="none"
                    clipPath={`url(#${clipId})`}
                  />
                  {isRectangle ? (
                    <rect x={x} y={y} width={width} height={height} rx={radius} fill="none" {...outlineProps} />
                  ) : (
                    <ellipse
                      cx={centerX}
                      cy={centerY}
                      rx={Math.max(10, width / 2)}
                      ry={Math.max(10, height / 2)}
                      fill="none"
                      {...outlineProps}
                    />
                  )}
                </g>
              )
            }

            if (action.tool === 'ellipse') {
              const x = Math.min(action.from.x, action.to.x)
              const y = Math.min(action.from.y, action.to.y)
              const width = Math.abs(action.to.x - action.from.x)
              const height = Math.abs(action.to.y - action.from.y)
              const centerX = x + width / 2
              const centerY = y + height / 2

              return (
                <ellipse
                  key={action.id}
                  cx={centerX}
                  cy={centerY}
                  rx={Math.max(10, width / 2)}
                  ry={Math.max(10, height / 2)}
                  fill="none"
                  stroke={action.color}
                  strokeWidth={action.size}
                />
              )
            }

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
                {action.tool === 'arrow' &&
                  (() => {
                    const angle = Math.atan2(action.to.y - action.from.y, action.to.x - action.from.x)
                    const headLength = Math.max(18, action.size * 4)
                    const headAngle = Math.PI / 7
                    const neck = {
                      x: action.to.x - headLength * 0.52 * Math.cos(angle),
                      y: action.to.y - headLength * 0.52 * Math.sin(angle)
                    }
                    const left = {
                      x: action.to.x - headLength * Math.cos(angle - headAngle),
                      y: action.to.y - headLength * Math.sin(angle - headAngle)
                    }
                    const right = {
                      x: action.to.x - headLength * Math.cos(angle + headAngle),
                      y: action.to.y - headLength * Math.sin(angle + headAngle)
                    }

                    return (
                      <polygon
                        points={`${action.to.x},${action.to.y} ${left.x},${left.y} ${neck.x},${neck.y} ${right.x},${right.y}`}
                        fill={action.color}
                        stroke={action.color}
                        strokeLinejoin="round"
                      />
                    )
                  })()}
              </g>
            )
          })}
        </svg>
      )}

      {payload &&
        visibleActions
          .filter((action): action is Extract<CaptureAction, { tool: 'blur' | 'pixelate' }> => action.tool === 'blur' || action.tool === 'pixelate')
          .map((action) => {
            const x = Math.min(action.from.x, action.to.x)
            const y = Math.min(action.from.y, action.to.y)
            const width = Math.abs(action.to.x - action.from.x)
            const height = Math.abs(action.to.y - action.from.y)
            const pixelSize = Math.max(6, action.size * 3)

            return (
              <div
                key={`privacy-${action.id}`}
                className={
                  action.showOutline === false
                    ? action.tool === 'blur'
                      ? 'privacy-preview blur-preview no-outline'
                      : 'privacy-preview pixel-preview no-outline'
                    : action.tool === 'blur'
                      ? 'privacy-preview blur-preview'
                      : 'privacy-preview pixel-preview'
                }
                style={{
                  left: x,
                  top: y,
                  width,
                  height,
                  borderColor: action.color,
                  ['--privacy-strength' as string]: `${Math.max(3, action.size * 1.6)}px`,
                  ['--privacy-pixel-size' as string]: `${Math.max(6, action.size * 3)}px`
                }}
              >
                <span
                  style={{
                    backgroundImage: `url(${captureBackdrop})`,
                    backgroundPosition:
                      action.tool === 'pixelate'
                        ? `-${x / pixelSize}px -${y / pixelSize}px`
                        : `-${x}px -${y}px`,
                    backgroundSize:
                      action.tool === 'pixelate'
                        ? `${window.innerWidth / pixelSize}px ${window.innerHeight / pixelSize}px`
                        : `${window.innerWidth}px ${window.innerHeight}px`,
                    width: action.tool === 'pixelate' ? width / pixelSize : '100%',
                    height: action.tool === 'pixelate' ? height / pixelSize : '100%',
                    transform: action.tool === 'pixelate' ? `scale(${pixelSize})` : undefined
                  }}
                />
              </div>
            )
          })}

      {selectedRect && (
        <div
          className="capture-toolbar-wrap"
          style={{
            left: toolbarPosition?.x ?? getToolbarPositionForRect(selectedRect, hasOptionsRow).x,
            top: toolbarPosition?.y ?? getToolbarPositionForRect(selectedRect, hasOptionsRow).y
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => {
            event.stopPropagation()
            setToolbarDrag(null)
          }}
        >
          <div className="capture-toolbar">
            <button
              className="toolbar-drag-handle"
              title={t(language, 'moveToolbar')}
              onMouseDown={(event) => {
                event.stopPropagation()
                const origin = toolbarPosition ?? getToolbarPositionForRect(selectedRect, hasOptionsRow)
                setToolbarDrag({ origin, start: { x: event.clientX, y: event.clientY } })
              }}
            >
              ⋮⋮
            </button>
            {toolOptions.map((item) => (
              <button
                key={item}
                className={tool === item ? 'active icon-tool' : 'icon-tool'}
                onClick={() => chooseTool(item)}
                title={toolTooltip(language, item, settings)}
              >
                <ToolIcon tool={item} />
              </button>
            ))}

            <div className="toolbar-menu">
              <button
                type="button"
                className={openMenu === 'shapes' ? 'toolbar-menu-button active' : 'toolbar-menu-button'}
                title={t(language, 'toolShapes')}
                onClick={() => toggleMenu('shapes')}
              >
                {shapeOptions.includes(tool as (typeof shapeOptions)[number]) ? (
                  <ToolIcon tool={tool} />
                ) : (
                  <ActionIcon type="shapes" />
                )}
              </button>
              {openMenu === 'shapes' && (
                <div className="toolbar-popover shape-popover toolbar-popover-up">
                  {shapeOptions.map((shape) => (
                    <button
                      key={shape}
                      className={tool === shape ? 'active icon-tool' : 'icon-tool'}
                      onClick={() => {
                        chooseTool(shape)
                        setOpenMenu(null)
                      }}
                      title={toolTooltip(language, shape, settings)}
                    >
                      <ToolIcon tool={shape} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="toolbar-menu">
              <button
                type="button"
                className={openMenu === 'colors' ? 'toolbar-menu-button active' : 'toolbar-menu-button'}
                title={t(language, 'toolColors')}
                onClick={() => toggleMenu('colors')}
              >
                <span className="current-color" style={{ background: color }} />
              </button>
              {openMenu === 'colors' && (
                <div className="toolbar-popover toolbar-popover-up">
                  <select
                    className="palette-select"
                    value={paletteName}
                    onChange={(event) => {
                      const nextPalette = event.currentTarget.value as keyof typeof palettes
                      setPaletteName(nextPalette)
                      setColor(palettes[nextPalette][0])
                    }}
                  >
                    {Object.keys(palettes).map((palette) => (
                      <option key={palette} value={palette}>
                        {palette}
                      </option>
                    ))}
                  </select>
                  <div className="color-dock">
                    {palettes[paletteName].map((item) => (
                      <button
                        key={item}
                        className={color === item ? 'active color-dot' : 'color-dot'}
                        style={{ background: item }}
                        onClick={() => setColor(item)}
                        aria-label={`Cor ${item}`}
                      />
                    ))}
                    <label className="custom-color" title="Cor personalizada">
                      <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {(tool !== 'blur' && tool !== 'pixelate') && (
            <div className="toolbar-menu">
              <button
                type="button"
                className={openMenu === 'size' ? 'toolbar-menu-button active' : 'toolbar-menu-button'}
                title={t(language, 'toolThickness')}
                onClick={() => toggleMenu('size')}
              >
                {size}px
              </button>
              {openMenu === 'size' && (
                <div className="toolbar-popover slim toolbar-popover-up">
                  <span className="range-label">{t(language, 'toolThickness')}</span>
                  <input
                    className="size-slider"
                    type="range"
                    min="2"
                    max="18"
                    value={size}
                    onChange={(event) => setSize(Number(event.currentTarget.value))}
                  />
                </div>
              )}
            </div>
            )}

            {showOutlineToggle && (
              <button
                type="button"
                className={showToolOutline ? 'toolbar-menu-button active text-button' : 'toolbar-menu-button text-button'}
                title={t(language, 'toolOutline')}
                onClick={() => setShowToolOutline((current) => !current)}
              >
                ◻
              </button>
            )}

            {showToolOptions && (
              <button
                type="button"
                className={openMenu === 'tool-options' ? 'toolbar-menu-button active text-button' : 'toolbar-menu-button text-button'}
                onClick={() => toggleMenu('tool-options')}
              >
                ⚙
              </button>
            )}

            <span className="toolbar-separator" />
            <button className="icon-tool" onClick={undo} title={actionTooltip(language, 'undoAction', 'undoShortcut', settings)} disabled={actions.length === 0}>
              <ActionIcon type="undo" />
            </button>
            <button className="icon-tool" onClick={redo} title={actionTooltip(language, 'redoAction', 'redoShortcut', settings)} disabled={redoStack.length === 0}>
              <ActionIcon type="redo" />
            </button>
            <button
              className="icon-tool danger"
              onClick={clearAllActions}
              title={`${t(language, 'clearAllAction')} (Alt+Delete)`}
              disabled={actions.length === 0 && redoStack.length === 0 && !pendingText}
            >
              <ActionIcon type="clear" />
            </button>
            <button className="icon-tool" onClick={() => setSettingsOpen(true)} title={t(language, 'settings')}>
              <ActionIcon type="settings" />
            </button>
            <button className="icon-tool strong" onClick={copySelection} title={actionTooltip(language, 'copyAction', 'copyShortcut', settings)}>
              <ActionIcon type="copy" />
            </button>
            <button className="icon-tool" onClick={saveSelection} title={actionTooltip(language, 'saveAction', 'saveShortcut', settings)}>
              <ActionIcon type="save" />
            </button>
            <button className="icon-tool" onClick={printSelection} title={actionTooltip(language, 'printAction', 'printShortcut', settings)}>
              <ActionIcon type="print" />
            </button>
            <button className="icon-tool whatsapp" onClick={shareWhatsApp} title={actionTooltip(language, 'whatsappAction', 'whatsappShortcut', settings)}>
              <ActionIcon type="whatsapp" />
            </button>
            <button className="icon-tool danger" onClick={() => window.gcpshot.cancelCapture()} title={actionTooltip(language, 'cancelAction', 'cancelShortcut', settings)}>
              <ActionIcon type="close" />
            </button>
          </div>

          {hasOptionsRow && (
            <div className="toolbar-options-dock">
              {tool === 'magnifier' && (
                <>
                  <select
                    className="palette-select"
                    value={magnifierMode}
                    onChange={(event) => setMagnifierMode(event.currentTarget.value as typeof magnifierMode)}
                  >
                    <option value="rectangle">{t(language, 'magnifierRect')}</option>
                    <option value="ellipse">{t(language, 'magnifierEllipse')}</option>
                  </select>
                  <label className="dock-slider-row">
                    <span>
                      {t(language, 'magnifierWidth')}: {magnifierWidth}px
                    </span>
                    <input
                      className="dock-slider"
                      type="range"
                      min="80"
                      max="900"
                      value={magnifierWidth}
                      onChange={(event) => setMagnifierWidth(Number(event.currentTarget.value))}
                    />
                  </label>
                  <label className="dock-slider-row">
                    <span>
                      {t(language, 'magnifierHeight')}: {magnifierHeight}px
                    </span>
                    <input
                      className="dock-slider"
                      type="range"
                      min="60"
                      max="700"
                      value={magnifierHeight}
                      onChange={(event) => setMagnifierHeight(Number(event.currentTarget.value))}
                    />
                  </label>
                  <label className="dock-slider-row">
                    <span>
                      {t(language, 'magnifierCorners')}: {magnifierMode === 'rectangle' ? `${magnifierCornerRadius}px` : '—'}
                    </span>
                    <input
                      className="dock-slider"
                      type="range"
                      min="0"
                      max="32"
                      value={magnifierCornerRadius}
                      disabled={magnifierMode !== 'rectangle'}
                      onChange={(event) => setMagnifierCornerRadius(Number(event.currentTarget.value))}
                    />
                  </label>
                </>
              )}
              {(tool === 'blur' || tool === 'pixelate') && (
                <label className="dock-slider-row dock-slider-row-wide">
                  <span>
                    {t(language, 'toolIntensity')}: {privacyIntensity}
                  </span>
                  <input
                    className="dock-slider"
                    type="range"
                    min="2"
                    max="18"
                    value={privacyIntensity}
                    onChange={(event) => updatePrivacyIntensity(Number(event.currentTarget.value))}
                  />
                </label>
              )}
              {tool === 'bubble' && (
                <>
                  <select
                    className="palette-select"
                    value={bubbleStyle}
                    onChange={(event) => setBubbleStyle(event.currentTarget.value as typeof bubbleStyle)}
                  >
                    <option value="speech">{t(language, 'bubbleSpeech')}</option>
                    <option value="caption">{t(language, 'bubbleCaption')}</option>
                    <option value="thought">{t(language, 'bubbleThought')}</option>
                  </select>
                  <select
                    className="palette-select"
                    value={bubbleBackground}
                    onChange={(event) => setBubbleBackground(event.currentTarget.value as typeof bubbleBackground)}
                  >
                    <option value="filled">{t(language, 'bgFilled')}</option>
                    <option value="transparent">{t(language, 'bgTransparent')}</option>
                    <option value="outline">{t(language, 'bgOutline')}</option>
                  </select>
                </>
              )}
              {tool === 'stamp' && (
                <>
                  <select
                    className="palette-select stamp-select"
                    value={`${stampTone}:${stampLabel}`}
                    onChange={(event) => {
                      const [tone, label] = event.currentTarget.value.split(':') as [StampTone, string]
                      setStampTone(tone)
                      setStampLabel(label)
                    }}
                  >
                    {allStampPresets.map((stamp) => (
                      <option key={`${stamp.tone}:${stamp.label}`} value={`${stamp.tone}:${stamp.label}`}>
                        {stamp.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="stamp-input"
                    value={stampLabel}
                    maxLength={18}
                    onChange={(event) => {
                      setStampLabel(event.currentTarget.value.toUpperCase())
                      setStampTone('custom')
                    }}
                    placeholder={t(language, 'stampPlaceholder')}
                  />
                  <label className="dock-slider-row stamp-size-row">
                    <span>Tamanho: {stampSize}px</span>
                    <input
                      className="dock-slider"
                      type="range"
                      min="18"
                      max="96"
                      value={stampSize}
                      onChange={(event) => setStampSize(Number(event.currentTarget.value))}
                    />
                  </label>
                  <button type="button" className="toolbar-menu-button text-button" onClick={saveCurrentStampPreset}>
                    Salvar modelo
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          language={language}
          settingsTab={settingsTab}
          recordingShortcut={recordingShortcut}
          overlay
          onTabChange={setSettingsTab}
          onClose={() => setSettingsOpen(false)}
          onUpdateSetting={(patch) => void updateSetting(patch)}
          onReset={() => void resetSettings()}
          onRecordingShortcutChange={setRecordingShortcut}
        />
      )}

      {pendingText && (
        <form
          className="text-composer"
          style={{ left: Math.min(pendingText.at.x, window.innerWidth - 320), top: pendingText.at.y }}
          onSubmit={(event) => {
            event.preventDefault()
            commitPendingText()
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            value={pendingText.value}
            placeholder={pendingText.tool === 'bubble' ? t(language, 'enterBubbleText') : t(language, 'enterText')}
            onChange={(event) => setPendingText({ ...pendingText, value: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setPendingText(null)
              }
            }}
          />
          <button type="submit">OK</button>
        </form>
      )}

      {initialCaptureMode === 'fullscreen' && payload && payload.segments.length > 1 && !selectedRect && (
        <div className="monitor-picker capture-monitor-picker">
          <strong>Escolha qual monitor capturar</strong>
          <span>Selecione uma tela para abrir o editor de print somente naquele monitor.</span>
          <div>
            {payload.segments.map((segment, index) => (
              <button
                key={`${segment.x}-${segment.y}-${segment.width}-${segment.height}`}
                type="button"
                onClick={() => {
                  const rect = { x: segment.x, y: segment.y, width: segment.width, height: segment.height }
                  setSelectedRect(rect)
                  setToolbarPosition(getToolbarPositionForRect(rect))
                  setTool('pen')
                  setOpenMenu(null)
                  setStatus(t(language, 'fullscreenSelected'))
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

      <div className="capture-help">
        <strong>{t(language, 'appName')}</strong>
        <span>{status}</span>
        <small>{t(language, 'helpHint')}</small>
      </div>
    </main>
  )
}

export function App(): JSX.Element {
  if (isCaptureMode) {
    return <CaptureOverlay />
  }

  return <Landing />
}
