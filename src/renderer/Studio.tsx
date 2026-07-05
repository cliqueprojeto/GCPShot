import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings } from '../shared/capture'
import type { AppLanguage, TranslationKey } from '../shared/i18n'
import { t } from '../shared/i18n'
import { StudioErrorBoundary } from './StudioErrorBoundary'
import {
  applyImageAdjustments,
  collageLayouts,
  createThumbnailDataUrl,
  renderCollage,
  type CollageLayoutId
} from './studioCollage'
import {
  addStudioImage,
  loadStudioLibrary,
  removeStudioImage,
  saveStudioLibrary,
  type StudioImage
} from './studioStorage'

type StudioMode = 'edit' | 'collage'

type StudioProps = {
  language: AppLanguage
  settings: AppSettings
  onBack: () => void
  onOpenSettings: () => void
}

type ImageAdjustments = {
  brightness: number
  contrast: number
  saturation: number
  rotation: number
  flipHorizontal: boolean
}

const defaultAdjustments: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  rotation: 0,
  flipHorizontal: false
}

const PREVIEW_MAX_SIDE = 960
const PREVIEW_DEBOUNCE_MS = 140

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

function StudioContent({ language, onBack, onOpenSettings }: Omit<StudioProps, 'settings'>): JSX.Element {
  const [library, setLibrary] = useState<StudioImage[]>(() => loadStudioLibrary())
  const [mode, setMode] = useState<StudioMode>('edit')
  const [selectedId, setSelectedId] = useState<string | null>(library[0]?.id ?? null)
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments)
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [layoutId, setLayoutId] = useState<CollageLayoutId>('hero-left')
  const [slotImages, setSlotImages] = useState<Array<string | null>>(collageLayouts[4]!.cells.map(() => null))
  const [collageGap, setCollageGap] = useState(12)
  const [collagePadding, setCollagePadding] = useState(24)
  const [collageBackground, setCollageBackground] = useState('#12061c')
  const [collagePreview, setCollagePreview] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState(0)
  const [status, setStatus] = useState('')
  const previewRequestRef = useRef(0)

  const selectedImage = useMemo(
    () => library.find((item) => item.id === selectedId) ?? null,
    [library, selectedId]
  )

  const activeLayout = useMemo(
    () => collageLayouts.find((item) => item.id === layoutId) ?? collageLayouts[0]!,
    [layoutId]
  )

  useEffect(() => {
    try {
      saveStudioLibrary(library)
    } catch {
      setStatus(t(language, 'studioRenderFailed'))
    }
  }, [language, library])

  useEffect(() => {
    if (mode !== 'edit' || !selectedImage) {
      setEditPreviewUrl(null)
      setPreviewBusy(false)
      return
    }

    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setPreviewBusy(true)

    const timer = window.setTimeout(() => {
      void applyImageAdjustments(selectedImage.dataUrl, adjustments, {
        maxSide: PREVIEW_MAX_SIDE,
        format: 'jpeg',
        quality: 0.86
      })
        .then((url) => {
          if (previewRequestRef.current !== requestId) {
            return
          }

          setEditPreviewUrl(url)
          setPreviewBusy(false)
        })
        .catch(() => {
          if (previewRequestRef.current !== requestId) {
            return
          }

          setEditPreviewUrl(null)
          setPreviewBusy(false)
          setStatus(t(language, 'studioRenderFailed'))
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [mode, selectedImage, adjustments, language])

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
  }, [mode, layoutId, slotImages, collageGap, collagePadding, collageBackground, library, language])

  function selectLayout(nextLayoutId: CollageLayoutId): void {
    const layout = collageLayouts.find((item) => item.id === nextLayoutId)
    if (!layout) {
      return
    }

    setLayoutId(nextLayoutId)
    setSlotImages(layout.cells.map((_, index) => slotImages[index] ?? library[index]?.id ?? null))
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

    setLibrary(loadStudioLibrary())
    setSelectedId(imported[0]?.id ?? selectedId)
    setStatus(t(language, 'studioImported', { count: String(imported.length) }))
  }

  async function exportCurrent(): Promise<void> {
    try {
      if (mode === 'edit') {
        if (!selectedImage) {
          return
        }

        setStatus(t(language, 'studioRendering'))
        const dataUrl = await applyImageAdjustments(selectedImage.dataUrl, adjustments, { maxSide: 4096, format: 'png' })
        const result = await window.gcpshot.exportStudioImage(dataUrl)
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

  function autoFillCollage(): void {
    setSlotImages(activeLayout.cells.map((_, index) => library[index]?.id ?? null))
  }

  function resetAdjustments(): void {
    setAdjustments(defaultAdjustments)
  }

  function saveEditedToLibrary(): void {
    if (!selectedImage) {
      return
    }

    setStatus(t(language, 'studioRendering'))

    void applyImageAdjustments(selectedImage.dataUrl, adjustments, { maxSide: 4096, format: 'png' })
      .then((dataUrl) => {
        const image = addStudioImage({
          name: `${selectedImage.name} (editado)`,
          dataUrl,
          width: selectedImage.width,
          height: selectedImage.height
        })
        setLibrary(loadStudioLibrary())
        setSelectedId(image.id)
        setAdjustments(defaultAdjustments)
        setStatus(t(language, 'studioSavedToLibrary'))
      })
      .catch(() => {
        setStatus(t(language, 'studioRenderFailed'))
      })
  }

  function selectImage(id: string): void {
    previewRequestRef.current += 1
    setSelectedId(id)
    setAdjustments(defaultAdjustments)
    setEditPreviewUrl(null)
  }

  function updateAdjustment<K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]): void {
    setAdjustments((current) => ({ ...current, [key]: value }))
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
              <p className="eyebrow">{t(language, 'studioEyebrow')}</p>
              <h1>{t(language, 'studioTitle')}</h1>
            </div>
          </div>
          <div className="nav-actions">
            <button type="button" className="ghost-button" onClick={onOpenSettings}>
              {t(language, 'settings')}
            </button>
            <button type="button" className="ghost-button" onClick={() => void importImages()}>
              {t(language, 'studioImport')}
            </button>
            <button type="button" className="primary-button compact" onClick={() => void exportCurrent()}>
              {t(language, 'studioExport')}
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
        </div>

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
                      removeStudioImage(item.id)
                      const next = loadStudioLibrary()
                      setLibrary(next)
                      if (selectedId === item.id) {
                        setSelectedId(next[0]?.id ?? null)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </aside>

          <div className="studio-canvas-wrap">
            {mode === 'edit' ? (
              selectedImage ? (
                <>
                  {editPreviewUrl ? (
                    <img className="studio-canvas-image" src={editPreviewUrl} alt={selectedImage.name} decoding="async" />
                  ) : (
                    <div className="studio-canvas-empty">
                      <strong>{previewBusy ? t(language, 'studioRendering') : t(language, 'studioCanvasEmptyTitle')}</strong>
                    </div>
                  )}
                </>
              ) : (
                <div className="studio-canvas-empty">
                  <strong>{t(language, 'studioCanvasEmptyTitle')}</strong>
                  <span>{t(language, 'studioCanvasEmptyHint')}</span>
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

          <aside className="studio-controls">
            {mode === 'edit' ? (
              <>
                <h3>{t(language, 'studioAdjustments')}</h3>
                <label className="studio-slider">
                  <span>{t(language, 'studioBrightness')}</span>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={adjustments.brightness}
                    onChange={(event) => updateAdjustment('brightness', Number(event.currentTarget.value))}
                  />
                </label>
                <label className="studio-slider">
                  <span>{t(language, 'studioContrast')}</span>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={adjustments.contrast}
                    onChange={(event) => updateAdjustment('contrast', Number(event.currentTarget.value))}
                  />
                </label>
                <label className="studio-slider">
                  <span>{t(language, 'studioSaturation')}</span>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={adjustments.saturation}
                    onChange={(event) => updateAdjustment('saturation', Number(event.currentTarget.value))}
                  />
                </label>
                <div className="studio-button-row">
                  <button type="button" className="ghost-button" onClick={() => updateAdjustment('rotation', adjustments.rotation - 90)}>
                    ↺
                  </button>
                  <button type="button" className="ghost-button" onClick={() => updateAdjustment('rotation', adjustments.rotation + 90)}>
                    ↻
                  </button>
                  <button type="button" className="ghost-button" onClick={() => updateAdjustment('flipHorizontal', !adjustments.flipHorizontal)}>
                    ⇋
                  </button>
                </div>
                <button type="button" className="ghost-button" onClick={resetAdjustments}>
                  {t(language, 'studioReset')}
                </button>
                <button type="button" className="primary-button" onClick={saveEditedToLibrary} disabled={!selectedImage || previewBusy}>
                  {t(language, 'studioSaveVariant')}
                </button>
              </>
            ) : (
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
                <button type="button" className="ghost-button" onClick={autoFillCollage}>
                  {t(language, 'studioAutoFill')}
                </button>
              </>
            )}
          </aside>
        </div>

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
