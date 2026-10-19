const hex = new URLSearchParams(location.search).get('hex')
if (/^#[0-9A-F]{6}$/.test(hex || '')) {
  document.getElementById('hex').textContent = hex
  document.getElementById('swatch').style.background = hex
}
document.getElementById('open').addEventListener('click', () => window.gcpshot.openColorLabFromToast())
document.getElementById('dismiss').addEventListener('click', () => window.gcpshot.dismissColorToast())
