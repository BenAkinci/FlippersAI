(() => {
  function currencySymbol(code) {
    return ({ AUD: '$', USD: 'US$', GBP: '£' })[code] || `${code} `
  }

  function discountSummary() {
    const form = document.getElementById('newDeal')
    if (!form) return
    const current = Number(form.elements?.price?.value)
    const original = Number(form.elements?.original_price?.value)
    const currency = String(form.elements?.currency?.value || 'AUD')
    const output = document.getElementById('discountCalculatedSummary')
    if (!output) return

    const valid = Number.isFinite(current) && current > 0 && Number.isFinite(original) && original > current
    if (!valid) {
      output.textContent = 'Enter the price before discount and FlippersAI will calculate the saving.'
      output.classList.remove('has-value')
      return
    }

    const saving = original - current
    const percent = (saving / original) * 100
    const symbol = currencySymbol(currency)
    output.textContent = `${symbol}${original.toFixed(2)} → ${symbol}${current.toFixed(2)} · save ${symbol}${saving.toFixed(2)} · ${percent.toFixed(percent >= 10 ? 0 : 1)}% off`
    output.classList.add('has-value')
  }

  function enhanceDiscountUI() {
    const form = document.getElementById('newDeal')
    if (!form || form.dataset.structured !== 'v104' || document.getElementById('discountDisclosure')) return

    const checkbox = form.elements?.discounted
    const originalInput = form.elements?.original_price
    const noteInput = form.elements?.discount_note
    const priceRow = form.querySelector('.price-row')
    if (!checkbox || !originalInput || !priceRow) return

    const originalLabel = originalInput.closest('label')
    const checkboxLabel = checkbox.closest('label')
    const noteLabel = noteInput?.closest('label')
    if (!originalLabel || !checkboxLabel) return

    checkbox.style.display = 'none'
    checkboxLabel.style.display = 'none'
    if (noteLabel) noteLabel.remove()

    const details = document.createElement('details')
    details.id = 'discountDisclosure'
    details.className = 'discount-disclosure'
    details.innerHTML = `<summary><span>Discounted / on sale</span><span class="discount-chevron" aria-hidden="true">⌄</span></summary><div class="discount-body"><div id="discountFieldMount"></div><div id="discountCalculatedSummary" class="discount-calculated">Enter the price before discount and FlippersAI will calculate the saving.</div></div>`
    priceRow.insertAdjacentElement('afterend', details)

    const mount = details.querySelector('#discountFieldMount')
    originalLabel.childNodes[0].textContent = 'Price before discount'
    originalLabel.querySelector('small')?.remove()
    mount.appendChild(originalLabel)

    const shouldOpen = checkbox.checked || (Number(originalInput.value) > 0)
    details.open = shouldOpen
    checkbox.checked = shouldOpen
    originalInput.disabled = !shouldOpen

    details.addEventListener('toggle', () => {
      checkbox.checked = details.open
      originalInput.disabled = !details.open
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      if (details.open) setTimeout(() => originalInput.focus(), 40)
      discountSummary()
    })

    ;['input', 'change'].forEach(type => {
      form.elements?.price?.addEventListener(type, discountSummary)
      originalInput.addEventListener(type, discountSummary)
      form.elements?.currency?.addEventListener(type, discountSummary)
    })

    const style = document.createElement('style')
    style.id = 'discountDisclosureStyles'
    style.textContent = `
      .price-row{grid-template-columns:1fr 1fr!important}
      .discount-disclosure{margin-top:12px;border:1px solid #dce8ed;border-radius:12px;background:#fbfdfe;overflow:hidden}
      .discount-disclosure summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;cursor:pointer;font-weight:700;color:#344955;list-style:none;user-select:none}
      .discount-disclosure summary::-webkit-details-marker{display:none}
      .discount-chevron{font-size:18px;line-height:1;transition:transform .15s ease;color:#6f8490}
      .discount-disclosure[open] .discount-chevron{transform:rotate(180deg)}
      .discount-body{padding:0 14px 14px;border-top:1px solid #e5eef2}
      #discountFieldMount{padding-top:12px;max-width:340px}
      .discount-calculated{margin-top:10px;padding:10px 12px;border-radius:10px;background:#f5f9fb;color:#607786;font-size:13px}
      .discount-calculated.has-value{background:#effaf5;color:#23735b;font-weight:700}
      @media(max-width:800px){.price-row{grid-template-columns:1fr!important}}
    `
    document.head.appendChild(style)
    discountSummary()
  }

  const observer = new MutationObserver(enhanceDiscountUI)
  const app = document.getElementById('app')
  if (app) observer.observe(app, { childList: true, subtree: true })
  setInterval(enhanceDiscountUI, 400)
  enhanceDiscountUI()
})()
