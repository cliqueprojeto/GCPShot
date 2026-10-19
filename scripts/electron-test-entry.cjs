const { app } = require('electron')
const { mkdirSync } = require('node:fs')
const { resolve } = require('node:path')
const profile = resolve('release/test-profile')
mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setLoginItemSettings = () => {}
require('../out/main/index.js')
