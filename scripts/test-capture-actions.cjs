const assert = require('node:assert/strict')
const { join } = require('node:path')
const { readFileSync } = require('node:fs')

module.exports = async function testCaptureActions(app, page) {
  await page.evaluate(() => window.gcpshot.updateSettings({ autoCopyAfterCapture: false, keepSelectionAfterAction: true, showNotifications: true, minimizeToTray: true }))
  const profile = await app.evaluate(({ app }) => app.getPath('userData'))
  const geometry = await app.evaluate(({ screen }) => {
    const displays = screen.getAllDisplays(), bounds = screen.getPrimaryDisplay().bounds
    return { x: bounds.x - Math.min(...displays.map((d) => d.bounds.x)) + 100, y: bounds.y - Math.min(...displays.map((d) => d.bounds.y)) + 100 }
  })
  async function select() {
    const created = app.waitForEvent('window', { predicate: async (window) => {
      try { await window.waitForURL(/capture=1/, { timeout: 2000 }); return true }
      catch { return false }
    } })
    await page.evaluate(() => window.gcpshot.beginCapture('region', false))
    const overlay = await created
    await overlay.waitForFunction(() => document.querySelector('.screen-backdrop')?.naturalWidth > 0)
    const surface = overlay.locator('.capture-overlay'), { x, y } = geometry
    await surface.dispatchEvent('mousedown', { clientX: x, clientY: y, button: 0, buttons: 1 })
    await surface.dispatchEvent('mousemove', { clientX: x + 160, clientY: y + 120, buttons: 1 })
    await surface.dispatchEvent('mouseup', { clientX: x + 160, clientY: y + 120, button: 0 })
    await overlay.locator('.selection-box').waitFor()
    return overlay
  }
  async function finish(overlay, key) {
    const closed = overlay.waitForEvent('close')
    await overlay.keyboard.press(key).catch(() => {})
    await closed
  }
  async function saveDialog(path) {
    await app.evaluate(({ dialog }, path) => {
      const original = dialog.showSaveDialog
      dialog.showSaveDialog = async () => { dialog.showSaveDialog = original; return { canceled: !path, filePath: path || undefined } }
    }, path)
  }
  async function printResult(success) {
    await app.evaluate(({ app }, success) => {
      app.__capturePrintTest = (_event, contents) => { contents.print = (_options, done) => done(success, success ? '' : 'Print job canceled') }
      app.on('web-contents-created', app.__capturePrintTest)
    }, success)
  }
  async function restorePrinter() { await app.evaluate(({ app }) => { app.removeListener('web-contents-created', app.__capturePrintTest); delete app.__capturePrintTest }) }

  let overlay = await select()
  await overlay.evaluate(() => { const input = document.createElement('input'); input.id = 'enter-test'; document.body.append(input); input.focus() })
  await overlay.keyboard.press('Enter')
  assert.equal(overlay.isClosed(), false, 'Enter in an input must not copy the screen')
  await overlay.evaluate(() => document.getElementById('enter-test').remove())
  await finish(overlay, 'Enter')
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readImage().isEmpty()), false)

  overlay = await select()
  await overlay.keyboard.press('t')
  await overlay.locator('.capture-overlay').dispatchEvent('mousedown', { clientX: geometry.x + 30, clientY: geometry.y + 40, button: 0 })
  await overlay.locator('.text-composer input').fill('GCPShot')
  await overlay.keyboard.press('Enter')
  assert.equal(overlay.isClosed(), false, 'The first Enter must commit the text annotation')
  await overlay.locator('.text-composer').waitFor({ state: 'detached' })
  await finish(overlay, 'Enter')

  for (const extension of ['png', 'pdf']) {
    overlay = await select()
    const path = join(profile, `capture-action-test.${extension}`)
    await saveDialog(path)
    await finish(overlay, 'Control+s')
    const bytes = readFileSync(path)
    assert.ok(extension === 'png' ? bytes.subarray(1, 4).toString() === 'PNG' : bytes.subarray(0, 5).toString() === '%PDF-')
  }

  for (const path of [null, join(profile, 'nonexistent-capture-directory', 'image.png')]) {
    overlay = await select()
    await saveDialog(path)
    await overlay.keyboard.press('Control+s')
    await overlay.waitForTimeout(350)
    assert.equal(overlay.isClosed(), false, 'Canceling or failing to save must retain the selection')
    await finish(overlay, 'Enter')
  }

  for (const success of [true, false]) {
    overlay = await select()
    await printResult(success)
    try {
      if (success) await finish(overlay, 'Control+p')
      else {
        await overlay.keyboard.press('Control+p')
        await overlay.waitForTimeout(650)
        assert.equal(overlay.isClosed(), false, 'Canceling print must retain the selection')
        await finish(overlay, 'Enter')
      }
    } finally { await restorePrinter() }
  }

  for (const success of [true, false]) {
    overlay = await select()
    await app.evaluate(({ shell }, success) => {
      shell.__captureOriginalOpen = shell.openExternal
      shell.__captureOpened = []
      shell.openExternal = async (url) => { shell.__captureOpened.push(url); if (!success) throw new Error('WhatsApp indisponível (teste)') }
    }, success)
    try {
      if (success) await finish(overlay, 'Control+Shift+w')
      else {
        await overlay.keyboard.press('Control+Shift+w')
        await overlay.waitForTimeout(300)
        assert.equal(overlay.isClosed(), false)
        await finish(overlay, 'Enter')
      }
      assert.deepEqual(await app.evaluate(({ shell }) => shell.__captureOpened), ['https://web.whatsapp.com/'])
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readImage().isEmpty()), false)
    } finally { await app.evaluate(({ shell }) => { shell.openExternal = shell.__captureOriginalOpen; delete shell.__captureOriginalOpen; delete shell.__captureOpened }) }
  }

  const main = await app.browserWindow(page)
  await main.evaluate((window) => { window.show(); window.close() })
  let toast
  for (let index = 0; index < 50; index++) {
    toast = app.windows().find((window) => window.url().includes('color-toast.html') && window.url().includes('destination=home'))
    if (toast) break
    await page.waitForTimeout(50)
  }
  assert.ok(toast)
  await toast.getByText('GCPShot continua ativo', { exact: true }).waitFor()
  assert.equal(await toast.locator('#brand').innerText(), 'GCPShot')
  assert.equal((await toast.locator('body').innerText()).includes('Electron'), false)
  await toast.screenshot({ path: 'release/notification-0.6.2.png' })
  await toast.getByRole('button', { name: 'Abrir GCPShot', exact: true }).click()
  assert.equal(await main.evaluate((window) => window.isVisible()), true)
  console.log('Enter, PNG/PDF save, print spool simulation, WhatsApp handoff, cancellation/error retention and branded notification passed.')
}
