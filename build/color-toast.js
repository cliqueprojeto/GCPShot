const hex = new URLSearchParams(location.search).get('hex')
if (new URLSearchParams(location.search).get('destination') === 'studio') {
  document.getElementById('open').setAttribute('aria-label', 'Abrir Estudio de imagem')
  document.getElementById('brand').textContent = 'GCPShot / Captura'
  document.getElementById('hex').textContent = 'Captura copiada'
  document.getElementById('description').textContent = 'Imagem na área de transferência e no Estúdio'
  document.getElementById('action').textContent = 'Abrir no Estúdio de imagem'
  document.getElementById('swatch').style.background = '#5F42EB'
}
if (/^#[0-9A-F]{6}$/.test(hex || '')) {
  document.getElementById('hex').textContent = hex
  document.getElementById('swatch').style.background = hex
}
document.getElementById('open').addEventListener('click', () => window.gcpshot.openColorLabFromToast())
document.getElementById('dismiss').addEventListener('click', () => window.gcpshot.dismissColorToast())
