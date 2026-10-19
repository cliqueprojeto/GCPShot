import { app } from 'electron'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { parseLibrary, type ColorLibrary } from '../shared/colors'

let library: ColorLibrary
let pendingWrite = Promise.resolve()
const path = (): string => join(app.getPath('userData'), 'color-library.json')

export async function loadColorLibrary(): Promise<ColorLibrary> {
  try {
    library = parseLibrary(JSON.parse(await readFile(path(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    try {
      library = parseLibrary(JSON.parse(await readFile(join(app.getPath('appData'), 'GCPstudioDesigner', 'library.json'), 'utf8')))
    } catch {
      library = { palettes: [], history: [] }
    }
    await saveColorLibrary(library)
  }
  return library
}

export function getColorLibrary(): ColorLibrary { return library }

export async function saveColorLibrary(input: unknown): Promise<ColorLibrary> {
  const next = parseLibrary(input)
  const write = pendingWrite.catch(() => {}).then(async () => {
    await writeFile(path() + '.tmp', JSON.stringify(next, null, 2), 'utf8')
    await rename(path() + '.tmp', path())
  })
  pendingWrite = write
  await write
  library = next
  return next
}
