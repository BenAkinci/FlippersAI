(() => {
  if (window.__flippersListingFidelity129) return
  window.__flippersListingFidelity129 = true

  const $ = (s, r = document) => r.querySelector(s)
  const SYSTEM_ORDER = ['US', 'UK', 'EU', 'AU']

  function setAutoField(name, value) {
    const el = $(`[name="${name}"]`)
    if (!el || !value) return
    const isManual = el.dataset.autoValue === undefined && String(el.value || '').trim()
    if (isManual) return
    el.value = value
    el.dataset.autoValue = value
    el.classList.add('auto-filled')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function evidenceLines(form) {
    return [form.elements?.description?.value, form.elements?.extra_info?.value]
      .filter(Boolean)
      .flatMap(v => String(v).split(/\n|\r|•|·/))
      .map(v => v.trim())
      .filter(Boolean)
  }

  function exactCondition(lines) {
    const rx = /\b(?:brand new|new with tags|new without tags|never worn|unworn|barely worn|worn once|worn twice|like new|excellent condition|great condition|good condition|fair condition|poor condition)\b/i
    for (const line of lines) {
      const m = line.match(rx)
      if (m) return m[0]
    }
    return ''
  }

  function reconcileLiteralListingFacts() {
    const form = $('#newDeal')
    if (!form) return
    const lines = evidenceLines(form)
    if (!lines.length) return

    const condition = exactCondition(lines)

    if (condition) setAutoField('condition', condition)
  }

  function parseDualSizes(raw) {
    const text = String(raw || '').toUpperCase().replace(/\u00A0/g, ' ')
    const pairs = []
    const rx = /\b(US|UK|EU|AU)\s*[-:]?\s*(\d+(?:\.\d+)?(?:\s*1\/2)?)\b/g
    let m
    while ((m = rx.exec(text))) {
      const key = `${m[1]}:${m[2].replace(/\s+/g, ' ')}`
      if (!pairs.some(p => p.key === key)) pairs.push({ key, system: m[1], size: m[2].replace(/\s+/g, ' ') })
    }
    if (pairs.length < 2) return null
    pairs.sort((a, b) => SYSTEM_ORDER.indexOf(a.system) - SYSTEM_ORDER.indexOf(b.system))
    return pairs
  }

  function applyDualSize() {
    const form = $('#newDeal')
    const visible = form?.querySelector('[name="size_entry"]')
    if (!form || !visible) return false
    const pairs = parseDualSizes(visible.value)
    if (!pairs) return false

    const primary = pairs.find(p => p.system === 'US') || pairs[0]
    if (form.elements?.size) form.elements.size.value = primary.size
    if (form.elements?.size_system) form.elements.size_system.value = primary.system
    visible.value = pairs.map(p => `${p.system} ${p.size}`).join(' / ')
    visible.dataset.canonicalValue = visible.value
    visible.dataset.sizeAlternates = JSON.stringify(pairs)
    visible.closest('.inline-unit-field')?.classList.remove('invalid')
    visible.setAttribute('aria-invalid', 'false')
    const err = visible.closest('.inline-unit-field')?.querySelector('.field-error')
    if (err) err.style.display = 'none'
    return true
  }

  document.addEventListener('blur', e => {
    if (e.target?.matches?.('[name="size_entry"]')) applyDualSize()
  }, true)

  document.addEventListener('submit', e => {
    if (e.target?.id === 'newDeal') applyDualSize()
  }, true)

  let timer
  const observer = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      reconcileLiteralListingFacts()
      applyDualSize()
    }, 80)
  })

  const app = document.getElementById('app')
  if (app) observer.observe(app, { childList: true, subtree: true, characterData: true })

  document.addEventListener('input', e => {
    if (e.target?.matches?.('[name="description"],[name="extra_info"]')) {
      clearTimeout(timer)
      timer = setTimeout(reconcileLiteralListingFacts, 120)
    }
  })

  reconcileLiteralListingFacts()
  applyDualSize()
})()
