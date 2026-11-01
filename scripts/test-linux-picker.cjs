const { spawn, execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const { mkdirSync } = require('node:fs')
async function select(mode, heldKeyboard = false) {
  let holder
  if (heldKeyboard) {
    holder = spawn(resolve('release/test-keyboard-grab'))
    await new Promise((accept, reject) => { holder.stdout.once('data', accept); holder.once('error', reject); holder.once('exit', (code) => { if (code) reject(new Error(`Keyboard grab fixture failed: ${code}`)) }) })
  }
  const child = spawn(resolve('build/GCPShot.LiveColor'), [String(process.pid)], { env: { ...process.env, GDK_BACKEND: 'x11', GDK_SCALE: '1', GDK_DPI_SCALE: '1' } })
  let output = '', error = ''
  const closed = new Promise((accept, reject) => {
    child.on('error', reject)
    child.stderr.on('data', (value) => { error += value })
    child.on('close', (code) => code === 0 ? accept() : reject(new Error(error)))
  })
  const ready = new Promise((accept) => child.stdout.on('data', (value) => { output += value; if (output.includes('READY')) accept() }))
  const timeout = setTimeout(() => child.kill(), 10000)
  try {
    await Promise.race([ready, closed.then(() => { throw new Error('Picker exited before ready') })])
    await new Promise((r) => setTimeout(r, 150))
    if (mode === 'escape') execFileSync('xdotool', ['key', 'Escape'])
    else if (mode === 'enter') execFileSync('xdotool', ['key', 'Return'])
    else if (mode === 'right-click') execFileSync('xdotool', ['click', '3'])
    else execFileSync('xdotool', ['mousemove', '100', '100', 'click', '1'])
    await closed
    assert.ok(output.includes(mode === 'escape' || mode === 'right-click' ? 'CANCEL' : '#12A4B6'), output)
  } finally { clearTimeout(timeout); child.kill(); holder?.kill() }
}
;(async () => {
  mkdirSync(resolve('release'), { recursive: true })
  execFileSync('gcc', ['scripts/hold-linux-keyboard.c', '-o', 'release/test-keyboard-grab', '-lX11'])
  execFileSync('xsetroot', ['-solid', '#12A4B6'])
  execFileSync('xdotool', ['mousemove', '100', '100'])
  await select('click')
  await select('escape')
  await select('enter')
  await select('right-click')
  await select('click', true)
  console.log('Linux X11 real sampling, Enter/Escape, right-click and delayed keyboard release passed.')
})().catch((error) => { console.error(error); process.exitCode = 1 })
