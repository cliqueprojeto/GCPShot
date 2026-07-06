export type VideoQuality = 'balanced' | 'sharp' | 'fluid'
export type VideoResolution = 'auto' | '1080p' | '720p'
export type AudioSource = 'none' | 'microphone' | 'system' | 'both'
export type WebcamShape = 'circle' | 'square' | 'rounded'

export type RecordingSettings = {
  videoQuality: VideoQuality
  videoFps: 24 | 30 | 60
  videoResolution: VideoResolution
  recordAudio: boolean
  audioSource: AudioSource
  microphoneDeviceId: string
  systemAudioDeviceId: string
  microphoneGain: number
  webcamEnabled: boolean
  webcamShape: WebcamShape
  webcamSize: number
  webcamFrameColor: string
  webcamDeviceId: string
}

export type RecordingCodecProfile = {
  mimeType: string
  extension: 'webm' | 'mp4'
  labelKey: 'recordingCodecH264' | 'recordingCodecVp8' | 'recordingCodecVp9' | 'recordingCodecDefault'
  hardwarePreferred: boolean
}

/** Intervalo de flush para OPFS — 1 s equilibra RAM e recuperação em falhas. */
export const RECORDING_CHUNK_MS = 1000

export const RECORDING_CODEC_CANDIDATES: RecordingCodecProfile[] = [
  {
    mimeType: 'video/webm;codecs=h264,opus',
    extension: 'webm',
    labelKey: 'recordingCodecH264',
    hardwarePreferred: true
  },
  {
    mimeType: 'video/webm;codecs=avc1,opus',
    extension: 'webm',
    labelKey: 'recordingCodecH264',
    hardwarePreferred: true
  },
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    extension: 'mp4',
    labelKey: 'recordingCodecH264',
    hardwarePreferred: true
  },
  {
    mimeType: 'video/mp4;codecs=avc1,mp4a.40.2',
    extension: 'mp4',
    labelKey: 'recordingCodecH264',
    hardwarePreferred: true
  },
  {
    mimeType: 'video/webm;codecs=vp8,opus',
    extension: 'webm',
    labelKey: 'recordingCodecVp8',
    hardwarePreferred: false
  },
  {
    mimeType: 'video/webm;codecs=vp9,opus',
    extension: 'webm',
    labelKey: 'recordingCodecVp9',
    hardwarePreferred: false
  },
  {
    mimeType: 'video/webm',
    extension: 'webm',
    labelKey: 'recordingCodecDefault',
    hardwarePreferred: false
  }
]

export type ResolvedRecordingCodec = RecordingCodecProfile & {
  audioBitsPerSecond: number
}

export const defaultRecordingSettings: RecordingSettings = {
  videoQuality: 'balanced',
  videoFps: 30,
  videoResolution: 'auto',
  recordAudio: true,
  audioSource: 'microphone',
  microphoneDeviceId: '',
  systemAudioDeviceId: '',
  microphoneGain: 100,
  webcamEnabled: false,
  webcamShape: 'circle',
  webcamSize: 180,
  webcamFrameColor: '#d94cff',
  webcamDeviceId: ''
}

export function resolveRecordingCodec(recordAudio: boolean): ResolvedRecordingCodec {
  const candidates = recordAudio
    ? RECORDING_CODEC_CANDIDATES
    : RECORDING_CODEC_CANDIDATES.map((profile) => ({
        ...profile,
        mimeType: profile.mimeType.replace(/,opus|,mp4a\.40\.2/g, '')
      }))

  for (const profile of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(profile.mimeType)) {
      return {
        ...profile,
        audioBitsPerSecond: profile.mimeType.includes('mp4') ? 128_000 : 96_000
      }
    }
  }

  return {
    mimeType: 'video/webm',
    extension: 'webm',
    labelKey: 'recordingCodecDefault',
    hardwarePreferred: false,
    audioBitsPerSecond: 96_000
  }
}

export function getVideoBitrate(quality: VideoQuality, fps: number): number {
  const fpsFactor = fps >= 60 ? 1.35 : fps <= 24 ? 0.85 : 1

  switch (quality) {
    case 'sharp':
      return Math.round(8_000_000 * fpsFactor)
    case 'fluid':
      return Math.round(3_000_000 * fpsFactor)
    default:
      return Math.round(5_000_000 * fpsFactor)
  }
}

export function getTargetResolution(
  resolution: VideoResolution,
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } {
  if (resolution === '1080p') {
    const aspect = sourceWidth / Math.max(1, sourceHeight)
    return aspect >= 1
      ? { width: 1920, height: Math.round(1920 / aspect) }
      : { width: Math.round(1080 * aspect), height: 1080 }
  }

  if (resolution === '720p') {
    const aspect = sourceWidth / Math.max(1, sourceHeight)
    return aspect >= 1
      ? { width: 1280, height: Math.round(1280 / aspect) }
      : { width: Math.round(720 * aspect), height: 720 }
  }

  const maxEdge = 1920
  if (sourceWidth <= maxEdge && sourceHeight <= maxEdge) {
    return { width: sourceWidth, height: sourceHeight }
  }

  const scale = maxEdge / Math.max(sourceWidth, sourceHeight)
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale)
  }
}
