import { app, net, shell } from 'electron'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { UPDATE_REPOSITORY, compareVersions, isPrereleaseVersion, matchUpdateAsset, parseReleaseFeedTags, type LinuxPackageKind, type UpdateManifest, type UpdateStatus } from '../shared/updates'

type GithubAsset = { name: string; size: number; browser_download_url: string }
type GithubRelease = { tag_name: string; name: string | null; body: string | null; draft: boolean; prerelease: boolean; html_url: string; published_at: string | null; assets: GithubAsset[] }
type Candidate = { version: string; tag: string; name: string; notes: string; prerelease: boolean; publishedAt?: string; releaseUrl: string; asset: { name: string; size: number; url: string; sha256?: string } }

let status: UpdateStatus = { state: 'idle', currentVersion: app.getVersion(), repository: UPDATE_REPOSITORY }
let candidate: Candidate | null = null
let downloadedFile: string | null = null
let listener: (next: UpdateStatus) => void = () => {}
let checking: Promise<UpdateStatus> | null = null

function publish(patch: Partial<UpdateStatus>): UpdateStatus {
  status = { ...status, ...patch, currentVersion: app.getVersion(), repository: UPDATE_REPOSITORY }
  listener(status)
  return status
}

export function onUpdateStatus(callback: (next: UpdateStatus) => void): void { listener = callback }
export function getUpdateStatus(): UpdateStatus { return status }
export function setLastCheck(iso: string | undefined): void { if (iso) status = { ...status, lastCheck: iso } }

function run(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => execFile(command, args, { timeout: 4000 }, (error) => resolve(!error)))
}

let linuxPackage: Promise<LinuxPackageKind> | null = null
export function detectLinuxPackage(): Promise<LinuxPackageKind> {
  linuxPackage ??= (async () => {
    if (await run('pacman', ['-Qq', 'gcpshot'])) return 'pacman'
    if (await run('dpkg-query', ['-W', 'gcpshot'])) return 'deb'
    if (await run('rpm', ['-q', 'gcpshot'])) return 'rpm'
    if (existsSync('/etc/arch-release')) return 'pacman'
    if (existsSync('/etc/fedora-release') || existsSync('/etc/redhat-release') || existsSync('/etc/SUSE-brand')) return 'rpm'
    return 'deb'
  })()
  return linuxPackage
}

const headers = { 'User-Agent': 'GCPShot-Updater' }
const releaseUrl = (tag: string): string => `https://github.com/${UPDATE_REPOSITORY}/releases/tag/${encodeURIComponent(tag)}`

/** Primary channel: the public Atom feed plus each release's manifest. Neither counts against the GitHub API limit. */
async function candidatesFromFeed(includePrereleases: boolean, pkg: LinuxPackageKind | undefined): Promise<Candidate | null> {
  const feed = await net.fetch(`https://github.com/${UPDATE_REPOSITORY}/releases.atom`, { headers: { ...headers, Accept: 'application/atom+xml' } })
  if (!feed.ok) throw new Error(`HTTP ${feed.status}`)
  const tags = parseReleaseFeedTags(await feed.text(), UPDATE_REPOSITORY)
    .filter((tag) => compareVersions(tag, app.getVersion()) > 0 && (includePrereleases || !isPrereleaseVersion(tag)))
    .sort((a, b) => compareVersions(b, a))
    .slice(0, 5)
  for (const tag of tags) {
    const response = await net.fetch(`https://github.com/${UPDATE_REPOSITORY}/releases/download/${encodeURIComponent(tag)}/update-manifest.json`, { headers })
    if (!response.ok) continue
    const manifest = (await response.json()) as UpdateManifest
    if (!includePrereleases && manifest.prerelease) continue
    const name = matchUpdateAsset(manifest.assets.map((asset) => asset.name), process.platform, process.arch, pkg)
    const asset = manifest.assets.find((item) => item.name === name)
    if (!asset) continue
    return {
      version: manifest.version || tag.replace(/^v/, ''), tag, name: `GCPShot ${manifest.version || tag}`, notes: manifest.notes || '',
      prerelease: manifest.prerelease, publishedAt: manifest.publishedAt, releaseUrl: releaseUrl(tag),
      asset: { name: asset.name, size: asset.size, sha256: asset.sha256, url: `https://github.com/${UPDATE_REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}` }
    }
  }
  return null
}

