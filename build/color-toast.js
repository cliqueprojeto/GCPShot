const params = new URLSearchParams(location.search)
const hex = params.get('hex')
document.title = 'GCPShot'
if (params.get('destination') === 'home') {
  document.getElementById('open').setAttribute('aria-label', 'Abrir GCPShot')
  document.getElementById('brand').textContent = 'GCPShot'
  document.getElementById('action').textContent = 'Abrir o GCPShot'
  document.getElementById('swatch').hidden = true
}
if (params.get('destination') === 'studio') {
  document.getElementById('open').setAttribute('aria-label', 'Abrir Estudio de imagem')
  document.getElementById('brand').textContent = 'GCPShot / Captura'
  document.getElementById('hex').textContent = 'Captura copiada'
  document.getElementById('description').textContent = 'Imagem na área de transferência e no Estúdio'
  document.getElementById('action').textContent = 'Abrir no Estúdio de imagem'
  document.getElementById('swatch').style.background = '#5F42EB'
}
if (params.get('title')) {
  document.getElementById('hex').textContent = params.get('title')
  document.getElementById('description').textContent = params.get('body') || ''
  document.getElementById('swatch').hidden = true
}
if (/^#[0-9A-F]{6}$/.test(hex || '')) {
  document.getElementById('hex').textContent = hex
  document.getElementById('swatch').style.background = hex
}
document.getElementById('open').addEventListener('click', () => window.gcpshot.openColorLabFromToast())
document.getElementById('dismiss').addEventListener('click', () => window.gcpshot.dismissColorToast())
