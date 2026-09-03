(() => {
  let userEdited = false

  function syncDiscount() {
    const form = document.getElementById('newDeal')
    if (!form || form.dataset.structured !== 'v104') return
    const checkbox = form.elements?.discounted
    const current = Number(form.elements?.price?.value)
    const original = Number(form.elements?.original_price?.value)
    const note = String(form.elements?.discount_note?.value || '').trim()
    if (!checkbox || userEdited) return

    const hasCurrent = Number.isFinite(current) && current > 0
    const hasOriginal = Number.isFinite(original) && original > 0
    const clearlyReduced = hasCurrent && hasOriginal && original > current
    const extractedDiscount = checkbox.dataset.autoValue === 'true'

    if (clearlyReduced || extractedDiscount || (note && hasOriginal)) {
      checkbox.checked = true
      checkbox.dataset.autoValue = 'true'
      checkbox.classList.add('auto-filled')
    }
  }

  document.addEventListener('change', event => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.name !== 'discounted') return
    if (event.isTrusted) {
      userEdited = true
      delete target.dataset.autoValue
      target.classList.remove('auto-filled')
    }
  }, true)

  document.addEventListener('input', event => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    if (['price', 'original_price', 'discount_note'].includes(target.name)) setTimeout(syncDiscount, 0)
  }, true)

  setInterval(syncDiscount, 500)
})()
