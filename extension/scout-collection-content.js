(() => {
  if (window.__flippersAiCollectionScannerLoaded) return
  window.__flippersAiCollectionScannerLoaded = true

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const text = el => clean(el?.innerText || el?.textContent || '')
  const visible = el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
  }
  const abs = href => {
    try { return new URL(href, location.href).toString() } catch { return '' }
  }
  const uniqBy = (rows, keyFn) => {
    const seen = new Set()
    return rows.filter(row => {
      const key = keyFn(row)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  function platform() {
    const host = location.hostname.toLowerCase()
    if (host.includes('facebook.com')) return 'facebook'
    if (host.includes('ebay.com.au')) return 'ebay'
    if (host.includes('gumtree.com.au')) return 'gumtree'
    if (host.includes('depop.com')) return 'depop'
    return 'other'
  }

  function itemPattern(kind) {
    if (kind === 'facebook') return /\/marketplace\/item\/(\d+)/i
    if (kind === 'ebay') return /\/itm\/(?:[^/]+\/)?(\d+)/i
    if (kind === 'gumtree') return /\/s-ad\/[^/]+\/[^/]+\/(\d+)/i
    if (kind === 'depop') return /\/products\/([^/?#]+)/i
    return /$a/
  }

  function isSingleListing(kind) {
    return itemPattern(kind).test(location.href)
  }

  function queryText(kind) {
    const selectors = kind === 'facebook'
      ? ['input[placeholder*="Search Marketplace" i]', 'input[aria-label*="Search Marketplace" i]']
      : kind === 'ebay'
        ? ['input[aria-label*="Search for anything" i]', 'input[type="search"]']
        : kind === 'gumtree'
          ? ['input[placeholder*="search" i]', 'input[type="search"]']
          : ['input[placeholder*="search" i]', 'input[type="search"]']
    for (const selector of selectors) {
      const value = clean(document.querySelector(selector)?.value)
      if (value) return value
    }
    const title = clean(document.title)
      .replace(/\s*[|–—-]\s*(Facebook Marketplace|eBay|Gumtree|Depop).*$/i, '')
      .replace(/^Marketplace\s*[|–—-]\s*/i, '')
    return title.slice(0, 180)
  }

  function parsePrice(value) {
    const raw = clean(value).replace(/,/g, '')
    const match = raw.match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i)
    if (!match) return null
    const n = Number(match[1])
    return Number.isFinite(n) && n >= 0 && n < 10000000 ? n : null
  }

  function cardRoot(anchor, pattern) {
    let current = anchor
    let best = anchor.parentElement || anchor
    for (let i = 0; i < 8 && current?.parentElement; i++) {
      current = current.parentElement
      const value = text(current)
      const rect = current.getBoundingClientRect()
      if (value.length >= 8 && value.length <= 1200 && rect.width >= 120 && rect.height >= 80) best = current
      const links = [...current.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href') || '')
        .filter(h => pattern.test(h))
      const uniqueLinks = new Set(links.map(h => h.match(pattern)?.[1]).filter(Boolean))
      if (uniqueLinks.size > 1) break
    }
    return best
  }

  function candidateTitle(anchor, card, priceText) {
    const direct = [
      clean(anchor.getAttribute('aria-label')),
      clean(anchor.getAttribute('title')),
      text(anchor)
    ].find(v => v && v.length >= 3 && v.length <= 180 && !/^\$/.test(v))
    if (direct && !/^(marketplace|view item|sponsored)$/i.test(direct)) return direct

    const imgAlt = clean(card.querySelector('img')?.alt)
    if (imgAlt && imgAlt.length >= 3 && imgAlt.length <= 180 && !/image may contain/i.test(imgAlt)) return imgAlt

    const raw = (card.innerText || '').split(/\n+/).map(clean).filter(Boolean)
    const blocked = /^(sponsored|just listed|new listing|seller information|ships to you|delivery available)$/i
    const lines = raw.filter(line => {
      if (line === priceText || parsePrice(line) !== null) return false
      if (blocked.test(line)) return false
      if (/^(\d+\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\s*ago)$/i.test(line)) return false
      return line.length >= 3 && line.length <= 180
    })
    return lines[0] || ''
  }

  function candidateLocation(card, title) {
    const lines = (card.innerText || '').split(/\n+/).map(clean).filter(Boolean)
    const candidates = lines.filter(line => line !== title && parsePrice(line) === null)
    const explicit = candidates.find(line => /\b[A-Z]{2,3}\s+\d{4}\b/.test(line) || /\b\d{4}\b/.test(line))
    if (explicit) return explicit.slice(0, 120)
    return ''
  }

  function candidateFromAnchor(anchor, kind, pattern) {
    if (!visible(anchor)) return null
    const href = abs(anchor.getAttribute('href') || '')
    const match = href.match(pattern)
    if (!match) return null
    const root = cardRoot(anchor, pattern)
    const rawText = text(root)
    if (!rawText || rawText.length < 5) return null
    const price = parsePrice(rawText)
    const priceText = rawText.match(/(?:A\$|AU\$|\$)\s*[0-9][0-9,.]*(?:\.\d{1,2})?/i)?.[0] || ''
    const title = candidateTitle(anchor, root, priceText)
    const image = [...root.querySelectorAll('img')]
      .filter(img => visible(img))
      .sort((a,b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0]
    return {
      listingId: match[1] || '',
      url: href,
      title,
      askingPrice: price,
      currency: 'AUD',
      location: candidateLocation(root, title),
      condition: '',
      sellerName: '',
      thumbnailUrl: image?.currentSrc || image?.src || '',
      rawText: rawText.slice(0, 1800),
      platform: kind
    }
  }

  function collectionScan() {
    const kind = platform()
    const pattern = itemPattern(kind)
    if (isSingleListing(kind)) {
      return { mode:'single', platform:kind, query:queryText(kind), candidates:[] }
    }

    const selectors = kind === 'facebook'
      ? ['a[href*="/marketplace/item/"]']
      : kind === 'ebay'
        ? ['a[href*="/itm/"]']
        : kind === 'gumtree'
          ? ['a[href*="/s-ad/"]']
          : kind === 'depop'
            ? ['a[href*="/products/"]']
            : []

    const anchors = selectors.flatMap(selector => [...document.querySelectorAll(selector)])
    const candidates = uniqBy(
      anchors.map(anchor => candidateFromAnchor(anchor, kind, pattern)).filter(Boolean),
      row => row.listingId || row.url
    ).filter(row => row.title || row.askingPrice !== null)

    return {
      mode: candidates.length >= 2 ? 'collection' : 'single',
      platform: kind,
      query: queryText(kind),
      candidates: candidates.slice(0, 80),
      visibleCount: candidates.length,
      pageUrl: location.href,
      capturedAt: new Date().toISOString()
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FLIPPERS_SCAN_COLLECTION') {
      try { sendResponse({ ok:true, data:collectionScan() }) }
      catch (error) { sendResponse({ ok:false, error:error.message || String(error) }) }
      return
    }
    if (message?.type === 'FLIPPERS_SCROLL_RESULTS') {
      window.scrollBy({ top: Math.max(window.innerHeight * 0.9, 700), behavior:'smooth' })
      setTimeout(() => {
        try { sendResponse({ ok:true, data:collectionScan() }) }
        catch (error) { sendResponse({ ok:false, error:error.message || String(error) }) }
      }, 950)
      return true
    }
  })
})()
