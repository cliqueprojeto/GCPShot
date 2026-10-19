const assert = require('node:assert/strict')

module.exports = async function testBranding(app, page) {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Captura', exact: true }).click()
  await page.getByText('Desenvolvido: Por Bruno Albertini', { exact: true }).waitFor()
  const support = page.getByRole('region', { name: 'Apoie o GCPShot', exact: true })
  assert.equal(await support.evaluate((node) => node.tagName), 'SECTION')
  assert.equal(await support.locator('details, summary').count(), 0)
  assert.ok(await support.locator('.contribution-card').isVisible())
  const site = page.getByRole('link', { name: 'Gestão Cultural Pro', exact: true })
  assert.equal(await site.getAttribute('href'), 'https://gestaoculturalpro.com.br/')

  await app.evaluate(({ Menu, dialog, shell }) => {
    const state = { originalBuilder: Menu.buildFromTemplate, originalDialog: dialog.showMessageBox, originalOpen: shell.openExternal, template: [], options: null, opened: [] }
    Menu.__brandingTest = state
    Menu.buildFromTemplate = (template) => { state.template = template; return state.originalBuilder.call(Menu, template) }
    dialog.showMessageBox = async (options) => { state.options = options; return { response: 0, checkboxChecked: false } }
    shell.openExternal = async (url) => { state.opened.push(url) }
  })
  try {
    await page.evaluate(() => window.gcpshot.updateSettings({}))
    const menuItem = await app.evaluate(({ Menu }) => {
      const item = Menu.__brandingTest.template.find((item) => item.label === 'Sobre')
      return { found: Boolean(item), hasIcon: Boolean(item?.icon && !item.icon.isEmpty()) }
    })
    assert.equal(menuItem.found, true); assert.equal(menuItem.hasIcon, true)
    await site.click()
    await app.evaluate(({ Menu }) => Menu.__brandingTest.template.find((item) => item.label === 'Sobre').click())
    const result = await app.evaluate(({ Menu }) => ({ title: Menu.__brandingTest.options.title, detail: Menu.__brandingTest.options.detail, buttons: Menu.__brandingTest.options.buttons, opened: Menu.__brandingTest.opened }))
    assert.equal(result.title, 'Sobre o GCPShot')
    assert.ok(result.detail.includes('Bruno Albertini | Gestão Cultural Pro'))
    assert.ok(result.detail.includes('https://gestaoculturalpro.com.br/'))
    assert.ok(result.buttons.includes('Acessar site'))
    assert.deepEqual(result.opened, ['https://gestaoculturalpro.com.br/', 'https://gestaoculturalpro.com.br/'])
  } finally {
    await app.evaluate(({ Menu, dialog, shell }) => {
      const state = Menu.__brandingTest
      Menu.buildFromTemplate = state.originalBuilder; dialog.showMessageBox = state.originalDialog; shell.openExternal = state.originalOpen
      delete Menu.__brandingTest
    })
  }
  await page.locator('.workspace-content').evaluate((node) => node.scrollTo(0, node.scrollHeight))
  await page.screenshot({ path: 'release/home-credits-support-0.6.1.png' })
  console.log('Home credits, permanent support panel, external website and tray About dialog passed.')
}
