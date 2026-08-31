(() => {
  if (window.__flippersResearchCompanionV095) return
  window.__flippersResearchCompanionV095 = true

  const LATEST = 'flippers_research_latest_v095'
  const HISTORY = 'flippers_research_history_v095'
  const MAX_HISTORY = 12
  let inFlight = false
  let lastSignature = ''
  let timer = null

  const clean = v => String(v || '').replace(/\s+/g, ' ').trim()
  const normalizeUrl = value => {
    try {
      const u = new URL(value)
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`
    } catch { return clean(value).replace(/[?#].*$/, '').replace(/\/$/, '') }
  }

  function pageKind(url = location.href) {
    const u = url.toLowerCase()
    if (/review|rating/.test(u)) return 'reviews'
    if (/profile|seller|shop/.test(u) && !/products\//.test(u)) return 'seller'
    return 'listing_or_marketplace'
  }

  function lightweightSignature() {
    const root = document.querySelector('main,[role="main"],article') || document.body
    const text = clean(root?.innerText || root?.textContent || '').slice(0, 5000)
    return `${normalizeUrl(location.href)}|${text.length}|${text.slice(0, 180)}`
  }

  function sanitise(data = {}) {
    return {
      url: data.url || data.pageUrl || location.href,
      canonicalUrl: data.canonicalUrl || '',
      platform: data.platform || '',
      pageKind: pageKind(data.url || data.pageUrl || location.href),
      title: data.title || '',
      askingPrice: Number.isFinite(Number(data.askingPrice)) ? Number(data.askingPrice) : null,
      sellerName: data.sellerName || '',
      sellerProfileUrl: data.sellerProfileUrl || '',
      condition: data.condition || '',
      conditionSource: data.conditionSource || 'unknown',
      location: data.location || '',
      description: data.description || '',
      listingId: data.listingId || '',
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.slice(0, 12) : [],
      visibleText: String(data.visibleText || '').slice(0, 30000),
      listingText: String(data.listingText || '').slice(0, 36000),
      scanConfidence: Number(data.scanConfidence || 0),
      documentTitle: data.documentTitle || data.pageTitle || document.title,
      capturedAt: new Date().toISOString(),
      source: 'authenticated_browser_companion'
    }
  }

  async function saveSnapshot(snapshot) {
    const stored = await chrome.storage.local.get(HISTORY)
    const history = Array.isArray(stored[HISTORY]) ? stored[HISTORY] : []
    const key = normalizeUrl(snapshot.url)
    const next = [snapshot, ...history.filter(row => normalizeUrl(row?.url) !== key)].slice(0, MAX_HISTORY)
    await chrome.storage.local.set({ [LATEST]: snapshot, [HISTORY]: next })
  }

  function scan(force = false) {
    if (inFlight) return
    const signature = lightweightSignature()
    if (!force && signature === lastSignature) return
    lastSignature = signature
    inFlight = true
    chrome.runtime.sendMessage({ type: 'FLIPPERS_SCAN_ACTIVE_TAB' }, async result => {
      try {
        if (!chrome.runtime.lastError && result?.ok && result.data) {
          await saveSnapshot(sanitise(result.data))
        }
      } finally {
        inFlight = false
      }
    })
  }

  function schedule(delay = 700, force = false) {
    clearTimeout(timer)
    timer = setTimeout(() => scan(force), delay)
  }

  addEventListener('scroll', () => schedule(900), { passive: true })
  addEventListener('click', () => schedule(650, true), true)
  addEventListener('popstate', () => schedule(500, true))
  addEventListener('hashchange', () => schedule(500, true))
  const observer = new MutationObserver(() => schedule(1000))
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  setInterval(() => scan(false), 3500)
  schedule(900, true)
})()
