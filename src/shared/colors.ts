export type Palette = { id: string; name: string; colors: string[] }
export type ColorLibrary = { palettes: Palette[]; history: string[] }
export type ColorResult = { ok: boolean; hex?: string; error?: string }
export type Harmony = 'analogous' | 'complementary' | 'triadic' | 'monochromatic'

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(raw)) return '#' + raw.split('').map((c) => c + c).join('').toUpperCase()
  return /^[\da-f]{6}$/i.test(raw) ? '#' + raw.toUpperCase() : null
}

export function rgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex)
  if (!value) throw new Error('Invalid HEX color')
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}

export function fromRgb(values: number[]): string {
  return '#' + values.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function hsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((n) => n / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s * 100, l * 100]
}

export function fromHsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2
  const channels = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return fromRgb(channels.map((n) => (n + m) * 255))
}

export function luminance(hex: string): number {
  const values = rgb(hex).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
}

export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export function harmony(hex: string, mode: Harmony): string[] {
  const [h, s, l] = hsl(hex)
  if (mode === 'monochromatic') return [-30, -15, 0, 15, 30].map((d) => fromHsl(h, s, Math.max(5, Math.min(95, l + d))))
  const offsets = mode === 'analogous' ? [-40, -20, 0, 20, 40] : mode === 'complementary' ? [-15, 0, 15, 165, 180] : [0, 120, 240, 135, 255]
  return offsets.map((d) => fromHsl(h + d, s, l))
}

export function parseLibrary(input: unknown): ColorLibrary {
  if (!input || typeof input !== 'object') throw new Error('Biblioteca de cores invalida.')
  const raw = input as Record<string, unknown>
  function color(value: unknown): string | null {
    if (typeof value === 'string') return normalizeHex(value)
    if (Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255)) return fromRgb(value)
    return null
  }
  function colors(value: unknown): string[] {
    return Array.isArray(value) ? value.map(color).filter((c): c is string => Boolean(c)).slice(0, 256) : []
  }
  if (!Array.isArray(raw.palettes)) throw new Error('Biblioteca sem paletas.')
  const ids = new Set<string>()
  const palettes = raw.palettes.slice(0, 500).map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error('Paleta invalida.')
    const p = item as Record<string, unknown>
    let id = typeof p.id === 'string' && p.id ? p.id : `import-${i}`
    while (ids.has(id)) id += `-${i}`
    ids.add(id)
    return { id, name: typeof p.name === 'string' ? p.name.slice(0, 100) : `Paleta ${i + 1}`, colors: colors(p.colors) }
  })
  return { palettes, history: [...new Set(colors(raw.history))].slice(0, 100) }
}
