(() => {
  if (window.__flippersAnalyseFormIntegrityV097) return
  window.__flippersAnalyseFormIntegrityV097 = true

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
    if (!(form instanceof HTMLFormElement) || form.dataset.integrityV097 === '1') return
    form.dataset.integrityV097 = '1'

    const urlField = form.elements.url
    if (!urlField) return

    let boundUrl = normalize(urlField.value)
    let userTouchedAux = false

    const auxFields = [form.elements.title, form.elements.price, form.elements.text].filter(Boolean)
    auxFields.forEach(field => {
      field.addEventListener('input', () => { userTouchedAux = true })
    })

    const clearAuxiliaryFields = () => {
      if (form.elements.title) form.elements.title.value = ''
      if (form.elements.price) form.elements.price.value = ''
      if (form.elements.text) form.elements.text.value = ''
      delete form.dataset.websiteFallbackPass
      delete form.dataset.flippersEvidenceUrl
      document.querySelector('#directAnalysisResult')?.remove()
    }

    // App/browser form restoration can repopulate an old title/price alongside a URL.
    // Those values have no trustworthy provenance, so clear them once on initial bind.
    const restoredAuxiliary = auxFields.some(field => clean(field.value))
    if (restoredAuxiliary && !form.dataset.flippersEvidenceUrl) {
      clearAuxiliaryFields()
      userTouchedAux = false
    }

    const handleUrlChange = () => {
      const next = normalize(urlField.value)
      if (!next) {
        boundUrl = ''
        return
      }
      if (next !== boundUrl) {
        clearAuxiliaryFields()
        userTouchedAux = false
        boundUrl = next
        form.dataset.flippersCurrentListingUrl = next
      }
    }

    urlField.addEventListener('input', handleUrlChange)
    urlField.addEventListener('change', handleUrlChange)
    urlField.addEventListener('paste', () => setTimeout(handleUrlChange, 0))

    // Final contamination gate: if optional values exist at submit time but they were
    // neither typed after this script bound nor tagged as evidence for this URL, clear them.
    form.addEventListener('submit', () => {
      const current = normalize(urlField.value)
      const evidenceUrl = normalize(form.dataset.flippersEvidenceUrl || '')
      if (!userTouchedAux && current && evidenceUrl !== current) clearAuxiliaryFields()
    }, true)
  }

  const observer = new MutationObserver(wire)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  wire()
})()
