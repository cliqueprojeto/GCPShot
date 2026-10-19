const assert = require('node:assert/strict')
const sharp = require('sharp')

module.exports = async function testCapture(app, page) {
  const png = await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#5F42EB' } }).png().toBuffer()
  const dataUrl = 'data:image/png;base64,' + png.toString('base64')
  // A synthetic screen lets this verify capture composition on macOS without bypassing its privacy permissions.
  await app.evaluate(({ desktopCapturer, nativeImage, screen }, source) => {
    desktopCapturer.getSources = async () => [{ id: 'screen:1:0', display_id: String(screen.getPrimaryDisplay().id), name: 'Test screen', thumbnail: nativeImage.createFromDataURL(source) }]
  }, dataUrl)
  await page.evaluate(() => window.gcpshot.updateSettings({ keepSelectionAfterAction: true, autoCopyAfterCapture: false }))
  for (const autoCopy of [true, false]) {
    const created = app.waitForEvent('window', { timeout: 15000 })
    await page.evaluate((quick) => window.gcpshot.beginCapture('region', quick), autoCopy)
    const overlay = await created
    await overlay.waitForLoadState('domcontentloaded')
    await overlay.waitForFunction(() => document.querySelector('.capture-overlay'))
    await overlay.waitForTimeout(400)
    await overlay.mouse.move(100, 100)
    await overlay.mouse.down()
    await overlay.mouse.move(420, 300, { steps: 5 })
    const closed = overlay.waitForEvent('close')
    await overlay.mouse.up().catch(() => {})
    if (!autoCopy) {
      await overlay.mouse.move(190, 160)
      await overlay.mouse.down()
      await overlay.mouse.move(340, 240, { steps: 5 })
      await overlay.mouse.up()
      await overlay.keyboard.press('Control+c').catch(() => {})
    }
    await closed
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readImage().isEmpty()), false)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readImage().toPNG().toString('base64'))
    const pixel = await sharp(Buffer.from(copied, 'base64')).removeAlpha().raw().toBuffer()
    assert.deepEqual([...pixel.subarray(0, 3)], [95, 66, 235])
    assert.equal(await (await app.browserWindow(page)).evaluate((window) => window.isVisible()), false)
    const captures = await page.evaluate(() => window.gcpshot.getStoredCaptures())
    assert.ok(captures.length > 0)
    assert.ok(captures[0].dataUrl.startsWith('data:image/png;base64,'))
    let toast
    for (let i = 0; i < 50; i++) {
      toast = app.windows().find((window) => window.url().includes('color-toast.html'))
      if (toast) break
      await page.waitForTimeout(50)
    }
    assert.ok(toast)
    await toast.getByRole('button', { name: 'Abrir Estudio de imagem', exact: true }).click()
    await page.locator('.studio-canvas-image').waitFor({ state: 'visible' })
    assert.equal(await (await app.browserWindow(page)).evaluate((window) => window.isVisible()), true)
    assert.ok(await page.locator('.workspace-sidebar').isVisible())
  }
  console.log('Quick Print Screen + annotated capture: clipboard, forced overlay close, disk archive and notification-to-Studio passed.')
}
