export type StudioImage = {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
  createdAt: number
}

const STORAGE_KEY = 'gcpshot-studio-library'
const MAX_ITEMS = 24

export function loadStudioLibrary(): StudioImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as StudioImage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudioLibrary(items: StudioImage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // Ignore quota errors to avoid crashing the renderer while editing.
  }
}

export function addStudioImage(input: {
  name: string
  dataUrl: string
  width: number
  height: number
}): StudioImage {
  const image: StudioImage = {
    id: crypto.randomUUID(),
    name: input.name,
    dataUrl: input.dataUrl,
    width: input.width,
    height: input.height,
    createdAt: Date.now()
  }

  const next = [image, ...loadStudioLibrary()].slice(0, MAX_ITEMS)
  saveStudioLibrary(next)
  return image
}

export function removeStudioImage(id: string): void {
  saveStudioLibrary(loadStudioLibrary().filter((item) => item.id !== id))
}

export async function readImageMeta(dataUrl: string): Promise<{ width: number; height: number }> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  return { width: image.naturalWidth, height: image.naturalHeight }
}

export async function pushCaptureToStudioAsync(dataUrl: string, name?: string): Promise<StudioImage> {
  const { width, height } = await readImageMeta(dataUrl)
  return addStudioImage({
    name: name ?? `Captura ${new Date().toLocaleString()}`,
    dataUrl,
    width,
    height
  })
}
