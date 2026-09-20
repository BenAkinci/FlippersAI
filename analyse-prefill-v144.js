// v0.144: Analyse pre-fill hand-off.
// Other pages (Deal Radar, Shortlist, Saved) put a small payload in sessionStorage
// under KEY and navigate to Analyse. Once the structured form (v104) and inline
// units (v105) have mounted, this fills empty fields exactly once and marks them
// auto-filled so user edits still win. No network calls; no values are invented.
(() => {
  if (window.__flippersAnalysePrefillV144) return
  window.__flippersAnalysePrefillV144 = true
  const KEY = 'flippers:analyse-prefill'
  const PLATFORMS = ['facebook', 'depop', 'ebay', 'gumtree', 'vinted', 'other']

  function read() {
    try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : null } catch { return null }
  }
  function clear() { try { sessionStorage.removeItem(KEY) } catch {} }

  function set(form, name, value) {
    const el = form.elements?.[name]
    if (!el || value === null || value === undefined || value === '') return
    if (String(el.value || '').trim()) return
    el.value = String(value)
    el.dataset.autoValue = String(value)
    el.classList.add('auto-filled')
  }

  function apply() {
    const p = read()
    if (!p) return
    const form = document.getElementById('newDeal')
    if (!form || form.dataset.structured !== 'v104' || form.dataset.inlineUnits !== 'v110' || form.dataset.shippingCost !== 'v120') return
    clear()
    const price = Number(p.price)
    if (Number.isFinite(price) && price > 0 && p.currency) {
      set(form, 'price', price)
      set(form, 'currency', String(p.currency).toUpperCase())
    }
    if (PLATFORMS.includes(p.platform)) set(form, 'platform', p.platform)
    set(form, 'title', p.title)
    set(form, 'url', p.url)
    set(form, 'condition', p.condition)
    set(form, 'location', p.location)
    set(form, 'seller', p.seller)
    set(form, 'description', p.description)
    set(form, 'extra_info', p.extra_info)
    if (p.shipping_cost !== null && p.shipping_cost !== undefined && p.shipping_cost !== '') set(form, 'shipping_cost', p.shipping_cost)
    ;['title', 'price', 'url', 'extra_info', 'shipping_cost'].forEach(name => form.elements?.[name]?.dispatchEvent(new Event('input', { bubbles: true })))
    const status = document.getElementById('autoExtractStatus')
    if (status && p.source_label) {
      status.className = 'auto-status good'
      status.textContent = `Filled from ${p.source_label}. Add listing screenshots if you have them, check the details, then analyse.`
    }
  }

  let timer
  const app = document.getElementById('app')
  if (app) new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 60) }).observe(app, { childList: true, subtree: true })
  window.addEventListener('flippers:analyse-prefill', () => setTimeout(apply, 60))
  setInterval(() => { if (read()) apply() }, 500)
  apply()
})()
