(() => {
  if (window.__flippersWebsiteAnalyseBridge) return
  window.__flippersWebsiteAnalyseBridge = true

  const ORIGIN = location.origin

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== ORIGIN) return
    const message = event.data
    if (!message || message.type !== 'FLIPPERS_WEBSITE_SCAN_REQUEST' || !message.requestId) return

    const requestId = String(message.requestId)
    const requestedUrl = String(message.url || '')

    window.postMessage({
      type: 'FLIPPERS_WEBSITE_SCAN_ACK',
      requestId
    }, ORIGIN)

    chrome.runtime.sendMessage({ type: 'FLIPPERS_GET_MARKETPLACE_TAB' }, tabResult => {
      if (chrome.runtime.lastError || !tabResult?.ok) {
        window.postMessage({
          type: 'FLIPPERS_WEBSITE_SCAN_RESPONSE',
          requestId,
          ok: false,
          error: chrome.runtime.lastError?.message || tabResult?.error || 'No marketplace tab is available.'
        }, ORIGIN)
        return
      }

      const activeUrl = String(tabResult.data?.url || '')
      const normalize = value => {
        try {
          const u = new URL(value)
          return `${u.origin}${u.pathname.replace(/\/$/, '')}`
        } catch { return String(value || '').replace(/[?#].*$/, '').replace(/\/$/, '') }
      }

      if (requestedUrl && normalize(requestedUrl) !== normalize(activeUrl)) {
        window.postMessage({
          type: 'FLIPPERS_WEBSITE_SCAN_RESPONSE',
          requestId,
          ok: false,
          error: 'Open the pasted marketplace listing in a browser tab so FlippersAI can read the authenticated page.',
          activeUrl
        }, ORIGIN)
        return
      }

      chrome.runtime.sendMessage({ type: 'FLIPPERS_SCAN_ACTIVE_TAB' }, scanResult => {
        if (chrome.runtime.lastError || !scanResult?.ok) {
          window.postMessage({
            type: 'FLIPPERS_WEBSITE_SCAN_RESPONSE',
            requestId,
            ok: false,
            error: chrome.runtime.lastError?.message || scanResult?.error || 'Could not read the marketplace listing.'
          }, ORIGIN)
          return
        }

        window.postMessage({
          type: 'FLIPPERS_WEBSITE_SCAN_RESPONSE',
          requestId,
          ok: true,
          data: scanResult.data
        }, ORIGIN)
      })
    })
  })
})()
