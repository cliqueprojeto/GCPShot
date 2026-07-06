import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell
} from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import type { AppSettings, CaptureExportPayload, CaptureMode, CaptureRect, CaptureResult, RecordMode } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let captureWindows: BrowserWindow[] = []
let tray: Tray | null = null
let settings: AppSettings
let isQuitting = false

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')
const defaultSettings = defaultAppSettings

const shortcutKeys: Array<keyof AppSettings> = [
  'captureShortcut',
  'fullscreenShortcut',
  'studioShortcut',
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
      ;(nextSettings as Record<string, string>)[key] = normalizeAccelerator(value)
    }
  })

  return nextSettings
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const file = await readFile(settingsPath(), 'utf8')
    return normalizeSettingsShortcuts({ ...defaultSettings, ...JSON.parse(file) })
  } catch {
    return defaultSettings
  }
}

function normalizeAccelerator(accelerator: string): string {
  return accelerator.replace(/\bControl\b/g, 'Ctrl')
}

async function saveSettings(nextSettings: AppSettings): Promise<void> {
  await writeFile(settingsPath(), JSON.stringify(nextSettings, null, 2))
}

function applyLoginItemSettings(): void {
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

function notify(title: string, body: string): void {
  if (!settings.showNotifications || !Notification.isSupported()) {
    return
  }

  new Notification({ title, body }).show()
}

function getAppIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(join(__dirname, '../../build/icon.ico'))

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

function loadRenderer(
  window: BrowserWindow,
  overlay: 'capture' | 'record' | false = false,
  mode: CaptureMode = 'region'
): void {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)

    if (overlay) {
      url.searchParams.set(overlay === 'record' ? 'record' : 'capture', '1')
      url.searchParams.set('mode', mode)
    }

    window.loadURL(url.toString())
    return
  }

  window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: overlay ? { [overlay === 'record' ? 'record' : 'capture']: '1', mode } : undefined
  })
}

function createMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
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
  loadRenderer(mainWindow)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://www.gestaoculturalpro.com.br')) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://www.gestaoculturalpro.com.br')) {
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

function createTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }

  let icon = getAppIcon()

  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII='
    )
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('GCPShot')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Capturar região', click: () => void beginCapture('region') },
      { label: 'Capturar tela inteira', click: () => void beginCapture('fullscreen') },
      { label: 'Abrir GCPShot', click: showMainWindow },
      { type: 'separator' },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: settings.startWithWindows,
        click: (item) => {
          void updateSettings({ startWithWindows: item.checked })
        }
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showMainWindow)
}

function cropThumbnailToWorkArea(thumbnail: Electron.NativeImage, display: Electron.Display): Electron.NativeImage {
  const imageSize = thumbnail.getSize()
  const bounds = display.bounds
  const workArea = display.workArea
  const scaleX = imageSize.width / bounds.width
  const scaleY = imageSize.height / bounds.height

  const cropRect = {
    x: Math.max(0, Math.round((workArea.x - bounds.x) * scaleX)),
    y: Math.max(0, Math.round((workArea.y - bounds.y) * scaleY)),
    width: Math.max(1, Math.round(workArea.width * scaleX)),
    height: Math.max(1, Math.round(workArea.height * scaleY))
  }

  return thumbnail.crop(cropRect)
}

