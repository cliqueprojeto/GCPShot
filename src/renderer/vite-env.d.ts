/// <reference types="vite/client" />

import type { AppSettings, CaptureExportPayload, CaptureImagePayload, CaptureMode, CaptureResult, RecordMode } from '../shared/capture'
import type { StudioPickResult, StudioVideoPickResult } from '../shared/studio'
import type { ColorLibrary, ColorResult } from '../shared/colors'
import type { StoredCapture } from '../shared/studio'

declare global {
  interface Window {
    gcpshot: {
      finishWelcome: (view: 'home' | 'studio' | 'colors') => Promise<void>
      getStoredCaptures: () => Promise<StoredCapture[]>
      removeStoredCapture: (id: string) => Promise<void>
      openColorLabFromToast: () => void
      dismissColorToast: () => void
      getColorLibrary: () => Promise<ColorLibrary>
      saveColorLibrary: (library: ColorLibrary) => Promise<ColorLibrary>
      pickColor: () => Promise<ColorResult>
      copyColorText: (value: string) => Promise<void>
      importColorLibrary: () => Promise<ColorLibrary | null>
      exportColorLibrary: (format: 'json' | 'css') => Promise<boolean>
      onOpenColors: (callback: (view: 'colors' | 'palettes') => void) => () => void
      onColorPicked: (callback: (hex: string) => void) => () => void
      beginCapture: (mode?: CaptureMode, autoCopy?: boolean) => Promise<CaptureResult>
      beginRecord: (mode?: RecordMode) => Promise<CaptureResult>
      cancelCapture: () => Promise<void>
      cancelRecord: () => Promise<void>
      setRecordPassthrough: (enabled: boolean) => Promise<void>
      saveRecording: (buffer: ArrayBuffer, meta?: { extension?: string }) => Promise<CaptureResult>
      copyCapture: (payload: CaptureExportPayload) => Promise<CaptureResult>
      saveCapture: (payload: CaptureExportPayload) => Promise<CaptureResult>
      printCapture: (payload: CaptureExportPayload) => Promise<CaptureResult>
      shareWhatsApp: (payload: CaptureExportPayload) => Promise<CaptureResult>
      getSettings: () => Promise<AppSettings>
      updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
      resetSettings: () => Promise<AppSettings>
      showMainWindow: () => Promise<void>
      openSettingsWindow: () => Promise<void>
      openStudioWindow: () => Promise<void>
      onOpenSettings: (callback: () => void) => () => void
      onOpenStudio: (callback: () => void) => () => void
      onCaptureImage: (callback: (payload: CaptureImagePayload) => void) => () => void
      pickStudioImages: () => Promise<StudioPickResult>
      exportStudioImage: (dataUrl: string) => Promise<CaptureResult>
      pickStudioVideos: () => Promise<StudioVideoPickResult>
      exportStudioVideoProject: (project: string) => Promise<CaptureResult>
    }
  }
}

export {}
