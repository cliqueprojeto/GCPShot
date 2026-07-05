import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, CaptureExportPayload, CaptureImagePayload, CaptureMode, CaptureResult, RecordMode } from '../shared/capture'
import type { StudioPickResult } from '../shared/studio'

const api = {
  beginCapture: (mode: CaptureMode = 'region'): Promise<CaptureResult> => ipcRenderer.invoke('capture:begin', mode),
  beginRecord: (mode: RecordMode = 'region'): Promise<CaptureResult> => ipcRenderer.invoke('record:begin', mode),
  cancelCapture: (): Promise<void> => ipcRenderer.invoke('capture:cancel'),
  cancelRecord: (): Promise<void> => ipcRenderer.invoke('record:cancel'),
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
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  showMainWindow: (): Promise<void> => ipcRenderer.invoke('window:show-main'),
  openSettingsWindow: (): Promise<void> => ipcRenderer.invoke('window:open-settings'),
  onOpenSettings: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('settings:open', listener)
    return () => ipcRenderer.removeListener('settings:open', listener)
  },
  onCaptureImage: (callback: (payload: CaptureImagePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CaptureImagePayload): void => {
      callback(payload)
    }

    ipcRenderer.on('capture:image', listener)
    return () => ipcRenderer.removeListener('capture:image', listener)
  },
  pickStudioImages: (): Promise<StudioPickResult> => ipcRenderer.invoke('studio:pick-images'),
  exportStudioImage: (dataUrl: string): Promise<CaptureResult> => ipcRenderer.invoke('studio:export-image', dataUrl)
}

contextBridge.exposeInMainWorld('gcpshot', api)
