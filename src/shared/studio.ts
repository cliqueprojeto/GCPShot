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
