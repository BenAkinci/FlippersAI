(() => {
  if (window.__flippersMarketplaceRatingOverlayV077) return
  window.__flippersMarketplaceRatingOverlayV077 = true

  const HISTORY_KEY = 'flippers_rating_history_v067'
  const ENABLED_KEY = 'flippers_marketplace_badges_enabled_v067'
  const BADGE = 'flippersai-cover-score-v077'
  const HOST = 'flippersai-rating-host-v077'
  const IMAGE = 'flippersai-rated-image-v077'
  let ratings = []
  let enabled = true
  let timer = null

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const abs = href => { try { return new URL(href, location.href).toString() } catch { return '' } }
  const platform = url => {
    try {
      const h = new URL(url || location.href, location.href).hostname.toLowerCase()
      if (h.includes('facebook.com')) return 'facebook'
      if (h.includes('ebay.com.au')) return 'ebay'
      if (h.includes('gumtree.com.au')) return 'gumtree'
      if (h.includes('depop.com')) return 'depop'
    } catch {}
    return 'other'
  }
  const currentPlatform = () => platform(location.href)
  const pathKey = url => {
    try {
      const u = new URL(url, location.href)
      return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '') || '/'}`
    } catch { return '' }
  }
  const listingToken = url => {
    try {
      const u = new URL(url, location.href)
      const p = u.pathname
      const host = u.hostname.toLowerCase()
      let m = null
      if (host.includes('facebook.com')) m = p.match(/\/marketplace\/item\/(\d+)/i)
      else if (host.includes('ebay.com.au')) m = p.match(/\/itm\/(?:[^/]+\/)?(\d+)/i)
      else if (host.includes('depop.com')) m = p.match(/\/products\/([^/?#]+)/i)
      else if (host.includes('gumtree.com.au')) m = p.match(/\/(?:s-ad|web\/listing)\/(?:.*\/)?(\d+)(?:\/)?$/i) || p.match(/\/(\d{7,})(?:\/)?$/)
      return m?.[1] || ''
    } catch { return '' }
  }

  function scoreOf(r = {}) { return Math.max(0, Math.min(100, Math.round(Number(r.score || 0)))) }
  function tone(r = {}) {
    const s = scoreOf(r)
    if (s >= 80) return 'good'
    if (s >= 60) return 'warn'
    return 'bad'
  }
  function elite(r = {}) {
    return scoreOf(r) >= 95 && ['strong_buy', 'buy'].includes(r.recommendation || '')
  }

  function ensureStyle() {
    if (document.getElementById('flippersai-rating-style-v077')) return
    const style = document.createElement('style')
    style.id = 'flippersai-rating-style-v077'
    style.textContent = `
      .${HOST}{position:relative!important}
      .${BADGE}{position:absolute!important;z-index:2147483646!important;display:flex!important;align-items:center!important;gap:5px!important;padding:6px 8px!important;border-radius:999px!important;color:#fff!important;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:0!important;white-space:nowrap!important;pointer-events:none!important;box-shadow:0 4px 14px rgba(0,0,0,.24)!important;border:1px solid rgba(255,255,255,.78)!important;transform:translateZ(0)!important}
      .${BADGE}.good{background:#16845f!important}.${BADGE}.warn{background:#c47700!important}.${BADGE}.bad{background:#b1433b!important}
      .${BADGE} .flippersai-mark-v077{font-size:9px!important;font-weight:800!important;opacity:.92!important}. ${BADGE} b{color:#fff!important}
      .${IMAGE}{outline:2px solid transparent!important;outline-offset:-2px!important;border-radius:inherit!important}
      .${IMAGE}.good{outline-color:#23966b!important}. ${IMAGE}.warn{outline-color:#f39a0a!important}. ${IMAGE}.bad{outline-color:#d6574e!important}
      .${BADGE}.elite::after{content:'★';display:inline-grid;place-items:center;width:16px;height:16px;margin-left:1px;border-radius:50%;background:#f39a0a;color:#162028;font-size:11px;line-height:1}
    `.replace(/\. flippersai/g, '.flippersai')
    document.documentElement.appendChild(style)
  }

  function clearLegacy() {
    document.querySelectorAll('.flippersai-score-badge-v067,.flippersai-elite-star-v067,.flippersai-score-badge-v066,.flippersai-top-pick-v066,.flippersai-score-badge,.flippersai-top-pick').forEach(el => el.remove())
    document.querySelectorAll('.flippersai-rated-card-v067,.flippersai-rated-card-v066,.flippersai-rated-card').forEach(el => {
      el.classList.remove('flippersai-rated-card-v067','flippersai-rated-card-v066','flippersai-rated-card','good','warn','bad','elite','top')
    })
  }

  function identityMap() {
    const byPath = new Map()
    const byId = new Map()
    const here = currentPlatform()
    for (const rating of ratings) {
      if (platform(rating.url || '') !== here) continue
      const key = pathKey(rating.url || '')
      if (key) byPath.set(key, rating)
      const token = String(rating.listingId || listingToken(rating.url || '') || '')
      if (token) byId.set(token, rating)
    }
    return { byPath, byId }
  }

  function matchRating(href, maps) {
    if (!href) return null
    const exact = maps.byPath.get(pathKey(href))
    if (exact) return exact
    const token = listingToken(href)
    return token ? (maps.byId.get(token) || null) : null
  }

  function knownListingIdentities(root, maps) {
    const ids = new Set()
    for (const a of root.querySelectorAll?.('a[href]') || []) {
      const href = abs(a.getAttribute('href') || a.href || '')
      const rating = matchRating(href, maps)
      if (!rating) continue
      ids.add(String(rating.listingId || pathKey(rating.url || href)))
      if (ids.size > 1) break
    }
    return ids.size
  }

  function genericCardRoot(anchor, maps) {
    let node = anchor
    let best = anchor.parentElement || anchor
    for (let i = 0; i < 10 && node?.parentElement; i++) {
      node = node.parentElement
      const rect = node.getBoundingClientRect()
      if (rect.width < 90 || rect.height < 70) continue
      const identities = knownListingIdentities(node, maps)
      if (identities > 1) break
      const hasImage = Boolean(node.querySelector('img'))
      if (identities === 1 && hasImage) best = node
      if (rect.width > Math.max(window.innerWidth * .9, 1100) && rect.height > window.innerHeight * .8) break
    }
    return best
  }

  function cardRoot(anchor, maps) {
    const kind = currentPlatform()
    let root = null
    if (kind === 'ebay') root = anchor.closest('li.s-item, .s-item, [data-testid="item-card"], article')
    else if (kind === 'depop') root = anchor.closest('article, li, [data-testid*="product" i], [class*="ProductCard"]')
    else if (kind === 'gumtree') root = anchor.closest('article, li, [data-testid*="listing" i], [class*="listing"]')
    else if (kind === 'facebook') root = anchor.closest('[role="article"]')
    if (root && knownListingIdentities(root, maps) <= 1 && root.querySelector('img')) return root
    return genericCardRoot(anchor, maps)
  }

  function bestImage(root, anchor) {
    const seen = new Set()
    const images = []
    for (const img of [...anchor.querySelectorAll?.('img') || [], ...root.querySelectorAll?.('img') || []]) {
      if (seen.has(img)) continue
      seen.add(img)
      const r = img.getBoundingClientRect()
      if (r.width < 55 || r.height < 45) continue
      images.push({ img, area:r.width * r.height, rect:r })
    }
    images.sort((a,b) => b.area - a.area)
    return images[0] || null
  }

  function removeNew(root) {
    root?.querySelectorAll?.(`:scope > .${BADGE}`).forEach(el => el.remove())
    root?.classList?.remove(HOST)
  }

  function paint(root, anchor, rating) {
    if (!root) return
    const t = tone(rating)
    const image = bestImage(root, anchor)
    const cardRect = root.getBoundingClientRect()
    root.classList.add(HOST)

    let badge = root.querySelector(`:scope > .${BADGE}`)
    if (!badge) {
      badge = document.createElement('div')
      badge.className = BADGE
      root.appendChild(badge)
    }
    badge.className = `${BADGE} ${t}${elite(rating) ? ' elite' : ''}`
    badge.innerHTML = `<span class="flippersai-mark-v077">FlippersAI</span><b>${scoreOf(rating)}/100</b>`
    badge.title = `${clean(rating.recommendation || 'Rated').replaceAll('_',' ')} · FlippersAI score ${scoreOf(rating)}/100`

    root.querySelectorAll(`.${IMAGE}`).forEach(img => img.classList.remove(IMAGE,'good','warn','bad'))
    if (image) {
      const top = Math.max(6, image.rect.top - cardRect.top + 7)
      const left = Math.max(6, image.rect.left - cardRect.left + 7)
      badge.style.top = `${Math.round(top)}px`
      badge.style.left = `${Math.round(left)}px`
      badge.style.right = 'auto'
      image.img.classList.add(IMAGE, t)
    } else {
      badge.style.top = '8px'
      badge.style.left = 'auto'
      badge.style.right = '8px'
    }
  }

  function clearUnmatched(matched) {
    document.querySelectorAll(`.${HOST}`).forEach(root => {
      if (!matched.has(root)) removeNew(root)
    })
    document.querySelectorAll(`.${IMAGE}`).forEach(img => {
      const root = img.closest(`.${HOST}`)
      if (!root || !matched.has(root)) img.classList.remove(IMAGE,'good','warn','bad')
    })
  }

  function apply() {
    clearLegacy()
    ensureStyle()
    if (!enabled || !ratings.length) {
      document.querySelectorAll(`.${HOST}`).forEach(removeNew)
      document.querySelectorAll(`.${IMAGE}`).forEach(img => img.classList.remove(IMAGE,'good','warn','bad'))
      return
    }
    const maps = identityMap()
    const matched = new Set()
    const usedRatings = new Set()
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = abs(anchor.getAttribute('href') || anchor.href || '')
      const rating = matchRating(href, maps)
      if (!rating) continue
      const key = String(rating.listingId || pathKey(rating.url || href))
      if (usedRatings.has(key)) continue
      const root = cardRoot(anchor, maps)
      if (!root) continue
      usedRatings.add(key)
      matched.add(root)
      paint(root, anchor, rating)
    }
    clearUnmatched(matched)
  }

  function schedule(delay = 70) {
    clearTimeout(timer)
    timer = setTimeout(apply, delay)
  }

  async function loadStored() {
    const stored = await chrome.storage.local.get([HISTORY_KEY, ENABLED_KEY]).catch(() => ({}))
    const history = stored[HISTORY_KEY] && typeof stored[HISTORY_KEY] === 'object' ? stored[HISTORY_KEY] : {}
    ratings = Object.values(history)
    enabled = stored[ENABLED_KEY] !== false
    apply()
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FLIPPERS_RATING_OVERLAY_V067' || message?.type === 'FLIPPERS_RATING_OVERLAY_V077') {
      ratings = Array.isArray(message.ratings) ? message.ratings : ratings
      enabled = message.enabled !== false
      apply()
      sendResponse({ ok:true, painted:document.querySelectorAll(`.${BADGE}`).length })
    }
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes[HISTORY_KEY] || changes[ENABLED_KEY]) loadStored().catch(() => {})
  })

  const observer = new MutationObserver(mutations => {
    const meaningful = mutations.some(m => {
      if (m.target?.closest?.(`.${HOST}`) && [...m.addedNodes, ...m.removedNodes].every(node => node.nodeType !== 1 || node.classList?.contains(BADGE))) return false
      return [...m.addedNodes, ...m.removedNodes].some(node => node.nodeType === 1 && !node.classList?.contains(BADGE))
    })
    if (meaningful) schedule()
  })
  observer.observe(document.documentElement, { childList:true, subtree:true })
  window.addEventListener('resize', () => schedule(40), { passive:true })
  document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') schedule(30) }, true)

  loadStored().catch(() => {})
})()
