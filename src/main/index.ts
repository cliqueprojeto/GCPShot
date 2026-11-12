import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
  shell
} from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { extname, join, basename } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import type { AppSettings, CaptureExportPayload, CaptureMode, CaptureSegment, CaptureRect, CaptureResult, RecordMode } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import { normalizeHex, parseLibrary, type ColorResult } from '../shared/colors'
import { getColorLibrary, loadColorLibrary, saveColorLibrary } from './colorLibrary'
import { getStoredCaptures, removeStoredCapture, storeCapture } from './captureStore'
import type { UpdateStatus } from '../shared/updates'
import { DEVELOPER_CREDIT, GCP_SITE_URL, ORGANIZATION_NAME, isProjectSiteUrl } from '../shared/branding'
import { authorizeKwinScreenshots, isWaylandSession, silentLinuxScreenshot } from './linuxCapture'
import { readDesktopShortcuts, type DesktopShortcuts } from './desktopShortcuts'
import { checkForUpdates, downloadAndInstall, getUpdateStatus, onUpdateStatus, setLastCheck } from './updater'
import { canonicalShortcut, globalShortcutKeys, shortcutCandidates, shortcutIdentity, validGlobalShortcut, type GlobalShortcutKey, type ShortcutInfo } from '../shared/shortcuts'

type MainView = 'home' | 'studio' | 'colors' | 'palettes'

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let captureWindows: BrowserWindow[] = []
let tray: Tray | null = null
let settings: AppSettings
let isQuitting = false
let colorPickerProcess: ChildProcess | null = null
let colorToastWindow: BrowserWindow | null = null
let liveColorWindow: BrowserWindow | null = null
let colorToastTimer: ReturnType<typeof setTimeout> | null = null
let toastDestination: 'colors' | 'studio' | 'home' = 'colors'
let showWelcome = false
let startupComplete = false
let pendingLaunchArgs: string[] | null = null
const shortcutEditors = new Set<number>()
const shortcutEditorOwners = new Set<number>()
let shortcutIssues: string[] = []
let desktopShortcuts: DesktopShortcuts = { desktop: 'other', label: '', reserved: new Set() }
const reservedByDesktop = (value: string): boolean => desktopShortcuts.reserved.has(shortcutIdentity(value, process.platform))
const availableCandidates = (key: GlobalShortcutKey): string[] => shortcutCandidates(process.platform, key).filter((value) => !reservedByDesktop(value))
let settingsQueue: Promise<unknown> = Promise.resolve()

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
app.setName('GCPShot')
if (process.platform === 'win32') app.setAppUserModelId('br.com.gestaoculturalpro.gcpshot')
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
  app.commandLine.appendSwitch('class', 'gcpshot')
  app.setDesktopName('gcpshot.desktop')
}
const ownsInstance = process.platform !== 'linux' || app.requestSingleInstanceLock()
if (!ownsInstance) app.quit()
if (process.platform === 'linux' && ownsInstance) {
  app.on('second-instance', (_event, argv) => {
    if (!startupComplete) { pendingLaunchArgs = argv; return }
    handleLinuxLaunch(argv)
  })
}
const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')
const defaultSettings = defaultAppSettings

const shortcutKeys: Array<keyof AppSettings> = [
  'captureShortcut',
  'fullscreenShortcut',
  'studioShortcut',
  'liveColorShortcut',
  'recordRegionShortcut',
  'recordFullscreenShortcut',
  'recordPauseShortcut',
  'copyShortcut',
  'saveShortcut',
  'printShortcut',
  'whatsappShortcut',
  'undoShortcut',
  'redoShortcut',
  'selectShortcut',
  'moveShortcut',
  'penShortcut',
  'arrowShortcut',
  'magnifierShortcut',
  'blurShortcut',
  'pixelateShortcut',
  'textShortcut',
  'bubbleShortcut',
  'stampShortcut',
  'numStampShortcut',
  'rectShortcut',
  'ellipseShortcut',
  'lineShortcut',
  'starShortcut',
  'cancelShortcut'
]

function normalizeSettingsShortcuts(nextSettings: AppSettings): AppSettings {
  shortcutKeys.forEach((key) => {
    const value = nextSettings[key]
    if (typeof value === 'string') {
      ;(nextSettings as unknown as Record<string, string>)[key] = normalizeAccelerator(value)
    }
  })

  return nextSettings
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const file = await readFile(settingsPath(), 'utf8')
    return normalizeSettingsShortcuts({ ...defaultSettings, ...JSON.parse(file) })
  } catch {
    const defaults = { ...defaultSettings }
    for (const key of globalShortcutKeys) defaults[key] = firstFreeShortcut(key, defaults)
    return defaults
  }
}

/** Picks the easiest candidate that the OS has not reserved and that no other GCPShot action already uses. */
function firstFreeShortcut(key: GlobalShortcutKey, current: AppSettings): string {
  const taken = new Set(globalShortcutKeys.filter((other) => other !== key).map((other) => shortcutIdentity(current[other], process.platform)))
  const options = availableCandidates(key).filter((value) => !taken.has(shortcutIdentity(value, process.platform)))
  for (const value of options) {
    if (isWaylandSession || globalShortcut.isRegistered(value)) return value
    try { if (globalShortcut.register(value, () => {})) { globalShortcut.unregister(value); return value } } catch { /* reserved */ }
  }
  return options[0] ?? shortcutCandidates(process.platform, key)[0]
}

function normalizeAccelerator(accelerator: string): string {
  return canonicalShortcut(canonicalShortcut(accelerator).replace(/\bSuper\b/g, process.platform === 'darwin' ? 'Command' : 'Super'))
}

async function saveSettings(nextSettings: AppSettings): Promise<void> {
  await writeFile(settingsPath(), JSON.stringify(nextSettings, null, 2))
}

