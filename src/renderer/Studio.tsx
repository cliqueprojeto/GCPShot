import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings } from '../shared/capture'
import type { AppLanguage, TranslationKey } from '../shared/i18n'
import { t } from '../shared/i18n'
import { StudioErrorBoundary } from './StudioErrorBoundary'
import { PhotoEditor, type PhotoEditorHandle } from './PhotoEditor'
import {
  collageLayouts,
  createThumbnailDataUrl,
  renderLayerComposition,
  renderCollage,
  type CollageLayoutId,
  type CollageSlotPosition,
  type ImageLayer
} from './studioCollage'
import {
  addStudioImage,
  addStudioVideo,
  loadStudioLibrary,
  loadStudioVideos,
  removeStudioImage,
  removeStudioVideo,
  saveStudioLibrary,
  saveStudioVideos,
  type StudioVideo,
  type StudioImage
} from './studioStorage'

type StudioMode = 'edit' | 'collage' | 'layers' | 'video'

type StudioProps = {
  language: AppLanguage
  settings: AppSettings
  onBack: () => void
  onOpenSettings: () => void
}

type TimelineClip = {
  id: string
  videoId: string
  start: number
  end: number
  track: number
}

type TimelineEffect = {
  id: string
  name: string
  start: number
  end: number
  track: number
}

const PREVIEW_DEBOUNCE_MS = 140
const TIMELINE_LABEL_WIDTH = 86
const TIMELINE_SECONDS_WIDTH = 92

const videoCopy = {
  'pt-BR': {
    tab: 'Editar video',
    library: 'Biblioteca de videos',
    import: 'Importar video',
    empty: 'Importe gravacoes ou clipes MP4/WebM para montar seu projeto.',
    preview: 'Selecione um video',
    timeline: 'Timeline',
    trim: 'Cortes',
    start: 'Inicio',
    end: 'Fim',
    transition: 'Transicao',
    audio: 'Trilha de audio',
    format: 'Formato de exportacao',
    export: 'Exportar projeto',
    media: 'Midia',
    annotations: 'Anotacoes',
    cursor: 'Cursor',
    narration: 'Narracao',
    effects: 'Efeitos',
    properties: 'Propriedades',
    exportPanel: 'Exportacao',
    rotation: 'Rotacao',
    text: 'Texto',
    magnetic: 'Magnetico',
    autoBlur: 'Blur automatico',
    exportSettings: 'Configurar exportacao',
    exported: 'Projeto de video exportado em {path}',
    added: '{count} video(s) importado(s).',
    storyboard: 'Arraste mentalmente o fluxo aqui: clipes, cortes, transicoes, trilha e legenda ficam salvos no projeto.'
  },
  en: {
    tab: 'Edit video',
    library: 'Video library',
    import: 'Import video',
    empty: 'Import recordings or MP4/WebM clips to build your project.',
    preview: 'Select a video',
    timeline: 'Timeline',
    trim: 'Cuts',
    start: 'Start',
    end: 'End',
    transition: 'Transition',
    audio: 'Audio track',
    format: 'Export format',
    export: 'Export project',
    media: 'Media',
    annotations: 'Annotations',
    cursor: 'Cursor',
    narration: 'Narration',
    effects: 'Effects',
    properties: 'Properties',
    exportPanel: 'Export',
    rotation: 'Rotation',
    text: 'Text',
    magnetic: 'Magnetic',
    autoBlur: 'Auto blur',
    exportSettings: 'Export settings',
    exported: 'Video project exported to {path}',
    added: '{count} video(s) imported.',
    storyboard: 'Build the flow here: clips, cuts, transitions, soundtrack and captions are saved in the project.'
  },
  es: {
    tab: 'Editar video',
    library: 'Biblioteca de videos',
    import: 'Importar video',
    empty: 'Importa grabaciones o clips MP4/WebM para armar tu proyecto.',
    preview: 'Selecciona un video',
    timeline: 'Linea de tiempo',
    trim: 'Cortes',
    start: 'Inicio',
    end: 'Fin',
    transition: 'Transicion',
    audio: 'Pista de audio',
    format: 'Formato de exportacion',
    export: 'Exportar proyecto',
    media: 'Medios',
    annotations: 'Anotaciones',
    cursor: 'Cursor',
    narration: 'Narracion',
    effects: 'Efectos',
    properties: 'Propiedades',
    exportPanel: 'Exportacion',
    rotation: 'Rotacion',
    text: 'Texto',
    magnetic: 'Magnetico',
    autoBlur: 'Blur automatico',
    exportSettings: 'Configurar exportacion',
    exported: 'Proyecto de video exportado en {path}',
    added: '{count} video(s) importado(s).',
    storyboard: 'Arma el flujo aqui: clips, cortes, transiciones, pista y subtitulos quedan guardados en el proyecto.'
  }
} as const

type StudioVideoCopy = (typeof videoCopy)[keyof typeof videoCopy]

function resolveStudioVideoCopy(language: AppLanguage): StudioVideoCopy {
  if (language === 'en') return videoCopy.en
  if (language === 'es') return videoCopy.es
  return videoCopy['pt-BR']
}

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '00:00'
  }

  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function safeVideoDuration(duration: number | undefined | null): number {
  return Number.isFinite(duration) && duration !== undefined && duration !== null ? Math.max(0, duration) : 0
}

function snapVideoTime(value: number, magnetic: boolean): number {
  return magnetic ? Math.round(value * 2) / 2 : value
}

function layoutLabelKey(layoutId: CollageLayoutId): TranslationKey {
  const map: Record<CollageLayoutId, TranslationKey> = {
    '2col': 'studioLayout2col',
    '2row': 'studioLayout2row',
    '3col': 'studioLayout3col',
    'grid-2x2': 'studioLayoutGrid2x2',
    'hero-left': 'studioLayoutHeroLeft',
    'hero-top': 'studioLayoutHeroTop'
  }

  return map[layoutId]
}

function StudioThumb({ item, active, onSelect, onRemove }: {
  item: StudioImage
  active: boolean
  onSelect: () => void
  onRemove: () => void
}): JSX.Element {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void createThumbnailDataUrl(item.dataUrl, 220).then((url) => {
      if (!cancelled) {
        setThumbUrl(url)
      }
    })

    return () => {
      cancelled = true
    }
  }, [item.dataUrl])

  return (
    <button type="button" className={active ? 'studio-thumb active' : 'studio-thumb'} onClick={onSelect} title={item.name}>
      {thumbUrl ? <img src={thumbUrl} alt={item.name} loading="lazy" decoding="async" /> : <span className="studio-thumb-placeholder" />}
      <span>{item.name}</span>
      <em
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        ×
      </em>
    </button>
  )
}

