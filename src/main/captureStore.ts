import { app } from 'electron'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { StoredCapture } from '../shared/studio'

type Entry = Omit<StoredCapture, 'dataUrl'>
let pending = Promise.resolve()
const directory = (): string => join(app.getPath('userData'), 'captures')
const validId = (id: string): boolean => /^capture-[0-9a-f-]+$/.test(id)

async function entries(): Promise<Entry[]> {
  try {
    const value = JSON.parse(await readFile(join(directory(), 'index.json'), 'utf8')) as Entry[]
    return Array.isArray(value) ? value.filter((item) => validId(item.id)) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeIndex(value: Entry[]): Promise<void> {
  const path = join(directory(), 'index.json')
  await writeFile(path + '.tmp', JSON.stringify(value), 'utf8')
  await rename(path + '.tmp', path)
}

export function storeCapture(image: Electron.NativeImage): Promise<Entry> {
  const operation = pending.catch(() => {}).then(async () => {
    await mkdir(directory(), { recursive: true })
    const entry = { id: `capture-${randomUUID()}`, name: `Captura ${new Date().toLocaleString()}`, ...image.getSize(), createdAt: Date.now() }
    const current = await entries()
    await writeFile(join(directory(), entry.id + '.png'), image.toPNG())
    await writeIndex([entry, ...current].slice(0, 24))
    await Promise.all(current.slice(23).map((old) => unlink(join(directory(), old.id + '.png')).catch(() => {})))
    return entry
  })
  pending = operation.then(() => {})
  return operation
}

export async function getStoredCaptures(): Promise<StoredCapture[]> {
  await pending.catch(() => {})
  const current = await entries()
  return Promise.all(current.map(async (entry) => ({ ...entry, dataUrl: `data:image/png;base64,${(await readFile(join(directory(), entry.id + '.png'))).toString('base64')}` })))
}

export async function removeStoredCapture(id: string): Promise<void> {
  if (!validId(id)) return
  const operation = pending.catch(() => {}).then(async () => {
    await writeIndex((await entries()).filter((item) => item.id !== id))
    await unlink(join(directory(), id + '.png')).catch(() => {})
  })
  pending = operation
  await operation
}
