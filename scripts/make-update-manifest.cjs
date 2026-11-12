// Usage: node scripts/make-update-manifest.cjs <installers-dir> <tag> <notes.md> [--prerelease]
// Writes <installers-dir>/update-manifest.json, which the in-app updater reads from github.com (no API rate limit).
const { createHash } = require('node:crypto')
const { readdirSync, readFileSync, statSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const [dir, tag, notesFile] = process.argv.slice(2)
if (!dir || !tag || !notesFile) throw new Error('Usage: make-update-manifest.cjs <dir> <tag> <notes.md> [--prerelease]')
const installers = readdirSync(dir).filter((name) => /\.(exe|dmg|deb|rpm|pkg\.tar\.zst)$/.test(name)).sort()
if (!installers.length) throw new Error(`No installers found in ${dir}`)
const version = tag.replace(/^v/, '')
const manifest = {
  version,
  tag,
  prerelease: process.argv.includes('--prerelease') || /-/.test(version),
  publishedAt: new Date().toISOString(),
  notes: readFileSync(notesFile, 'utf8').trim(),
  assets: installers.map((name) => {
    const file = join(dir, name)
    return { name, size: statSync(file).size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }
  })
}
writeFileSync(join(dir, 'update-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`update-manifest.json: ${manifest.assets.length} installers for ${tag}${manifest.prerelease ? ' (prerelease)' : ''}`)
