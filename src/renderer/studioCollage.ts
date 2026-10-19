import type { StudioImage } from './studioStorage'

export type CollageLayoutId = '2col' | '2row' | '3col' | 'grid-2x2' | 'hero-left' | 'hero-top'
export type ImageFilterPreset = 'none' | 'pb' | 'sepia' | 'noir' | 'retro' | 'chrome' | 'film' | 'warm'

type NormalizedCell = {
  x: number
  y: number
  w: number
  h: number
}

export type CollageLayout = {
  id: CollageLayoutId
  slots: number
  aspect: number
  cells: NormalizedCell[]
}

export type CollageSlotPosition = {
  x: number
  y: number
}

export type ImageLayer = {
  id: string
  image: StudioImage
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

export const collageLayouts: CollageLayout[] = [
  {
    id: '2col',
    slots: 2,
    aspect: 16 / 10,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 }
    ]
  },
  {
    id: '2row',
    slots: 2,
    aspect: 10 / 16,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 }
    ]
  },
  {
    id: '3col',
    slots: 3,
    aspect: 16 / 9,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }
    ]
  },
  {
    id: 'grid-2x2',
    slots: 4,
    aspect: 1,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  },
  {
    id: 'hero-left',
    slots: 3,
    aspect: 16 / 10,
    cells: [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.5 },
      { x: 0.58, y: 0.5, w: 0.42, h: 0.5 }
    ]
  },
  {
    id: 'hero-top',
    slots: 3,
    aspect: 10 / 14,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58, w: 0.5, h: 0.42 },
      { x: 0.5, y: 0.58, w: 0.5, h: 0.42 }
    ]
  }
]

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = dataUrl
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: { x: number; y: number; width: number; height: number },
  position: CollageSlotPosition = { x: 0.5, y: 0.5 }
): void {
  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const offsetX = Math.min(1, Math.max(0, position.x))
  const offsetY = Math.min(1, Math.max(0, position.y))
  const x = rect.x - Math.max(0, width - rect.width) * offsetX
  const y = rect.y - Math.max(0, height - rect.height) * offsetY

  context.save()
  context.beginPath()
  context.roundRect(rect.x, rect.y, rect.width, rect.height, 12)
  context.clip()
  context.drawImage(image, x, y, width, height)
  context.restore()
}

function computeCellRects(
  layout: CollageLayout,
  width: number,
  height: number,
  padding: number,
  gap: number
): Array<{ x: number; y: number; width: number; height: number }> {
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  return layout.cells.map((cell) => {
    const slotGapX = gap * (cell.w < 1 ? 0.5 : 0)
    const slotGapY = gap * (cell.h < 1 ? 0.5 : 0)

    return {
      x: padding + cell.x * innerWidth + slotGapX,
      y: padding + cell.y * innerHeight + slotGapY,
      width: cell.w * innerWidth - gap,
      height: cell.h * innerHeight - gap
    }
  })
}

export async function renderCollage(options: {
  layoutId: CollageLayoutId
  slotImages: Array<StudioImage | null>
  gap: number
  padding: number
  background: string
  slotPositions?: CollageSlotPosition[]
  outputWidth?: number
}): Promise<string> {
  const layout = collageLayouts.find((item) => item.id === options.layoutId) ?? collageLayouts[0]
  const outputWidth = options.outputWidth ?? 1600
  const outputHeight = Math.round(outputWidth / layout.aspect)
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('canvas-unavailable')
  }

  context.fillStyle = options.background
  context.fillRect(0, 0, outputWidth, outputHeight)

  const rects = computeCellRects(layout, outputWidth, outputHeight, options.padding, options.gap)

  for (let index = 0; index < rects.length; index += 1) {
    const imageMeta = options.slotImages[index]
    if (!imageMeta) {
      continue
    }

    const image = await loadImage(imageMeta.dataUrl)
    drawCover(context, image, rects[index]!, options.slotPositions?.[index])
  }

  return canvas.toDataURL('image/png')
}

