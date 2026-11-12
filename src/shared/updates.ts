export const UPDATE_REPOSITORY = 'cliqueprojeto/GCPShot'

export type UpdateCheckMode = 'startup' | 'daily' | 'manual'

export type UpdateState = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'installing' | 'ready' | 'error'

export type UpdateStatus = {
  state: UpdateState
  currentVersion: string
  repository: string
  latestVersion?: string
  releaseName?: string
  releaseUrl?: string
  notes?: string
  prerelease?: boolean
  publishedAt?: string
  assetName?: string
  assetSize?: number
  progress?: number
  message?: string
  lastCheck?: string
}

type ParsedVersion = { core: number[]; pre: Array<string | number> }

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim())
  if (!match) return null
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : []
  }
}

/** Semantic version comparison (prereleases sort before the final release). Invalid versions sort lowest. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a), right = parseVersion(b)
  if (!left || !right) return left ? 1 : right ? -1 : 0
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1
  }
  if (!left.pre.length || !right.pre.length) return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1
  for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index += 1) {
    const l = left.pre[index], r = right.pre[index]
    if (l === undefined) return -1
    if (r === undefined) return 1
    if (l === r) continue
    if (typeof l === 'number' && typeof r === 'number') return l > r ? 1 : -1
    if (typeof l === 'number') return -1
    if (typeof r === 'number') return 1
    return l > r ? 1 : -1
  }
  return 0
}

export type LinuxPackageKind = 'deb' | 'rpm' | 'pacman'

/** Picks the installer asset that matches the running platform from a release's asset names. */
export function matchUpdateAsset(names: string[], platform: string, arch: string, linuxPackage: LinuxPackageKind = 'deb'): string | null {
  const lower = names.map((name) => ({ name, lower: name.toLowerCase() }))
  const find = (test: (value: string) => boolean): string | null => lower.find((entry) => test(entry.lower))?.name ?? null
  if (platform === 'win32') return find((value) => value.endsWith('.exe') && value.includes('windows'))
  if (platform === 'darwin') {
    const wanted = arch === 'arm64' ? 'arm64' : 'x64'
    return find((value) => value.endsWith('.dmg') && value.includes(`macos-${wanted}`))
  }
  if (platform === 'linux') {
    if (linuxPackage === 'pacman') return find((value) => value.endsWith('.pkg.tar.zst'))
    if (linuxPackage === 'rpm') return find((value) => value.endsWith('.rpm') && /x86_64|amd64|x64/.test(value))
    return find((value) => value.endsWith('.deb') && /amd64|x86_64|x64/.test(value))
  }
  return null
}

/** Manifest published as `update-manifest.json` on every release (served by github.com, no API rate limit). */
export type UpdateManifest = {
  version: string
  tag: string
  prerelease: boolean
  publishedAt: string
  notes: string
  assets: Array<{ name: string; size: number; sha256: string }>
}

export function isPrereleaseVersion(version: string): boolean {
  return /^v?\d+\.\d+\.\d+-/.test(version.trim())
}

/** Extracts release tags (newest first as listed) from the GitHub `releases.atom` feed. */
export function parseReleaseFeedTags(xml: string, repository: string): string[] {
  const escaped = repository.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const pattern = new RegExp(`https://github\\.com/${escaped}/releases/tag/([^"'<>\\s]+)`, 'g')
  return [...new Set([...xml.matchAll(pattern)].map((match) => decodeURIComponent(match[1])))]
}