/** Fallback channel: the REST API (limited to 60 anonymous requests per hour per network). */
async function candidatesFromApi(includePrereleases: boolean, pkg: LinuxPackageKind | undefined): Promise<Candidate | null> {
  const response = await net.fetch(`https://api.github.com/repos/${UPDATE_REPOSITORY}/releases?per_page=20`, {
    headers: { ...headers, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  })
  if (response.status === 403 || response.status === 429) throw new Error('O GitHub limitou as consultas por alguns minutos. Tente novamente mais tarde.')
  if (!response.ok) throw new Error(`O canal público de atualizações não está disponível agora (HTTP ${response.status}). Tente novamente mais tarde.`)
  const releases = (await response.json()) as GithubRelease[]
  return releases
    .filter((release) => !release.draft && (includePrereleases || !release.prerelease))
    .map((release): Candidate | null => {
      const name = matchUpdateAsset(release.assets.map((asset) => asset.name), process.platform, process.arch, pkg)
      const asset = release.assets.find((item) => item.name === name)
      const version = release.tag_name.replace(/^v/, '')
      return asset && compareVersions(version, app.getVersion()) > 0
        ? { version, tag: release.tag_name, name: release.name || `GCPShot ${version}`, notes: release.body || '', prerelease: release.prerelease, publishedAt: release.published_at || undefined, releaseUrl: release.html_url, asset: { name: asset.name, size: asset.size, url: asset.browser_download_url } }
        : null
    })
    .filter((item): item is Candidate => item !== null)
    .sort((a, b) => compareVersions(b.version, a.version))[0] ?? null
}

export function checkForUpdates(includePrereleases: boolean): Promise<UpdateStatus> {
  if (status.state === 'downloading' || status.state === 'installing') return Promise.resolve(status)
  checking ??= (async () => {
    publish({ state: 'checking', message: 'Procurando novas versões no GitHub…', progress: undefined })
    try {
      const pkg = process.platform === 'linux' ? await detectLinuxPackage() : undefined
      let best: Candidate | null
      try { best = await candidatesFromFeed(includePrereleases, pkg) }
      catch { best = await candidatesFromApi(includePrereleases, pkg) }
      const lastCheck = new Date().toISOString()
      candidate = best
      if (!best) return publish({ state: 'none', latestVersion: undefined, notes: undefined, assetName: undefined, releaseUrl: undefined, message: `Você já está na versão mais recente (${app.getVersion()}).`, lastCheck })
      return publish({
        state: 'available', lastCheck, latestVersion: best.version, releaseName: best.name, releaseUrl: best.releaseUrl,
        notes: best.notes, prerelease: best.prerelease, publishedAt: best.publishedAt, assetName: best.asset.name, assetSize: best.asset.size,
        message: `Nova versão ${best.version}${best.prerelease ? ' (desenvolvimento)' : ''} disponível.`
      })
    } catch (error) {
      return publish({ state: 'error', message: error instanceof Error ? error.message : 'Não foi possível verificar atualizações.', lastCheck: new Date().toISOString() })
    } finally { checking = null }
  })()
  return checking
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

async function download(target: Candidate): Promise<string> {
  const directory = join(app.getPath('temp'), 'gcpshot-update')
  await mkdir(directory, { recursive: true })
  const file = join(directory, target.asset.name)
  const response = await net.fetch(target.asset.url, { headers })
  if (!response.ok || !response.body) throw new Error(`Falha ao baixar a atualização (HTTP ${response.status}).`)
  const total = Number(response.headers.get('content-length')) || target.asset.size
  const output = createWriteStream(file)
  const reader = response.body.getReader()
  let received = 0, lastReport = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (!output.write(Buffer.from(value))) await new Promise((resolve) => output.once('drain', resolve))
      const progress = total ? Math.min(1, received / total) : 0
      if (progress - lastReport >= 0.01) { lastReport = progress; publish({ state: 'downloading', progress, message: `Baixando ${Math.round(progress * 100)}%…` }) }
    }
    await new Promise<void>((resolve, reject) => output.end((error?: Error | null) => (error ? reject(error) : resolve())))
  } catch (error) {
    output.destroy()
    await rm(file, { force: true })
    throw error
  }
  if (target.asset.size && received !== target.asset.size) { await rm(file, { force: true }); throw new Error('O download da atualização ficou incompleto. Tente novamente.') }
  if (target.asset.sha256 && (await sha256(file)) !== target.asset.sha256.toLowerCase()) { await rm(file, { force: true }); throw new Error('O arquivo baixado não confere com a assinatura SHA-256 da release. A instalação foi cancelada por segurança.') }
  return file
}

function privileged(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pkexec', [command, ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    let error = ''
    child.stderr?.on('data', (chunk: Buffer) => { error = (error + chunk.toString()).slice(-2000) })
    child.once('error', reject)
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(code === 126 || code === 127 ? 'Instalação cancelada ou sem permissão de administrador.' : error.trim() || `Instalador terminou com código ${code}.`))))
  })
}

async function installLinux(file: string): Promise<void> {
  const kind = await detectLinuxPackage()
  if (kind === 'pacman') return privileged('pacman', ['-U', '--noconfirm', file])
  if (kind === 'rpm') {
    if (await run('which', ['dnf'])) return privileged('dnf', ['install', '-y', file])
    if (await run('which', ['zypper'])) return privileged('zypper', ['--non-interactive', '--no-gpg-checks', 'install', file])
    return privileged('rpm', ['-U', '--replacepkgs', file])
  }
  if (await run('which', ['apt-get'])) return privileged('apt-get', ['install', '-y', '--allow-downgrades', file])
  return privileged('dpkg', ['-i', file])
}

/** Downloads the selected release asset and starts the platform installer. Resolves `true` when the app should quit. */
export async function downloadAndInstall(): Promise<boolean> {
  if (!candidate) throw new Error('Nenhuma atualização selecionada. Clique em "Verificar agora".')
  if (status.state === 'downloading' || status.state === 'installing') return false
  try {
    publish({ state: 'downloading', progress: 0, message: 'Iniciando download…' })
    downloadedFile = await download(candidate)
    publish({ state: 'installing', progress: 1, message: 'Instalando a nova versão…' })
    if (process.platform === 'win32') {
      spawn(downloadedFile, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref()
      return true
    }
    if (process.platform === 'darwin') {
      await shell.openPath(downloadedFile)
      publish({ state: 'ready', message: 'Arraste o GCPShot para a pasta Aplicativos e substitua a versão anterior. Depois reabra o app.' })
      return false
    }
    try {
      await installLinux(downloadedFile)
    } catch (error) {
      shell.showItemInFolder(downloadedFile)
      throw new Error(`${error instanceof Error ? error.message : 'Falha na instalação.'} O pacote foi salvo para instalação manual.`)
    }
    publish({ state: 'ready', message: 'Atualização instalada. Reiniciando o GCPShot…' })
    app.relaunch()
    return true
  } catch (error) {
    publish({ state: 'error', progress: undefined, message: error instanceof Error ? error.message : 'Falha ao atualizar.' })
    throw error
  }
}
