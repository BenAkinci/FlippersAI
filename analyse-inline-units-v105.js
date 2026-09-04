(() => {
  const PRICE_RE = /^\s*(AUD|USD|GBP)\s*\$?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*$/i
  const PRICE_SUFFIX_RE = /^\s*\$?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(AUD|USD|GBP)\s*$/i
  const SIZE_RE = /^\s*(US|UK|EU|AU)\s*[-:]?\s*([A-Za-z0-9][A-Za-z0-9 .\/-]*)\s*$/i
  const SIZE_EXEMPT_RE = /^(?:OS|ONE\s*SIZE|N\/?A|NOT\s*APPLICABLE)$/i

  function ensureStyles() {
    if (document.getElementById('inlineUnitStyles')) return
    const style = document.createElement('style')
    style.id = 'inlineUnitStyles'
    style.textContent = `
      .inline-unit-field{display:flex;flex-direction:column;gap:6px;min-width:0}
      .inline-unit-field input{width:100%;box-sizing:border-box}
      .inline-unit-field .field-error{display:none;margin:0;color:#b42318;font-size:12px;line-height:1.35}
      .inline-unit-field.invalid input{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.10)!important;background:#fffafa}
      .inline-unit-field.invalid .field-error{display:block}
      .inline-unit-field .field-help{color:#6f8490;font-size:12px;line-height:1.35}
    `
    document.head.appendChild(style)
  }

  function parsePrice(value) {
    const text = String(value || '').trim().toUpperCase()
    if (!text) return null
    let m = text.match(PRICE_RE)
    if (m) return { currency: m[1].toUpperCase(), amount: Number(m[2].replace(',', '.')) }
    m = text.match(PRICE_SUFFIX_RE)
    if (m) return { currency: m[2].toUpperCase(), amount: Number(m[1].replace(',', '.')) }
    return null
  }

  function parseSize(value) {
    const text = String(value || '').trim()
    if (!text) return null
    if (SIZE_EXEMPT_RE.test(text)) return { system: '', size: text }
    const m = text.match(SIZE_RE)
    return m ? { system: m[1].toUpperCase(), size: m[2].trim() } : null
  }

  function setInvalid(wrapper, invalid, message = '') {
    if (!wrapper) return
    wrapper.classList.toggle('invalid', invalid)
    const error = wrapper.querySelector('.field-error')
    if (error && message) error.textContent = message
    const input = wrapper.querySelector('input')
    if (input) input.setAttribute('aria-invalid', invalid ? 'true' : 'false')
  }

  function hideOriginalControl(control) {
    const label = control?.closest('label')
    if (label) label.style.display = 'none'
    else if (control) control.style.display = 'none'
  }

  function syncPriceFromVisible(form, validate = false) {
    const visible = form.querySelector('[name="price_entry"]')
    const price = form.elements?.price
    const currency = form.elements?.currency
    const wrapper = visible?.closest('.inline-unit-field')
    if (!visible || !price || !currency) return true
    const raw = visible.value.trim()
    if (!raw) {
      price.value = ''
      if (validate) setInvalid(wrapper, false)
      return true
    }
    const parsed = parsePrice(raw)
    if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount < 0) {
      if (validate) setInvalid(wrapper, true, 'Include the currency with the price, e.g. AUD 100, USD 85 or GBP 70.')
      return false
    }
    price.value = String(parsed.amount)
    currency.value = parsed.currency
    setInvalid(wrapper, false)
    return true
  }

  function syncSizeFromVisible(form, validate = false) {
    const visible = form.querySelector('[name="size_entry"]')
    const size = form.elements?.size
    const system = form.elements?.size_system
    const wrapper = visible?.closest('.inline-unit-field')
    if (!visible || !size || !system) return true
    const raw = visible.value.trim()
    if (!raw) {
      size.value = ''
      system.value = ''
      if (validate) setInvalid(wrapper, false)
      return true
    }
    const parsed = parseSize(raw)
    if (!parsed) {
      if (validate) setInvalid(wrapper, true, 'Include the size system, e.g. US 10, UK 9, EU 44 or AU 10.')
      return false
    }
    size.value = parsed.size
    system.value = parsed.system
    setInvalid(wrapper, false)
    return true
  }

  function syncVisibleFromHidden(form) {
    const p = form.querySelector('[name="price_entry"]')
    const s = form.querySelector('[name="size_entry"]')
    if (p && p.dataset.userEdited !== 'true') {
      const amount = String(form.elements?.price?.value || '').trim()
      const currency = String(form.elements?.currency?.value || '').trim()
      if (amount && currency) p.value = `${currency} ${amount}`
    }
    if (s && s.dataset.userEdited !== 'true') {
      const size = String(form.elements?.size?.value || '').trim()
      const system = String(form.elements?.size_system?.value || '').trim()
      if (size) s.value = system ? `${system} ${size}` : size
    }
  }

  function enhance() {
    ensureStyles()
    const form = document.getElementById('newDeal')
    if (!form || form.dataset.structured !== 'v104' || form.dataset.inlineUnits === 'v105') return
    const price = form.elements?.price
    const currency = form.elements?.currency
    const size = form.elements?.size
    const sizeSystem = form.elements?.size_system
    if (!price || !currency || !size || !sizeSystem) return

    form.dataset.inlineUnits = 'v105'

    const priceLabel = price.closest('label')
    const priceParent = priceLabel?.parentElement
    if (priceLabel && priceParent) {
      const wrapper = document.createElement('label')
      wrapper.className = 'inline-unit-field'
      wrapper.innerHTML = `<span>Current price</span><input name="price_entry" inputmode="decimal" autocomplete="off" placeholder="e.g. AUD 100, USD 85, GBP 70"><small class="field-help">Include the currency code in the same box.</small><small class="field-error">Include the currency with the price.</small>`
      priceParent.insertBefore(wrapper, priceLabel)
    }
    hideOriginalControl(price)
    hideOriginalControl(currency)

    const sizeLabel = size.closest('label')
    const sizeParent = sizeLabel?.parentElement
    if (sizeLabel && sizeParent) {
      const wrapper = document.createElement('label')
      wrapper.className = 'inline-unit-field'
      wrapper.innerHTML = `<span>Size</span><input name="size_entry" autocomplete="off" placeholder="e.g. US 10, UK 9, EU 44, AU 10"><small class="field-help">Include the size system in the same box.</small><small class="field-error">Include the size system.</small>`
      sizeParent.insertBefore(wrapper, sizeLabel)
    }
    hideOriginalControl(size)
    hideOriginalControl(sizeSystem)

    const priceEntry = form.querySelector('[name="price_entry"]')
    const sizeEntry = form.querySelector('[name="size_entry"]')
    priceEntry?.addEventListener('input', () => { priceEntry.dataset.userEdited = 'true'; syncPriceFromVisible(form, false); setInvalid(priceEntry.closest('.inline-unit-field'), false) })
    priceEntry?.addEventListener('blur', () => syncPriceFromVisible(form, true))
    sizeEntry?.addEventListener('input', () => { sizeEntry.dataset.userEdited = 'true'; syncSizeFromVisible(form, false); setInvalid(sizeEntry.closest('.inline-unit-field'), false) })
    sizeEntry?.addEventListener('blur', () => syncSizeFromVisible(form, true))

    syncVisibleFromHidden(form)
  }

  document.addEventListener('submit', event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'newDeal' || form.dataset.inlineUnits !== 'v105') return
    const priceOk = syncPriceFromVisible(form, true)
    const sizeOk = syncSizeFromVisible(form, true)
    if (!priceOk || !sizeOk) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const first = form.querySelector('.inline-unit-field.invalid input')
      first?.focus()
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, true)

  let timer
  new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(() => { enhance(); const form = document.getElementById('newDeal'); if (form?.dataset.inlineUnits === 'v105') syncVisibleFromHidden(form) }, 40)
  }).observe(document.getElementById('app'), { childList: true, subtree: true })

  setInterval(() => {
    const form = document.getElementById('newDeal')
    if (form?.dataset.inlineUnits === 'v105') syncVisibleFromHidden(form)
  }, 600)

  enhance()
})()
