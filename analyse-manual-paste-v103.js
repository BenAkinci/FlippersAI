(() => {
  const isImageFile = file => file && (file.type || '').startsWith('image/')

  function setPasteStatus(message, isError = false) {
    const status = document.getElementById('manualPasteStatus')
    if (!status) return
    status.textContent = message
    status.style.color = isError ? '#b42318' : '#58717e'
  }

  function attachPastedFiles(files) {
    const input = document.getElementById('manualEvidenceInput')
    const images = [...files].filter(isImageFile).slice(0, 10)
    if (!input || !images.length) return false
    try {
      const dt = new DataTransfer()
      images.forEach(file => dt.items.add(file))
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      setPasteStatus(`${images.length} copied photo${images.length === 1 ? '' : 's'} added below.`)
      return true
    } catch (error) {
      console.error('[FlippersAI] Could not attach pasted images', error)
      setPasteStatus('Could not add that copied image. Try copying the screenshot again.', true)
      return false
    }
  }

  function imagesFromClipboard(event) {
    const files = [...(event.clipboardData?.files || [])].filter(isImageFile)
    if (files.length) return files
    return [...(event.clipboardData?.items || [])]
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(isImageFile)
  }

  function ensurePasteBox() {
    const form = document.getElementById('newDeal')
    const dropZone = document.getElementById('manualDropZone')
    const tray = document.getElementById('manualEvidenceTray')
    if (!form || !dropZone || !tray || document.getElementById('manualPasteBox')) return

    const box = document.createElement('div')
    box.id = 'manualPasteBox'
    box.className = 'manual-paste-box'
    box.contentEditable = 'true'
    box.setAttribute('role', 'textbox')
    box.setAttribute('aria-label', 'Paste copied listing photos here')
    box.setAttribute('spellcheck', 'false')
    box.innerHTML = `
      <div class="manual-paste-icon" aria-hidden="true">⌘V</div>
      <div class="manual-paste-copy">
        <strong>Paste copied photos here</strong>
        <span>Click this box, then press <b>Cmd+V</b> on Mac or <b>Ctrl+V</b> on Windows.</span>
        <small id="manualPasteStatus">Copied screenshots/photos will appear in the image tray below.</small>
      </div>`

    dropZone.insertAdjacentElement('afterend', box)

    box.addEventListener('paste', event => {
      const images = imagesFromClipboard(event)
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      if (!images.length) {
        setPasteStatus('No copied image was found. Copy a screenshot or photo first, then paste it here.', true)
        return
      }
      attachPastedFiles(images)
      box.blur()
    }, true)

    box.addEventListener('beforeinput', event => {
      if (event.inputType !== 'insertFromPaste') event.preventDefault()
    })

    box.addEventListener('input', () => {
      // This is a paste target, not a text field. Keep its instructional UI intact.
      if (!box.querySelector('.manual-paste-copy')) {
        box.innerHTML = `
          <div class="manual-paste-icon" aria-hidden="true">⌘V</div>
          <div class="manual-paste-copy">
            <strong>Paste copied photos here</strong>
            <span>Click this box, then press <b>Cmd+V</b> on Mac or <b>Ctrl+V</b> on Windows.</span>
            <small id="manualPasteStatus">Copied screenshots/photos will appear in the image tray below.</small>
          </div>`
      }
    })
  }

  function injectStyles() {
    if (document.getElementById('manualPasteStyles')) return
    const style = document.createElement('style')
    style.id = 'manualPasteStyles'
    style.textContent = `
      .manual-paste-box{display:flex;align-items:center;gap:14px;padding:16px 18px;border:1.5px solid #c9dbe3;border-radius:14px;background:#f8fbfc;outline:none;cursor:text;min-height:78px;transition:border-color .15s,box-shadow .15s,background .15s}
      .manual-paste-box:hover{border-color:#9fc1cf;background:#fbfdfe}
      .manual-paste-box:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.13);background:#fffdf8}
      .manual-paste-icon{display:grid;place-items:center;min-width:46px;height:38px;padding:0 7px;border:1px solid #d8e4e9;border-bottom-width:3px;border-radius:8px;background:#fff;color:#344e5a;font-size:12px;font-weight:800;letter-spacing:.03em;user-select:none}
      .manual-paste-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
      .manual-paste-copy strong{font-size:14px;color:#17343f}
      .manual-paste-copy span{font-size:13px;color:#607786}
      .manual-paste-copy small{font-size:12px;color:#58717e;margin-top:2px}
    `
    document.head.appendChild(style)
  }

  let timer
  function enhance() {
    injectStyles()
    ensurePasteBox()
  }

  new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(enhance, 30)
  }).observe(document.getElementById('app'), { childList: true, subtree: true })

  enhance()
})()