function applyLoginItemSettings(): void {
  if (process.platform === 'linux') {
    const directory = join(app.getPath('appData'), 'autostart')
    const path = join(directory, 'gcpshot.desktop')
    if (settings.startWithWindows) {
      mkdirSync(directory, { recursive: true })
      const executable = process.execPath.replace(/([\\"`$])/g, '\\$1').replace(/%/g, '%%')
      writeFileSync(path, `[Desktop Entry]\nType=Application\nName=GCPShot\nExec="${executable}" --hidden\nIcon=gcpshot\nStartupWMClass=gcpshot\nNoDisplay=true\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`)
    } else if (existsSync(path)) unlinkSync(path)
    return
  }
  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    openAsHidden: settings.startWithWindows,
    path: process.execPath,
    args: ['--hidden']
  })
}

function shouldStartHidden(): boolean {
  if (process.argv.includes('--hidden')) {
    return true
  }

  try {
    return app.getLoginItemSettings().wasOpenedAtLogin === true
  } catch {
    return false
  }
}

function notify(title: string, body: string, destination: 'home' | 'studio' = 'home'): void {
  showColorToast('', destination, { title, body })
}

function getAppIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))

  if (!icon.isEmpty()) {
    return icon
  }

  const pngIcon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))

  if (!pngIcon.isEmpty()) {
    return pngIcon
  }

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="g" x1="3" y1="4" x2="29" y2="28"><stop stop-color="#7b2ff7"/><stop offset="1" stop-color="#d94cff"/></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="url(#g)"/>
      <path d="M8 13h4l2-3h5l2 3h3v9H8z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="16" cy="17.8" r="3.2" fill="none" stroke="#fff" stroke-width="2.4"/>
    </svg>
  `)

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`)
}

app.on('browser-window-created', (_event, window) => {
  if (process.platform !== 'darwin') window.setIcon(getAppIcon())
  if (process.platform === 'win32') {
    const installedIcon = join(process.resourcesPath, 'GCPShot.ico')
    window.setAppDetails({
      appId: 'br.com.gestaoculturalpro.gcpshot',
      appIconPath: existsSync(installedIcon) ? installedIcon : join(__dirname, '../../build/icon.ico'),
      appIconIndex: 0,
      relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${app.getAppPath()}"`,
      relaunchDisplayName: 'GCPShot'
    })
  }
})

function loadRenderer(
  window: BrowserWindow,
  overlay: 'capture' | 'record' | false = false,
  mode: CaptureMode = 'region',
  mainView: MainView = 'home'
): void {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)

    if (overlay) {
      url.searchParams.set(overlay === 'record' ? 'record' : 'capture', '1')
      url.searchParams.set('mode', mode)
    } else if (mainView !== 'home') {
      url.searchParams.set(mainView, '1')
    }

    window.loadURL(url.toString())
    return
  }

  window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: overlay
      ? { [overlay === 'record' ? 'record' : 'capture']: '1', mode }
      : mainView !== 'home'
        ? { [mainView]: '1' }
        : undefined
  })
}

function createMainWindow(mainView: MainView = 'home'): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    if (mainView === 'studio') {
      mainWindow.webContents.send('studio:open')
    }
    return
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#13091f',
    title: 'GCPShot',
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenu(null)
  if (showWelcome && mainView === 'home') void mainWindow.loadFile(join(__dirname, '../../build/welcome.html'))
  else loadRenderer(mainWindow, false, 'region', mainView)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isProjectSiteUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isProjectSiteUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault()
      mainWindow?.hide()
      notify('GCPShot continua ativo', 'Use a bandeja ou os atalhos para capturar.')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }

  mainWindow.show()
  mainWindow.focus()
}

function openStudioWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow('studio')
    return
  }

  mainWindow.show()
  mainWindow.focus()

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('studio:open')
    })
    return
  }

  mainWindow.webContents.send('studio:open')
}

function openSettingsWindow(): void {
  showMainWindow()
  if (!mainWindow) {
    return
  }

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('settings:open')
    })
    return
  }

  mainWindow.webContents.send('settings:open')
}

function openColorWindow(view: 'colors' | 'palettes' = 'colors'): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(view)
    return
  }
  const window = mainWindow
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  const send = (): void => {
    if (window.webContents.getURL().includes('/welcome.html')) {
      showWelcome = false
      void writeFile(join(app.getPath('userData'), 'welcome-version.txt'), app.getVersion(), 'utf8').catch((error) => console.error('GCPShot: welcome state', error))
      loadRenderer(window, false, 'region', view)
    } else window.webContents.send('colors:open', view)
  }
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send)
  else send()
}

function handleLinuxLaunch(argv: string[]): void {
  if (argv.includes('--hidden')) return
  if (captureWindows.length) { captureWindows[0]?.focus(); return }
  if (argv.includes('--live-color')) {
    if (!colorPickerProcess) void beginLiveColor().then((result) => { if (result.error) notify('Live Color', result.error) })
  } else if (!colorPickerProcess) {
    if (argv.includes('--color-lab')) openColorWindow('colors')
    else showMainWindow()
  }
}

