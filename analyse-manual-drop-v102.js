(() => {
  const isImageFile = file => file && (file.type || '').startsWith('image/')

  function zoneForEvent(event) {
    const zone = document.getElementById('manualDropZone')
    if (!zone) return null
    const target = event.target
    return target instanceof Node && zone.contains(target) ? zone : null
  }

  function setStatus(message, isError = false) {
    const zone = document.getElementById('manualDropZone')
    if (!zone) return
    let status = document.getElementById('manualDropStatus')
    if (!status) {
      status = document.createElement('small')
      status.id = 'manualDropStatus'
      status.style.display = 'block'
      status.style.marginTop = '6px'
      const text = zone.querySelector('span')
      text?.appendChild(status)
    }
    status.textContent = message
    status.style.color = isError ? '#b42318' : '#58717e'
  }

  function attachFiles(files) {
    const input = document.getElementById('manualEvidenceInput')
    if (!input || !files.length) return false
    try {
      const dt = new DataTransfer()
      files.filter(isImageFile).slice(0, 10).forEach(file => dt.items.add(file))
      if (!dt.files.length) return false
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      setStatus(`${dt.files.length} image${dt.files.length === 1 ? '' : 's'} added.`)
      return true
    } catch (error) {
      console.error('[FlippersAI] Could not attach dropped images', error)
      setStatus('Could not attach that image. Try Cmd/Ctrl+V or choose the file instead.', true)
      return false
    }
  }

  function filesFromTransfer(dt) {
    const direct = [...(dt?.files || [])].filter(isImageFile)
    if (direct.length) return direct
    return [...(dt?.items || [])]
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(isImageFile)
  }

  function imageUrlFromTransfer(dt) {
    if (!dt) return ''
    const uri = String(dt.getData('text/uri-list') || '').split('\n').find(x => /^https?:\/\//i.test(x.trim()))
    if (uri) return uri.trim()
    const html = dt.getData('text/html') || ''
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const src = doc.querySelector('img')?.src
      if (src) return src
    }
    const plain = String(dt.getData('text/plain') || '').trim()
    return /^https?:\/\//i.test(plain) ? plain : ''
  }

  async function importRemoteImage(url) {
    if (!url) return false
    setStatus('Importing dropped image…')
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Dropped URL was not an image')
      const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
      const file = new File([blob], `listing-photo-${Date.now()}.${ext}`, { type: blob.type })
      return attachFiles([file])
    } catch (error) {
      console.warn('[FlippersAI] Browser image drag was blocked by source/CORS', error)
      setStatus('That photo came from a webpage that blocks direct image dragging. Copy/paste a screenshot with Cmd/Ctrl+V, or save the image and drop the file here.', true)
      return false
    }
  }

  document.addEventListener('dragenter', event => {
    const zone = zoneForEvent(event)
    if (!zone) return
    event.preventDefault()
    zone.classList.add('dragging')
    setStatus('Drop to add this image.')
  }, true)

  document.addEventListener('dragover', event => {
    const zone = zoneForEvent(event)
    if (!zone) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    zone.classList.add('dragging')
  }, true)

  document.addEventListener('dragleave', event => {
    const zone = zoneForEvent(event)
    if (!zone) return
    if (!zone.contains(event.relatedTarget)) zone.classList.remove('dragging')
  }, true)

  document.addEventListener('drop', event => {
    const zone = zoneForEvent(event)
    if (!zone) return
    event.preventDefault()
    event.stopImmediatePropagation()
    zone.classList.remove('dragging')

    const files = filesFromTransfer(event.dataTransfer)
    if (files.length) {
      attachFiles(files)
      return
    }

    const imageUrl = imageUrlFromTransfer(event.dataTransfer)
    if (imageUrl) {
      importRemoteImage(imageUrl)
      return
    }

    setStatus('No image was detected in that drop. Try Cmd/Ctrl+V or choose the image file.', true)
  }, true)
})()
