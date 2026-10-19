const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const { resolve } = require('node:path')
;(async () => {
  const executablePath = process.platform === 'darwin'
    ? resolve(process.arch === 'arm64' ? 'release/mac-arm64/GCPShot.app/Contents/MacOS/GCPShot' : 'release/mac/GCPShot.app/Contents/MacOS/GCPShot')
    : process.platform === 'win32' ? resolve('release/win-unpacked/GCPShot.exe') : '/opt/GCPShot/gcpshot'
  const app = await electron.launch({ executablePath, args: [], timeout: 30000 })
  try {
    const page = await app.firstWindow()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.getByRole('button', { name: 'Color Lab', exact: true }).click()
    await page.getByRole('heading', { name: 'Cor em foco' }).waitFor()
    await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'))
    await page.getByRole('textbox', { name: 'Cor HEX', exact: true }).fill('#12A4B6')
    await page.getByRole('button', { name: 'Aplicar HEX', exact: true }).click()
    await page.getByRole('button', { name: 'Copiar', exact: true }).first().click()
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), '#12A4B6')
    await page.getByRole('button', { name: 'Criar paleta com esta harmonia' }).click()
    await page.getByRole('textbox', { name: 'Nome da paleta', exact: true }).fill('Teste do instalador')
    await page.getByRole('button', { name: 'Salvar paleta', exact: true }).click()
    await page.getByRole('heading', { name: 'Teste do instalador', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.gcpshot.getColorLibrary())).palettes[0].colors.length, 5)
    await require('./test-capture-flow.cjs')(app, page)
    assert.deepEqual(errors, [])
    console.log(`Packaged ${process.platform}/${process.arch} app: launch, Color Lab, clipboard and palette persistence passed.`)
  } finally { await app.evaluate(({ app }) => app.quit()).catch(() => {}); await app.close().catch(() => {}) }
})().catch((error) => { console.error(error); process.exitCode = 1 })