function StudioVideoThumb({ item, active, onSelect, onRemove, onDragStart }: {
  item: StudioVideo
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={active ? 'studio-thumb studio-video-thumb active' : 'studio-thumb studio-video-thumb'}
      onClick={onSelect}
      title={item.name}
      draggable
      onDragStart={onDragStart}
    >
      <video src={item.dataUrl} muted preload="metadata" />
      <span>{item.name}</span>
      <em
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        x
      </em>
    </button>
  )
}

function StudioContent({ language, onBack, onOpenSettings }: Omit<StudioProps, 'settings'>): JSX.Element {
  const [library, setLibrary] = useState<StudioImage[]>(() => loadStudioLibrary())
  const [videoLibrary, setVideoLibrary] = useState<StudioVideo[]>(() => loadStudioVideos())
  const [mode, setMode] = useState<StudioMode>('edit')
  const [selectedId, setSelectedId] = useState<string | null>(library[0]?.id ?? null)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videoLibrary[0]?.id ?? null)
  const [layoutId, setLayoutId] = useState<CollageLayoutId>('hero-left')
  const [slotImages, setSlotImages] = useState<Array<string | null>>(collageLayouts[4]!.cells.map(() => null))
  const [slotPositions, setSlotPositions] = useState<CollageSlotPosition[]>(collageLayouts[4]!.cells.map(() => ({ x: 0.5, y: 0.5 })))
  const [collageGap, setCollageGap] = useState(12)
  const [collagePadding, setCollagePadding] = useState(24)
  const [collageBackground, setCollageBackground] = useState('#12061c')
  const [collagePreview, setCollagePreview] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState(0)
  const [layers, setLayers] = useState<ImageLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [layerBackground, setLayerBackground] = useState('#12061c')
  const [layerPreview, setLayerPreview] = useState<string | null>(null)
  const [videoTrimStart, setVideoTrimStart] = useState(0)
  const [videoTrimEnd, setVideoTrimEnd] = useState(0)
  const [videoTransition, setVideoTransition] = useState('fade')
  const [videoAudioMix, setVideoAudioMix] = useState(80)
  const [videoExportFormat, setVideoExportFormat] = useState('mp4-1080p')
  const [videoPlayhead, setVideoPlayhead] = useState(0)
  const [videoPanel, setVideoPanel] = useState<'media' | 'annotations' | 'transitions' | 'cursor' | 'audio'>('media')
  const [videoRotation, setVideoRotation] = useState(0)
  const [videoText, setVideoText] = useState('')
  const [videoMagnetic, setVideoMagnetic] = useState(true)
  const [videoAutoBlur, setVideoAutoBlur] = useState(false)
  const [videoPixelate, setVideoPixelate] = useState(false)
  const [videoMagnifier, setVideoMagnifier] = useState(false)
  const [videoCursorEffect, setVideoCursorEffect] = useState<'none' | 'highlight' | 'rings' | 'spotlight'>('highlight')
  const [videoExportOpen, setVideoExportOpen] = useState(false)
  const [videoAppliedEffects, setVideoAppliedEffects] = useState<string[]>(['fade'])
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([])
  const [timelineEffects, setTimelineEffects] = useState<TimelineEffect[]>([
    { id: 'effect-fade', name: 'fade', start: 0, end: 4, track: 3 }
  ])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>('effect-fade')
  const [timelineScrubbing, setTimelineScrubbing] = useState(false)
  const [status, setStatus] = useState('')
  const previewRequestRef = useRef(0)
  const photoEditorRef = useRef<PhotoEditorHandle>(null)
  const studioVideoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const timelineBodyRef = useRef<HTMLDivElement | null>(null)
  const videoLabels = resolveStudioVideoCopy(language)

  useEffect(() => {
    let active = true
    async function refreshCaptures(): Promise<void> {
      try {
        const captures = await window.gcpshot.getStoredCaptures()
        if (!active) return
        const merged = [...captures, ...loadStudioLibrary()].sort((a, b) => b.createdAt - a.createdAt)
        setLibrary(merged)
        if (captures[0]) {
          setSelectedId(captures[0].id)
          setMode('edit')
        }
      } catch { if (active) setStatus(t(language, 'studioRenderFailed')) }
    }
    void refreshCaptures()
    const remove = window.gcpshot.onOpenStudio(() => void refreshCaptures())
    return () => { active = false; remove() }
  }, [language])

  const selectedImage = useMemo(
    () => library.find((item) => item.id === selectedId) ?? null,
    [library, selectedId]
  )

  const selectedVideo = useMemo(
    () => videoLibrary.find((item) => item.id === selectedVideoId) ?? null,
    [selectedVideoId, videoLibrary]
  )

  const selectedVideoDuration = selectedVideo ? safeVideoDuration(selectedVideo.duration) || 30 : 0
  const selectedTrimEnd = videoTrimEnd > 0 ? Math.min(videoTrimEnd, Math.max(0.2, selectedVideoDuration || videoTrimEnd)) : selectedVideoDuration
  const timelineDuration = useMemo(() => {
    const clipEnd = timelineClips.reduce((max, clip) => Math.max(max, clip.end), 0)
    const effectEnd = timelineEffects.reduce((max, effect) => Math.max(max, effect.end), 0)
    return Math.max(30, clipEnd, effectEnd, selectedVideoDuration)
  }, [selectedVideoDuration, timelineClips, timelineEffects])
  const timelineContentWidth = Math.max(980, timelineDuration * TIMELINE_SECONDS_WIDTH)

  const activeLayout = useMemo(
    () => collageLayouts.find((item) => item.id === layoutId) ?? collageLayouts[0]!,
    [layoutId]
  )

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId]
  )

  useEffect(() => {
    try {
      saveStudioLibrary(library)
    } catch {
      setStatus(t(language, 'studioRenderFailed'))
    }
  }, [language, library])

  useEffect(() => {
    saveStudioVideos(videoLibrary)
  }, [videoLibrary])

  useEffect(() => {
    setTimelineClips((current) => {
      const existingVideoIds = new Set(current.map((clip) => clip.videoId))
      const added = videoLibrary
        .filter((video) => !existingVideoIds.has(video.id))
        .reduce<TimelineClip[]>((clips, video) => {
          const previousEnd = [...current, ...clips].reduce((max, clip) => Math.max(max, clip.end), 0)
          const duration = safeVideoDuration(video.duration) || 30
          clips.push({
            id: crypto.randomUUID(),
            videoId: video.id,
            start: previousEnd,
            end: previousEnd + duration,
            track: 1
          })
          return clips
        }, [])

      return added.length ? [...current, ...added] : current
    })
  }, [videoLibrary])

  useEffect(() => {
    if (!selectedClipId && timelineClips[0]) {
      setSelectedClipId(timelineClips[0].id)
    }
  }, [selectedClipId, timelineClips])

  useEffect(() => {
    if (mode !== 'video') {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!selectedVideo) {
        return
      }

      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setVideoExportOpen(true)
      }

      if (event.key === '[') {
        event.preventDefault()
        setVideoTrimStart(Math.min(selectedTrimEnd - 0.2, snapVideoTime(videoPlayhead, videoMagnetic)))
      }

      if (event.key === ']') {
        event.preventDefault()
        setVideoTrimEnd(Math.max(videoTrimStart + 0.2, snapVideoTime(videoPlayhead, videoMagnetic)))
      }

      if (event.key.toLowerCase() === 'x') {
        event.preventDefault()
        cutAtPlayhead()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, selectedTrimEnd, selectedVideo, videoMagnetic, videoPlayhead, videoTrimStart])

  useEffect(() => {
    if (!timelineScrubbing) {
      return
    }

    const onMouseMove = (event: MouseEvent): void => {
      seekTimeline(event.clientX)
    }

    const onMouseUp = (): void => {
      setTimelineScrubbing(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [timelineScrubbing, selectedVideoDuration, videoMagnetic])

  useEffect(() => {
    if (mode !== 'collage') {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void renderCollage({
        layoutId,
        slotImages: slotImages.map((id) => (id ? library.find((item) => item.id === id) ?? null : null)),
        gap: collageGap,
        padding: collagePadding,
        background: collageBackground,
        slotPositions,
        outputWidth: 1200
      })
        .then((nextUrl) => {
          if (!cancelled) {
            setCollagePreview(nextUrl)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus(t(language, 'studioRenderFailed'))
          }
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, layoutId, slotImages, slotPositions, collageGap, collagePadding, collageBackground, library, language])

  useEffect(() => {
    if (mode !== 'layers') {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void renderLayerComposition({
        layers,
        background: layerBackground,
        outputWidth: 1200,
        outputHeight: 760
      })
        .then((nextUrl) => {
          if (!cancelled) {
            setLayerPreview(nextUrl)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus(t(language, 'studioRenderFailed'))
          }
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, layers, layerBackground, language])

  function selectLayout(nextLayoutId: CollageLayoutId): void {
    const layout = collageLayouts.find((item) => item.id === nextLayoutId)
    if (!layout) {
      return
    }

    setLayoutId(nextLayoutId)
    setSlotImages(layout.cells.map((_, index) => slotImages[index] ?? library[index]?.id ?? null))
    setSlotPositions(layout.cells.map((_, index) => slotPositions[index] ?? { x: 0.5, y: 0.5 }))
    setActiveSlot(0)
  }

  async function importImages(): Promise<void> {
    const result = await window.gcpshot.pickStudioImages()
    if (!result.ok || !result.files.length) {
      return
    }

    const imported = result.files.map((file) =>
      addStudioImage({
        name: file.name,
        dataUrl: file.dataUrl,
        width: file.width,
        height: file.height
      })
    )

    setLibrary((current) => [...imported, ...current])
    setSelectedId(imported[0]?.id ?? selectedId)
    setStatus(t(language, 'studioImported', { count: String(imported.length) }))
  }

  async function importVideos(): Promise<void> {
    const result = await window.gcpshot.pickStudioVideos()
    if (!result.ok || !result.files.length) {
      return
    }

    const imported = result.files.map((file) =>
      addStudioVideo({
        name: file.name,
        dataUrl: file.dataUrl,
        mimeType: file.mimeType
      })
    )

    const next = loadStudioVideos()
    setVideoLibrary(next)
    setSelectedVideoId(imported[0]?.id ?? selectedVideoId)
    setMode('video')
    setStatus(videoLabels.added.replace('{count}', String(imported.length)))
  }

  function selectVideoClip(item: StudioVideo): void {
    const duration = safeVideoDuration(item.duration) || 30
    setSelectedVideoId(item.id)
    setVideoTrimStart(0)
    setVideoTrimEnd(duration)
    setVideoPlayhead(0)
  }

  function addVideoToTimeline(item: StudioVideo, startAt = timelineDuration > 30 ? timelineDuration : 0): void {
    const duration = safeVideoDuration(item.duration) || 30
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      videoId: item.id,
      start: startAt,
      end: startAt + duration,
      track: 1
    }
    setTimelineClips((current) => [...current, clip])
    setSelectedClipId(clip.id)
    selectVideoClip(item)
    setStatus(`${item.name} adicionado a timeline.`)
  }

  function applyVideoDrag(event: React.DragEvent<HTMLElement>): void {
    event.preventDefault()
    const rect = timelineBodyRef.current?.getBoundingClientRect()
    const startAt = rect
      ? snapVideoTime(
          Math.max(0, event.clientX - rect.left - TIMELINE_LABEL_WIDTH) / TIMELINE_SECONDS_WIDTH,
          videoMagnetic
        )
      : timelineDuration

    const timelineEffectId = event.dataTransfer.getData('application/x-gcpshot-timeline-effect')
    if (timelineEffectId) {
      setTimelineEffects((current) =>
        current.map((effect) => {
          if (effect.id !== timelineEffectId) return effect
          const duration = Math.max(0.2, effect.end - effect.start)
          return { ...effect, start: startAt, end: startAt + duration }
        })
      )
      setSelectedEffectId(timelineEffectId)
      return
    }

    const id = event.dataTransfer.getData('text/plain')
    const effect = event.dataTransfer.getData('application/x-gcpshot-effect')
    if (effect) {
      applyStudioEffect(effect, startAt)
      return
    }

    const item = videoLibrary.find((video) => video.id === id)
    if (item) {
      addVideoToTimeline(item, startAt)
    }
  }

  function applyStudioEffect(effect: string, startAt = videoPlayhead): void {
    if (['fade', 'fade-black', 'circle', 'flip', 'page', 'slide'].includes(effect)) {
      setVideoTransition(effect)
    }

    if (effect === 'Auto Blur' || effect === 'Blur') {
      setVideoAutoBlur(true)
    }

    if (effect === 'Pixel' || effect === 'Pixelate') {
      setVideoPixelate(true)
    }

    if (effect === 'Lupa' || effect === 'Magnifier') {
      setVideoMagnifier(true)
    }

    if (effect === 'Highlight' || effect === 'highlight') {
      setVideoCursorEffect('highlight')
    }

    if (effect === 'Rings' || effect === 'Ripple' || effect === 'rings') {
      setVideoCursorEffect('rings')
    }

    if (effect === 'Spotlight' || effect === 'spotlight') {
      setVideoCursorEffect('spotlight')
    }

    const start = Math.max(0, startAt)
    const timelineEffect: TimelineEffect = {
      id: crypto.randomUUID(),
      name: effect,
      start,
      end: start + 4,
      track: 3
    }
    setTimelineEffects((current) => [...current, timelineEffect])
    setSelectedEffectId(timelineEffect.id)
    setVideoAppliedEffects((current) => (current.includes(effect) ? current : [...current, effect]))
    setStatus(`${effect} aplicado ao clipe selecionado.`)
  }

  function seekTimeline(clientX: number): void {
    if (!selectedVideoDuration || !timelineBodyRef.current) {
      return
    }

    const rect = timelineBodyRef.current.getBoundingClientRect()
    const labelWidth = 86
    const usableLeft = rect.left + labelWidth
    const usableWidth = Math.max(1, rect.width - labelWidth)
    const nextTime = snapVideoTime(Math.max(0, (clientX - usableLeft) / TIMELINE_SECONDS_WIDTH), videoMagnetic)
    setVideoPlayhead(nextTime)
    if (studioVideoPreviewRef.current) {
      studioVideoPreviewRef.current.currentTime = Math.min(selectedVideoDuration, nextTime)
    }
  }

  function cutAtPlayhead(): void {
    if (!selectedVideo || videoPlayhead <= 0) {
      return
    }

    const selectedClip = timelineClips.find((clip) => clip.id === selectedClipId)
    if (!selectedClip || videoPlayhead <= selectedClip.start + 0.1 || videoPlayhead >= selectedClip.end - 0.1) {
      const nextEnd = Math.max(videoTrimStart + 0.2, snapVideoTime(videoPlayhead, videoMagnetic))
      setVideoTrimEnd(Math.min(nextEnd, selectedVideoDuration || nextEnd))
      return
    }

    const rightClip: TimelineClip = {
      ...selectedClip,
      id: crypto.randomUUID(),
      start: videoPlayhead
    }
    setTimelineClips((current) =>
      current.flatMap((clip) => (clip.id === selectedClip.id ? [{ ...clip, end: videoPlayhead }, rightClip] : [clip]))
    )
    setSelectedClipId(rightClip.id)
    setStatus('Clipe dividido na agulha.')
  }

  function updateTrimStart(value: number): void {
    const next = Math.min(selectedTrimEnd - 0.2, snapVideoTime(value, videoMagnetic))
    setVideoTrimStart(Math.max(0, next))
  }

  function updateTrimEnd(value: number): void {
    const next = Math.max(videoTrimStart + 0.2, snapVideoTime(value, videoMagnetic))
    setVideoTrimEnd(Math.min(selectedVideoDuration || next, next))
  }

  async function renderSelectedVideoClip(): Promise<Blob | null> {
    if (!selectedVideo) {
      return null
    }

    const video = document.createElement('video')
    video.src = selectedVideo.dataUrl
    video.muted = false
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Video invalido.'))
    })

    const duration = safeVideoDuration(video.duration)
    const start = Math.max(0, Math.min(videoTrimStart, duration || videoTrimStart))
    const end = Math.max(start + 0.2, Math.min(videoTrimEnd || duration, duration || videoTrimEnd || start + 0.2))
    video.currentTime = start
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
    })

    const stream = video.captureStream()
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      recorder.onerror = () => reject(new Error('Falha ao renderizar video.'))
    })

    recorder.start(500)
    await video.play()
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        if (video.currentTime >= end || video.ended) {
          window.clearInterval(timer)
          video.pause()
          resolve()
        }
      }, 100)
    })

    recorder.stop()
    stream.getTracks().forEach((track) => track.stop())
    return stopped
  }

  async function exportVideoProject(): Promise<void> {
    if (selectedVideo) {
      try {
        setStatus(t(language, 'studioRendering'))
        const blob = await renderSelectedVideoClip()
        if (blob) {
          const buffer = await blob.arrayBuffer()
          const result = await window.gcpshot.saveRecording(buffer, { extension: 'webm' })
          setStatus(result.ok ? videoLabels.exported.replace('{path}', result.path ?? '') : result.error ?? t(language, 'saveFailed'))
          return
        }
      } catch {
        setStatus(t(language, 'studioRenderFailed'))
        return
      }
    }

    const project = {
      app: 'GCPShot',
      version: 1,
      exportFormat: videoExportFormat,
      audioMix: videoAudioMix,
      transition: videoTransition,
      rotation: videoRotation,
      text: videoText,
      magnetic: videoMagnetic,
      autoBlur: videoAutoBlur,
      pixelate: videoPixelate,
      magnifier: videoMagnifier,
      cursorEffect: videoCursorEffect,
      appliedEffects: videoAppliedEffects,
      timelineClips,
      timelineEffects,
      selectedVideoId,
      clips: videoLibrary.map((video) => ({
        id: video.id,
        name: video.name,
        mimeType: video.mimeType,
        duration: safeVideoDuration(video.duration),
        selected: video.id === selectedVideoId,
        trimStart: video.id === selectedVideoId ? videoTrimStart : 0,
        trimEnd: video.id === selectedVideoId ? selectedTrimEnd : safeVideoDuration(video.duration)
      }))
    }
    const result = await window.gcpshot.exportStudioVideoProject(JSON.stringify(project, null, 2))
    setStatus(result.ok ? videoLabels.exported.replace('{path}', result.path ?? '') : result.error ?? t(language, 'saveFailed'))
  }

  async function exportCurrent(): Promise<void> {
    try {
      if (mode === 'edit') {
        if (!selectedImage) {
          return
        }

        setStatus(t(language, 'studioRendering'))
        const dataUrl = await photoEditorRef.current?.exportImage()
        if (!dataUrl) return
        const result = await window.gcpshot.exportStudioImage(dataUrl)
        setStatus(result.ok ? t(language, 'studioExported', { path: result.path ?? '' }) : result.error ?? t(language, 'saveFailed'))
        return
      }

      if (mode === 'layers') {
        if (!layerPreview) {
          return
        }

        const result = await window.gcpshot.exportStudioImage(layerPreview)
        setStatus(result.ok ? t(language, 'studioExported', { path: result.path ?? '' }) : result.error ?? t(language, 'saveFailed'))
        return
      }

      if (!collagePreview) {
        return
      }

      const result = await window.gcpshot.exportStudioImage(collagePreview)
      setStatus(result.ok ? t(language, 'studioExported', { path: result.path ?? '' }) : result.error ?? t(language, 'saveFailed'))
    } catch {
      setStatus(t(language, 'studioRenderFailed'))
    }
  }

  function assignSelectedToSlot(slotIndex: number): void {
    if (!selectedId) {
      return
    }

    setSlotImages((current) => current.map((value, index) => (index === slotIndex ? selectedId : value)))
    setActiveSlot(slotIndex)
  }

  function updateSlotPosition(slotIndex: number, key: keyof CollageSlotPosition, value: number): void {
    setSlotPositions((current) =>
      activeLayout.cells.map((_, index) => {
        const position = current[index] ?? { x: 0.5, y: 0.5 }
        return index === slotIndex ? { ...position, [key]: value } : position
      })
    )
  }

  function autoFillCollage(): void {
    setSlotImages(activeLayout.cells.map((_, index) => library[index]?.id ?? null))
    setSlotPositions(activeLayout.cells.map(() => ({ x: 0.5, y: 0.5 })))
  }

  async function addSelectedAsLayer(): Promise<void> {
    let image = selectedImage
    if (!image) {
      return
    }
    if (mode === 'edit' && photoEditorRef.current) {
      try {
        const dataUrl = await photoEditorRef.current.exportImage()
        const decoded = new Image()
        decoded.src = dataUrl
        await decoded.decode()
        image = { ...image, dataUrl, width: decoded.naturalWidth, height: decoded.naturalHeight }
      } catch { setStatus(t(language, 'studioRenderFailed')); return }
    }

    const layer: ImageLayer = {
      id: crypto.randomUUID(),
      image,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      opacity: 1
    }
    setLayers((current) => [...current, layer])
    setSelectedLayerId(layer.id)
    setMode('layers')
  }

  function updateSelectedLayer<K extends keyof Omit<ImageLayer, 'id' | 'image'>>(key: K, value: ImageLayer[K]): void {
    if (!selectedLayerId) {
      return
    }

    setLayers((current) => current.map((layer) => (layer.id === selectedLayerId ? { ...layer, [key]: value } : layer)))
  }

  function removeSelectedLayer(): void {
    if (!selectedLayerId) {
      return
    }

    setLayers((current) => {
      const next = current.filter((layer) => layer.id !== selectedLayerId)
      setSelectedLayerId(next[next.length - 1]?.id ?? null)
      return next
    })
  }

  function moveSelectedLayer(direction: -1 | 1): void {
    if (!selectedLayerId) {
      return
    }

    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === selectedLayerId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [layer] = next.splice(index, 1)
      if (layer) {
        next.splice(nextIndex, 0, layer)
      }
      return next
    })
  }

  function saveEditedToLibrary(): void {
    if (!selectedImage) {
      return
    }

    setStatus(t(language, 'studioRendering'))

    void photoEditorRef.current?.exportImage()
      .then(async (dataUrl) => {
        const decoded = new Image()
        decoded.src = dataUrl
        await decoded.decode()
        const image = addStudioImage({
          name: `${selectedImage.name} (editado)`,
          dataUrl,
          width: decoded.naturalWidth,
          height: decoded.naturalHeight
        })
        setLibrary((current) => [image, ...current])
        setSelectedId(image.id)
        setStatus(t(language, 'studioSavedToLibrary'))
      })
      .catch(() => {
        setStatus(t(language, 'studioRenderFailed'))
      })
  }

  function selectImage(id: string): void {
    previewRequestRef.current += 1
    setSelectedId(id)
  }

  return (
    <main className="app-shell studio-shell">
      <section className="studio-panel">
        <header className="studio-header">
          <div className="studio-header-left">
            <button type="button" className="ghost-button" onClick={onBack}>
              ← {t(language, 'studioBack')}
            </button>
            <div>
              <p className="eyebrow">GCPShot / IMAGENS</p>
              <h1>Estúdio de imagem</h1>
            </div>
          </div>
          <div className="nav-actions">
            <button type="button" className="ghost-button" onClick={onOpenSettings}>
              {t(language, 'settings')}
            </button>
            <button type="button" className="ghost-button" onClick={() => void (mode === 'video' ? importVideos() : importImages())}>
              {mode === 'video' ? videoLabels.import : t(language, 'studioImport')}
            </button>
            <button type="button" className="primary-button compact" onClick={() => void (mode === 'video' ? setVideoExportOpen(true) : exportCurrent())}>
              {mode === 'video' ? videoLabels.export : t(language, 'studioExport')}
            </button>
          </div>
        </header>

        <div className="studio-mode-tabs">
          <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
            {t(language, 'studioModeEdit')}
          </button>
          <button type="button" className={mode === 'collage' ? 'active' : ''} onClick={() => setMode('collage')}>
            {t(language, 'studioModeCollage')}
          </button>
          <button type="button" className={mode === 'layers' ? 'active' : ''} onClick={() => setMode('layers')}>
            Camadas
          </button>
        </div>

        {mode === 'video' ? (
        <div className="video-editor-shell">
          <aside className="video-editor-rail">
            {[
              ['media', videoLabels.media],
              ['annotations', videoLabels.annotations],
              ['transitions', videoLabels.transition],
              ['cursor', videoLabels.cursor],
              ['audio', videoLabels.audio]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={videoPanel === id ? 'active' : ''}
                onClick={() => setVideoPanel(id as typeof videoPanel)}
              >
                <span>{label.slice(0, 1)}</span>
                {label}
              </button>
            ))}
          </aside>

          <aside className="video-editor-bin">
            <div className="studio-library-head">
              <strong>{videoPanel === 'media' ? videoLabels.library : videoLabels.properties}</strong>
              <span>{videoLibrary.length}</span>
            </div>
            {videoPanel === 'media' ? (
              videoLibrary.length === 0 ? (
                <p className="studio-empty">{videoLabels.empty}</p>
              ) : (
                <div className="studio-thumbs video-bin-grid">
                  {videoLibrary.map((item) => (
                    <StudioVideoThumb
                      key={item.id}
                      item={item}
                      active={selectedVideoId === item.id}
                      onSelect={() => selectVideoClip(item)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', item.id)
                        event.dataTransfer.effectAllowed = 'copyMove'
                      }}
                      onRemove={() => {
                        removeStudioVideo(item.id)
                        const next = loadStudioVideos()
                        setVideoLibrary(next)
                        if (selectedVideoId === item.id) {
                          setSelectedVideoId(next[0]?.id ?? null)
                        }
                      }}
                    />
                  ))}
                </div>
              )
            ) : videoPanel === 'annotations' ? (
              <div className="transition-grid">
                {['Blur', 'Pixel', 'Lupa', 'Texto'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={
                      (item === 'Blur' && videoAutoBlur) || (item === 'Pixel' && videoPixelate) || (item === 'Lupa' && videoMagnifier)
                        ? 'active'
                        : ''
                    }
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-gcpshot-effect', item)
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => (item === 'Texto' ? setVideoText(videoText || 'Texto na tela') : applyStudioEffect(item))}
                  >
                    <span className={`annotation-preview annotation-preview-${item.toLowerCase()}`} />
                    {item}
                  </button>
                ))}
              </div>
            ) : videoPanel === 'transitions' ? (
              <div className="transition-grid">
                {['fade', 'fade-black', 'circle', 'flip', 'page', 'slide'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={videoTransition === item ? 'active' : ''}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-gcpshot-effect', item)
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                    onMouseEnter={() => setVideoTransition(item)}
                    onClick={() => applyStudioEffect(item)}
                  >
                    <span className={`transition-preview transition-${item}`} />
                    {item.replace('-', ' ')}
                  </button>
                ))}
              </div>
            ) : videoPanel === 'cursor' ? (
              <div className="transition-grid">
                {(['highlight', 'rings', 'spotlight'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={videoCursorEffect === item ? 'active' : ''}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-gcpshot-effect', item)
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => applyStudioEffect(item)}
                  >
                    <span className={`cursor-preview cursor-preview-${item}`} />
                    {item}
                  </button>
                ))}
              </div>
            ) : videoPanel === 'audio' ? (
              <div className="transition-grid audio-effects-grid">
                {['Noise Removal', 'Volume Leveling', 'Fade In', 'Fade Out', 'Clip Speed', 'Auto Blur'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={item === 'Auto Blur' && videoAutoBlur ? 'active' : ''}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-gcpshot-effect', item)
                      event.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => applyStudioEffect(item)}
                  >
                    <span className={item === 'Auto Blur' ? 'privacy-preview-card' : 'audio-effect-preview'} />
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <div className="video-editor-notes">
                <strong>{videoPanel === 'audio' ? videoLabels.narration : videoLabels.annotations}</strong>
                <p>{videoLabels.storyboard}</p>
              </div>
            )}
          </aside>

          <section className="video-editor-main">
            <div className="video-editor-topbar">
              <div className="video-tool-switch">
                <button type="button" className="active">↖</button>
                <button type="button">✋</button>
                <button type="button">✂</button>
              </div>
              <strong>{selectedVideo ? selectedVideo.name : videoLabels.preview}</strong>
              <button type="button" className="primary-button compact" onClick={() => setVideoExportOpen(true)} disabled={!selectedVideo}>
                {videoLabels.export}
              </button>
            </div>

            <div className="video-preview-frame">
              {selectedVideo ? (
                <div className={`video-preview-live transition-live-${videoTransition} cursor-live-${videoCursorEffect} ${videoAutoBlur ? 'auto-blur-live' : ''} ${videoPixelate ? 'pixelate-live' : ''} ${videoMagnifier ? 'magnifier-live' : ''}`}>
                  <video
                    ref={studioVideoPreviewRef}
                    className="studio-video-preview"
                    src={selectedVideo.dataUrl}
                    controls
                    style={{ transform: `rotate(${videoRotation}deg)` }}
                    onTimeUpdate={(event) => setVideoPlayhead(event.currentTarget.currentTime)}
                    onLoadedMetadata={(event) => {
                      const duration = safeVideoDuration(event.currentTarget.duration) || selectedVideo.duration || 30
                      setVideoLibrary((current) =>
                        current.map((item) => (item.id === selectedVideo.id ? { ...item, duration } : item))
                      )
                      if (videoTrimEnd === 0) {
                        setVideoTrimEnd(duration)
                      }
                    }}
                  />
                  {videoText.trim() && <span className="video-live-text">{videoText.trim()}</span>}
                  {videoAutoBlur && <span className="video-live-blur">BLUR</span>}
                  {videoPixelate && <span className="video-live-pixel" />}
                  {videoMagnifier && <span className="video-live-magnifier" />}
                  {videoCursorEffect !== 'none' && <span className="video-live-cursor" />}
                </div>
              ) : (
                <div className="studio-canvas-empty">
                  <strong>{videoLabels.preview}</strong>
                  <span>{videoLabels.empty}</span>
                </div>
              )}
            </div>

            <div className="video-editor-timeline">
              <div className="timeline-toolbar">
                <button type="button">↶</button>
                <button type="button">↷</button>
                <button type="button">✂</button>
                <button type="button" onClick={cutAtPlayhead}>Cortar</button>
                <label className="timeline-magnetic">
                  <input type="checkbox" checked={videoMagnetic} onChange={(event) => setVideoMagnetic(event.currentTarget.checked)} />
                  {videoLabels.magnetic}
                </label>
                <span>{formatVideoTime(videoPlayhead)} / {formatVideoTime(selectedVideoDuration)}</span>
              </div>
              <div className="timeline-ruler">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span key={index}>{formatVideoTime(index * 5)}</span>
                ))}
              </div>
              <div
                ref={timelineBodyRef}
                className="timeline-body"
                onMouseDown={(event) => {
                  seekTimeline(event.clientX)
                  setTimelineScrubbing(true)
                }}
              >
                <div
                  className="timeline-playhead"
                  style={{ left: `${86 + Math.min(1, Math.max(0, (videoPlayhead || 0) / Math.max(1, selectedVideoDuration || 1))) * Math.max(1, (timelineBodyRef.current?.clientWidth ?? 760) - 86)}px` }}
                />
                <div className="track-label">Track 3</div>
                <div className="track-lane effects" onDragOver={(event) => event.preventDefault()} onDrop={applyVideoDrag}>
                  {timelineEffects.map((effect) => (
                    <button
                      key={effect.id}
                      type="button"
                      className={selectedEffectId === effect.id ? 'effect-chip timeline-effect active' : 'effect-chip timeline-effect'}
                      style={{
                        left: effect.start * TIMELINE_SECONDS_WIDTH,
                        width: Math.max(72, (effect.end - effect.start) * TIMELINE_SECONDS_WIDTH)
                      }}
                      draggable
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedEffectId(effect.id)
                        setVideoPlayhead(effect.start)
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/x-gcpshot-timeline-effect', effect.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                    >
                      <span>{effect.name}</span>
                      <small>{formatVideoTime(effect.start)} - {formatVideoTime(effect.end)}</small>
                    </button>
                  ))}
                </div>
                <div className="track-label">Track 2</div>
                <div className="track-lane audio" onDragOver={(event) => event.preventDefault()} onDrop={applyVideoDrag}>
                  <span className="audio-wave" />
                </div>
                <div className="track-label">Track 1</div>
                <div className="track-lane" onDragOver={(event) => event.preventDefault()} onDrop={applyVideoDrag}>
                  {timelineClips.map((clip) => {
                    const clipVideo = videoLibrary.find((video) => video.id === clip.videoId)
                    if (!clipVideo) return null
                    return (
                    <div
                      key={clip.id}
                      className={selectedClipId === clip.id ? 'timeline-clip active' : 'timeline-clip'}
                      draggable
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedClipId(clip.id)
                        selectVideoClip(clipVideo)
                        setVideoPlayhead(clip.start)
                      }}
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', clipVideo.id)}
                      style={{
                        left: clip.start * TIMELINE_SECONDS_WIDTH,
                        width: Math.max(160, (clip.end - clip.start) * TIMELINE_SECONDS_WIDTH)
                      }}
                    >
                      <strong>{clipVideo.name}</strong>
                      <span>{formatVideoTime(clip.start)} - {formatVideoTime(clip.end)}</span>
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <aside className="video-export-panel">
            <h3>{selectedEffectId ? 'Propriedades do efeito' : videoLabels.exportPanel}</h3>
            {selectedEffectId && (
              <>
                <label className="studio-slider">
                  <span>Inicio do efeito</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, timelineDuration)}
                    step="0.1"
                    value={timelineEffects.find((effect) => effect.id === selectedEffectId)?.start ?? 0}
                    onChange={(event) => {
                      const nextStart = snapVideoTime(Number(event.currentTarget.value), videoMagnetic)
                      setTimelineEffects((current) =>
                        current.map((effect) =>
                          effect.id === selectedEffectId
                            ? { ...effect, start: Math.min(nextStart, effect.end - 0.2) }
                            : effect
                        )
                      )
                    }}
                  />
                </label>
                <label className="studio-slider">
                  <span>Fim do efeito</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, timelineDuration)}
                    step="0.1"
                    value={timelineEffects.find((effect) => effect.id === selectedEffectId)?.end ?? 4}
                    onChange={(event) => {
                      const nextEnd = snapVideoTime(Number(event.currentTarget.value), videoMagnetic)
                      setTimelineEffects((current) =>
                        current.map((effect) =>
                          effect.id === selectedEffectId
                            ? { ...effect, end: Math.max(nextEnd, effect.start + 0.2) }
                            : effect
                        )
                      )
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => {
                    setTimelineEffects((current) => current.filter((effect) => effect.id !== selectedEffectId))
                    setSelectedEffectId(null)
                  }}
                >
                  Remover efeito
                </button>
              </>
            )}
            <label className="studio-slider">
              <span>{videoLabels.start}</span>
              <input type="range" min="0" max={Math.max(1, selectedVideoDuration || 1)} step="0.1" value={videoTrimStart} onChange={(event) => updateTrimStart(Number(event.currentTarget.value))} />
            </label>
            <label className="studio-slider">
              <span>{videoLabels.end}</span>
              <input type="range" min="0" max={Math.max(1, selectedVideoDuration || 1)} step="0.1" value={selectedTrimEnd} onChange={(event) => updateTrimEnd(Number(event.currentTarget.value))} />
            </label>
            <label className="studio-slider">
              <span>{videoLabels.rotation}</span>
              <input type="range" min="-180" max="180" step="1" value={videoRotation} onChange={(event) => setVideoRotation(Number(event.currentTarget.value))} />
            </label>
            <label className="studio-slider">
              <span>{videoLabels.audio}</span>
              <input type="range" min="0" max="100" value={videoAudioMix} onChange={(event) => setVideoAudioMix(Number(event.currentTarget.value))} />
            </label>
            <label className="studio-color">
              <span>{videoLabels.text}</span>
              <input type="text" value={videoText} onChange={(event) => setVideoText(event.currentTarget.value)} placeholder="Titulo, legenda ou chamada" />
            </label>
            <label className="studio-toggle">
              <input type="checkbox" checked={videoAutoBlur} onChange={(event) => setVideoAutoBlur(event.currentTarget.checked)} />
              <span>{videoLabels.autoBlur}</span>
            </label>
            <label className="studio-toggle">
              <input type="checkbox" checked={videoPixelate} onChange={(event) => setVideoPixelate(event.currentTarget.checked)} />
              <span>Pixel</span>
            </label>
            <label className="studio-toggle">
              <input type="checkbox" checked={videoMagnifier} onChange={(event) => setVideoMagnifier(event.currentTarget.checked)} />
              <span>Lupa</span>
            </label>
            <label className="studio-toggle">
              <input type="checkbox" checked={videoMagnetic} onChange={(event) => setVideoMagnetic(event.currentTarget.checked)} />
              <span>{videoLabels.magnetic}</span>
            </label>
            <label className="studio-color">
              <span>{videoLabels.format}</span>
              <select value={videoExportFormat} onChange={(event) => setVideoExportFormat(event.currentTarget.value)}>
                <option value="mp4-1080p">MP4 1080p</option>
                <option value="mp4-720p">MP4 720p</option>
                <option value="webm-1080p">WebM 1080p</option>
                <option value="gif-preview">GIF preview</option>
              </select>
            </label>
            <button type="button" className="primary-button" onClick={() => setVideoExportOpen(true)} disabled={!selectedVideo}>
              {videoLabels.export}
            </button>
          </aside>
        </div>
        ) : (
        <div className="studio-workspace">
          <aside className="studio-library">
            <div className="studio-library-head">
              <strong>{t(language, 'studioLibrary')}</strong>
              <span>{library.length}</span>
            </div>
            {library.length === 0 ? (
              <p className="studio-empty">{t(language, 'studioLibraryEmpty')}</p>
            ) : (
              <div className="studio-thumbs">
                {library.map((item) => (
                  <StudioThumb
                    key={item.id}
                    item={item}
                    active={selectedId === item.id}
                    onSelect={() => selectImage(item.id)}
                    onRemove={() => {
                      void (async () => {
                        if (item.id.startsWith('capture-')) await window.gcpshot.removeStoredCapture(item.id)
                        removeStudioImage(item.id)
                        const next = library.filter((image) => image.id !== item.id)
                        setLibrary(next)
                        if (selectedId === item.id) setSelectedId(next[0]?.id ?? null)
                      })().catch(() => setStatus(t(language, 'studioRenderFailed')))
                    }}
                  />
                ))}
              </div>
            )}
          </aside>

          <div className="studio-canvas-wrap">
            {mode === 'edit' ? (
              selectedImage ? (
                <PhotoEditor key={selectedImage.id} ref={photoEditorRef} source={selectedImage.dataUrl} name={selectedImage.name} onSave={saveEditedToLibrary} onLayer={addSelectedAsLayer} />
              ) : (
                <div className="studio-canvas-empty">
                  <strong>{t(language, 'studioCanvasEmptyTitle')}</strong>
                  <span>{t(language, 'studioCanvasEmptyHint')}</span>
                </div>
              )
            ) : mode === 'layers' ? (
              layerPreview ? (
                <img className="studio-canvas-image collage" src={layerPreview} alt="Composicao em camadas" decoding="async" />
              ) : (
                <div className="studio-canvas-empty">
                  <strong>Composicao em camadas</strong>
                  <span>Adicione imagens da biblioteca como camadas e ajuste ordem, posicao, tamanho e opacidade.</span>
                </div>
              )
            ) : collagePreview ? (
              <img className="studio-canvas-image collage" src={collagePreview} alt={t(language, 'studioModeCollage')} decoding="async" />
            ) : (
              <div className="studio-canvas-empty">
                <strong>{t(language, 'studioCollageEmptyTitle')}</strong>
                <span>{t(language, 'studioCollageEmptyHint')}</span>
              </div>
            )}
          </div>

          <aside className="studio-controls" style={mode === 'edit' ? { display: 'none' } : undefined}>
            {mode === 'collage' ? (
              <>
                <h3>{t(language, 'studioCollageLayout')}</h3>
                <div className="studio-layout-grid">
                  {collageLayouts.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      className={layoutId === layout.id ? 'studio-layout-card active' : 'studio-layout-card'}
                      onClick={() => selectLayout(layout.id)}
                    >
                      <span className={`studio-layout-preview layout-${layout.id}`} />
                      <strong>{t(language, layoutLabelKey(layout.id))}</strong>
                    </button>
                  ))}
                </div>
                <label className="studio-slider">
                  <span>{t(language, 'studioCollageGap')}</span>
                  <input type="range" min="0" max="32" value={collageGap} onChange={(event) => setCollageGap(Number(event.currentTarget.value))} />
                </label>
                <label className="studio-slider">
                  <span>{t(language, 'studioCollagePadding')}</span>
                  <input
                    type="range"
                    min="0"
                    max="64"
                    value={collagePadding}
                    onChange={(event) => setCollagePadding(Number(event.currentTarget.value))}
                  />
                </label>
                <label className="studio-color">
                  <span>{t(language, 'studioCollageBackground')}</span>
                  <input type="color" value={collageBackground} onChange={(event) => setCollageBackground(event.currentTarget.value)} />
                </label>
                <div className="studio-slot-list">
                  {activeLayout.cells.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={activeSlot === index ? 'studio-slot active' : 'studio-slot'}
                      onClick={() => assignSelectedToSlot(index)}
                    >
                      {t(language, 'studioSlot', { index: String(index + 1) })} ·{' '}
                      {slotImages[index] ? library.find((item) => item.id === slotImages[index])?.name : t(language, 'studioSlotEmpty')}
                    </button>
                  ))}
                </div>
                {slotImages[activeSlot] && (
                  <div className="studio-frame-controls">
                    <h3>Enquadramento do frame {activeSlot + 1}</h3>
                    <label className="studio-slider">
                      <span>Horizontal</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((slotPositions[activeSlot]?.x ?? 0.5) * 100)}
                        onChange={(event) => updateSlotPosition(activeSlot, 'x', Number(event.currentTarget.value) / 100)}
                      />
                    </label>
                    <label className="studio-slider">
                      <span>Vertical</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((slotPositions[activeSlot]?.y ?? 0.5) * 100)}
                        onChange={(event) => updateSlotPosition(activeSlot, 'y', Number(event.currentTarget.value) / 100)}
                      />
                    </label>
                  </div>
                )}
                <button type="button" className="ghost-button" onClick={autoFillCollage}>
                  {t(language, 'studioAutoFill')}
                </button>
              </>
            ) : (
              <>
                <h3>Composicao em camadas</h3>
                <button type="button" className="primary-button" onClick={addSelectedAsLayer} disabled={!selectedImage}>
                  Adicionar imagem selecionada
                </button>
                <label className="studio-color">
                  <span>Fundo</span>
                  <input type="color" value={layerBackground} onChange={(event) => setLayerBackground(event.currentTarget.value)} />
                </label>
                <div className="studio-layer-list">
                  {layers.map((layer, index) => (
                    <button
                      key={layer.id}
                      type="button"
                      className={selectedLayerId === layer.id ? 'studio-layer active' : 'studio-layer'}
                      onClick={() => setSelectedLayerId(layer.id)}
                    >
                      <span>{index + 1}. {layer.image.name}</span>
                      <small>{Math.round(layer.opacity * 100)}% - {Math.round(layer.scale * 100)}%</small>
                    </button>
                  ))}
                </div>
                {selectedLayer && (
                  <div className="studio-frame-controls">
                    <h3>Propriedades da camada</h3>
                    <label className="studio-slider">
                      <span>Horizontal</span>
                      <input type="range" min="0" max="100" value={Math.round(selectedLayer.x * 100)} onChange={(event) => updateSelectedLayer('x', Number(event.currentTarget.value) / 100)} />
                    </label>
                    <label className="studio-slider">
                      <span>Vertical</span>
                      <input type="range" min="0" max="100" value={Math.round(selectedLayer.y * 100)} onChange={(event) => updateSelectedLayer('y', Number(event.currentTarget.value) / 100)} />
                    </label>
                    <label className="studio-slider">
                      <span>Tamanho</span>
                      <input type="range" min="20" max="220" value={Math.round(selectedLayer.scale * 100)} onChange={(event) => updateSelectedLayer('scale', Number(event.currentTarget.value) / 100)} />
                    </label>
                    <label className="studio-slider">
                      <span>Rotacao</span>
                      <input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(event) => updateSelectedLayer('rotation', Number(event.currentTarget.value))} />
                    </label>
                    <label className="studio-slider">
                      <span>Opacidade</span>
                      <input type="range" min="0" max="100" value={Math.round(selectedLayer.opacity * 100)} onChange={(event) => updateSelectedLayer('opacity', Number(event.currentTarget.value) / 100)} />
                    </label>
                    <div className="studio-button-row">
                      <button type="button" className="ghost-button" onClick={() => moveSelectedLayer(-1)}>Descer</button>
                      <button type="button" className="ghost-button" onClick={() => moveSelectedLayer(1)}>Subir</button>
                      <button type="button" className="ghost-button danger" onClick={removeSelectedLayer}>Remover</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
        )}

        {videoExportOpen && (
          <div className="video-export-modal" role="dialog" aria-modal="true" aria-label={videoLabels.exportSettings}>
            <div className="video-export-dialog">
              <header>
                <strong>{videoLabels.exportSettings}</strong>
                <button type="button" onClick={() => setVideoExportOpen(false)}>x</button>
              </header>
              <label className="studio-color">
                <span>{videoLabels.format}</span>
                <select value={videoExportFormat} onChange={(event) => setVideoExportFormat(event.currentTarget.value)}>
                  <option value="mp4-1080p">MP4 1080p</option>
                  <option value="mp4-720p">MP4 720p</option>
                  <option value="webm-1080p">WebM 1080p</option>
                  <option value="gif-preview">GIF preview</option>
                </select>
              </label>
              <div className="video-export-summary">
                <span>{formatVideoTime(videoTrimStart)} - {formatVideoTime(selectedTrimEnd)}</span>
                <span>{videoLabels.rotation}: {videoRotation} graus</span>
                <span>{videoLabels.audio}: {videoAudioMix}%</span>
              </div>
              <button type="button" className="primary-button" disabled={!selectedVideo} onClick={() => void exportVideoProject().then(() => setVideoExportOpen(false))}>
                {videoLabels.export}
              </button>
            </div>
          </div>
        )}

        <p className="studio-status">{status}</p>
        <p className="studio-footnote">{t(language, 'studioFootnote')}</p>
      </section>
    </main>
  )
}

export function Studio(props: StudioProps): JSX.Element {
  return (
    <StudioErrorBoundary
      fallback={
        <main className="app-shell studio-shell">
          <section className="studio-panel studio-error-panel">
            <h1>{t(props.language, 'studioRenderFailed')}</h1>
            <button type="button" className="primary-button" onClick={props.onBack}>
              {t(props.language, 'studioBack')}
            </button>
          </section>
        </main>
      }
    >
      <StudioContent language={props.language} onBack={props.onBack} onOpenSettings={props.onOpenSettings} />
    </StudioErrorBoundary>
  )
}
