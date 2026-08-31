(() => {
  if (window.__flippersAnalyseBrowserAcquisitionV092) return
  window.__flippersAnalyseBrowserAcquisitionV092 = true

  const clean = value => String(value || '').trim()

  function dataUrlToFile(dataUrl, index) {
    try {
      const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i)
      if (!match) return null
      const binary = atob(match[2])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const ext = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg'
      return new File([bytes], `listing-${index + 1}.${ext}`, { type: match[1] })
    } catch { return null }
  }

  function requestBrowserScan(url) {
    return new Promise(resolve => {
      const requestId = `analyse-${Date.now()}-${Math.random().toString(36).slice(2)}`
      let acked = false
      let settled = false
      let ackTimer
      let responseTimer

      const finish = value => {
        if (settled) return
        settled = true
        clearTimeout(ackTimer)
        clearTimeout(responseTimer)
        window.removeEventListener('message', onMessage)
        resolve(value)
      }

      const onMessage = event => {
        if (event.source !== window || event.origin !== location.origin) return
        const message = event.data
        if (!message || message.requestId !== requestId) return
        if (message.type === 'FLIPPERS_WEBSITE_SCAN_ACK') {
          acked = true
          clearTimeout(ackTimer)
          responseTimer = setTimeout(() => finish(null), 22000)
          return
        }
        if (message.type === 'FLIPPERS_WEBSITE_SCAN_RESPONSE') {
          finish(message.ok ? message.data || null : null)
        }
      }

      window.addEventListener('message', onMessage)
      window.postMessage({ type: 'FLIPPERS_WEBSITE_SCAN_REQUEST', requestId, url }, location.origin)
      ackTimer = setTimeout(() => { if (!acked) finish(null) }, 650)
    })
  }

  function enrichForm(form, scan) {
    if (!scan || typeof scan !== 'object') return

    const title = form.elements.title
    const price = form.elements.price
    const text = form.elements.text
    const images = form.elements.images

    if (title && !clean(title.value) && clean(scan.title)) title.value = clean(scan.title)
    if (price && !clean(price.value) && Number.isFinite(Number(scan.askingPrice))) price.value = String(Number(scan.askingPrice))

    if (text) {
      const captured = [
        clean(scan.description) ? `Description: ${clean(scan.description)}` : '',
        clean(scan.condition) ? `Seller-stated condition: ${clean(scan.condition)}` : '',
        clean(scan.location) ? `Location: ${clean(scan.location)}` : '',
        clean(scan.sellerName) ? `Seller: ${clean(scan.sellerName)}` : '',
        clean(scan.listingId) ? `Listing ID: ${clean(scan.listingId)}` : '',
        clean(scan.visibleText) ? `Rendered listing page text:\n${clean(scan.visibleText).slice(0, 24000)}` : ''
      ].filter(Boolean).join('\n\n')
      if (!clean(text.value) && captured) text.value = captured
    }

    if (images && (!images.files || images.files.length === 0) && Array.isArray(scan.images) && scan.images.length) {
      try {
        const transfer = new DataTransfer()
        scan.images.slice(0, 6).map(dataUrlToFile).filter(Boolean).forEach(file => transfer.items.add(file))
        if (transfer.files.length) images.files = transfer.files
      } catch {}
    }

    form.dataset.browserAcquisition = 'success'
    form.dataset.browserAcquisitionSource = clean(scan.source || 'authenticated_browser_dom')
  }

  document.addEventListener('submit', async event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'newDeal') return
    if (form.dataset.browserAcquisitionAttempted === '1') return

    const data = new FormData(form)
    const url = clean(data.get('url'))
    if (!url) return

    form.dataset.browserAcquisitionAttempted = '1'
    event.preventDefault()
    event.stopImmediatePropagation()

    const button = form.querySelector('button[type="submit"],button:not([type])')
    const previous = button?.innerHTML
    if (button) {
      button.disabled = true
      button.textContent = 'Reading listing…'
    }

    try {
      const scan = await requestBrowserScan(url)
      if (scan) enrichForm(form, scan)
    } catch {}
    finally {
      if (button) {
        button.disabled = false
        if (previous) button.innerHTML = previous
      }
    }

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }, true)
})()
