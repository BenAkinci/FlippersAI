(() => {
  if (window.__flippersRatingOverlayLoadedV067) return
  window.__flippersRatingOverlayLoadedV067 = true

  const HISTORY_KEY = 'flippers_rating_history_v067'
  const ENABLED_KEY = 'flippers_marketplace_badges_enabled_v067'
  let ratings = []
  let enabled = true
  let timer = null

  const abs = href => { try { return new URL(href, location.href).toString() } catch { return '' } }
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim()

  function pattern() {
    const h = location.hostname.toLowerCase()
    if (h.includes('facebook.com')) return /\/marketplace\/item\/(\d+)/i
    if (h.includes('ebay.com.au')) return /\/itm\/(?:[^/]+\/)?(\d+)/i
    if (h.includes('gumtree.com.au')) return /\/s-ad\/[^/]+\/[^/]+\/(\d+)/i
    if (h.includes('depop.com')) return /\/products\/([^/?#]+)/i
    return /$a/
  }

  function ensureStyle() {
    if (document.getElementById('flippersai-rating-style-v067')) return
    const s = document.createElement('style')
    s.id = 'flippersai-rating-style-v067'
    s.textContent = `
      .flippersai-rated-card-v067{position:relative!important;border-radius:12px!important;outline:2px solid transparent!important;outline-offset:2px!important;transition:outline-color .15s,box-shadow .15s!important}
      .flippersai-rated-card-v067.good{outline-color:#23966b!important;box-shadow:0 0 0 4px rgba(35,150,107,.09)!important}
      .flippersai-rated-card-v067.warn{outline-color:#f39a0a!important;box-shadow:0 0 0 4px rgba(243,154,10,.09)!important}
      .flippersai-rated-card-v067.bad{outline-color:#d6574e!important;box-shadow:0 0 0 4px rgba(214,87,78,.08)!important}
      .flippersai-rated-card-v067.elite{outline-width:3px!important;box-shadow:0 0 0 5px rgba(243,154,10,.14)!important}
      .flippersai-score-badge-v067{position:absolute!important;z-index:2147483640!important;right:8px!important;top:8px!important;display:flex!important;align-items:center!important;gap:5px!important;padding:6px 9px!important;border-radius:999px!important;color:#fff!important;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;box-shadow:0 4px 14px rgba(0,0,0,.20)!important;pointer-events:none!important;white-space:nowrap!important}
      .flippersai-score-badge-v067.good{background:#217e5c!important}.flippersai-score-badge-v067.warn{background:#b66c00!important}.flippersai-score-badge-v067.bad{background:#aa3f37!important}
      .flippersai-score-badge-v067 b{font-size:13px!important;color:#fff!important}.flippersai-score-badge-v067 span{opacity:.92!important}
      .flippersai-elite-star-v067{position:absolute!important;z-index:2147483640!important;right:9px!important;bottom:9px!important;width:31px!important;height:31px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:#f39a0a!important;color:#162028!important;font:900 19px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;box-shadow:0 5px 15px rgba(0,0,0,.18)!important;pointer-events:none!important}
    `
    document.documentElement.appendChild(s)
  }

  function scoreOf(r = {}) { return Math.max(0, Math.min(100, Math.round(Number(r.score || 0)))) }
  function tone(r = {}) {
    const score = scoreOf(r)
    if (score >= 80) return 'good'
    if (score >= 60) return 'warn'
    return 'bad'
  }
  function elite(r = {}) {
    const rec = r.recommendation || ''
    return scoreOf(r) >= 95 && ['strong_buy','buy'].includes(rec)
  }

  function clearLegacy() {
    document.querySelectorAll('.flippersai-rated-card-v066,.flippersai-rated-card').forEach(root => {
      root.classList.remove('flippersai-rated-card-v066','flippersai-rated-card','good','warn','bad','top')
      root.querySelectorAll('.flippersai-score-badge-v066,.flippersai-top-pick-v066,.flippersai-score-badge,.flippersai-top-pick').forEach(el => el.remove())
    })
  }

  function clear(root) {
    if (!root) return
    root.classList.remove('flippersai-rated-card-v067','good','warn','bad','elite')
    root.querySelectorAll(':scope > .flippersai-score-badge-v067,:scope > .flippersai-elite-star-v067').forEach(el => el.remove())
  }

  function same(r, href, id) {
    if (r.listingId && id && String(r.listingId) === String(id)) return true
    if (!r.url || !href) return false
    try {
      const a = new URL(r.url, location.href), b = new URL(href, location.href)
      return a.origin === b.origin && a.pathname.replace(/\/$/,'') === b.pathname.replace(/\/$/,'')
    } catch { return r.url === href }
  }

  function cardRoot(anchor, rx) {
    let node = anchor
    let best = anchor.parentElement || anchor
    for (let i = 0; i < 9 && node?.parentElement; i++) {
      node = node.parentElement
      const rect = node.getBoundingClientRect()
      const ids = [...node.querySelectorAll('a[href]')]
        .map(a => abs(a.getAttribute('href') || a.href || ''))
        .map(h => h.match(rx)?.[1]).filter(Boolean)
      if (new Set(ids).size > 1) break
      if (rect.width >= 120 && rect.height >= 90) best = node
    }
    return best
  }

  function paintCard(root, rating) {
    const t = tone(rating)
    const isElite = elite(rating)
    root.classList.remove('good','warn','bad','elite')
    root.classList.add('flippersai-rated-card-v067', t)
    if (isElite) root.classList.add('elite')

    let badge = root.querySelector(':scope > .flippersai-score-badge-v067')
    if (!badge) {
      badge = document.createElement('div')
      badge.className = 'flippersai-score-badge-v067'
      root.appendChild(badge)
    }
    badge.className = `flippersai-score-badge-v067 ${t}`
    badge.innerHTML = `<b>${scoreOf(rating)}/100</b><span>${clean(rating.label || 'Rated')}</span>`
    const when = rating.scannedAt || rating.updatedAt || ''
    badge.title = `FlippersAI rating${when ? ` · scanned ${new Date(when).toLocaleString()}` : ''}`

    let star = root.querySelector(':scope > .flippersai-elite-star-v067')
    if (isElite) {
      if (!star) { star = document.createElement('div'); star.className = 'flippersai-elite-star-v067'; root.appendChild(star) }
      star.textContent = '★'
      star.title = 'Elite opportunity — 95+ FlippersAI score'
    } else star?.remove()
  }

  function apply() {
    clearLegacy()
    ensureStyle()
    if (!enabled || !ratings.length) {
      document.querySelectorAll('.flippersai-rated-card-v067').forEach(clear)
      return
    }
    const rx = pattern()
    const matched = new Set()
    const used = new Set()
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = abs(anchor.getAttribute('href') || anchor.href || '')
      const m = href.match(rx)
      if (!m) continue
      const rating = ratings.find(r => same(r, href, m[1] || ''))
      if (!rating) continue
      const root = cardRoot(anchor, rx)
      if (!root || used.has(root)) continue
      used.add(root)
      matched.add(root)
      paintCard(root, rating)
    }
    document.querySelectorAll('.flippersai-rated-card-v067').forEach(root => { if (!matched.has(root)) clear(root) })
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(apply, 90) }

  async function loadStored() {
    const stored = await chrome.storage.local.get([HISTORY_KEY, ENABLED_KEY]).catch(() => ({}))
    const history = stored[HISTORY_KEY] && typeof stored[HISTORY_KEY] === 'object' ? stored[HISTORY_KEY] : {}
    ratings = Object.values(history)
    enabled = stored[ENABLED_KEY] !== false
    apply()
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FLIPPERS_RATING_OVERLAY_V067') {
      ratings = Array.isArray(message.ratings) ? message.ratings : []
      enabled = message.enabled !== false
      apply()
      sendResponse({ ok:true })
      return
    }
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes[HISTORY_KEY] || changes[ENABLED_KEY]) loadStored().catch(() => {})
  })

  const observer = new MutationObserver(mutations => {
    const meaningful = mutations.some(m => {
      if (m.target?.closest?.('.flippersai-rated-card-v067')) return false
      return [...m.addedNodes, ...m.removedNodes].some(node => node.nodeType === 1 && !node.classList?.contains('flippersai-score-badge-v067') && !node.classList?.contains('flippersai-elite-star-v067'))
    })
    if (meaningful) schedule()
  })
  observer.observe(document.documentElement, { childList:true, subtree:true })

  loadStored().catch(() => {})
})()
