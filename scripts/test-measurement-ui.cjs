const assert = require('node:assert/strict')
const sharp = require('sharp')
const { join } = require('node:path')
const { readFileSync } = require('node:fs')

module.exports = async function testMeasurement(app, page) {
  const created = app.waitForEvent('window', { predicate: async (window) => { try { await window.waitForURL(/capture=1/, { timeout: 1500 }); return true } catch { return false } }, timeout: 15000 })
  await page.evaluate(() => window.gcpshot.beginCapture('region', false))
  const overlay = await created
  await overlay.waitForFunction(() => document.querySelector('.screen-backdrop')?.naturalWidth > 0)
  const surface = overlay.locator('.capture-overlay')
  for (const [event, x, y] of [['mousedown', 100, 100], ['mousemove', 600, 400], ['mouseup', 600, 400]]) await surface.dispatchEvent(event, { clientX: x, clientY: y, button: 0, buttons: event === 'mouseup' ? 0 : 1 })
  await overlay.getByRole('button', { name: 'Medir distancia (cm)', exact: true }).click()
  await overlay.getByRole('spinbutton', { name: 'Escala de medicao', exact: true }).fill('100')
  for (const [event, x, y] of [['mousedown', 150, 150], ['mousemove', 350, 150], ['mouseup', 350, 150]]) await surface.dispatchEvent(event, { clientX: x, clientY: y, button: 0, buttons: event === 'mouseup' ? 0 : 1 })
  await overlay.locator('.measurement-line').getByText('2,00 cm', { exact: true }).waitFor()
  await overlay.screenshot({ path: 'release/capture-measurement.png' })
  const closed = overlay.waitForEvent('close')
  await overlay.evaluate(() => document.activeElement?.blur())
  await overlay.keyboard.press('Enter').catch(() => {})
  await closed
  const data = await app.evaluate(({ clipboard }) => clipboard.readImage().toPNG().toString('base64'))
  const pixels = await sharp(Buffer.from(data, 'base64')).removeAlpha().raw().toBuffer()
  let white = 0
  for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245) white++
  assert.ok(white > 100, 'The measurement label must be rasterized into the copied image')
  await page.evaluate(() => window.gcpshot.showMainWindow())
  for (const window of app.windows()) if (window.url().includes('color-toast.html')) await window.evaluate(() => window.gcpshot.dismissColorToast()).catch(() => {})

  const image = await sharp({ create: { width: 600, height: 400, channels: 4, background: 'white' } }).png().toBuffer()
  const navigation = page.getByRole('navigation', { name: 'Navegação principal' })
  await navigation.getByRole('button', { name: 'Captura', exact: true }).click()
  await page.evaluate((dataUrl) => {
    const entries = JSON.parse(localStorage.getItem('gcpshot-studio-library') || '[]')
    localStorage.setItem('gcpshot-studio-library', JSON.stringify([{ id: 'measure-fixture', name: 'Measure fixture', width: 600, height: 400, dataUrl, createdAt: Date.now() + 20000 }, ...entries.filter((item) => item.id !== 'measure-fixture')]))
  }, `data:image/png;base64,${image.toString('base64')}`)
  await navigation.getByRole('button', { name: 'Estúdio', exact: true }).click()
  await page.locator('.studio-thumb[title="Measure fixture"]').click()
  const editor = page.getByRole('region', { name: 'Editor de imagem', exact: true })
  await page.waitForFunction(() => document.querySelector('.photo-status')?.textContent.includes('600 × 400'))
  await editor.getByRole('button', { name: 'Medir', exact: true }).click()
  await editor.getByRole('spinbutton', { name: 'Escala da imagem', exact: true }).fill('100')
  const paint = editor.locator('.photo-paint')
  const bounds = await paint.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 6, bounds.y + bounds.height / 4)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 2 / 3, bounds.y + bounds.height / 4, { steps: 8 })
  await page.mouse.up()
  await editor.getByLabel('Distancia medida', { exact: true }).waitFor()
  assert.ok(Math.abs(parseFloat((await editor.getByLabel('Distancia medida').textContent()).replace(',', '.')) - 3) < .03)
  await editor.getByRole('spinbutton', { name: 'Referencia da imagem em cm', exact: true }).fill('6')
  await editor.getByRole('button', { name: 'Calibrar pela medida', exact: true }).click()
  assert.equal(await editor.getByLabel('Distancia medida').textContent(), '6,00 cm')
  await page.screenshot({ path: 'release/studio-measurement.png' })
  await editor.getByRole('button', { name: 'Aplicar medida', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.photo-status')?.textContent.includes('Aplicando'))
  const path = join(await app.evaluate(({ app }) => app.getPath('userData')), 'measurement-export.png')
  await app.evaluate(({ dialog }, path) => { const old = dialog.showSaveDialog; dialog.showSaveDialog = async () => { dialog.showSaveDialog = old; return { canceled: false, filePath: path } } }, path)
  await page.getByRole('button', { name: 'Exportar PNG', exact: true }).click()
  let exported
  for (let i = 0; i < 40; i++) {
    try { exported = await sharp(readFileSync(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); break }
    catch { await page.waitForTimeout(100) }
  }
  assert.ok(exported, 'The exported measurement PNG must finish writing and decode successfully')
  assert.equal(exported.info.width, 600); assert.equal(exported.info.height, 400)
  let purple = 0
  for (let i = 0; i < exported.data.length; i += 3) if (exported.data[i] < 130 && exported.data[i + 1] < 120 && exported.data[i + 2] > 180) purple++
  assert.ok(purple > 100, 'Calibrated measurement must be included in exported PNG')
  await editor.getByRole('button', { name: 'Desfazer edição', exact: true }).click()
  await editor.getByRole('button', { name: 'Refazer edição', exact: true }).click()
  console.log('Measurement: calibrated capture annotation/clipboard and Studio cm ruler/calibration/full-resolution PNG export/undo-redo passed.')
}
