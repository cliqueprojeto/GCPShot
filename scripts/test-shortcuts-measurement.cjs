const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function moduleFrom(path) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {} }; vm.runInNewContext(source, context); return context.exports
}
const shortcuts = moduleFrom('src/shared/shortcuts.ts')
assert.equal(shortcuts.canonicalShortcut('control + shift + c'), 'Ctrl+Shift+C')
assert.equal(shortcuts.shortcutIdentity('Shift+Control+C', 'linux'), shortcuts.shortcutIdentity('Ctrl+Shift+C', 'linux'))
assert.equal(shortcuts.shortcutIdentity('Super+Alt+C', 'darwin'), shortcuts.shortcutIdentity('Command+Alt+C', 'darwin'))
for (const platform of ['linux', 'darwin', 'win32']) {
  const all = new Set()
  for (const key of shortcuts.globalShortcutKeys) {
    for (const value of shortcuts.shortcutCandidates(platform, key)) { assert.ok(shortcuts.validGlobalShortcut(value)); assert.ok(!all.has(value)); all.add(value) }
  }
}
for (const bad of ['C', '', 'Ctrl+Shift', 'Ctrl+Ctrl+C', 'Ctrl+NONSENSE']) assert.equal(shortcuts.validGlobalShortcut(bad), false, bad)
const measure = moduleFrom('src/shared/measurement.ts')
assert.equal(measure.measureCm({ x: 0, y: 0 }, { x: 300, y: 400 }, 100), 5)
assert.equal(measure.measureLabel({ x: 0, y: 0 }, { x: 96, y: 0 }), '2,54 cm')
assert.equal(measure.measureCm({ x: -100, y: 20 }, { x: 0, y: 20 }, 20), 5)
assert.equal(measure.measureCm({ x: 1, y: 1 }, { x: 1, y: 1 }), 0)
assert.throws(() => measure.measureCm({ x: 0, y: 0 }, { x: 1, y: 1 }, 0))
assert.equal(measure.validMeasureScale(Infinity), false)
assert.ok(Math.abs(measure.measureAngle({ x: 10, y: 0 }, { x: 0, y: 0 })) < .0001)
const keyboard = moduleFrom('src/renderer/captureUtils.ts')
assert.equal(keyboard.eventMatchesShortcut({ key: 'ç', code: 'KeyC', ctrlKey: false, shiftKey: true, altKey: true, metaKey: true }, 'Command+Alt+Shift+C'), true)
assert.equal(keyboard.eventMatchesShortcut({ key: 'Enter', code: 'Enter', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }, 'Ctrl+Return'), true)
assert.equal(keyboard.eventMatchesShortcut({ key: 'c', code: 'KeyC', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }, 'Command+C'), false)
console.log('Platform shortcut suggestions, normalization, validation and calibrated cm geometry passed.')
