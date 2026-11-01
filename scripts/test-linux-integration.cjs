const assert = require('node:assert/strict')
const { execFileSync, spawn } = require('node:child_process')

module.exports = async function testLinuxIntegration(app, page) {
  if (process.platform !== 'linux') return
  const executable = await app.evaluate(() => process.execPath)
  const windowId = await (await app.browserWindow(page)).evaluate((window) => window.getNativeWindowHandle().readUInt32LE())
  const wmClass = execFileSync('xprop', ['-id', String(windowId), 'WM_CLASS'], { encoding: 'utf8' })
  assert.match(wmClass, /"gcpshot", "gcpshot"/)
  const launch = (args) => new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: 'ignore' })
    const timer = setTimeout(() => { child.kill(); reject(new Error('Second instance did not exit')) }, 10000)
    child.once('error', (error) => { clearTimeout(timer); reject(error) })
    child.once('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Second instance exited ${code}`)) })
  })
  await launch(['--color-lab'])
  await page.getByRole('heading', { name: 'Cor em foco', exact: true }).waitFor()
  await launch(['--color-lab'])
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((window) => !window.webContents.getURL().includes('color-toast')).length), 1)

  await app.evaluate(({ Menu }) => {
    Menu.__linuxOriginalBuilder = Menu.buildFromTemplate
    Menu.buildFromTemplate = (template) => { Menu.__linuxTemplate = template; return Menu.__linuxOriginalBuilder.call(Menu, template) }
  })
  try {
    await page.evaluate(() => window.gcpshot.updateSettings({}))
    await app.evaluate(({ Menu, BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().includes('color-toast')).hide()
      const item = Menu.__linuxTemplate.find((item) => item.label === 'Color Lab')
      if (!item) throw new Error('Missing Color Lab tray action')
      item.click()
    })
    await page.getByRole('heading', { name: 'Cor em foco', exact: true }).waitFor()
  } finally {
    await app.evaluate(({ Menu }) => {
      Menu.buildFromTemplate = Menu.__linuxOriginalBuilder
      delete Menu.__linuxOriginalBuilder; delete Menu.__linuxTemplate
    })
  }

  execFileSync('xsetroot', ['-solid', '#12A4B6'])
  execFileSync('xdotool', ['mousemove', '100', '100'])
  await app.evaluate(({ clipboard }) => clipboard.writeText('before-picker'))
  // Reproduce a real global accelerator with modifiers held after activation.
  execFileSync('xdotool', ['keydown', 'ctrl', 'keydown', 'shift', 'keydown', 'c'])
  try { await new Promise((resolve) => setTimeout(resolve, 500)) }
  finally { execFileSync('xdotool', ['keyup', 'c', 'keyup', 'shift', 'keyup', 'ctrl']) }
  await new Promise((resolve) => setTimeout(resolve, 700))
  execFileSync('xdotool', ['click', '1'])
  await page.waitForFunction(async () => {
    const library = await window.gcpshot.getColorLibrary()
    return library.history[0] === '#12A4B6'
  }, null, { timeout: 10000 })
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), '#12A4B6')
  console.log('Installed Linux: real WM_CLASS, single instance, Color Lab launcher/tray and held-key global Live Color shortcut passed.')
}
