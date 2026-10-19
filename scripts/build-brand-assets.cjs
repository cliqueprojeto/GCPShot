const sharp = require('sharp')
const fs = require('node:fs/promises')
const color = '#5F42EB'

async function bitmap(input, output) {
  const { data, info } = await sharp(input).flatten({ background: color }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const stride = Math.ceil(info.width * 3 / 4) * 4
  const buffer = Buffer.alloc(54 + stride * info.height)
  buffer.write('BM'); buffer.writeUInt32LE(buffer.length, 2); buffer.writeUInt32LE(54, 10)
  buffer.writeUInt32LE(40, 14); buffer.writeInt32LE(info.width, 18); buffer.writeInt32LE(info.height, 22)
  buffer.writeUInt16LE(1, 26); buffer.writeUInt16LE(24, 28); buffer.writeUInt32LE(stride * info.height, 34)
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const from = (y * info.width + x) * 3, to = 54 + (info.height - 1 - y) * stride + x * 3
    buffer[to] = data[from + 2]; buffer[to + 1] = data[from + 1]; buffer[to + 2] = data[from]
  }
  await fs.writeFile(output, buffer)
}

;(async () => {
  await sharp('build/icon-master.png').resize(1024, 1024).png().toFile('build/icon.png')
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
  await fs.mkdir('build/icons', { recursive: true })
  for (const size of sizes) {
    await sharp('build/icon.png').resize(size, size).png().toFile(`build/icon-${size}.png`)
    await fs.copyFile(`build/icon-${size}.png`, `build/icons/${size}x${size}.png`)
  }
  const { default: toIco } = await import('png-to-ico')
  await fs.writeFile('build/icon.ico', await toIco(sizes.filter((size) => size <= 256).map((size) => `build/icon-${size}.png`)))
  const icon = (await fs.readFile('build/icon.png')).toString('base64')
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { Scan, Monitor, Images, Pipette, Palette, Crosshair, Power, LogOut, Settings2, Info } = require('lucide-react')
  await fs.mkdir('build/tray', { recursive: true })
  for (const [name, component] of Object.entries({ region: Scan, fullscreen: Monitor, studio: Images, colors: Pipette, palettes: Palette, live: Crosshair, startup: Power, quit: LogOut, settings: Settings2, about: Info })) {
    for (const [variant, stroke] of [['light', '#ECECF5'], ['dark', '#343047']]) {
      const markup = renderToStaticMarkup(React.createElement(component, { size: 20, color: stroke, strokeWidth: 1.8 }))
      await sharp(Buffer.from(markup)).png().toFile(`build/tray/${name}-${variant}.png`)
    }
  }
  const image = (x, y, size) => `<image href="data:image/png;base64,${icon}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
  const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/>${body}</svg>`)
  await bitmap(svg(164, 314, `${image(22, 28, 120)}<text x="82" y="181" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="24" font-weight="600" fill="white">GCPShot</text><text x="82" y="208" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="12" fill="#e5dfff">Capture. Crie.</text><text x="82" y="228" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="12" fill="#e5dfff">Compartilhe.</text><path d="M32 263h100" stroke="#bfb1ff"/><text x="82" y="287" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="9" fill="white">GESTAO CULTURAL PRO</text>`), 'build/installerSidebar.bmp')
  await bitmap(svg(150, 57, `${image(4, 5, 47)}<text x="56" y="27" font-family="Segoe UI, sans-serif" font-size="17" font-weight="600" fill="white">GCPShot</text><text x="57" y="43" font-family="Segoe UI, sans-serif" font-size="9" fill="#e5dfff">Capture &amp; Studio</text>`), 'build/installerHeader.bmp')
  await sharp(svg(660, 420, `${image(292, 14, 76)}<text x="330" y="117" text-anchor="middle" font-family="Helvetica, sans-serif" font-size="30" font-weight="600" fill="white">GCPShot</text><text x="330" y="148" text-anchor="middle" font-family="Helvetica, sans-serif" font-size="15" fill="#e5dfff">Seu proximo clique, com mais possibilidades.</text><path d="M291 242h78m-16-16 16 16-16 16" stroke="#e8e1ff" stroke-width="3" fill="none"/><text x="330" y="350" text-anchor="middle" font-family="Helvetica, sans-serif" font-size="15" fill="white">Arraste GCPShot para Aplicativos</text><text x="330" y="380" text-anchor="middle" font-family="Helvetica, sans-serif" font-size="11" fill="#e5dfff">GESTAO CULTURAL PRO</text>`)).png().toFile('build/dmg-background.png')
})().catch((error) => { console.error(error); process.exitCode = 1 })
