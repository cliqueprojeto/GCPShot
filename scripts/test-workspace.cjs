const { _electron: electron } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
;(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ executablePath: require('electron'), args: [resolve('scripts/electron-test-entry.cjs')], env })
  try {
    const page = await app.firstWindow()
    if (page.url().includes('welcome.html')) {
      await page.screenshot({ path: 'release/welcome-0.6.0.png' })
      await page.getByRole('button', { name: 'Começar', exact: true }).click()
    }
    await page.getByRole('heading', { name: 'O que vamos criar hoje?' }).waitFor()
    await page.screenshot({ path: 'release/workspace-home-0.6.0.png', fullPage: true })
    for (const name of ['Color Lab', 'Minhas Paletas', 'Estúdio', 'Captura']) {
      await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click()
      assert.equal(await page.locator('.workspace-sidebar').count(), 1)
    }
    await require('./test-capture-flow.cjs')(app, page)
    await require('./test-photo-editor.cjs')(app, page)
    await page.screenshot({ path: 'release/workspace-studio-0.6.0.png' })
    console.log('Unified navigation and capture workflows passed.')
  } finally { await app.evaluate(({ app }) => app.quit()).catch(() => {}); await app.close().catch(() => {}) }
})().catch((error) => { console.error(error); process.exitCode = 1 })
