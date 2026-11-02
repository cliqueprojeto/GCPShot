const assert = require('node:assert/strict')

module.exports = async function testShortcutSettings(app, page) {
  await app.evaluate(({ Tray, globalShortcut }) => {
    const state = { setMenu: Tray.prototype.setContextMenu, destroy: Tray.prototype.destroy, register: globalShortcut.register, trays: new Set(), destroyed: 0 }
    Tray.__settingsTest = state
    Tray.prototype.setContextMenu = function(menu) { state.trays.add(this); return state.setMenu.call(this, menu) }
    Tray.prototype.destroy = function() { state.destroyed++; return state.destroy.call(this) }
    globalShortcut.register = (value, callback) => value === 'Ctrl+Alt+Shift+F24' ? false : state.register.call(globalShortcut, value, callback)
  })
  const original = await page.evaluate(() => window.gcpshot.getSettings())
  try {
    await page.locator('.workspace-sidebar').getByRole('button', { name: 'Configurações', exact: true }).click()
    await page.getByRole('dialog').getByRole('tab').nth(2).click()
    await page.getByRole('dialog').locator('select').nth(1).selectOption('pt-BR')
    await page.getByRole('dialog').getByRole('tab').nth(1).click()
    await page.getByText('Sistema detectado:', { exact: false }).waitFor()
    await page.waitForFunction(async () => (await window.gcpshot.getShortcutInfo()).suggestions.liveColorShortcut.length > 0)
    const input = page.getByRole('textbox', { name: /Atalho Live Color/ })
    await input.fill('Ctrl+Alt+Shift+F24')
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /Salvar atalho Live Color/ }).click()
      await page.getByRole('alert').waitFor()
      assert.equal((await page.evaluate(() => window.gcpshot.getSettings())).liveColorShortcut, original.liveColorShortcut)
    }
    await input.fill(original.captureShortcut)
    await page.getByRole('button', { name: /Salvar atalho Live Color/ }).click()
    await page.getByRole('alert').waitFor()
    assert.equal((await page.evaluate(() => window.gcpshot.getSettings())).liveColorShortcut, original.liveColorShortcut)
    const info = await page.evaluate(() => window.gcpshot.getShortcutInfo())
    const chosen = info.suggestions.liveColorShortcut.find((value) => value !== original.liveColorShortcut) || info.suggestions.liveColorShortcut[0]
    await page.getByRole('combobox', { name: /Sugestoes Live Color/ }).selectOption(chosen)
    await page.waitForFunction((value) => window.gcpshot.getSettings().then((settings) => settings.liveColorShortcut === value), chosen)
    const recorded = info.suggestions.liveColorShortcut.find((value) => value !== chosen) || chosen
    await input.locator('..').getByRole('button', { name: 'Gravar', exact: true }).click()
    await input.press(recorded.replace(/Command/g, 'Meta').replace(/Ctrl/g, 'Control'))
    await page.waitForFunction((value) => window.gcpshot.getSettings().then((settings) => settings.liveColorShortcut === value), recorded)
    assert.equal(await app.evaluate(({ globalShortcut }, value) => globalShortcut.isRegistered(value), recorded), false, 'Global shortcuts must remain paused while settings are open')
    await page.getByRole('button', { name: 'Fechar configurações', exact: true }).click()
    for (let i = 0; i < 30; i++) { if (await app.evaluate(({ globalShortcut }, value) => globalShortcut.isRegistered(value), recorded)) break; await page.waitForTimeout(50) }
    assert.equal(await app.evaluate(({ globalShortcut }, value) => globalShortcut.isRegistered(value), recorded), true)
    for (let i = 0; i < 5; i++) await page.evaluate(() => window.gcpshot.updateSettings({}))
    const trays = await app.evaluate(({ Tray }) => ({ count: Tray.__settingsTest.trays.size, destroyed: Tray.__settingsTest.destroyed }))
    assert.deepEqual(trays, { count: 1, destroyed: 0 })
    await page.screenshot({ path: 'release/shortcut-settings-validated.png' })
    console.log('Shortcut UI: conflicts rejected, prior setting preserved, suggestions saved, global editing suspension and exactly one reusable tray passed.')
  } finally {
    if (await page.getByRole('button', { name: 'Fechar configurações', exact: true }).count()) await page.getByRole('button', { name: 'Fechar configurações', exact: true }).click()
    await app.evaluate(({ Tray, globalShortcut }) => {
      const state = Tray.__settingsTest
      Tray.prototype.setContextMenu = state.setMenu; Tray.prototype.destroy = state.destroy; globalShortcut.register = state.register
      delete Tray.__settingsTest
    })
    await page.evaluate((settings) => window.gcpshot.updateSettings({ liveColorShortcut: settings.liveColorShortcut }), original)
  }
}
