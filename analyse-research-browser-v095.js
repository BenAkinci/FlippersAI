(() => {
  if (window.__flippersAnalyseResearchBrowserV095) return
  window.__flippersAnalyseResearchBrowserV095 = true

  const clean = v => String(v || '').replace(/\s+/g, ' ').trim()
  let state = { latest: null, history: [] }

  function form() { return document.querySelector('form#newDeal') }
  function normalizeUrl(value) {
    try { const u = new URL(value); return `${u.origin}${u.pathname.replace(/\/$/, '')}` }
    catch { return clean(value).replace(/[?#].*$/, '').replace(/\/$/, '') }
  }

  function ensureResearchButton() {
    const f = form()
    const result = document.querySelector('#directAnalysisResult')
    if (!f || !result || result.dataset.researchBrowserV095 === '1') return
    if (!/couldn.?t read this listing automatically/i.test(result.textContent || '')) return
    result.dataset.researchBrowserV095 = '1'
    const actions = result.querySelector('.direct-analysis-actions') || result
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button primary'
    button.id = 'openResearchBrowserV095'
    button.textContent = 'Open Research Browser'
    button.addEventListener('click', startResearch)
    actions.prepend(button)
    renderStatus(result)
  }

  function renderStatus(container = document.querySelector('#directAnalysisResult')) {
    if (!container) return
    let box = container.querySelector('#researchBrowserStatusV095')
    if (!box) {
      box = document.createElement('div')
      box.id = 'researchBrowserStatusV095'
      box.style.marginTop = '14px'
      box.style.padding = '12px'
      box.style.border = '1px solid rgba(148,163,184,.35)'
      box.style.borderRadius = '10px'
      container.appendChild(box)
    }
    const pages = state.history.length
    const latest = state.latest
    const facts = latest ? [latest.title, latest.askingPrice != null ? `$${latest.askingPrice}` : '', latest.sellerName, latest.condition, latest.location].filter(Boolean) : []
    box.innerHTML = latest
      ? `<strong>Research Browser connected</strong><p>${pages} page${pages === 1 ? '' : 's'} captured. Latest: ${escapeHtml(latest.documentTitle || latest.title || latest.url)}</p><p>${facts.length ? `Captured: ${escapeHtml(facts.join(' · '))}` : 'Keep browsing the listing, seller profile and reviews. FlippersAI is reading the page as you go.'}</p><div class="direct-analysis-actions"><button type="button" class="button primary" id="analyseResearchEvidenceV095">Analyse captured evidence</button><button type="button" class="button" id="clearResearchEvidenceV095">Clear research session</button></div>`
      : `<strong>Research Browser ready</strong><p>Open the real marketplace listing, then browse normally. FlippersAI will capture the listing and any seller/review pages you visit.</p>`
    box.querySelector('#analyseResearchEvidenceV095')?.addEventListener('click', analyseCaptured)
    box.querySelector('#clearResearchEvidenceV095')?.addEventListener('click', clearResearch)
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))
  }

  function startResearch() {
    const f = form()
    const url = clean(new FormData(f).get('url'))
    if (!url) return
    window.postMessage({ type: 'FLIPPERS_RESEARCH_CLEAR_V095' }, location.origin)
    const opened = window.open(url, '_blank')
    if (!opened) {
      document.querySelector('#researchBrowserStatusV095')?.insertAdjacentHTML('beforeend', '<p><strong>Popup blocked.</strong> Allow popups for FlippersAI, then try again.</p>')
    } else {
      renderStatus()
    }
  }

  function pickPrimaryListing() {
    const f = form()
    const target = normalizeUrl(new FormData(f).get('url'))
    return state.history.find(row => normalizeUrl(row?.url) === target)
      || state.history.find(row => row?.pageKind === 'listing_or_marketplace' && (row?.askingPrice != null || row?.title))
      || state.latest
      || null
  }

  function analyseCaptured() {
    const f = form()
    if (!f) return
    const primary = pickPrimaryListing()
    if (!primary) return

    if (f.elements.title && clean(primary.title)) f.elements.title.value = clean(primary.title)
    if (f.elements.price && Number.isFinite(Number(primary.askingPrice))) f.elements.price.value = String(Number(primary.askingPrice))

    const evidence = state.history.map((row, i) => {
      const parts = [
        `Research page ${i + 1}: ${row.pageKind || 'page'}`,
        `URL: ${row.url || ''}`,
        row.title ? `Title: ${row.title}` : '',
        row.askingPrice != null ? `Asking price: $${row.askingPrice}` : '',
        row.sellerName ? `Seller: ${row.sellerName}` : '',
        row.condition ? `Condition: ${row.condition}` : '',
        row.location ? `Location: ${row.location}` : '',
        row.description ? `Description: ${row.description}` : '',
        row.visibleText ? `Rendered page text: ${String(row.visibleText).slice(0, 12000)}` : ''
      ].filter(Boolean)
      return parts.join('\n')
    }).join('\n\n---\n\n')

    if (f.elements.text) f.elements.text.value = evidence
    f.dataset.websiteFallbackPass = '1'
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  function clearResearch() {
    state = { latest: null, history: [] }
    window.postMessage({ type: 'FLIPPERS_RESEARCH_CLEAR_V095' }, location.origin)
    renderStatus()
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return
    if (event.data?.type !== 'FLIPPERS_RESEARCH_STATE_V095') return
    state = {
      latest: event.data.latest || null,
      history: Array.isArray(event.data.history) ? event.data.history : []
    }
    ensureResearchButton()
    renderStatus()
  })

  const observer = new MutationObserver(() => ensureResearchButton())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.postMessage({ type: 'FLIPPERS_RESEARCH_SYNC_V095' }, location.origin)
  ensureResearchButton()
})()