async function beginLiveColor(): Promise<ColorResult> {
  if (captureWindows.length) return { ok: false, error: 'Conclua a captura antes de iniciar o Live Color.' }
  if (colorPickerProcess || liveColorWindow) return { ok: false, error: 'O Live Color ja esta ativo.' }
  const wasVisible = Boolean(mainWindow?.isVisible())
  try {
    closeColorToast()
    mainWindow?.hide()
    const helper = process.platform === 'win32' ? 'GCPShot.LiveColor.exe' : 'GCPShot.LiveColor'
    const executable = app.isPackaged ? join(process.resourcesPath, helper) : join(__dirname, '../../build', helper)
    // Wayland forbids reading screen pixels live: sample a silent capture of the active monitor instead.
    const frozen = isWaylandSession ? await pickColorFromSilentShot(wasVisible) : undefined
    const value = frozen !== undefined ? frozen : await new Promise<string | null>((resolve, reject) => {
      const child = spawn(executable, [String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(process.platform === 'linux' ? { GDK_SCALE: '1', GDK_DPI_SCALE: '1' } : {}) } })
      colorPickerProcess = child
      let output = '', error = ''
      let timedOut = false
      const timeout = process.platform === 'darwin' || process.platform === 'linux' ? setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, 135_000) : undefined
      const clearPickerTimeout = (): void => { if (timeout) clearTimeout(timeout) }
      child.stdout?.on('data', (chunk: Buffer) => { output = (output + chunk.toString()).slice(-4096) })
      child.stderr?.on('data', (chunk: Buffer) => { error = (error + chunk.toString()).slice(-4096) })
      child.once('error', (error) => { clearPickerTimeout(); reject(error) })
      child.once('close', (code) => {
        clearPickerTimeout()
        if (isQuitting) { resolve(null); return }
        if (timedOut) { reject(new Error('O Live Color foi encerrado por seguranca porque deixou de responder. Tente novamente.')); return }
        if (code !== 0) { reject(new Error(error.trim() || 'Nao foi possivel iniciar o Live Color.')); return }
        resolve(output.split(/\r?\n/).find((line) => /^#[0-9A-F]{6}$/.test(line)) ?? null)
      })
    })
    const hex = value ? normalizeHex(value) : null
    if (!hex) return { ok: false }
    clipboard.writeText(hex)
    const current = getColorLibrary()
    await saveColorLibrary({ ...current, history: [hex, ...current.history.filter((c) => c !== hex)].slice(0, 100) })
    mainWindow?.webContents.send('colors:picked', hex)
    showColorToast(hex)
    return { ok: true, hex }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Falha ao selecionar cor.' }
  } finally {
    colorPickerProcess = null
    if (!isQuitting && wasVisible && mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
  }
}

/** Opens the real-time magnifier over a silent capture. Resolves undefined when no silent capture is possible. */
async function pickColorFromSilentShot(wasVisible: boolean): Promise<string | null | undefined> {
  if (wasVisible) await new Promise((resolve) => setTimeout(resolve, 220))
  const shot = await silentLinuxScreenshot()
  if (!shot) return undefined
  const { display, image } = shot
  const size = image.getSize()
  return new Promise((resolve) => {
    const window = new BrowserWindow({
      ...display.bounds, frame: false, fullscreen: true, show: false, resizable: false, movable: false,
      alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#000000', title: 'GCPShot Live Color', icon: getAppIcon(),
      webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
    })
    liveColorWindow = window
    let settled = false
    const timeout = setTimeout(() => finish(null), 120_000)
    function finish(hex: string | null): void {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      ipcMain.removeListener('livecolor:finish', onFinish)
      liveColorWindow = null
      if (!window.isDestroyed()) window.destroy()
      resolve(hex)
    }
    function onFinish(event: Electron.IpcMainEvent, hex: unknown): void {
      if (window.isDestroyed() || event.sender !== window.webContents) return
      finish(typeof hex === 'string' && /^#[0-9A-F]{6}$/i.test(hex) ? hex.toUpperCase() : null)
    }
    ipcMain.on('livecolor:finish', onFinish)
    window.on('closed', () => finish(null))
    window.setMenu(null)
    window.webContents.once('did-finish-load', () => window.webContents.send('livecolor:image', { dataUrl: image.toDataURL(), width: size.width, height: size.height }))
    window.once('ready-to-show', () => { window.show(); window.setAlwaysOnTop(true, 'screen-saver'); window.focus() })
    if (isDev && process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL)
      url.searchParams.set('livecolor', '1')
      void window.loadURL(url.toString())
    } else void window.loadFile(join(__dirname, '../renderer/index.html'), { query: { livecolor: '1' } })
  })
}

function closeColorToast(): void {
  if (colorToastTimer) clearTimeout(colorToastTimer)
  colorToastTimer = null
  if (colorToastWindow && !colorToastWindow.isDestroyed()) colorToastWindow.destroy()
  colorToastWindow = null
}

function showColorToast(hex: string, destination: 'colors' | 'studio' | 'home' = 'colors', message?: { title: string; body: string }): void {
  closeColorToast()
  if (!settings.showNotifications) return
  toastDestination = destination
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const window = new BrowserWindow({
    x: Math.max(area.x + 8, area.x + area.width - 406), y: Math.max(area.y + 8, area.y + area.height - 208),
    width: Math.min(390, area.width - 16), height: 188, frame: false, show: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#151923',
    title: `GCPShot - ${message?.title || (destination === 'studio' ? 'Captura copiada' : 'Cor copiada')}`, icon: getAppIcon(),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  })
  colorToastWindow = window
  window.setMenu(null)
  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return
    window.showInactive()
    colorToastTimer = setTimeout(closeColorToast, 12000)
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  void window.loadFile(join(__dirname, '../../build/color-toast.html'), { query: { hex, destination, title: message?.title || '', body: message?.body || '' } })
}

async function showAboutDialog(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Sobre o GCPShot',
    message: 'GCPShot',
    detail: `${DEVELOPER_CREDIT} | ${ORGANIZATION_NAME}\n\nVersão ${app.getVersion()}\n${GCP_SITE_URL}`,
    icon: getAppIcon(),
    buttons: ['Acessar site', 'Fechar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })
  if (result.response === 0) await shell.openExternal(GCP_SITE_URL)
}

function createTray(): void {
  let icon = getAppIcon()

  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII='
    )
  }

  if (!tray || tray.isDestroyed()) {
    tray = new Tray(icon.resize({ width: 16, height: 16 }))
    if (process.platform !== 'linux') tray.on('click', () => tray?.popUpContextMenu())
  } else tray.setImage(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('GCPShot')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Capturar região', icon: trayMenuIcon('region'), click: () => void beginCapture('region') },
      { label: 'Capturar tela inteira', icon: trayMenuIcon('fullscreen'), click: () => void beginCapture('fullscreen') },
      { type: 'separator' },
      { label: 'Abrir o Estúdio', icon: trayMenuIcon('studio'), click: openStudioWindow },
      { label: 'Color Lab', icon: trayMenuIcon('colors'), click: () => openColorWindow('colors') },
      { label: 'Minhas Paletas', icon: trayMenuIcon('palettes'), click: () => openColorWindow('palettes') },
      { label: 'Live Color', icon: trayMenuIcon('live'), accelerator: settings.liveColorShortcut, registerAccelerator: false, click: () => void beginLiveColor().then((result) => { if (result.error) notify('Live Color', result.error) }) },
      { type: 'separator' },
      { label: 'Configurações', icon: trayMenuIcon('settings'), click: openSettingsWindow },
      { label: 'Verificar atualizações', icon: trayMenuIcon('about'), click: () => void runUpdateCheck(true) },
      { label: 'Sobre', icon: trayMenuIcon('about'), click: () => void showAboutDialog().catch((error) => console.error('GCPShot: não foi possível abrir Sobre.', error)) },
      {
        label: process.platform === 'win32' ? 'Iniciar com o Windows' : 'Iniciar com o sistema',
        icon: trayMenuIcon('startup'),
        type: 'checkbox',
        checked: settings.startWithWindows,
        click: (item) => {
          void updateSettings({ startWithWindows: item.checked })
        }
      },
      { type: 'separator' },
      {
        label: 'Sair',
        icon: trayMenuIcon('quit'),
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
}

function trayMenuIcon(name: string): Electron.NativeImage {
  return nativeImage.createFromPath(join(__dirname, '../../build/tray', `${name}-${nativeTheme.shouldUseDarkColors ? 'light' : 'dark'}.png`)).resize({ width: 16, height: 16 })
}

async function beginOverlay(mode: CaptureMode, overlay: 'capture' | 'record', autoCopy = false): Promise<CaptureResult> {
  if (colorPickerProcess || liveColorWindow) return { ok: false, error: 'Conclua o Live Color ou pressione Esc antes de capturar.' }
  closeColorToast()
  if (captureWindows.length > 0) {
    captureWindows[0]?.focus()
    return { ok: true }
  }

  const mainWasVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible())
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
  }

  // Wayland: capture the monitor under the mouse silently (KWin/portal) instead of the screen-share picker.
  if (isWaylandSession && overlay === 'capture') {
    if (mainWasVisible) await new Promise((resolve) => setTimeout(resolve, 220))
    const shot = await silentLinuxScreenshot()
    if (shot) {
      const { display, image } = shot
      const size = image.getSize()
      return openOverlayWindow(mode, overlay, autoCopy, [{
        dataUrl: image.toDataURL(), x: 0, y: 0, width: display.bounds.width, height: display.bounds.height,
        displayId: display.id, label: display.label || 'Monitor', scaleFactor: size.width / display.bounds.width,
        pixelWidth: size.width, pixelHeight: size.height, isPrimary: display.id === screen.getPrimaryDisplay().id, screenSourceId: ''
      }], display.bounds, size.width / display.bounds.width, '', true)
    }
  }

  const displays = screen.getAllDisplays()
  const primaryDisplayId = screen.getPrimaryDisplay().id
  const maxScale = Math.max(...displays.map((display) => display.scaleFactor))
  const thumbnailSize = {
    width: Math.max(...displays.map((display) => Math.round(display.size.width * display.scaleFactor))),
    height: Math.max(...displays.map((display) => Math.round(display.size.height * display.scaleFactor)))
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  })

  if (sources.length === 0) {
    return { ok: false, error: 'Nenhuma tela disponível para captura.' }
  }

  const minX = Math.min(...displays.map((display) => display.bounds.x))
  const minY = Math.min(...displays.map((display) => display.bounds.y))
  const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height))
  const desktopWidth = maxX - minX
  const desktopHeight = maxY - minY

  const primarySource =
    sources.find((candidate) => candidate.display_id === String(primaryDisplayId)) ??
    sources[0]
  const primarySourceId = primarySource?.id ?? sources[0]?.id ?? ''

  const segments = displays.flatMap((display, index) => {
    const source =
      sources.find((candidate) => candidate.display_id === String(display.id)) ??
      (displays.length === 1 ? sources[0] : undefined)
    if (!source || source.thumbnail.isEmpty()) return []
    const area = display.bounds

    return [{
      dataUrl: source.thumbnail.toDataURL(),
      x: area.x - minX,
      y: area.y - minY,
      width: area.width,
      height: area.height,
      displayId: display.id,
      label: display.label || `Monitor ${index + 1}`,
      scaleFactor: display.scaleFactor,
      pixelWidth: source.thumbnail.getSize().width,
      pixelHeight: source.thumbnail.getSize().height,
      isPrimary: display.id === primaryDisplayId,
      screenSourceId: source.id
    }]
  })
  if (!segments.length) return { ok: false, error: 'Não foi possível identificar a tela autorizada. Verifique a permissão de captura do sistema.' }

  return openOverlayWindow(mode, overlay, autoCopy, segments, { x: minX, y: minY, width: desktopWidth, height: desktopHeight }, maxScale, primarySourceId, false)
}

