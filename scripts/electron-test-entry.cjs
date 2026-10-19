const { app } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const profile = resolve('release/test-profile')
mkdirSync(profile, { recursive: true })
writeFileSync(resolve(profile, 'settings.json'), JSON.stringify({ liveColorShortcut: 'Ctrl+Alt+Shift+F9', printScreenShortcut: false }))
app.setPath('userData', profile)
app.setLoginItemSettings = () => {}
require('../out/main/index.js')
