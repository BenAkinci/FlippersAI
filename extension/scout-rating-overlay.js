(() => {
  if (window.__flippersRatingOverlayLoaded) return
  window.__flippersRatingOverlayLoaded = true
  const abs = href => { try { return new URL(href, location.href).toString() } catch { return '' } }
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim()
  const pattern = () => {
    const h = location.hostname.toLowerCase()
    if (h.includes('facebook.com')) return /\/marketplace\/item\/(\d+)/i
    if (h.includes('ebay.com.au')) return /\/itm\/(?:[^/]+\/)?(\d+)/i
    if (h.includes('gumtree.com.au')) return /\/s-ad\/[^/]+\/[^/]+\/(\d+)/i
    if (h.includes('depop.com')) return /\/products\/([^/?#]+)/i
    return /$a/
  }
  function cardRoot(anchor, rx) {
    let node = anchor, best = anchor.parentElement || anchor
    for (let i = 0; i < 9 && node?.parentElement; i++) {
      node = node.parentElement
      const rect = node.getBoundingClientRect()
      const links = [...node.querySelectorAll('a[href]')].map(a => abs(a.getAttribute('href') || a.href || '')).map(h => h.match(rx)?.[1]).filter(Boolean)
      if (new Set(links).size > 1) break
      if (rect.width >= 100 && rect.height >= 60) best = node
    }
    return best
  }
  function ensureStyle() {
    if (document.getElementById('flippersai-rating-style')) return
    const style = document.createElement('style')
    style.id = 'flippersai-rating-style'
    style.textContent = `
      .flippersai-rated-card{position:relative!important;border-radius:12px!important;outline:2px solid transparent!important;outline-offset:2px!important;transition:outline-color .15s,box-shadow .15s!important}
      .flippersai-rated-card.good{outline-color:#28a477!important;box-shadow:0 0 0 4px rgba(40,164,119,.10)!important}.flippersai-rated-card.warn{outline-color:#f39a0a!important;box-shadow:0 0 0 4px rgba(243,154,10,.10)!important}.flippersai-rated-card.bad{outline-color:#d65a50!important;box-shadow:0 0 0 4px rgba(214,90,80,.09)!important}.flippersai-rated-card.top{outline-width:3px!important;box-shadow:0 0 0 5px rgba(243,154,10,.16)!important}
      .flippersai-score-badge{position:absolute!important;z-index:2147483000!important;top:7px!important;right:7px!important;display:flex!important;align-items:center!important;gap:5px!important;padding:6px 8px!important;border-radius:999px!important;background:rgba(22,32,40,.93)!important;color:#fff!important;font:700 11px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;box-shadow:0 5px 16px rgba(0,0,0,.18)!important;pointer-events:none!important}.flippersai-score-badge.good{background:rgba(25,126,91,.94)!important}.flippersai-score-badge.warn{background:rgba(185,111,0,.95)!important}.flippersai-score-badge.bad{background:rgba(170,59,50,.94)!important}.flippersai-score-badge b{font-size:13px!important;color:#fff!important}
      .flippersai-top-pick{position:absolute!important;z-index:2147483000!important;left:7px!important;top:7px!important;padding:5px 7px!important;border-radius:999px!important;background:#f39a0a!important;color:#162028!important;font:850 9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.04em!important;pointer-events:none!important;box-shadow:0 4px 12px rgba(0,0,0,.13)!important}`
    document.documentElement.appendChild(style)
  }
  function tone(r) {
    if (['strong_buy','buy'].includes(r.recommendation)) return 'good'
    if (['negotiate','verify_first'].includes(r.recommendation)) return 'warn'
    if (r.recommendation === 'skip') return 'bad'
    return Number(r.score || 0) >= 75 ? 'good' : Number(r.score || 0) >= 50 ? 'warn' : 'bad'
  }
  function clear(root) {
    if (!root) return
    root.classList.remove('flippersai-rated-card','good','warn','bad','top')
    root.querySelectorAll(':scope > .flippersai-score-badge,:scope > .flippersai-top-pick').forEach(el => el.remove())
  }
  function clearAll() { document.querySelectorAll('.flippersai-rated-card').forEach(clear) }
  function matches(r, href, id) {
    if (r.listingId && id && String(r.listingId) === String(id)) return true
    if (!r.url || !href) return false
    try {
      const a = new URL(r.url, location.href), b = new URL(href, location.href)
      return a.origin === b.origin && a.pathname.replace(/\/$/,'') === b.pathname.replace(/\/$/,'')
    } catch { return r.url === href }
  }
  function apply(ratings = [], enabled = true) {
    clearAll()
    if (!enabled || !ratings.length) return
    ensureStyle()
    const rx = pattern(), used = new Set()
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = abs(anchor.getAttribute('href') || anchor.href || ''), m = href.match(rx)
      if (!m) continue
      const rating = ratings.find(r => matches(r, href, m[1] || ''))
      if (!rating) continue
      const root = cardRoot(anchor, rx)
      if (!root || used.has(root)) continue
      used.add(root)
      const t = tone(rating)
      root.classList.add('flippersai-rated-card', t)
      if (rating.topPick) root.classList.add('top')
      const badge = document.createElement('div')
      badge.className = `flippersai-score-badge ${t}`
      badge.innerHTML = `<b>${Math.round(Number(rating.score || 0))}</b><span>${clean(rating.label || 'Rated')}</span>`
      badge.title = `FlippersAI · ${rating.label || 'Rated'} · Profit ${rating.profit == null ? '—' : '$' + Math.round(Number(rating.profit))} · ROI ${rating.roi == null ? '—' : Math.round(Number(rating.roi)) + '%'} · Confidence ${rating.confidence == null ? '—' : Math.round(Number(rating.confidence)) + '%'}`
      root.appendChild(badge)
      if (rating.topPick) { const top = document.createElement('div'); top.className = 'flippersai-top-pick'; top.textContent = 'FLIPPERSAI TOP PICK'; root.appendChild(top) }
    }
  }
  function remove(listings = []) {
    const rx = pattern(), used = new Set()
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = abs(anchor.getAttribute('href') || anchor.href || ''), m = href.match(rx)
      if (!m || !listings.some(r => matches(r, href, m[1] || ''))) continue
      const root = cardRoot(anchor, rx)
      if (root && !used.has(root)) { used.add(root); clear(root) }
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FLIPPERS_RATING_OVERLAY') { apply(message.ratings || [], message.enabled !== false); sendResponse({ ok:true }); return }
    if (message?.type === 'FLIPPERS_RATING_REMOVE') { remove(message.listings || []); sendResponse({ ok:true }); return }
  })
})()