export function filterPresetToCanvasFilter(
  preset: ImageFilterPreset | undefined,
  adjustments: { brightness: number; contrast: number; saturation: number }
): string {
  const base = [
    `brightness(${100 + adjustments.brightness}%)`,
    `contrast(${100 + adjustments.contrast}%)`,
    `saturate(${100 + adjustments.saturation}%)`
  ]

  switch (preset) {
    case 'pb':
      return [...base, 'grayscale(100%)'].join(' ')
    case 'sepia':
      return [...base, 'sepia(82%)', 'contrast(108%)', 'saturate(92%)'].join(' ')
    case 'noir':
      return [...base, 'grayscale(100%)', 'contrast(132%)', 'brightness(88%)'].join(' ')
    case 'retro':
      return [...base, 'sepia(38%)', 'saturate(138%)', 'contrast(112%)'].join(' ')
    case 'chrome':
      return [...base, 'saturate(158%)', 'contrast(124%)', 'brightness(104%)'].join(' ')
    case 'film':
      return [...base, 'sepia(18%)', 'contrast(118%)', 'saturate(86%)'].join(' ')
    case 'warm':
      return [...base, 'sepia(22%)', 'saturate(118%)', 'brightness(106%)'].join(' ')
    case 'none':
    default:
      return base.join(' ')
  }
}

export async function applyImageAdjustments(
  dataUrl: string,
  adjustments: {
    brightness: number
    contrast: number
    saturation: number
    rotation: number
    flipHorizontal: boolean
    filterPreset?: ImageFilterPreset
  },
  options?: {
    maxSide?: number
    format?: 'png' | 'jpeg'
    quality?: number
  }
): Promise<string> {
  const source = await loadImage(dataUrl)
  const naturalWidth = source.naturalWidth
  const naturalHeight = source.naturalHeight

  if (!naturalWidth || !naturalHeight) {
    throw new Error('invalid-image-size')
  }

  const rotation = ((adjustments.rotation % 360) + 360) % 360
  const swap = rotation === 90 || rotation === 270
  const targetWidth = swap ? naturalHeight : naturalWidth
  const targetHeight = swap ? naturalWidth : naturalHeight

  const maxSide = options?.maxSide ?? 4096
  const scale = Math.min(1, maxSide / Math.max(targetWidth, targetHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(targetWidth * scale))
  canvas.height = Math.max(1, Math.round(targetHeight * scale))

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new Error('canvas-unavailable')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.filter = filterPresetToCanvasFilter(adjustments.filterPreset, adjustments)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((rotation * Math.PI) / 180)
  context.scale(adjustments.flipHorizontal ? -1 : 1, 1)
  context.drawImage(
    source,
    (-naturalWidth * scale) / 2,
    (-naturalHeight * scale) / 2,
    naturalWidth * scale,
    naturalHeight * scale
  )
  context.filter = 'none'

  const format = options?.format ?? 'png'
  if (format === 'jpeg') {
    return canvas.toDataURL('image/jpeg', options?.quality ?? 0.9)
  }

  return canvas.toDataURL('image/png')
}

export async function renderLayerComposition(options: {
  layers: ImageLayer[]
  background: string
  outputWidth?: number
  outputHeight?: number
}): Promise<string> {
  const outputWidth = options.outputWidth ?? 1600
  const outputHeight = options.outputHeight ?? 1000
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('canvas-unavailable')
  }

  context.fillStyle = options.background
  context.fillRect(0, 0, outputWidth, outputHeight)

  for (const layer of options.layers) {
    const image = await loadImage(layer.image.dataUrl)
    const baseScale = Math.min(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight) * 0.72
    const drawWidth = image.naturalWidth * baseScale * layer.scale
    const drawHeight = image.naturalHeight * baseScale * layer.scale
    context.save()
    context.globalAlpha = Math.min(1, Math.max(0, layer.opacity))
    context.translate(layer.x * outputWidth, layer.y * outputHeight)
    context.rotate((layer.rotation * Math.PI) / 180)
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    context.restore()
  }

  return canvas.toDataURL('image/png')
}

export async function createThumbnailDataUrl(dataUrl: string, maxSide = 240): Promise<string> {
  const source = await loadImage(dataUrl)
  const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight))

  if (scale >= 1) {
    return dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale))

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    return dataUrl
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
