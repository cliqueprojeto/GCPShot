for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', async () => {
    button.disabled = true
    try { await window.gcpshot.finishWelcome(button.dataset.view) }
    catch { button.disabled = false }
  })
}
