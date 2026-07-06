export type StudioImportFile = {
  name: string
  dataUrl: string
  width: number
  height: number
}

export type StudioPickResult = {
  ok: boolean
  files: StudioImportFile[]
  error?: string
}

export type StudioVideoImportFile = {
  name: string
  dataUrl: string
  mimeType: string
}

export type StudioVideoPickResult = {
  ok: boolean
  files: StudioVideoImportFile[]
  error?: string
}
