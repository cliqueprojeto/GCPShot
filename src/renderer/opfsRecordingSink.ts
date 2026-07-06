/**
 * Gravação incremental no OPFS (Origin Private File System).
 * Mantém os chunks no disco em vez da RAM — estilo Camtasia / extensão Chrome.
 */
export class OpfsRecordingSink {
  private writable: FileSystemWritableFileStream | null = null
  private fileHandle: FileSystemFileHandle | null = null
  private fileName = ''
  private useMemoryFallback = false
  private memoryChunks: Blob[] = []
  private bytesWritten = 0
  private pendingWrite: Promise<void> = Promise.resolve()

  static isSupported(): boolean {
    return typeof navigator.storage?.getDirectory === 'function'
  }

  get writtenBytes(): number {
    return this.bytesWritten
  }

  get usesOpfs(): boolean {
    return !this.useMemoryFallback
  }

  async open(extension: string): Promise<void> {
    if (!OpfsRecordingSink.isSupported()) {
      this.useMemoryFallback = true
      return
    }

    const root = await navigator.storage.getDirectory()
    this.fileName = `gcpshot-recording-${Date.now()}.${extension}`
    this.fileHandle = await root.getFileHandle(this.fileName, { create: true })
    this.writable = await this.fileHandle.createWritable()
  }

  async write(chunk: Blob): Promise<void> {
    if (chunk.size === 0) {
      return
    }

    this.pendingWrite = this.pendingWrite.then(async () => {
      if (this.useMemoryFallback) {
        this.memoryChunks.push(chunk)
        this.bytesWritten += chunk.size
        return
      }

      await this.writable!.write(chunk)
      this.bytesWritten += chunk.size
    })

    return this.pendingWrite
  }

  async close(mimeType: string): Promise<Blob> {
    await this.pendingWrite

    if (this.useMemoryFallback) {
      return new Blob(this.memoryChunks, { type: mimeType })
    }

    await this.writable!.close()
    this.writable = null
    const file = await this.fileHandle!.getFile()
    return new Blob([await file.arrayBuffer()], { type: mimeType })
  }

  async dispose(): Promise<void> {
    if (!this.fileName || this.useMemoryFallback) {
      this.memoryChunks = []
      this.bytesWritten = 0
      return
    }

    try {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(this.fileName)
    } catch {
      // arquivo temporário já removido ou indisponível
    }

    this.fileName = ''
    this.fileHandle = null
    this.memoryChunks = []
    this.bytesWritten = 0
    this.pendingWrite = Promise.resolve()
  }
}
