import type { CaptureRect } from '../shared/capture'
import type { CaptureAction } from '../shared/capture'
import type { AppSettings } from '../shared/capture'
import {
  RECORDING_CHUNK_MS,
  getTargetResolution,
  getVideoBitrate,
  resolveRecordingCodec,
  type ResolvedRecordingCodec
} from '../shared/record'
import { OpfsRecordingSink } from './opfsRecordingSink'

type Point = { x: number; y: number }

type CompositorOptions = {
  screenVideo: HTMLVideoElement
  cropRect: CaptureRect
  sourceOrigin: Point
  outputWidth: number
  outputHeight: number
  webcamVideo?: HTMLVideoElement | null
  webcamRect?: { x: number; y: number; size: number; shape: 'circle' | 'square' | 'rounded'; color: string }
  getActions: () => CaptureAction[]
  drawAction: (
    context: CanvasRenderingContext2D,
    action: CaptureAction,
    scaleX: number,
    scaleY: number,
    image: HTMLImageElement | HTMLVideoElement
  ) => void
}

export type RecordingStopResult = {
  blob: Blob
  mimeType: string
  extension: string
  codec: ResolvedRecordingCodec
  usedOpfs: boolean
  bytesWritten: number
}

const STOP_TIMEOUT_MS = 20_000

export class RegionRecorder {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private recorder: MediaRecorder | null = null
  private sink = new OpfsRecordingSink()
  private paintTimer: ReturnType<typeof setInterval> | null = null
  private compositor: CompositorOptions | null = null
  private codec: ResolvedRecordingCodec
  private isPaused = false
  private audioStream: MediaStream | null = null
  private systemAudioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private canvasStream: MediaStream | null = null

