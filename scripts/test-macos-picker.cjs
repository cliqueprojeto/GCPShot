const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')

if (process.platform !== 'darwin') throw new Error('This test requires macOS AppKit.')
const helper = process.argv[2] || resolve('build/GCPShot.LiveColor')
// Fixture pixels avoid Screen Recording authorization in CI. Events still travel
// through the real NSApplication event queue and the production input handlers.
for (const [mode, expected, status] of [
  ['click', '#5F42EB', 0],
  ['enter', '#5F42EB', 0],
  ['keypad-enter', '#5F42EB', 0],
  ['escape', 'CANCEL', 0],
  ['right-click', 'CANCEL', 0],
  ['stalled', '', 1]
]) {
  const result = spawnSync(helper, [String(process.pid), `--test-${mode}`], { encoding: 'utf8', timeout: 10000 })
  assert.ifError(result.error)
  assert.equal(result.status, status, `${mode}: ${result.stderr}`)
  assert.equal(result.stdout.trim(), expected, mode)
  if (mode === 'stalled') assert.match(result.stderr, /amostragem de tela parou de responder/)
  console.log(`macOS picker ${process.arch}: ${mode} passed`)
}
