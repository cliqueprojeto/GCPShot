const assert = require('node:assert/strict')
const sharp = require('sharp')

module.exports = async function testCapture(app, page) {
  const displays = await app.evaluate(({ screen }) => screen.getAllDisplays().map((display) => ({ id: display.id, bounds: display.bounds, scale: display.scaleFactor })))
  const sources = []
  for (const display of displays) {
    const width = Math.round(display.bounds.width * display.scale), height = Math.round(display.bounds.height * display.scale)
    const band = await sharp({ create: { width, height: Math.round(40 * display.scale), channels: 4, background: '#28D8AC' } }).png().toBuffer()
    const png = await sharp({ create: { width, height, channels: 4, background: '#5F42EB' } }).composite([{ input: band, left: 0, top: height - Math.round(40 * display.scale) }]).png().toBuffer()
    sources.push({ id: `screen:${display.id}:0`, display_id: String(display.id), dataUrl: 'data:image/png;base64,' + png.toString('base64') })
  }
  // A synthetic screen lets this verify capture composition on macOS without bypassing its privacy permissions.
  await app.evaluate(({ desktopCapturer, nativeImage }, sources) => {
    desktopCapturer.getSources = async () => sources.map((source) => ({ ...source, name: 'Test screen', thumbnail: nativeImage.createFromDataURL(source.dataUrl) })).reverse()
  }, sources)
  await page.evaluate(() => window.gcpshot.updateSettings({ keepSelectionAfterAction: true, autoCopyAfterCapture: false }))
  for (const autoCopy of [true, false]) {
    const created = app.waitForEvent('window', { timeout: 15000 })
    await page.evaluate((quick) => window.gcpshot.beginCapture('region', quick), autoCopy)
    const overlay = await created
    await overlay.waitForLoadState('domcontentloaded')
    await overlay.waitForFunction(() => document.querySelector('.capture-overlay'))
    await overlay.waitForFunction(() => document.querySelector('.screen-backdrop')?.naturalWidth > 0)
    await overlay.screenshot({ path: 'release/capture-geometry.png' })
    const display = displays[autoCopy ? 0 : displays.length - 1]
    const x = display.bounds.x - Math.min(...displays.map((d) => d.bounds.x)) + 100
    const y = display.bounds.y - Math.min(...displays.map((d) => d.bounds.y)) + (autoCopy ? display.bounds.height - 30 : 100)
    await overlay.mouse.move(x, y)
    await overlay.mouse.down()
    await overlay.mouse.move(x + 160, y + (autoCopy ? 20 : 120), { steps: 5 })
    const closed = overlay.waitForEvent('close')
    await overlay.mouse.up().catch(() => {})
    if (!autoCopy) {
      await overlay.mouse.move(x + 40, y + 40)
      await overlay.mouse.down()
      await overlay.mouse.move(x + 100, y + 80, { steps: 5 })
      await overlay.mouse.up()
      await overlay.keyboard.press('Control+c').catch(() => {})
    }
    await closed
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readImage().isEmpty()), false)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readImage().toPNG().toString('base64'))
    const meta = await sharp(Buffer.from(copied, 'base64')).metadata()
    assert.equal(meta.width, Math.round(160 * display.scale))
    assert.equal(meta.height, Math.round((autoCopy ? 20 : 120) * display.scale))
    const pixel = await sharp(Buffer.from(copied, 'base64')).removeAlpha().raw().toBuffer()
    assert.deepEqual([...pixel.subarray(0, 3)], autoCopy ? [40, 216, 172] : [95, 66, 235])
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
    await page.locator('.photo-image-frame img').waitFor({ state: 'visible' })
    assert.equal(await (await app.browserWindow(page)).evaluate((window) => window.isVisible()), true)
    assert.ok(await page.locator('.workspace-sidebar').isVisible())
  }
  console.log('Quick Print Screen + annotated capture: clipboard, forced overlay close, disk archive and notification-to-Studio passed.')
}
