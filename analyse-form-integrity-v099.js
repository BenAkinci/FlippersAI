(() => {
  if (window.__flippersAnalyseFormIntegrityV099) return
  window.__flippersAnalyseFormIntegrityV099 = true

  const clean = v => String(v || '').trim()
  const normalize = value => {
    try {
      const u = new URL(value)
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`
    } catch {
      return clean(value).replace(/[?#].*$/, '').replace(/\/$/, '')
    }
  }

  let boundForm = null
  let userTouchedAux = false
  let userTouchedUrl = false
  let boundUrl = ''

  function clearAux(form) {
    if (!form) return
    if (form.elements.title) form.elements.title.value = ''
    if (form.elements.price) form.elements.price.value = ''
    if (form.elements.text) form.elements.text.value = ''
    delete form.dataset.websiteFallbackPass
    delete form.dataset.flippersEvidenceUrl
    document.querySelector('#directAnalysisResult')?.remove()
  }

  function hasAux(form) {
    return [form?.elements?.title, form?.elements?.price, form?.elements?.text].some(f => clean(f?.value))
  }

  function evidenceMatches(form) {
    const current = normalize(form?.elements?.url?.value || '')
    const evidence = normalize(form?.dataset?.flippersEvidenceUrl || '')
    return Boolean(current && evidence && current === evidence)
  }

  function sweepRestoredValues(form) {
    if (!form || userTouchedAux || evidenceMatches(form)) return
    if (hasAux(form)) clearAux(form)
  }

  function wire() {
    const form = document.querySelector('form#newDeal')
    if (!(form instanceof HTMLFormElement)) return
    if (boundForm === form) return

    boundForm = form
    userTouchedAux = false
    userTouchedUrl = false
    boundUrl = normalize(form.elements.url?.value || '')
    form.autocomplete = 'off'

    ;[form.elements.title, form.elements.price, form.elements.text].filter(Boolean).forEach(field => {
      field.setAttribute('autocomplete', 'off')
      field.addEventListener('input', () => { userTouchedAux = true })
      field.addEventListener('keydown', () => { userTouchedAux = true })
      field.addEventListener('paste', () => { userTouchedAux = true })
    })

    const urlField = form.elements.url
    if (urlField) {
      urlField.setAttribute('autocomplete', 'off')
      const handle = () => {
        userTouchedUrl = true
        const next = normalize(urlField.value)
        if (next && next !== boundUrl) {
          clearAux(form)
          userTouchedAux = false
          boundUrl = next
          form.dataset.flippersCurrentListingUrl = next
        }
      }
      urlField.addEventListener('input', handle)
      urlField.addEventListener('change', handle)
      urlField.addEventListener('paste', () => setTimeout(handle, 0))
    }

    form.addEventListener('submit', () => {
      const current = normalize(urlField?.value || '')
      const evidence = normalize(form.dataset.flippersEvidenceUrl || '')
      if (!userTouchedAux && current && current !== evidence) clearAux(form)
    }, true)

    // Browsers may restore form values asynchronously after mount. Re-check after
    // the app has rendered and after BFCache/pageshow restoration.
    ;[0, 100, 350, 800, 1500, 3000].forEach(ms => setTimeout(() => sweepRestoredValues(form), ms))
  }

  window.addEventListener('pageshow', () => {
    setTimeout(() => {
      wire()
      if (boundForm) sweepRestoredValues(boundForm)
    }, 0)
    setTimeout(() => { if (boundForm) sweepRestoredValues(boundForm) }, 500)
  })

  const observer = new MutationObserver(() => wire())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  wire()
})()
