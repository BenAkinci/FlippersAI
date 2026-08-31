(() => {
  if (window.__flippersAnalyseFormIntegrityV096) return
  window.__flippersAnalyseFormIntegrityV096 = true

  const clean = v => String(v || '').trim()
  const normalize = value => {
    try {
      const u = new URL(value)
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`
    } catch {
      return clean(value).replace(/[?#].*$/, '').replace(/\/$/, '')
    }
  }

  function wire() {
    const form = document.querySelector('form#newDeal')
    if (!(form instanceof HTMLFormElement) || form.dataset.integrityV096 === '1') return
    form.dataset.integrityV096 = '1'

    const urlField = form.elements.url
    if (!urlField) return

    let boundUrl = normalize(urlField.value)

    const clearAuxiliaryFields = () => {
      if (form.elements.title) form.elements.title.value = ''
      if (form.elements.price) form.elements.price.value = ''
      if (form.elements.text) form.elements.text.value = ''
      delete form.dataset.websiteFallbackPass
      document.querySelector('#directAnalysisResult')?.remove()
    }

    const handleUrlChange = () => {
      const next = normalize(urlField.value)
      if (!next) {
        boundUrl = ''
        return
      }

      // A new marketplace URL defines a new opportunity. Never carry facts from
      // a previous listing into it. This intentionally clears only the optional
      // auxiliary fields; anything the user types after entering this URL remains.
      if (next !== boundUrl) {
        clearAuxiliaryFields()
        boundUrl = next
        form.dataset.flippersCurrentListingUrl = next
      }
    }

    urlField.addEventListener('input', handleUrlChange)
    urlField.addEventListener('change', handleUrlChange)
    urlField.addEventListener('paste', () => setTimeout(handleUrlChange, 0))

    // If the page restored auxiliary values but no URL, treat them as stale.
    if (!boundUrl && (clean(form.elements.title?.value) || clean(form.elements.price?.value) || clean(form.elements.text?.value))) {
      form.dataset.flippersHasUnboundAuxiliaryValues = '1'
    }
  }

  const observer = new MutationObserver(wire)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  wire()
})()
