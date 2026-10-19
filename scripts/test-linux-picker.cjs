const { spawn, execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')
const { resolve } = require('node:path')
async function select(cancel) {
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
    if (cancel) execFileSync('xdotool', ['key', 'Escape'])
    else execFileSync('xdotool', ['mousemove', '100', '100', 'click', '1'])
    await closed
    assert.ok(output.includes(cancel ? 'CANCEL' : '#12A4B6'), output)
  } finally { clearTimeout(timeout); child.kill() }
}
;(async () => {
  execFileSync('xsetroot', ['-solid', '#12A4B6'])
  await select(false)
  await select(true)
  console.log('Linux X11 real pixel sampling and Escape cancellation passed.')
})().catch((error) => { console.error(error); process.exitCode = 1 })
