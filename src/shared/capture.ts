import type { AppLanguage } from './i18n'
import type { AudioSource, VideoQuality, VideoResolution, WebcamShape } from './record'

export type CaptureRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CaptureSegment = {
  dataUrl: string
  x: number
  y: number
  width: number
  height: number
  displayId: number
  isPrimary: boolean
}

export type CaptureImagePayload = {
  dataUrl: string
  mode: CaptureMode
  segments: CaptureSegment[]
  virtualDesktop: {
    width: number
    height: number
    offsetX: number
    offsetY: number
  }
  display: {
    width: number
    height: number
    scaleFactor: number
  }
  screenSourceId: string
}

export type CaptureResult = {
  ok: boolean
  path?: string
  error?: string
}

export type CaptureMode = 'region' | 'fullscreen'
export type RecordMode = 'region' | 'fullscreen'

export type CaptureAction =
  | { id: string; tool: 'pen'; color: string; size: number; points: Array<{ x: number; y: number }> }
  | {
      id: string
      tool: 'line' | 'arrow' | 'rect' | 'ellipse' | 'star' | 'magnifier' | 'blur' | 'pixelate'
      color: string
      size: number
      from: { x: number; y: number }
      to: { x: number; y: number }
      magnifierMode?: 'ellipse' | 'rectangle'
      magnifierRounded?: boolean
      magnifierCornerRadius?: number
      showOutline?: boolean
    }
  | {
      id: string
      tool: 'text' | 'bubble'
      color: string
      size: number
      at: { x: number; y: number }
      text: string
      bubbleStyle?: 'speech' | 'caption' | 'thought'
      backgroundMode?: 'filled' | 'transparent' | 'outline'
    }
  | {
      id: string
      tool: 'stamp'
      color: string
      size: number
      at: { x: number; y: number }
      label: string
      tone: 'approved' | 'review' | 'private' | 'warning' | 'custom'
    }
  | {
      id: string
      tool: 'numStamp'
      color: string
      size: number
      at: { x: number; y: number }
      number: number
    }

export type CaptureExportPayload = {
  dataUrl: string
  rect: CaptureRect
  actions: CaptureAction[]
  exportedDataUrl?: string
  display?: CaptureImagePayload['display']
}

export type AppSettings = {
  startWithWindows: boolean
  minimizeToTray: boolean
  showNotifications: boolean
  autoCopyAfterCapture: boolean
  keepSelectionAfterAction: boolean
  captureCursor: boolean
  captureShortcut: string
  fullscreenShortcut: string
  studioShortcut: string
  recordRegionShortcut: string
  recordFullscreenShortcut: string
  recordPauseShortcut: string
  copyShortcut: string
  saveShortcut: string
  printShortcut: string
  whatsappShortcut: string
  undoShortcut: string
  redoShortcut: string
  selectShortcut: string
  moveShortcut: string
  penShortcut: string
  arrowShortcut: string
  magnifierShortcut: string
  blurShortcut: string
  pixelateShortcut: string
  textShortcut: string
  bubbleShortcut: string
  stampShortcut: string
  numStampShortcut: string
  rectShortcut: string
  ellipseShortcut: string
  lineShortcut: string
  starShortcut: string
  cancelShortcut: string
  printScreenShortcut: boolean
  defaultFormat: 'png' | 'jpg'
  language: AppLanguage
  videoQuality: VideoQuality
  videoFps: 24 | 30 | 60
  videoResolution: VideoResolution
  recordAudio: boolean
  audioSource: AudioSource
  microphoneDeviceId: string
  microphoneGain: number
  webcamEnabled: boolean
  webcamShape: WebcamShape
  webcamSize: number
  webcamFrameColor: string
  webcamDeviceId: string
}

export type SettingsShortcutKey = keyof Pick<
  AppSettings,
  | 'captureShortcut'
  | 'fullscreenShortcut'
  | 'studioShortcut'
  | 'recordRegionShortcut'
  | 'recordFullscreenShortcut'
  | 'recordPauseShortcut'
  | 'copyShortcut'
  | 'saveShortcut'
  | 'printShortcut'
  | 'whatsappShortcut'
  | 'undoShortcut'
  | 'redoShortcut'
  | 'selectShortcut'
  | 'moveShortcut'
  | 'penShortcut'
  | 'arrowShortcut'
  | 'magnifierShortcut'
  | 'blurShortcut'
  | 'pixelateShortcut'
  | 'textShortcut'
  | 'bubbleShortcut'
  | 'stampShortcut'
  | 'numStampShortcut'
  | 'rectShortcut'
  | 'ellipseShortcut'
  | 'lineShortcut'
  | 'starShortcut'
  | 'cancelShortcut'
>

export type ExportFormat = 'png' | 'jpeg' | 'jpg' | 'pdf'

export const defaultAppSettings: AppSettings = {
  startWithWindows: false,
  minimizeToTray: true,
  showNotifications: true,
  autoCopyAfterCapture: false,
  keepSelectionAfterAction: false,
  captureCursor: false,
  captureShortcut: 'Alt+Shift+S',
  fullscreenShortcut: 'Alt+Shift+F',
  studioShortcut: 'Alt+Shift+E',
  recordRegionShortcut: 'Alt+Shift+R',
  recordFullscreenShortcut: 'Alt+Shift+V',
  recordPauseShortcut: 'Alt+Shift+P',
  copyShortcut: 'Ctrl+C',
  saveShortcut: 'Ctrl+S',
  printShortcut: 'Ctrl+P',
  whatsappShortcut: 'Ctrl+Shift+W',
  undoShortcut: 'Ctrl+Z',
  redoShortcut: 'Ctrl+Y',
  selectShortcut: 'V',
  moveShortcut: 'M',
  penShortcut: 'P',
  arrowShortcut: 'A',
  magnifierShortcut: 'L',
  blurShortcut: 'B',
  pixelateShortcut: 'X',
  textShortcut: 'T',
  bubbleShortcut: 'U',
  stampShortcut: 'K',
  numStampShortcut: 'N',
  rectShortcut: 'R',
  ellipseShortcut: 'O',
  lineShortcut: 'I',
  starShortcut: 'G',
  cancelShortcut: 'Esc',
  printScreenShortcut: true,
  defaultFormat: 'png',
  language: 'auto',
  videoQuality: 'balanced',
  videoFps: 30,
  videoResolution: 'auto',
  recordAudio: true,
  audioSource: 'microphone',
  microphoneDeviceId: '',
  microphoneGain: 100,
  webcamEnabled: false,
  webcamShape: 'circle',
  webcamSize: 180,
  webcamFrameColor: '#d94cff',
  webcamDeviceId: ''
}
