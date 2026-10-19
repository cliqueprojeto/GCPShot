const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/shared/colors.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const context = { exports: {} }
vm.runInNewContext(source, context)
const c = context.exports
assert.equal(c.normalizeHex(' abc '), '#AABBCC')
assert.equal(c.normalizeHex('#GG1234'), null)
assert.equal(c.fromRgb([157, 123, 255]), '#9D7BFF')
assert.equal(c.contrast('#000000', '#FFFFFF'), 21)
assert.equal(c.contrast('#FFFFFF', '#FFFFFF'), 1)
assert.ok(Math.abs(c.contrast('#9D7BFF', '#FFFFFF') - 3.13) < 0.01)
assert.ok(Math.abs(c.contrast('#9D7BFF', '#000000') - 6.71) < 0.01)
for (const hex of ['#000000', '#FFFFFF', '#9D7BFF', '#00FF00', '#1264A8']) {
  assert.equal(c.fromHsl(...c.hsl(hex)), hex)
  for (const mode of ['analogous', 'complementary', 'triadic', 'monochromatic']) {
    assert.equal(c.harmony(hex, mode).length, 5)
    assert.ok(c.harmony(hex, mode).every((value) => /^#[0-9A-F]{6}$/.test(value)))
  }
}
const migrated = c.parseLibrary({ palettes: [{ name: 'Teste', colors: [[0, 0, 102], [255, 255, 153]] }], history: [[0, 0, 235], '#0000eb'] })
assert.equal(migrated.palettes[0].colors.join(','), '#000066,#FFFF99')
assert.equal(migrated.history.join(','), '#0000EB')
assert.throws(() => c.parseLibrary({ palettes: 'invalid' }))
assert.equal(c.parseLibrary({ palettes: [{ colors: ['invalid', [999, 0, 0], '#abc'] }] }).palettes[0].colors.join(','), '#AABBCC')
console.log('Color conversion, WCAG contrast, harmonies, Designer migration and input validation passed.')