  constructor(private settings: AppSettings) {
    this.codec = resolveRecordingCodec(settings.recordAudio && settings.audioSource !== 'none')
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    })

    if (!context) {
      throw new Error('Canvas 2D indisponível para gravação.')
    }

    this.context = context
  }

  getSelectedCodec(): ResolvedRecordingCodec {
    return this.codec
  }

  async attachScreenStream(sourceId: string, cropRect: CaptureRect, sourceOrigin: Point = { x: 0, y: 0 }): Promise<MediaStream> {
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-expect-error Electron desktop capture constraints
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      }
    })

    const screenVideo = document.createElement('video')
    screenVideo.srcObject = screenStream
    screenVideo.muted = true
    await screenVideo.play()

    const target = getTargetResolution(this.settings.videoResolution, cropRect.width, cropRect.height)

    this.canvas.width = target.width
    this.canvas.height = target.height

    this.compositor = {
      screenVideo,
      cropRect,
      sourceOrigin,
      outputWidth: target.width,
      outputHeight: target.height,
      getActions: () => [],
      drawAction: () => undefined
    }

    return this.canvas.captureStream(this.settings.videoFps)
  }

  setCompositorOptions(options: Partial<CompositorOptions>): void {
    if (!this.compositor) {
      return
    }

    this.compositor = { ...this.compositor, ...options }
  }

  async attachAudio(sourceId?: string): Promise<MediaStream | null> {
    if (!this.settings.recordAudio || this.settings.audioSource === 'none') {
      return null
    }

    const streams: MediaStream[] = []

    if ((this.settings.audioSource === 'system' || this.settings.audioSource === 'both') && sourceId) {
      try {
        this.systemAudioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            // @ts-expect-error Electron desktop audio constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId
            }
          }
        })
        streams.push(this.systemAudioStream)
      } catch {
        // Some Windows audio devices do not expose desktop audio to Chromium.
      }
    }

    if (this.settings.audioSource === 'microphone' || this.settings.audioSource === 'both') {
      const constraints: MediaStreamConstraints = {
        audio: this.settings.microphoneDeviceId
          ? {
              deviceId: { exact: this.settings.microphoneDeviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          : {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
      }

      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        })
      }
      streams.push(this.audioStream)
    }

    if (streams.length === 0) {
      return null
    }

    if (streams.length === 1 && this.settings.microphoneGain === 100) {
      return streams[0] ?? null
    }

    this.audioContext = new AudioContext()
    const destination = this.audioContext.createMediaStreamDestination()

    streams.forEach((stream) => {
      const source = this.audioContext!.createMediaStreamSource(stream)
      if (stream === this.audioStream) {
        const gain = this.audioContext!.createGain()
        gain.gain.value = Math.max(0, this.settings.microphoneGain) / 100
        source.connect(gain).connect(destination)
        return
      }

      source.connect(destination)
    })

    return destination.stream
  }

  async start(canvasStream: MediaStream, audioStream: MediaStream | null): Promise<void> {
    this.codec = resolveRecordingCodec(Boolean(audioStream))
    await this.sink.open(this.codec.extension)
    this.canvasStream = canvasStream

    const tracks = [...canvasStream.getVideoTracks()]
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks())
    }

    const mixed = new MediaStream(tracks)
    this.recorder = new MediaRecorder(mixed, {
      mimeType: this.codec.mimeType,
      videoBitsPerSecond: getVideoBitrate(this.settings.videoQuality, this.settings.videoFps),
      audioBitsPerSecond: this.codec.audioBitsPerSecond
    })

    this.recorder.ondataavailable = (event) => {
      void this.sink.write(event.data)
    }

    this.recorder.start(RECORDING_CHUNK_MS)
    this.isPaused = false
    this.startPaintLoop()
  }

  pause(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.pause()
    }
    this.isPaused = true
    this.stopPaintLoop()
  }

  resume(): void {
    if (this.recorder?.state === 'paused') {
      this.recorder.resume()
    }
    this.isPaused = false
    this.startPaintLoop()
  }

  async stop(): Promise<RecordingStopResult> {
    this.stopPaintLoop()

    const recorder = this.recorder
    if (!recorder) {
      throw new Error('Gravação não iniciada.')
    }

    if (recorder.state === 'inactive') {
      throw new Error('A gravação já foi encerrada.')
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Tempo esgotado ao finalizar a gravação.'))
      }, STOP_TIMEOUT_MS)

      recorder.onstop = () => {
        window.clearTimeout(timeoutId)
        void this.sink
          .close(this.codec.mimeType)
          .then(async (blob) => {
            if (blob.size === 0) {
              throw new Error('Nenhum dado de vídeo foi gravado.')
            }

            const result: RecordingStopResult = {
              blob,
              mimeType: this.codec.mimeType,
              extension: this.codec.extension,
              codec: this.codec,
              usedOpfs: this.sink.usesOpfs,
              bytesWritten: this.sink.writtenBytes
            }

            this.recorder = null
            await this.sink.dispose()
            this.disposeCompositor()
            resolve(result)
          })
          .catch(reject)
      }

      recorder.onerror = () => {
        window.clearTimeout(timeoutId)
        reject(new Error('Erro do MediaRecorder ao finalizar.'))
      }

      try {
        if (recorder.state === 'paused') {
          recorder.resume()
        }

        if (recorder.state === 'recording') {
          recorder.requestData()
        }

        recorder.stop()
      } catch (error) {
        window.clearTimeout(timeoutId)
        reject(error instanceof Error ? error : new Error('Falha ao parar gravação.'))
      }
    })
  }

  private disposeCompositor(): void {
    const screenStream = this.compositor?.screenVideo.srcObject
    if (screenStream instanceof MediaStream) {
      screenStream.getTracks().forEach((track) => track.stop())
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
      this.audioStream = null
    }

    if (this.systemAudioStream) {
      this.systemAudioStream.getTracks().forEach((track) => track.stop())
      this.systemAudioStream = null
    }

    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => track.stop())
      this.canvasStream = null
    }

    this.compositor = null
  }

  private startPaintLoop(): void {
    this.stopPaintLoop()
    this.paintFrame()

    const intervalMs = Math.max(16, Math.round(1000 / this.settings.videoFps))
    this.paintTimer = setInterval(() => {
      if (!this.isPaused) {
        this.paintFrame()
      }
    }, intervalMs)
  }

  private stopPaintLoop(): void {
    if (this.paintTimer) {
      clearInterval(this.paintTimer)
      this.paintTimer = null
    }
  }

  private paintFrame(): void {
    const compositor = this.compositor
    if (!compositor) {
      return
    }

    const { screenVideo, cropRect, outputWidth, outputHeight, sourceOrigin } = compositor
    const scaleX = outputWidth / cropRect.width
    const scaleY = outputHeight / cropRect.height

    this.context.drawImage(
      screenVideo,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      outputWidth,
      outputHeight
    )

    this.context.save()
    this.context.scale(scaleX, scaleY)
    this.context.translate(-(sourceOrigin.x + cropRect.x), -(sourceOrigin.y + cropRect.y))

    compositor.getActions().forEach((action) => {
      compositor.drawAction(this.context, action, 1, 1, screenVideo)
    })

    this.context.restore()

    if (compositor.webcamVideo && compositor.webcamRect) {
      const { x, y, size, shape, color } = compositor.webcamRect
      const video = compositor.webcamVideo
      const targetX = (x - sourceOrigin.x - cropRect.x) * scaleX
      const targetY = (y - sourceOrigin.y - cropRect.y) * scaleY
      const targetWidth = size * scaleX
      const targetHeight = size * scaleY

      this.context.save()
      this.context.beginPath()

      if (shape === 'circle') {
        this.context.ellipse(
          targetX + targetWidth / 2,
          targetY + targetHeight / 2,
          targetWidth / 2,
          targetHeight / 2,
          0,
          0,
          Math.PI * 2
        )
      } else if (shape === 'rounded') {
        this.context.roundRect(targetX, targetY, targetWidth, targetHeight, Math.min(targetWidth, targetHeight) * 0.18)
      } else {
        this.context.rect(targetX, targetY, targetWidth, targetHeight)
      }

      this.context.closePath()
      this.context.lineWidth = 4
      this.context.strokeStyle = color
      this.context.stroke()
      this.context.clip()
      const videoWidth = video.videoWidth || targetWidth
      const videoHeight = video.videoHeight || targetHeight
      const sourceAspect = videoWidth / Math.max(1, videoHeight)
      const targetAspect = targetWidth / Math.max(1, targetHeight)
      let sourceX = 0
      let sourceY = 0
      let sourceWidth = videoWidth
      let sourceHeight = videoHeight

      if (sourceAspect > targetAspect) {
        sourceWidth = videoHeight * targetAspect
        sourceX = (videoWidth - sourceWidth) / 2
      } else {
        sourceHeight = videoWidth / targetAspect
        sourceY = (videoHeight - sourceHeight) / 2
      }

      this.context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight)
      this.context.restore()
    }
  }
}

export async function createWebcamVideo(deviceId: string): Promise<HTMLVideoElement> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : true,
    audio: false
  })

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  await video.play()
  return video
}

export function clampWebcamPosition(point: Point, size: number, viewport: { width: number; height: number }): Point {
  return {
    x: Math.max(12, Math.min(point.x, viewport.width - size - 12)),
    y: Math.max(12, Math.min(point.y, viewport.height - size - 12))
  }
}