async function beginOverlay(mode: CaptureMode, overlay: 'capture' | 'record'): Promise<CaptureResult> {
  if (captureWindows.length > 0) {
    captureWindows[0]?.focus()
    return { ok: true }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
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

  const minX = Math.min(...displays.map((display) => display.workArea.x))
  const minY = Math.min(...displays.map((display) => display.workArea.y))
  const maxX = Math.max(...displays.map((display) => display.workArea.x + display.workArea.width))
  const maxY = Math.max(...displays.map((display) => display.workArea.y + display.workArea.height))
  const desktopWidth = maxX - minX
  const desktopHeight = maxY - minY

  const primarySource =
    sources.find((candidate) => candidate.display_id === String(primaryDisplayId)) ??
    sources[0]
  const primarySourceId = primarySource?.id ?? sources[0]?.id ?? ''

  const segments = displays.map((display, index) => {
    const source =
      sources.find((candidate) => candidate.display_id === String(display.id)) ??
      sources[index] ??
      sources[0]
    const cropped = cropThumbnailToWorkArea(source.thumbnail, display)
    const area = display.workArea

    return {
      dataUrl: cropped.toDataURL(),
      x: area.x - minX,
      y: area.y - minY,
      width: area.width,
      height: area.height,
      displayId: display.id,
      isPrimary: display.id === primaryDisplayId,
      screenSourceId: source.id
    }
  })

  const window = new BrowserWindow({
    x: minX,
    y: minY,
    width: desktopWidth,
    height: desktopHeight,
    frame: false,
    fullscreen: false,
    resizable: false,
    movable: false,
    transparent: overlay === 'record',
    alwaysOnTop: true,
    skipTaskbar: true,
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

async function beginCapture(mode: CaptureMode = 'region'): Promise<CaptureResult> {
  return beginOverlay(mode, 'capture')
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

function closeCaptureWindow(): void {
  captureWindows.forEach((window) => {
    if (!window.isDestroyed()) {
      window.close()
    }
  })

  captureWindows = []
  captureWindow = null

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
  }
}

function registerIpc(): void {
  ipcMain.handle('capture:begin', (_event, mode: CaptureMode = 'region') => beginCapture(mode))
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
    const { canceled, filePath } = await dialog.showSaveDialog(captureWindow ?? mainWindow ?? undefined, {
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
    (_event, payload: CaptureExportPayload): CaptureResult => {
      const image = imageFromExportPayload(payload)
      clipboard.writeImage(image)
      notify('Captura copiada', 'A imagem está na área de transferência.')
      if (!settings.keepSelectionAfterAction) {
        closeCaptureWindow()
      }
      return { ok: true }
    }
  )
  ipcMain.handle(
    'capture:save',
    async (_event, payload: CaptureExportPayload): Promise<CaptureResult> => {
      const image = imageFromExportPayload(payload)
      const extension = settings.defaultFormat
      const { canceled, filePath } = await dialog.showSaveDialog(captureWindow ?? mainWindow ?? undefined, {
        title: 'Salvar captura',
        defaultPath: `GCPShot-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
        filters: [
          { name: 'Imagem PNG', extensions: ['png'] },
          { name: 'Imagem JPEG', extensions: ['jpeg', 'jpg'] },
          { name: 'PDF', extensions: ['pdf'] }
        ]
      })

      if (canceled || !filePath) {
        return { ok: false, error: 'Salvamento cancelado.' }
      }

      const chosenExtension = extname(filePath).toLowerCase()

      if (chosenExtension === '.pdf') {
        const pdfWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
        const html = encodeURIComponent(`
          <!doctype html>
          <html>
            <body style="margin:0;display:grid;place-items:center;min-height:100vh;">
              <img src="${image.toDataURL()}" style="max-width:100%;max-height:100vh;" />
            </body>
          </html>
        `)

        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${html}`)
        await writeFile(filePath, await pdfWindow.webContents.printToPDF({ printBackground: true }))
        pdfWindow.close()
      } else {
        await writeFile(filePath, chosenExtension === '.png' ? image.toPNG() : image.toJPEG(92))
      }
      notify('Captura salva', filePath)
      if (!settings.keepSelectionAfterAction) {
        closeCaptureWindow()
      }
      return { ok: true, path: filePath }
    }
  )
  ipcMain.handle('capture:print', async (_event, payload: CaptureExportPayload): Promise<CaptureResult> => {
    const image = imageFromExportPayload(payload)
    const printWindow = new BrowserWindow({
      width: 760,
      height: 560,
      show: false,
      title: 'Imprimir captura - GCPShot',
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

    await printWindow.loadURL(`data:text/html;charset=utf-8,${html}`)
    printWindow.show()
    printWindow.setAlwaysOnTop(true, 'screen-saver')
    printWindow.moveTop()
    printWindow.focus()

    return new Promise((resolve) => {
      setTimeout(() => {
        printWindow.webContents.print({}, (success, failureReason) => {
        printWindow.close()
        if (success) {
          notify('Captura enviada para impressão', 'O diálogo de impressão foi aberto.')
          if (!settings.keepSelectionAfterAction) {
            closeCaptureWindow()
          }
          resolve({ ok: true })
          return
        }

        resolve({ ok: false, error: failureReason })
      })
      }, 250)
    })
  })
  ipcMain.handle('capture:share-whatsapp', async (_event, payload: CaptureExportPayload): Promise<CaptureResult> => {
    const image = imageFromExportPayload(payload)
    clipboard.writeImage(image)
    await shell.openExternal('https://web.whatsapp.com/')
    notify('Imagem copiada', 'O WhatsApp Web foi aberto. Cole a captura com Ctrl+V.')

    return { ok: true }
  })
  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>): Promise<AppSettings> => {
    return updateSettings(patch)
  })
  ipcMain.handle('settings:reset', async (): Promise<AppSettings> => {
    settings = { ...defaultSettings }
    await saveSettings(settings)
    applyLoginItemSettings()
    registerShortcuts()
    createTray()
    return settings
  })
  ipcMain.handle('window:show-main', () => {
    showMainWindow()
  })
  ipcMain.handle('window:open-settings', () => {
    openSettingsWindow()
  })
  ipcMain.handle('studio:pick-images', async (): Promise<{ ok: boolean; files: Array<{ name: string; dataUrl: string; width: number; height: number }>; error?: string }> => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow ?? undefined, {
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
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
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
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow ?? undefined, {
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
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
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

function registerShortcuts(): void {
  globalShortcut.unregisterAll()

  const startRegion = (): void => {
    void beginCapture('region')
  }

  const startFullscreen = (): void => {
    void beginCapture('fullscreen')
  }

  globalShortcut.register(settings.captureShortcut, startRegion)
  globalShortcut.register(settings.fullscreenShortcut, startFullscreen)

  if (settings.printScreenShortcut) {
    globalShortcut.register('PrintScreen', start)
  }
}

async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  settings = normalizeSettingsShortcuts({ ...settings, ...patch })
  await saveSettings(settings)
  applyLoginItemSettings()
  registerShortcuts()
  createTray()

  return settings
}

app.whenReady().then(async () => {
  settings = await loadSettings()

  if (process.platform === 'win32') {
    app.setAppUserModelId('br.com.gestaoculturalpro.gcpshot')
  }

  applyLoginItemSettings()
  registerIpc()
  createTray()

  if (!shouldStartHidden()) {
    createMainWindow()
  }

  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