function openOverlayWindow(
  mode: CaptureMode,
  overlay: 'capture' | 'record',
  autoCopy: boolean,
  segments: CaptureSegment[],
  bounds: Electron.Rectangle,
  maxScale: number,
  primarySourceId: string,
  fullscreen: boolean
): CaptureResult {
  const { x: minX, y: minY, width: desktopWidth, height: desktopHeight } = bounds
  const window = new BrowserWindow({
    x: minX,
    y: minY,
    width: desktopWidth,
    height: desktopHeight,
    frame: false,
    fullscreen,
    resizable: false,
    movable: false,
    transparent: overlay === 'record',
    alwaysOnTop: true,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    backgroundColor: overlay === 'record' ? '#00000000' : '#05010a',
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.setMenu(null)
  if (overlay === 'record') {
    window.setContentProtection(true)
  }
  window.setBounds({ x: minX, y: minY, width: desktopWidth, height: desktopHeight })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.webContents.once('did-finish-load', () => {
    window.webContents.send('capture:image', {
      dataUrl: '',
      mode,
      autoCopy,
      segments,
      virtualDesktop: {
        width: desktopWidth,
        height: desktopHeight,
        offsetX: minX,
        offsetY: minY
      },
      display: {
        width: desktopWidth,
        height: desktopHeight,
        scaleFactor: maxScale
      },
      screenSourceId: primarySourceId
    })
  })
  window.on('closed', () => {
    captureWindows = []
    captureWindow = null
  })

  loadRenderer(window, overlay, mode)
  captureWindows = [window]
  captureWindow = window

  return { ok: true }
}

async function beginCapture(mode: CaptureMode = 'region', autoCopy = false): Promise<CaptureResult> {
  return beginOverlay(mode, 'capture', autoCopy)
}

async function beginRecord(mode: RecordMode = 'region'): Promise<CaptureResult> {
  return beginOverlay(mode, 'record')
}

function cropCapture(
  dataUrl: string,
  rect: CaptureRect,
  display?: { width: number; height: number }
): Electron.NativeImage {
  const image = nativeImage.createFromDataURL(dataUrl)
  const imageSize = image.getSize()
  const windowBounds = captureWindow?.getBounds()
  const boundsWidth = display?.width ?? windowBounds?.width ?? imageSize.width
  const boundsHeight = display?.height ?? windowBounds?.height ?? imageSize.height
  const widthRatio = boundsWidth ? imageSize.width / boundsWidth : 1
  const heightRatio = boundsHeight ? imageSize.height / boundsHeight : 1

  const cropRect = {
    x: Math.max(0, Math.round(rect.x * widthRatio)),
    y: Math.max(0, Math.round(rect.y * heightRatio)),
    width: Math.max(1, Math.round(rect.width * widthRatio)),
    height: Math.max(1, Math.round(rect.height * heightRatio))
  }

  return image.crop(cropRect)
}

function imageFromExportPayload(payload: CaptureExportPayload): Electron.NativeImage {
  if (payload.exportedDataUrl) {
    return nativeImage.createFromDataURL(payload.exportedDataUrl)
  }

  return cropCapture(payload.dataUrl, payload.rect, payload.display)
}

function saveDialog(owner: BrowserWindow | null, options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  return owner && !owner.isDestroyed() ? dialog.showSaveDialog(owner, options) : dialog.showSaveDialog(options)
}

function openDialog(owner: BrowserWindow | null, options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  return owner && !owner.isDestroyed() ? dialog.showOpenDialog(owner, options) : dialog.showOpenDialog(options)
}

function closeCaptureWindow(): void {
  captureWindows.forEach((window) => {
    if (!window.isDestroyed()) {
      window.close()
    }
  })

  captureWindows = []
  captureWindow = null
}

function closeCaptureForSender(senderId: number): void {
  if (captureWindows.some((window) => !window.isDestroyed() && window.webContents.id === senderId)) closeCaptureWindow()
}

async function rememberCapture(image: Electron.NativeImage): Promise<void> {
  try { await storeCapture(image) }
  catch (error) { console.error('GCPShot: não foi possível atualizar a biblioteca de capturas.', error) }
}

function registerIpc(): void {
  ipcMain.handle('app:welcome-finish', async (event, view: MainView) => {
    if (event.sender !== mainWindow?.webContents || !['home', 'studio', 'colors'].includes(view)) return
    await writeFile(join(app.getPath('userData'), 'welcome-version.txt'), app.getVersion(), 'utf8')
    showWelcome = false
    if (mainWindow) loadRenderer(mainWindow, false, 'region', view)
  })
  ipcMain.on('colors:toast-open', (event) => {
    if (event.sender !== colorToastWindow?.webContents) return
    closeColorToast()
    if (toastDestination === 'studio') openStudioWindow()
    else if (toastDestination === 'colors') openColorWindow('colors')
    else showMainWindow()
  })
  ipcMain.on('colors:toast-dismiss', (event) => {
    if (event.sender === colorToastWindow?.webContents) closeColorToast()
  })
  ipcMain.handle('colors:get', () => getColorLibrary())
  ipcMain.handle('studio:captures', () => getStoredCaptures())
  ipcMain.handle('studio:remove-capture', (_event, id: string) => removeStoredCapture(id))
  ipcMain.handle('colors:save', (_event, input: unknown) => saveColorLibrary(input))
  ipcMain.handle('colors:pick', () => beginLiveColor())
  ipcMain.handle('colors:copy', (_event, value: string) => {
    if (typeof value === 'string' && value.length < 100000) clipboard.writeText(value)
  })
  ipcMain.handle('colors:import', async () => {
    const options: Electron.OpenDialogOptions = { title: 'Importar paletas', filters: [{ name: 'Paletas JSON', extensions: ['json'] }], properties: ['openFile'] }
    const result = await (mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options))
    if (result.canceled || !result.filePaths[0]) return null
    const incoming = parseLibrary(JSON.parse(await readFile(result.filePaths[0], 'utf8')))
    const current = getColorLibrary()
    return saveColorLibrary({ palettes: [...current.palettes, ...incoming.palettes.map((p) => ({ ...p, id: crypto.randomUUID() }))], history: [...new Set([...current.history, ...incoming.history])] })
  })
  ipcMain.handle('colors:export', async (_event, format: 'json' | 'css') => {
    if (format !== 'json' && format !== 'css') throw new Error('Formato invalido.')
    const options: Electron.SaveDialogOptions = { title: 'Exportar paletas', defaultPath: `GCPShot-Paletas.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] }
    const result = await (mainWindow ? dialog.showSaveDialog(mainWindow, options) : dialog.showSaveDialog(options))
    if (result.canceled || !result.filePath) return false
    const library = getColorLibrary()
    const content = format === 'json' ? JSON.stringify(library, null, 2) : ':root {\n' + library.palettes.flatMap((p, i) => p.colors.map((c, j) => `  --paleta-${i + 1}-cor-${j + 1}: ${c};`)).join('\n') + '\n}\n'
    await writeFile(result.filePath, content, 'utf8')
    return true
  })
  ipcMain.handle('capture:begin', (_event, mode: CaptureMode = 'region', autoCopy = false) => beginCapture(mode, autoCopy === true))
  ipcMain.handle('record:begin', (_event, mode: RecordMode = 'region') => beginRecord(mode))
  ipcMain.handle('record:cancel', () => {
    closeCaptureWindow()
    return { ok: true }
  })
  ipcMain.handle('record:set-passthrough', (_event, enabled: boolean) => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.setIgnoreMouseEvents(enabled, { forward: true })
    }
  })
  ipcMain.handle(
    'record:save',
    async (_event, buffer: ArrayBuffer, meta?: { extension?: string }): Promise<CaptureResult> => {
    const extension = meta?.extension === 'mp4' ? 'mp4' : 'webm'
    const filterName = extension === 'mp4' ? 'Vídeo MP4 (H.264)' : 'Vídeo WebM'
    const { canceled, filePath } = await saveDialog(captureWindow ?? mainWindow, {
      title: 'Salvar gravação',
      defaultPath: `GCPShot-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
      filters: [{ name: filterName, extensions: [extension] }]
    })

    if (canceled || !filePath) {
      return { ok: false, error: 'Salvamento cancelado.' }
    }

    await writeFile(filePath, Buffer.from(buffer))
    notify('Gravação salva', filePath)
    closeCaptureWindow()
    return { ok: true, path: filePath }
  }
  )
  ipcMain.handle('capture:cancel', () => {
    closeCaptureWindow()
  })
  ipcMain.handle(
    'capture:copy',
    async (event, payload: CaptureExportPayload): Promise<CaptureResult> => {
      const senderId = event.sender.id
      const image = imageFromExportPayload(payload)
      if (image.isEmpty()) return { ok: false, error: 'Nao foi possivel compor a captura.' }
      await storeCapture(image)
      clipboard.writeImage(image)
      closeCaptureForSender(senderId)
      showColorToast('', 'studio')
      return { ok: true }
    }
  )
  ipcMain.handle(
    'capture:save',
    async (event, payload: CaptureExportPayload): Promise<CaptureResult> => {
      const senderId = event.sender.id
      try {
        const image = imageFromExportPayload(payload)
        if (image.isEmpty()) return { ok: false, error: 'Não foi possível compor a captura.' }
        const extension = settings.defaultFormat
        const { canceled, filePath } = await saveDialog(captureWindow ?? mainWindow, {
          title: 'Salvar captura',
          defaultPath: `GCPShot-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
          filters: [
            { name: 'Imagem PNG', extensions: ['png'] },
            { name: 'Imagem JPEG', extensions: ['jpeg', 'jpg'] },
            { name: 'PDF', extensions: ['pdf'] }
          ]
        })

        if (canceled || !filePath) return { ok: false, error: 'Salvamento cancelado.' }

        const chosenExtension = extname(filePath).toLowerCase()

        if (chosenExtension === '.pdf') {
          const pdfWindow = new BrowserWindow({ show: false, title: 'Exportar PDF - GCPShot', icon: getAppIcon(), webPreferences: { sandbox: true } })
          const html = encodeURIComponent(`
          <!doctype html>
          <html>
            <body style="margin:0;display:grid;place-items:center;min-height:100vh;">
              <img src="${image.toDataURL()}" style="max-width:100%;max-height:100vh;" />
            </body>
          </html>
        `)

          try {
            await pdfWindow.loadURL(`data:text/html;charset=utf-8,${html}`)
            await writeFile(filePath, await pdfWindow.webContents.printToPDF({ printBackground: true }))
          } finally { if (!pdfWindow.isDestroyed()) pdfWindow.destroy() }
        } else {
          await writeFile(filePath, chosenExtension === '.png' ? image.toPNG() : image.toJPEG(92))
        }
        await rememberCapture(image)
        closeCaptureForSender(senderId)
        notify('Captura salva', filePath, 'studio')
        return { ok: true, path: filePath }
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível salvar a captura.' } }
    }
  )
  ipcMain.handle('capture:print', async (event, payload: CaptureExportPayload): Promise<CaptureResult> => {
    const senderId = event.sender.id
    const image = imageFromExportPayload(payload)
    if (image.isEmpty()) return { ok: false, error: 'Não foi possível compor a captura.' }
    const printWindow = new BrowserWindow({
      width: 760,
      height: 560,
      show: false,
      title: 'Imprimir captura - GCPShot',
      skipTaskbar: true,
      parent: captureWindow ?? mainWindow ?? undefined,
      modal: false,
      alwaysOnTop: true,
      icon: getAppIcon(),
      webPreferences: {
        sandbox: true
      }
    })
    const html = encodeURIComponent(`
      <!doctype html>
      <html>
        <body style="margin:0;display:grid;place-items:center;min-height:100vh;">
          <img src="${image.toDataURL()}" style="max-width:100%;max-height:100vh;" />
        </body>
      </html>
    `)

    try { await printWindow.loadURL(`data:text/html;charset=utf-8,${html}`) }
    catch (error) {
      if (!printWindow.isDestroyed()) printWindow.destroy()
      return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível abrir a impressão.' }
    }
    printWindow.show()
    printWindow.setAlwaysOnTop(true, 'screen-saver')
    printWindow.moveTop()
    printWindow.focus()

    return new Promise((resolve) => {
      let settled = false
      const complete = (success: boolean, reason?: string): void => {
        if (settled) return
        settled = true
        if (!printWindow.isDestroyed()) printWindow.destroy()
        if (!success) { resolve({ ok: false, error: reason || 'Impressão cancelada.' }); return }
        void rememberCapture(image).then(() => {
          closeCaptureForSender(senderId)
          notify('Captura enviada para impressão', 'A imagem foi enviada para a fila de impressão.', 'studio')
          resolve({ ok: true })
        })
      }
      printWindow.once('closed', () => complete(false, 'Impressão cancelada.'))
      setTimeout(() => {
        if (settled || printWindow.isDestroyed()) return
        try { printWindow.webContents.print({}, complete) }
        catch (error) { complete(false, error instanceof Error ? error.message : 'Falha na impressão.') }
      }, 250)
    })
  })
  ipcMain.handle('capture:share-whatsapp', async (event, payload: CaptureExportPayload): Promise<CaptureResult> => {
    const senderId = event.sender.id
    try {
      const image = imageFromExportPayload(payload)
      if (image.isEmpty()) return { ok: false, error: 'Não foi possível compor a captura.' }
      clipboard.writeImage(image)
      await shell.openExternal('https://web.whatsapp.com/')
      await rememberCapture(image)
      closeCaptureForSender(senderId)
      notify('Pronta para o WhatsApp', `Imagem copiada. Cole a captura no WhatsApp Web com ${process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V'}.`, 'studio')

      return { ok: true }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível abrir o WhatsApp Web.' } }
  })
  ipcMain.handle('updates:status', () => getUpdateStatus())
  ipcMain.handle('updates:check', () => runUpdateCheck(false))
  ipcMain.handle('updates:install', () => installUpdateAndQuit())
  ipcMain.handle('updates:open-release', () => {
    const url = getUpdateStatus().releaseUrl
    if (url?.startsWith('https://github.com/')) void shell.openExternal(url)
  })
  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:shortcut-info', () => shortcutInfo())
  ipcMain.handle('settings:shortcut-editing', (event, enabled: boolean) => {
    const id = event.sender.id
    if (enabled) {
      if (!shortcutEditorOwners.has(id)) {
        shortcutEditorOwners.add(id)
        event.sender.once('destroyed', () => { shortcutEditors.delete(id); shortcutEditorOwners.delete(id); if (!isQuitting && shortcutEditors.size === 0) registerShortcuts(settings, true) })
      }
      shortcutEditors.add(id)
      globalShortcut.unregisterAll()
    } else {
      shortcutEditors.delete(id)
      if (shortcutEditors.size === 0) registerShortcuts(settings, true)
    }
  })
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>): Promise<AppSettings> => {
    return updateSettings(patch)
  })
  ipcMain.handle('settings:reset', async (): Promise<AppSettings> => {
    const defaults = { ...defaultSettings }
    for (const key of globalShortcutKeys) defaults[key] = firstFreeShortcut(key, defaults)
    return updateSettings(defaults)
  })
  ipcMain.handle('window:show-main', () => {
    showMainWindow()
  })
  ipcMain.handle('window:open-settings', () => {
    openSettingsWindow()
  })
  ipcMain.handle('window:open-studio', () => {
    openStudioWindow()
  })
  ipcMain.handle('studio:pick-images', async (): Promise<{ ok: boolean; files: Array<{ name: string; dataUrl: string; width: number; height: number }>; error?: string }> => {
    const { canceled, filePaths } = await openDialog(mainWindow, {
      title: 'Importar imagens para o estúdio',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })

    if (canceled || !filePaths.length) {
      return { ok: false, files: [], error: 'Importação cancelada.' }
    }

    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const buffer = await readFile(filePath)
        const extension = extname(filePath).toLowerCase()
        const mime =
          extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
        const image = nativeImage.createFromPath(filePath)
        const size = image.getSize()

        return {
          name: basename(filePath),
          dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
          width: size.width,
          height: size.height
        }
      })
    )

    return { ok: true, files }
  })
  ipcMain.handle('studio:export-image', async (_event, dataUrl: string): Promise<CaptureResult> => {
    const { canceled, filePath } = await saveDialog(mainWindow, {
      title: 'Exportar imagem do estúdio',
      defaultPath: `GCPShot-Studio-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      filters: [{ name: 'Imagem PNG', extensions: ['png'] }]
    })

    if (canceled || !filePath) {
      return { ok: false, error: 'Exportação cancelada.' }
    }

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    notify('Estúdio GCPShot', 'Imagem exportada com sucesso.')
    return { ok: true, path: filePath }
  })
  ipcMain.handle('studio:pick-videos', async (): Promise<{ ok: boolean; files: Array<{ name: string; dataUrl: string; mimeType: string }>; error?: string }> => {
    const { canceled, filePaths } = await openDialog(mainWindow, {
      title: 'Importar videos para o estudio',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv'] }]
    })

    if (canceled || !filePaths.length) {
      return { ok: false, files: [], error: 'Importacao cancelada.' }
    }

    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const buffer = await readFile(filePath)
        const extension = extname(filePath).toLowerCase()
        const mime =
          extension === '.webm'
            ? 'video/webm'
            : extension === '.mov'
              ? 'video/quicktime'
              : extension === '.mkv'
                ? 'video/x-matroska'
                : 'video/mp4'

        return {
          name: basename(filePath),
          dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
          mimeType: mime
        }
      })
    )

    return { ok: true, files }
  })
  ipcMain.handle('studio:export-video-project', async (_event, project: string): Promise<CaptureResult> => {
    const { canceled, filePath } = await saveDialog(mainWindow, {
      title: 'Exportar projeto de video',
      defaultPath: `GCPShot-Video-Studio-${new Date().toISOString().replace(/[:.]/g, '-')}.gcpshot-video.json`,
      filters: [{ name: 'Projeto de video GCPShot', extensions: ['json'] }]
    })

    if (canceled || !filePath) {
      return { ok: false, error: 'Exportacao cancelada.' }
    }

    await writeFile(filePath, project, 'utf8')
    notify('Estudio GCPShot', 'Projeto de video exportado.')
    return { ok: true, path: filePath }
  })
}

function registerShortcuts(next = settings, recover = true): void {
  globalShortcut.unregisterAll()
  const handlers = {
    captureShortcut: () => { void beginCapture('region') }, fullscreenShortcut: () => { void beginCapture('fullscreen') },
    studioShortcut: openStudioWindow, liveColorShortcut: () => { void beginLiveColor().then((result) => { if (result.error) notify('Live Color', result.error) }) }
  }
  const used = new Set<string>()
  const issues: string[] = []
  try {
    for (const key of globalShortcutKeys) {
      const requested = canonicalShortcut(next[key])
      if (!recover && reservedByDesktop(requested)) throw new Error(`${requested} ja e usado pelo ${desktopShortcuts.label || 'sistema'}. Escolha uma das sugestoes disponiveis.`)
      const options = recover ? [requested, ...availableCandidates(key)].filter((value) => !reservedByDesktop(value)) : [requested]
      let chosen = ''
      for (const value of [...new Set(options)]) {
        const identity = shortcutIdentity(value, process.platform)
        if (!validGlobalShortcut(value) || used.has(identity)) continue
        try { if (globalShortcut.register(value, handlers[key])) { chosen = value; used.add(identity); break } } catch { /* Invalid or reserved by the desktop. */ }
      }
      if (!chosen) {
        const error = `${key}: ${requested} indisponivel ou em conflito. Escolha uma sugestao nas configuracoes.`
        if (!recover) throw new Error(error)
        issues.push(error)
      } else {
        if (chosen !== requested) issues.push(`${requested} indisponivel; usando ${chosen}.`)
        next[key] = chosen
      }
    }
    if (next.printScreenShortcut) {
      let registered = false
      if (reservedByDesktop('PrintScreen')) issues.push(`Print Screen ja abre a ferramenta de captura do ${desktopShortcuts.label || 'sistema'}; use o atalho de captura do GCPShot.`)
      else {
        try { registered = globalShortcut.register('PrintScreen', () => void beginCapture('region', true)) } catch { /* Reserved by the system. */ }
        if (!registered) issues.push('Print Screen esta reservado pelo sistema; use o atalho de captura.')
      }
    }
    shortcutIssues = issues
  } finally {
    if (shortcutEditors.size) globalShortcut.unregisterAll()
  }
}

async function shortcutInfo(): Promise<ShortcutInfo> {
  if (process.platform === 'linux') desktopShortcuts = await readDesktopShortcuts().catch(() => desktopShortcuts)
  const suggestions = {} as ShortcutInfo['suggestions']
  // Wayland portal registration is asynchronous and consent-gated: never probe it, rely on the desktop's own config.
  const portal = isWaylandSession
  for (const key of globalShortcutKeys) {
    suggestions[key] = availableCandidates(key).filter((value) => {
      if (globalShortcutKeys.some((other) => other !== key && shortcutIdentity(settings[other], process.platform) === shortcutIdentity(value, process.platform))) return false
      if (portal || globalShortcut.isRegistered(value)) return true
      try {
        if (!globalShortcut.register(value, () => {})) return false
        globalShortcut.unregister(value)
        return true
      } catch { return false }
    })
  }
  const session = isWaylandSession ? 'Wayland' : 'X11'
  const platform = process.platform === 'darwin' ? `macOS ${process.arch === 'arm64' ? 'Apple Silicon' : 'Intel'}` : process.platform === 'win32' ? 'Windows' : `Linux (${desktopShortcuts.label ? `${desktopShortcuts.label}, ` : ''}${session})`
  return { platform, desktop: desktopShortcuts.label, suggestions, issues: shortcutIssues, portal, reservedCount: desktopShortcuts.reserved.size }
}

function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const operation = settingsQueue.then(async () => {
    const previous = { ...settings }
    const next = normalizeSettingsShortcuts({ ...settings, ...patch })
    const changed = globalShortcutKeys.some((key) => next[key] !== previous[key]) || next.printScreenShortcut !== previous.printScreenShortcut
    try {
      if (changed) registerShortcuts(next, false)
      await saveSettings(next)
      settings = next
    } catch (error) {
      if (changed) registerShortcuts(previous, true)
      throw error
    }
    if (next.startWithWindows !== previous.startWithWindows) applyLoginItemSettings()
    createTray()
    return settings
  })
  settingsQueue = operation.catch(() => {})
  return operation
}

async function runUpdateCheck(interactive: boolean): Promise<UpdateStatus> {
  const result = await checkForUpdates(settings.includePrereleases)
  if (result.lastCheck && result.lastCheck !== settings.lastUpdateCheck) void updateSettings({ lastUpdateCheck: result.lastCheck }).catch(() => {})
  if (result.state === 'available') void promptUpdate(result)
  else if (interactive) notify('Atualizações', result.message || 'Verificação concluída.')
  return result
}

let updatePromptOpen = false
async function promptUpdate(update: UpdateStatus): Promise<void> {
  if (updatePromptOpen) return
  updatePromptOpen = true
  try {
    const options: Electron.MessageBoxOptions = {
      type: 'info', title: 'Atualização do GCPShot', icon: getAppIcon(), noLink: true,
      message: `GCPShot ${update.latestVersion}${update.prerelease ? ' (desenvolvimento)' : ''} está disponível`,
      detail: `Versão instalada: ${update.currentVersion}.\n\n${(update.notes || '').replace(/[#*`>]/g, '').trim().slice(0, 900)}`,
      buttons: ['Atualizar agora', 'Ver novidades', 'Depois'], defaultId: 0, cancelId: 2
    }
    const parent = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? mainWindow : undefined
    const { response } = await (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options))
    if (response === 0) await installUpdateAndQuit().catch((error) => notify('Atualização', error instanceof Error ? error.message : 'Falha ao atualizar.'))
    else if (response === 1 && update.releaseUrl) void shell.openExternal(update.releaseUrl)
  } finally { updatePromptOpen = false }
}

async function installUpdateAndQuit(): Promise<void> {
  if (await downloadAndInstall()) {
    isQuitting = true
    setTimeout(() => app.quit(), 400)
  }
}

function scheduleAutomaticUpdateCheck(): void {
  if (isDev || process.env.GCPSHOT_DISABLE_UPDATES === '1') return
  const last = Date.parse(settings.lastUpdateCheck || '') || 0
  const due = settings.updateCheckMode === 'startup' || (settings.updateCheckMode === 'daily' && Date.now() - last > 24 * 3600_000)
  if (due) setTimeout(() => void runUpdateCheck(false), 6000)
  if (settings.updateCheckMode !== 'manual') setInterval(() => {
    const previous = Date.parse(settings.lastUpdateCheck || '') || 0
    if (settings.updateCheckMode !== 'manual' && Date.now() - previous > 24 * 3600_000) void runUpdateCheck(false)
  }, 3600_000)
}

app.whenReady().then(async () => {
  if (!ownsInstance) return
  if (process.platform === 'darwin') app.dock?.setIcon(getAppIcon())
  if (process.platform === 'linux') desktopShortcuts = await readDesktopShortcuts().catch(() => desktopShortcuts)
  settings = await loadSettings()
  registerShortcuts(settings, true)
  await saveSettings(settings).catch((error) => console.error('GCPShot: nao foi possivel persistir os atalhos iniciais.', error))
  showWelcome = await readFile(join(app.getPath('userData'), 'welcome-version.txt'), 'utf8').then((version) => version !== app.getVersion()).catch(() => true)
  await loadColorLibrary()

  applyLoginItemSettings()
  setLastCheck(settings.lastUpdateCheck)
  onUpdateStatus((next) => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('updates:status', next)
  })
  if (process.platform === 'linux') authorizeKwinScreenshots()
  registerIpc()
  createTray()
  scheduleAutomaticUpdateCheck()
  nativeTheme.on('updated', createTray)

  if (!shouldStartHidden()) {
    createMainWindow(process.platform === 'linux' && process.argv.includes('--color-lab') ? 'colors' : 'home')
  }

  startupComplete = true
  if (process.platform === 'linux' && process.argv.includes('--live-color')) handleLinuxLaunch(process.argv)
  if (pendingLaunchArgs) { handleLinuxLaunch(pendingLaunchArgs); pendingLaunchArgs = null }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  colorPickerProcess?.kill()
  if (liveColorWindow && !liveColorWindow.isDestroyed()) liveColorWindow.destroy()
  closeColorToast()
  tray?.destroy()
  tray = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
