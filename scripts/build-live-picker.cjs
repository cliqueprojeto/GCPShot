const { execFileSync } = require('node:child_process')
const { join, resolve } = require('node:path')
if (process.platform === 'darwin') {
  execFileSync('swiftc', ['-swift-version', '5', '-O', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx14.0`, '-framework', 'Cocoa', '-framework', 'ScreenCaptureKit', '-framework', 'CoreGraphics', '-o', 'build/GCPShot.LiveColor', 'native/LiveColorPicker.swift'], { stdio: 'inherit' })
  process.exit(0)
}
if (process.platform === 'linux') {
  const flags = require('node:child_process').execFileSync('pkg-config', ['--cflags', '--libs', 'gtk+-3.0', 'gio-unix-2.0'], { encoding: 'utf8' }).trim().split(/\s+/)
  execFileSync('gcc', ['-O2', '-Wall', '-Wextra', '-o', 'build/GCPShot.LiveColor', 'native/live-color-picker.c', ...flags], { stdio: 'inherit' })
  process.exit(0)
}
if (process.platform !== 'win32') throw new Error('Unsupported build platform.')
const compiler = join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
const preview = process.argv.includes('--preview') ? ['/define:PICKER_PREVIEW'] : []
execFileSync(compiler, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', ...preview, '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/win32icon:build/icon.ico', '/out:build/GCPShot.LiveColor.exe', resolve('native/LiveColorPicker.cs')], { stdio: 'inherit' })
