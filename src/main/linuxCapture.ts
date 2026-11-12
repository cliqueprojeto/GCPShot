import { app, nativeImage, screen } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type SilentShot = { image: Electron.NativeImage; display: Electron.Display; method: string }

export const isWaylandSession = process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY))

export function linuxHelperPath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'GCPShot.LiveColor') : join(__dirname, '../../build', 'GCPShot.LiveColor')
}

/**
 * KWin only serves org.kde.KWin.ScreenShot2 to executables whose .desktop entry requests it
 * (Spectacle does the same). Registering the helper lets captures skip the screen-share dialog.
 */
export function authorizeKwinScreenshots(): void {
  if (!isWaylandSession || !existsSync(linuxHelperPath())) return
  try {
    const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
    const directory = join(dataHome, 'applications')
    const file = join(directory, 'gcpshot-capture-helper.desktop')
    const exec = linuxHelperPath().replace(/([\\"`$])/g, '\\$1')
    const content = `[Desktop Entry]\nType=Application\nName=GCPShot Capture Helper\nComment=Captura silenciosa do monitor ativo para o GCPShot\nExec="${exec}"\nIcon=gcpshot\nNoDisplay=true\nTerminal=false\nX-KDE-DBUS-Restricted-Interfaces=org.kde.KWin.ScreenShot2\n`
    if (existsSync(file) && readFileSync(file, 'utf8') === content) return
    mkdirSync(directory, { recursive: true })
    writeFileSync(file, content)
    // Refresh KDE's service cache so KWin sees the new entry right away.
    for (const tool of ['kbuildsycoca6', 'kbuildsycoca5']) {
      const child = spawn(tool, [], { stdio: 'ignore', detached: true })
      child.on('error', () => {})
      child.unref()
    }
  } catch (error) { console.error('GCPShot: nao foi possivel registrar a captura silenciosa do KDE.', error) }
}

function runHelper(args: string[], timeout = 20_000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(linuxHelperPath(), args, { timeout, env: { ...process.env, GDK_SCALE: '1', GDK_DPI_SCALE: '1' } }, (error, stdout, stderr) => {
      if (error) { if (stderr) console.warn('GCPShot: captura silenciosa:', stderr.trim()); resolve(null); return }
      resolve(stdout)
    })
  })
}

function grim(file: string): Promise<boolean> {
  return new Promise((resolve) => execFile('grim', [file], { timeout: 10_000 }, (error) => resolve(!error)))
}

/** Chooses the display the image belongs to: same pixel size, preferring the one under the mouse. */
function displayForImage(size: Electron.Size): Electron.Display {
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const matches = screen.getAllDisplays().filter((display) => {
    const pixelWidth = Math.round(display.size.width * display.scaleFactor), pixelHeight = Math.round(display.size.height * display.scaleFactor)
    return (Math.abs(pixelWidth - size.width) <= 2 && Math.abs(pixelHeight - size.height) <= 2) || (display.size.width === size.width && display.size.height === size.height)
  })
  return matches.find((display) => display.id === cursorDisplay.id) ?? matches[0] ?? cursorDisplay
}

/** Crops a whole-desktop screenshot down to the monitor under the mouse. */
function cropToCursorDisplay(image: Electron.NativeImage): { image: Electron.NativeImage; display: Electron.Display } {
  const displays = screen.getAllDisplays()
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  if (displays.length === 1) return { image, display }
  const minX = Math.min(...displays.map((item) => item.bounds.x)), minY = Math.min(...displays.map((item) => item.bounds.y))
  const width = Math.max(...displays.map((item) => item.bounds.x + item.bounds.width)) - minX
  const height = Math.max(...displays.map((item) => item.bounds.y + item.bounds.height)) - minY
  const size = image.getSize()
  const ratioX = size.width / width, ratioY = size.height / height
  const rect = {
    x: Math.round((display.bounds.x - minX) * ratioX), y: Math.round((display.bounds.y - minY) * ratioY),
    width: Math.round(display.bounds.width * ratioX), height: Math.round(display.bounds.height * ratioY)
  }
  return { image: image.crop(rect), display }
}

/** Captures the active monitor on Wayland without the screen-share picker. Returns null when no silent method works. */
export async function silentLinuxScreenshot(): Promise<SilentShot | null> {
  if (!isWaylandSession) return null
  // Private random directory under the user's profile: no other account can pre-create or symlink the target.
  const directory = await mkdtemp(join(app.getPath('userData'), 'shot-'))
  const file = join(directory, 'screen.png')
  try {
    let output = existsSync(linuxHelperPath()) ? await runHelper(['--screenshot', file]) : null
    let method = output?.match(/^OK (\w+) (\w+)/m)
    if (!method && (await grim(file))) { output = 'OK grim desktop'; method = output.match(/^OK (\w+) (\w+)/m) }
    if (!method || !existsSync(file)) return null
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) return null
    if (method[2] === 'screen') return { image, display: displayForImage(image.getSize()), method: method[1] }
    return { ...cropToCursorDisplay(image), method: method[1] }
  } finally { await rm(directory, { recursive: true, force: true }).catch(() => {}) }
}
