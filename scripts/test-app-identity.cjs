const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

module.exports = async function testAppIdentity(app, page) {
  const identity = await app.evaluate(({ app }) => ({ name: app.getName(), packaged: app.isPackaged, executable: process.execPath, resources: process.resourcesPath, appPath: app.getAppPath() }))
  assert.equal(identity.name, 'GCPShot')
  if (process.platform === 'win32') {
    if (identity.packaged) assert.ok(existsSync(join(identity.resources, 'GCPShot.ico')), 'The taskbar icon must be outside app.asar')
    const handle = await (await app.browserWindow(page)).evaluate((window) => window.getNativeWindowHandle().readBigUInt64LE().toString())
    const args = ['-NoProfile', '-File', resolve('scripts/test-windows-identity.ps1'), '-ExpectedIcon', resolve('build/icon.ico'), '-WindowHandle', handle]
    const executable = identity.packaged ? identity.executable : process.env.GCP_PACKAGED_EXE
    if (executable) args.push('-Executable', executable)
    console.log(execFileSync('powershell.exe', args, { encoding: 'utf8', timeout: 30000 }).trim())
  }
  if (identity.packaged && process.platform === 'darwin') {
    const plist = resolve(identity.executable, '../../Info.plist')
    const get = (key) => execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim()
    assert.equal(get('CFBundleName'), 'GCPShot')
    const icon = get('CFBundleIconFile')
    assert.ok(!icon.toLowerCase().includes('electron'))
    assert.ok(existsSync(join(identity.resources, icon.endsWith('.icns') ? icon : `${icon}.icns`)))
  }
  if (identity.packaged && process.platform === 'linux') {
    const desktop = readFileSync('/usr/share/applications/gcpshot.desktop', 'utf8')
    assert.match(desktop, /^Name=GCPShot$/m)
    assert.match(desktop, /^StartupWMClass=gcpshot$/m)
    assert.match(desktop, /^Icon=gcpshot$/m)
    assert.ok(existsSync('/usr/share/icons/hicolor/256x256/apps/gcpshot.png'))
  }
  console.log('Application identity and platform icon checks passed.')
}
