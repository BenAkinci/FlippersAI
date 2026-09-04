(() => {
  const SIZE_EXEMPT_RE = /^(?:OS|ONE\s*SIZE|N\/?A|NOT\s*APPLICABLE)$/i
  const CURRENCY_CODES = ['AUD', 'USD', 'GBP']
  const SIZE_SYSTEMS = ['US', 'UK', 'EU', 'AU']

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

  function parseAmount(text) {
    const cleaned = String(text || '').trim().replace(/\s+/g, '')
    if (!cleaned) return null
    if (!/^\d[\d,.]*$/.test(cleaned)) return null
    let normalized = cleaned
    if (cleaned.includes(',') && cleaned.includes('.')) normalized = cleaned.replace(/,/g, '')
    else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned)) normalized = cleaned.replace(/,/g, '')
    else if (/^\d+,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(',', '.')
    const amount = Number(normalized)
    return Number.isFinite(amount) ? amount : null
  }

  function parsePrice(value) {
    const raw = String(value || '').trim()
    if (!raw) return null
    let text = raw.toUpperCase().replace(/\u00A0/g, ' ').trim()

    let currency = null
    if (/\bAUD\b/i.test(text) || /(?:^|\s)A\$(?=\s*\d)/i.test(text) || /^A\$\s*\d/i.test(text)) currency = 'AUD'
    if (/\bUSD\b/i.test(text) || /(?:^|\s)US\$(?=\s*\d)/i.test(text) || /^US\$\s*\d/i.test(text)) {
      if (currency && currency !== 'USD') return null
      currency = 'USD'
    }
    if (/\bGBP\b/i.test(text) || /£/.test(text)) {
      if (currency && currency !== 'GBP') return null
      currency = 'GBP'
    }

    for (const code of CURRENCY_CODES) {
      if (new RegExp(code, 'i').test(text)) {
        if (currency && currency !== code) return null
        currency = code
      }
    }

    // A bare $ is intentionally ambiguous and must not be guessed.
    if (!currency && /\$/.test(text)) return null
    if (!currency) return null

    text = text
      .replace(/AUD|USD|GBP/gi, ' ')
      .replace(/US\$/gi, ' ')
      .replace(/A\$/gi, ' ')
      .replace(/[£$]/g, ' ')
      .replace(/\b(?:PRICE|COST|ASK|ASKING)\b/gi, ' ')
      .trim()

    const numberMatch = text.match(/\d[\d,.]*/)
    if (!numberMatch) return null
    const amount = parseAmount(numberMatch[0])
    if (amount === null || amount < 0) return null
    return { currency, amount }
  }

  function parseSize(value) {
    const raw = String(value || '').trim()
    if (!raw) return null
    if (SIZE_EXEMPT_RE.test(raw)) return { system: '', size: raw.toUpperCase() === 'ONE SIZE' ? 'One Size' : raw.toUpperCase() }

    let text = raw.toUpperCase().replace(/\u00A0/g, ' ').trim()
    text = text.replace(/\b(?:SHOE\s*)?SIZE\b/g, ' ').replace(/\s+/g, ' ').trim()

    let system = null
    for (const code of SIZE_SYSTEMS) {
      const touchingStart = new RegExp(`^${code}(?=\\d|\\s|[-:])`, 'i')
      const touchingEnd = new RegExp(`(?<=\\d)${code}$`, 'i')
      const separated = new RegExp(`(?:^|\\s)${code}(?:$|\\s)`, 'i')
      if (touchingStart.test(text) || touchingEnd.test(text) || separated.test(text)) {
        if (system && system !== code) return null
        system = code
      }
    }
    if (!system) return null

    text = text
      .replace(new RegExp(system, 'ig'), ' ')
      .replace(/[-:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!text || !/[0-9]/.test(text)) return null
    return { system, size: text.replace(/\s+/g, ' ').trim() }
  }

  function canonicalPrice(parsed) {
    if (!parsed) return ''
    const digits = Number.isInteger(parsed.amount) ? 0 : 2
    const amount = parsed.amount.toLocaleString('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: 2 })
    if (parsed.currency === 'AUD') return `A$${amount}`
    if (parsed.currency === 'USD') return `US$${amount}`
    if (parsed.currency === 'GBP') return `£${amount} GBP`
    return `${parsed.currency} ${amount}`
  }

  function canonicalSize(parsed) {
    if (!parsed) return ''
    return parsed.system ? `${parsed.system} ${parsed.size}` : parsed.size
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

  function syncPriceFromVisible(form, validate = false, normalizeVisible = false) {
    const visible = form.querySelector('[name="price_entry"]')
    const price = form.elements?.price
    const currency = form.elements?.currency
    const wrapper = visible?.closest('.inline-unit-field')
    if (!visible || !price || !currency) return true
    const raw = visible.value.trim()
    if (!raw) {
      price.value = ''
      currency.value = ''
      if (validate) setInvalid(wrapper, false)
      return true
    }
    const parsed = parsePrice(raw)
    if (!parsed) {
      if (validate) setInvalid(wrapper, true, 'Include an unambiguous currency, e.g. AUD 100, $100 AUD, USD100 or £70. A bare $ is not enough.')
      return false
    }
    price.value = String(parsed.amount)
    currency.value = parsed.currency
    const canonical = canonicalPrice(parsed)
    visible.dataset.canonicalValue = canonical
    if (normalizeVisible) visible.value = canonical
    setInvalid(wrapper, false)
    return true
  }

  function syncSizeFromVisible(form, validate = false, normalizeVisible = false) {
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
      if (validate) setInvalid(wrapper, true, 'Include the size system, e.g. US 9, 9US, size UK 9 or EU44.')
      return false
    }
    size.value = parsed.size
    system.value = parsed.system
    const canonical = canonicalSize(parsed)
    visible.dataset.canonicalValue = canonical
    if (normalizeVisible) visible.value = canonical
    setInvalid(wrapper, false)
    return true
  }

  function syncVisibleFromHidden(form) {
    const p = form.querySelector('[name="price_entry"]')
    const s = form.querySelector('[name="size_entry"]')
    if (p && p.dataset.userEdited !== 'true' && document.activeElement !== p) {
      const amount = String(form.elements?.price?.value || '').trim()
      const currency = String(form.elements?.currency?.value || '').trim()
      if (amount && currency) {
        const parsed = { currency, amount: Number(amount) }
        p.value = canonicalPrice(parsed)
        p.dataset.canonicalValue = canonicalPrice(parsed)
      }
    }
    if (s && s.dataset.userEdited !== 'true' && document.activeElement !== s) {
      const size = String(form.elements?.size?.value || '').trim()
      const system = String(form.elements?.size_system?.value || '').trim()
      if (size) {
        const parsed = { system, size }
        s.value = canonicalSize(parsed)
        s.dataset.canonicalValue = canonicalSize(parsed)
      }
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
      wrapper.innerHTML = `<span>Current price</span><input name="price_entry" inputmode="decimal" autocomplete="off" placeholder="e.g. AUD 100, $100 AUD, USD85"><small class="field-help">Type the currency and amount together in whatever clear format is natural.</small><small class="field-error">Include an unambiguous currency with the price.</small>`
      priceParent.insertBefore(wrapper, priceLabel)
    }
    hideOriginalControl(price)
    hideOriginalControl(currency)

    const sizeLabel = size.closest('label')
    const sizeParent = sizeLabel?.parentElement
    if (sizeLabel && sizeParent) {
      const wrapper = document.createElement('label')
      wrapper.className = 'inline-unit-field'
      wrapper.innerHTML = `<span>Size</span><input name="size_entry" autocomplete="off" placeholder="e.g. US 9, 9US, size UK 9, EU44"><small class="field-help">Type the size system and size together in whatever clear format is natural.</small><small class="field-error">Include the size system.</small>`
      sizeParent.insertBefore(wrapper, sizeLabel)
    }
    hideOriginalControl(size)
    hideOriginalControl(sizeSystem)

    const priceEntry = form.querySelector('[name="price_entry"]')
    const sizeEntry = form.querySelector('[name="size_entry"]')

    priceEntry?.addEventListener('input', () => {
      priceEntry.dataset.userEdited = 'true'
      syncPriceFromVisible(form, false, false)
      setInvalid(priceEntry.closest('.inline-unit-field'), false)
    })
    priceEntry?.addEventListener('blur', () => syncPriceFromVisible(form, true, true))

    sizeEntry?.addEventListener('input', () => {
      sizeEntry.dataset.userEdited = 'true'
      syncSizeFromVisible(form, false, false)
      setInvalid(sizeEntry.closest('.inline-unit-field'), false)
    })
    sizeEntry?.addEventListener('blur', () => syncSizeFromVisible(form, true, true))

    syncVisibleFromHidden(form)
  }

  document.addEventListener('submit', event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'newDeal' || form.dataset.inlineUnits !== 'v105') return
    const priceOk = syncPriceFromVisible(form, true, true)
    const sizeOk = syncSizeFromVisible(form, true, true)
    if (!priceOk || !sizeOk) {
      event.preventDefault()
      event.stopImmediatePropagation()
      // Validation is deliberately non-focus-stealing. Show the error and scroll it into view,
      // but never force the user's cursor back into a field.
      const first = form.querySelector('.inline-unit-field.invalid')
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, true)

  let timer
  const app = document.getElementById('app')
  if (app) {
    new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        enhance()
        const form = document.getElementById('newDeal')
        if (form?.dataset.inlineUnits === 'v105') syncVisibleFromHidden(form)
      }, 40)
    }).observe(app, { childList: true, subtree: true })
  }

  setInterval(() => {
    const form = document.getElementById('newDeal')
    if (form?.dataset.inlineUnits === 'v105') syncVisibleFromHidden(form)
  }, 600)

  enhance()
})()
