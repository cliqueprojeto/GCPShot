const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function moduleFrom(path) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {} }; vm.runInNewContext(source, context); return context.exports
}

const updates = moduleFrom('src/shared/updates.ts')
const { compareVersions, matchUpdateAsset } = updates
assert.equal(compareVersions('0.8.0', '0.7.0'), 1)
assert.equal(compareVersions('v0.7.0', '0.7.0'), 0)
assert.equal(compareVersions('0.8.0-beta.1', '0.8.0'), -1)
assert.equal(compareVersions('0.8.0-beta.10', '0.8.0-beta.2'), 1)
assert.equal(compareVersions('0.8.0-alpha', '0.8.0-beta'), -1)
assert.equal(compareVersions('0.10.0', '0.9.9'), 1)
assert.equal(compareVersions('garbage', '0.1.0'), -1)

const assets = ['GCPShot-0.8.0-Windows-x64.exe', 'GCPShot-0.8.0-Windows-x64.exe.blockmap', 'GCPShot-0.8.0-macOS-x64.dmg', 'GCPShot-0.8.0-macOS-arm64.dmg', 'GCPShot-0.8.0-Linux-amd64.deb', 'GCPShot-0.8.0-Linux-x86_64.rpm', 'gcpshot-0.8.0-1-x86_64.pkg.tar.zst']
assert.equal(matchUpdateAsset(assets, 'win32', 'x64'), 'GCPShot-0.8.0-Windows-x64.exe')
assert.equal(matchUpdateAsset(assets, 'darwin', 'arm64'), 'GCPShot-0.8.0-macOS-arm64.dmg')
assert.equal(matchUpdateAsset(assets, 'darwin', 'x64'), 'GCPShot-0.8.0-macOS-x64.dmg')
assert.equal(matchUpdateAsset(assets, 'linux', 'x64', 'deb'), 'GCPShot-0.8.0-Linux-amd64.deb')
assert.equal(matchUpdateAsset(assets, 'linux', 'x64', 'rpm'), 'GCPShot-0.8.0-Linux-x86_64.rpm')
assert.equal(matchUpdateAsset(assets, 'linux', 'x64', 'pacman'), 'gcpshot-0.8.0-1-x86_64.pkg.tar.zst')
assert.equal(matchUpdateAsset(['notes.txt'], 'win32', 'x64'), null)

const feed = '<feed><entry><link rel="alternate" type="text/html" href="https://github.com/cliqueprojeto/GCPShot/releases/tag/v0.8.0"/></entry><entry><link rel="alternate" href="https://github.com/cliqueprojeto/GCPShot/releases/tag/v0.8.1-beta.1"/></entry><entry><link href="https://github.com/other/GCPShot/releases/tag/v9.9.9"/></entry></feed>'
assert.deepEqual([...updates.parseReleaseFeedTags(feed, 'cliqueprojeto/GCPShot')], ['v0.8.0', 'v0.8.1-beta.1'])
assert.equal(updates.isPrereleaseVersion('v0.8.1-beta.1'), true)
assert.equal(updates.isPrereleaseVersion('0.8.0'), false)

const shortcuts = moduleFrom('src/shared/shortcuts.ts')
const kde = shortcuts.parseKdeShortcuts('[services][org.kde.spectacle.desktop]\nRectangularRegionScreenShot=Meta+Shift+Print\tMeta+Shift+S,Meta+Shift+Print,Captura\n_k_friendly_name=Spectacle\n_launch=Print,Print,Spectacle\nunused=none,Meta+K,Algo\n')
assert.deepEqual([...kde], ['Super+Shift+PrintScreen', 'Super+Shift+S', 'PrintScreen'])
const gnome = shortcuts.parseGnomeShortcuts("org.gnome.settings-daemon.plugins.media-keys terminal ['<Primary><Alt>t']\norg.gnome.shell.keybindings show-screenshot-ui ['Print']\norg.gnome.desktop.wm.keybindings switch-input-source ['<Super>space', 'XF86Keyboard']\n")
assert.deepEqual([...gnome], ['Ctrl+Alt+T', 'PrintScreen', 'Super+Space'])
// Suggestions must never steal everyday app shortcuts or AltGr characters.
for (const key of shortcuts.globalShortcutKeys) {
  for (const value of shortcuts.shortcutCandidates('win32', key)) {
    assert.ok(!/^Ctrl\+Alt\+[^S]/.test(value) || value.includes('Shift'), `AltGr collision on Windows: ${value}`)
    assert.ok(!/^Ctrl\+Shift\+[A-Z]$/.test(value), `App shortcut collision on Windows: ${value}`)
  }
  for (const value of shortcuts.shortcutCandidates('darwin', key)) assert.ok(!/^Command\+Shift\+[3-6]$/.test(value), `macOS screenshot collision: ${value}`)
  for (const value of shortcuts.shortcutCandidates('linux', key)) assert.ok(!/^Ctrl\+Alt\+(F\d+|T|L|D)$/.test(value), `Linux system collision: ${value}`)
  assert.ok(shortcuts.shortcutCandidates('linux', key).length >= 10, 'Linux must offer many free suggestions')
}
// Linux: easiest suggestions are Alt+1…Alt+4, and Shift+digit (never fires on Linux) is never offered.
assert.deepEqual([...shortcuts.globalShortcutKeys].map((key) => shortcuts.shortcutCandidates('linux', key)[0]), ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4'])
for (const key of shortcuts.globalShortcutKeys) {
  for (const value of shortcuts.shortcutCandidates('linux', key)) {
    assert.ok(!/Shift\+[0-9]$/.test(value), `Shift+digit suggested on Linux: ${value}`)
    assert.ok(!/^Alt\+[A-Z]$/.test(value), `Alt+letter steals app menus: ${value}`)
  }
}
assert.equal(shortcuts.brokenOnPlatform('Alt+Shift+2', 'linux'), true)
assert.equal(shortcuts.brokenOnPlatform('Alt+2', 'linux'), false)
assert.equal(shortcuts.brokenOnPlatform('Alt+Shift+2', 'win32'), false)
// GCPShot's own KDE entries (stale portal bindings) must not count as reserved by the system.
const own = shortcuts.parseKdeShortcuts('[gcpshot]\nABC-Alt+Shift+S=Alt+Shift+S,Alt+Shift+S,GCPShot shortcut\n[gcpshotkeys]\ncaptureShortcut=Alt+1,none,Capturar\n[kwin]\nExpose=Ctrl+F9,Ctrl+F9,Janelas\n')
assert.deepEqual([...own], ['Ctrl+F9'])
// Qt key codes sent to kglobalaccel.
const keyModule = ts.transpileModule(fs.readFileSync('src/main/kdeShortcuts.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const keyContext = { exports: {}, require: (name) => name === '../shared/shortcuts' ? shortcuts : require(name) }
vm.runInNewContext(keyModule, keyContext)
assert.equal(keyContext.exports.qtKeyCode('Alt+1'), 0x08000031)
assert.equal(keyContext.exports.qtKeyCode('Ctrl+Alt+Shift+F12'), 0x0E00003B + 0x01000000 - 0x3B + 0x3B)
assert.equal(keyContext.exports.qtKeyCode('Super+Shift+S'), 0x12000053)
assert.equal(keyContext.exports.qtKeyCode('PrintScreen'), 0x01000009)
console.log('Update version ordering, installer selection per OS and desktop shortcut parsing passed.')
