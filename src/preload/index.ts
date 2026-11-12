import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, CaptureExportPayload, CaptureImagePayload, CaptureMode, CaptureResult, RecordMode } from '../shared/capture'
import type { StudioPickResult, StudioVideoPickResult } from '../shared/studio'
import type { ColorLibrary, ColorResult } from '../shared/colors'
import type { StoredCapture } from '../shared/studio'
import type { ShortcutInfo } from '../shared/shortcuts'
import type { UpdateStatus } from '../shared/updates'

const api = {
  finishWelcome: (view: 'home' | 'studio' | 'colors'): Promise<void> => ipcRenderer.invoke('app:welcome-finish', view),
  getStoredCaptures: (): Promise<StoredCapture[]> => ipcRenderer.invoke('studio:captures'),
  removeStoredCapture: (id: string): Promise<void> => ipcRenderer.invoke('studio:remove-capture', id),
  openColorLabFromToast: (): void => ipcRenderer.send('colors:toast-open'),
  dismissColorToast: (): void => ipcRenderer.send('colors:toast-dismiss'),
  getColorLibrary: (): Promise<ColorLibrary> => ipcRenderer.invoke('colors:get'),
  saveColorLibrary: (library: ColorLibrary): Promise<ColorLibrary> => ipcRenderer.invoke('colors:save', library),
  pickColor: (): Promise<ColorResult> => ipcRenderer.invoke('colors:pick'),
  copyColorText: (value: string): Promise<void> => ipcRenderer.invoke('colors:copy', value),
  importColorLibrary: (): Promise<ColorLibrary | null> => ipcRenderer.invoke('colors:import'),
  exportColorLibrary: (format: 'json' | 'css'): Promise<boolean> => ipcRenderer.invoke('colors:export', format),
  onOpenColors: (callback: (view: 'colors' | 'palettes') => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, view: 'colors' | 'palettes'): void => callback(view)
    ipcRenderer.on('colors:open', listener)
    return () => ipcRenderer.removeListener('colors:open', listener)
  },
  onColorPicked: (callback: (hex: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, hex: string): void => callback(hex)
    ipcRenderer.on('colors:picked', listener)
    return () => ipcRenderer.removeListener('colors:picked', listener)
  },
  beginCapture: (mode: CaptureMode = 'region', autoCopy = false): Promise<CaptureResult> => ipcRenderer.invoke('capture:begin', mode, autoCopy),
  beginRecord: (mode: RecordMode = 'region'): Promise<CaptureResult> => ipcRenderer.invoke('record:begin', mode),
  cancelCapture: (): Promise<void> => ipcRenderer.invoke('capture:cancel'),
  cancelRecord: (): Promise<void> => ipcRenderer.invoke('record:cancel'),
  setRecordPassthrough: (enabled: boolean): Promise<void> => ipcRenderer.invoke('record:set-passthrough', enabled),
  saveRecording: (buffer: ArrayBuffer, meta?: { extension?: string }): Promise<CaptureResult> =>
    ipcRenderer.invoke('record:save', buffer, meta),
  copyCapture: (payload: CaptureExportPayload): Promise<CaptureResult> =>
    ipcRenderer.invoke('capture:copy', payload),
  saveCapture: (payload: CaptureExportPayload): Promise<CaptureResult> =>
    ipcRenderer.invoke('capture:save', payload),
  printCapture: (payload: CaptureExportPayload): Promise<CaptureResult> =>
    ipcRenderer.invoke('capture:print', payload),
  shareWhatsApp: (payload: CaptureExportPayload): Promise<CaptureResult> =>
    ipcRenderer.invoke('capture:share-whatsapp', payload),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:status'),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updates:install'),
  openReleasePage: (): Promise<void> => ipcRenderer.invoke('updates:open-release'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status)
    ipcRenderer.on('updates:status', listener)
    return () => ipcRenderer.removeListener('updates:status', listener)
  },
  finishLiveColor: (hex: string | null): void => ipcRenderer.send('livecolor:finish', hex),
  onLiveColorImage: (callback: (payload: { dataUrl: string; width: number; height: number }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { dataUrl: string; width: number; height: number }): void => callback(payload)
    ipcRenderer.on('livecolor:image', listener)
    return () => ipcRenderer.removeListener('livecolor:image', listener)
  },
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  getShortcutInfo: (): Promise<ShortcutInfo> => ipcRenderer.invoke('settings:shortcut-info'),
  setShortcutEditing: (enabled: boolean): Promise<void> => ipcRenderer.invoke('settings:shortcut-editing', enabled),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  showMainWindow: (): Promise<void> => ipcRenderer.invoke('window:show-main'),
  openSettingsWindow: (): Promise<void> => ipcRenderer.invoke('window:open-settings'),
  openStudioWindow: (): Promise<void> => ipcRenderer.invoke('window:open-studio'),
  onOpenSettings: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('settings:open', listener)
    return () => ipcRenderer.removeListener('settings:open', listener)
  },
  onOpenStudio: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('studio:open', listener)
    return () => ipcRenderer.removeListener('studio:open', listener)
  },
  onCaptureImage: (callback: (payload: CaptureImagePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CaptureImagePayload): void => {
      callback(payload)
    }

    ipcRenderer.on('capture:image', listener)
    return () => ipcRenderer.removeListener('capture:image', listener)
  },
  pickStudioImages: (): Promise<StudioPickResult> => ipcRenderer.invoke('studio:pick-images'),
  exportStudioImage: (dataUrl: string): Promise<CaptureResult> => ipcRenderer.invoke('studio:export-image', dataUrl),
  pickStudioVideos: (): Promise<StudioVideoPickResult> => ipcRenderer.invoke('studio:pick-videos'),
  exportStudioVideoProject: (project: string): Promise<CaptureResult> => ipcRenderer.invoke('studio:export-video-project', project)
}

contextBridge.exposeInMainWorld('gcpshot', api)
