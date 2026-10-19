import { filterPresetToCanvasFilter, type ImageFilterPreset } from './studioCollage'

export type PhotoAdjustments = {
  brightness: number; exposure: number; contrast: number; saturation: number
  highlights: number; shadows: number; warmth: number; tint: number; vignette: number
  rotation: number; flipHorizontal: boolean; flipVertical: boolean; filterPreset: ImageFilterPreset
}
export const originalPhoto: PhotoAdjustments = {
  brightness: 0, exposure: 0, contrast: 0, saturation: 0, highlights: 0, shadows: 0,
  warmth: 0, tint: 0, vignette: 0, rotation: 0, flipHorizontal: false, flipVertical: false, filterPreset: 'none'
}
export async function loadPhoto(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}
export function photoCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height))
  return canvas
}
export async function renderPhoto(url: string, values: PhotoAdjustments, maxSide = Infinity): Promise<HTMLCanvasElement> {
  const image = await loadPhoto(url)
  const angle = values.rotation * Math.PI / 180
  const width = Math.abs(image.naturalWidth * Math.cos(angle)) + Math.abs(image.naturalHeight * Math.sin(angle))
  const height = Math.abs(image.naturalHeight * Math.cos(angle)) + Math.abs(image.naturalWidth * Math.sin(angle))
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = photoCanvas(width * scale, height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(angle)
  ctx.scale(values.flipHorizontal ? -1 : 1, values.flipVertical ? -1 : 1)
  ctx.filter = filterPresetToCanvasFilter(values.filterPreset, values)
  ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale)
  ctx.restore()
  if (values.exposure || values.highlights || values.shadows || values.warmth || values.tint || values.vignette) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = pixels.data, exposure = 2 ** (values.exposure / 50)
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4
      const luma = (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255
      const light = values.shadows * (1 - luma) ** 2 * .8 + values.highlights * luma ** 2 * .8
      const distance = Math.min(1, ((x / canvas.width - .5) ** 2 + (y / canvas.height - .5) ** 2) * 2)
      const vignette = 1 - values.vignette / 100 * distance
      data[i] = ((data[i] + light + values.warmth * .45 + values.tint * .15) * exposure) * vignette
      data[i + 1] = ((data[i + 1] + light - values.tint * .3) * exposure) * vignette
      data[i + 2] = ((data[i + 2] + light - values.warmth * .45 + values.tint * .15) * exposure) * vignette
    }
    ctx.putImageData(pixels, 0, 0)
  }
  return canvas
}

// Flood only connected pixels: matching colors inside the subject stay untouched.
export function backgroundMask(canvas: HTMLCanvasElement, tolerance: number, seed: { x: number; y: number }): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data, count = canvas.width * canvas.height
  const x = Math.min(canvas.width - 1, Math.max(0, Math.round(seed.x * (canvas.width - 1))))
  const y = Math.min(canvas.height - 1, Math.max(0, Math.round(seed.y * (canvas.height - 1))))
  const start = y * canvas.width + x, offset = start * 4
  const color = [data[offset], data[offset + 1], data[offset + 2]]
  const visited = new Uint8Array(count), queue = new Uint32Array(count)
  let head = 0, tail = 1
  queue[0] = start; visited[start] = 1
  const add = (index: number) => { if (!visited[index]) { visited[index] = 1; queue[tail++] = index } }
  while (head < tail) {
    const index = queue[head++], i = index * 4
    const distance = Math.sqrt((data[i] - color[0]) ** 2 + (data[i + 1] - color[1]) ** 2 + (data[i + 2] - color[2]) ** 2)
    if (data[i + 3] && distance > tolerance * 4.42) continue
    data[i + 3] = 0
    if (index % canvas.width > 0) add(index - 1)
    if (index % canvas.width < canvas.width - 1) add(index + 1)
    if (index >= canvas.width) add(index - canvas.width)
    if (index < count - canvas.width) add(index + canvas.width)
  }
  const result = photoCanvas(canvas.width, canvas.height)
  result.getContext('2d')!.putImageData(pixels, 0, 0)
  return result
}
