(() => {
  if (window.__flippersManualDrop132) return
  window.__flippersManualDrop132 = true

  const isImageFile = file => file && (file.type || '').startsWith('image/')
  let dragDepth = 0
  let scrollLock = null

  function getZone() {
    return document.getElementById('manualDropZone')
  }

  function isAnalyseActive() {
    return Boolean(document.getElementById('newDeal') && getZone())
  }

  function transferLooksLikeImage(dt) {
    if (!dt) return false
    const files = [...(dt.files || [])]
    if (files.some(isImageFile)) return true
    const items = [...(dt.items || [])]
    if (items.some(item => item.kind === 'file' && (!item.type || item.type.startsWith('image/')))) return true
    const types = [...(dt.types || [])]
    return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html')
  }

  function pointInsideZone(event) {
    const zone = getZone()
    if (!zone) return false
    const rect = zone.getBoundingClientRect()
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
  }

  function lockScroll() {
    if (scrollLock) return
    scrollLock = { x: window.scrollX, y: window.scrollY }
    document.documentElement.classList.add('analyse-image-drag-active')
  }

  function restoreLockedScroll() {
    if (!scrollLock) return
    if (Math.abs(window.scrollY - scrollLock.y) > 1 || Math.abs(window.scrollX - scrollLock.x) > 1) {
      window.scrollTo({ left: scrollLock.x, top: scrollLock.y, behavior: 'auto' })
    }
  }

  function unlockScroll() {
    scrollLock = null
    dragDepth = 0
    document.documentElement.classList.remove('analyse-image-drag-active')
    getZone()?.classList.remove('dragging')
  }

  function ensureStyles() {
    if (document.getElementById('analyseManualDrop132Styles')) return
    const style = document.createElement('style')
    style.id = 'analyseManualDrop132Styles'
    style.textContent = `
      html.analyse-image-drag-active,
      html.analyse-image-drag-active body { scroll-behavior:auto !important; }
      #manualDropZone.dragging {
        border-color:#f59e0b !important;
        background:#fff8e8 !important;
      }
    `
    document.head.appendChild(style)
  }

  function setStatus(message, isError = false) {
    const zone = getZone()
    if (!zone) return
    let status = document.getElementById('manualDropStatus')
    if (!status) {
      status = document.createElement('small')
      status.id = 'manualDropStatus'
      status.style.display = 'block'
      status.style.marginTop = '6px'
      zone.querySelector('span')?.appendChild(status)
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

  // Cancel the browser's native file/image navigation and autoscroll while an
  // image is being dragged over Analyse. The upload box remains the only drop target.
  document.addEventListener('dragenter', event => {
    if (!isAnalyseActive() || !transferLooksLikeImage(event.dataTransfer)) return
    event.preventDefault()
    dragDepth += 1
    if (pointInsideZone(event)) {
      event.stopPropagation()
      lockScroll()
      restoreLockedScroll()
      getZone()?.classList.add('dragging')
      setStatus('Drop to add this image.')
    }
  }, true)

  document.addEventListener('dragover', event => {
    if (!isAnalyseActive() || !transferLooksLikeImage(event.dataTransfer)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = pointInsideZone(event) ? 'copy' : 'none'
    if (pointInsideZone(event)) {
      event.stopPropagation()
      lockScroll()
      restoreLockedScroll()
      getZone()?.classList.add('dragging')
    } else {
      getZone()?.classList.remove('dragging')
    }
  }, true)

  document.addEventListener('dragleave', event => {
    if (!isAnalyseActive()) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (!pointInsideZone(event)) getZone()?.classList.remove('dragging')
    if (dragDepth === 0) unlockScroll()
  }, true)

  document.addEventListener('drop', event => {
    if (!isAnalyseActive() || !transferLooksLikeImage(event.dataTransfer)) return
    const inside = pointInsideZone(event)
    event.preventDefault()
    if (!inside) {
      unlockScroll()
      return
    }
    event.stopImmediatePropagation()
    restoreLockedScroll()
    unlockScroll()

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

  document.addEventListener('dragend', unlockScroll, true)
  window.addEventListener('blur', unlockScroll)
  ensureStyles()
})()
