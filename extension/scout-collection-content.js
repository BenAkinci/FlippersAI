(() => {
  if (window.__flippersAiCollectionScannerLoaded) return
  window.__flippersAiCollectionScannerLoaded = true

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const text = el => clean(el?.innerText || el?.textContent || '')
  const abs = href => { try { return new URL(href, location.href).toString() } catch { return '' } }
  const visible = el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
  }
  const visibleOrChild = el => visible(el) || [...(el?.querySelectorAll?.('img,span,div') || [])].some(visible)
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
        : ['input[placeholder*="search" i]', 'input[type="search"]']
    for (const selector of selectors) {
      const value = clean(document.querySelector(selector)?.value)
      if (value) return value
    }
    const rawTitle = clean(document.title)
    const resultsMatch = rawTitle.match(/\b\d+\s+results?\s+for\s+(.+?)(?:\s*[|–—-]\s*|$)/i)
    if (resultsMatch?.[1]) return clean(resultsMatch[1]).slice(0, 180)
    return rawTitle
      .replace(/\s*[|–—-]\s*(Facebook Marketplace|eBay|Gumtree|Depop).*$/i, '')
      .replace(/^Marketplace\s*[|–—-]\s*/i, '')
      .slice(0, 180)
  }

  function parsePrice(value) {
    const raw = clean(value).replace(/,/g, '')
    const match = raw.match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i)
    if (!match) return null
    const n = Number(match[1])
    return Number.isFinite(n) && n >= 0 && n < 10000000 ? n : null
  }

  function inferRegion(value = '') {
    const s = ` ${clean(value).toUpperCase()} `
    const rules = [
      ['ACT', /\b(ACT|AUSTRALIAN CAPITAL TERRITORY)\b/],
      ['NSW', /\b(NSW|NEW SOUTH WALES)\b/],
      ['NT', /\b(NT|NORTHERN TERRITORY)\b/],
      ['QLD', /\b(QLD|QUEENSLAND)\b/],
      ['SA', /\b(SA|SOUTH AUSTRALIA)\b/],
      ['TAS', /\b(TAS|TASMANIA)\b/],
      ['VIC', /\b(VIC|VICTORIA)\b/],
      ['WA', /\b(WA|WESTERN AUSTRALIA)\b/]
    ]
    return rules.find(([, rx]) => rx.test(s))?.[0] || ''
  }

  function inferCategory(title = '', raw = '') {
    const s = `${title} ${raw}`.toLowerCase()
    const rules = [
      ['Phones', /\b(iphone|galaxy|pixel|smartphone|mobile phone|phone)\b/],
      ['Audio', /\b(airpods?|earbuds?|headphones?|speaker|bose|sony xm|beats)\b/],
      ['Sneakers', /\b(jordan|yeezy|air max|dunk|sneaker|shoe|adidas|nike|new balance)\b/],
      ['Gaming', /\b(playstation|ps5|ps4|xbox|nintendo|switch|gaming console|steam deck)\b/],
      ['Watches', /\b(rolex|omega|seiko|watch|apple watch|garmin)\b/],
      ['Collectibles', /\b(pokemon|pokémon|trading card|tcg|sports card|coin|lego)\b/],
      ['Computers', /\b(macbook|laptop|pc|computer|ipad|surface|monitor|gpu|graphics card)\b/],
      ['Cameras', /\b(camera|canon|nikon|sony alpha|fujifilm|gopro|lens)\b/],
      ['Fashion', /\b(handbag|bag|jacket|hoodie|shirt|dress|supreme|gucci|prada|louis vuitton)\b/],
      ['Home & Appliances', /\b(fridge|washing machine|dryer|vacuum|dyson|coffee machine|furniture|sofa)\b/]
    ]
    return rules.find(([, rx]) => rx.test(s))?.[0] || 'Other'
  }

  function cardRoot(anchor, pattern) {
    let current = anchor
    let best = anchor.parentElement || anchor
    for (let i = 0; i < 9 && current?.parentElement; i++) {
      current = current.parentElement
      const value = text(current)
      const rect = current.getBoundingClientRect()
      const itemLinks = [...current.querySelectorAll('a[href]')]
        .map(a => abs(a.getAttribute('href') || ''))
        .map(h => h.match(pattern)?.[1])
        .filter(Boolean)
      const uniqueLinks = new Set(itemLinks)
      if (uniqueLinks.size > 1) break
      if (value.length >= 5 && value.length <= 1600 && rect.width >= 100 && rect.height >= 60) best = current
    }
    return best
  }

  function candidateTitle(anchor, card, priceText) {
    const rawLines = String(card.innerText || '').split(/\n+/).map(clean).filter(Boolean)
    const blocked = /^(sponsored|just listed|new listing|ships to you|delivery available|seller information|save|share)$/i
    const goodLines = rawLines.filter(line => {
      if (!line || line === priceText || parsePrice(line) !== null) return false
      if (blocked.test(line)) return false
      if (/^(\d+\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\s*ago)$/i.test(line)) return false
      return line.length >= 3 && line.length <= 180
    })

    const aria = clean(anchor.getAttribute('aria-label'))
    if (aria && aria.length <= 180 && !/^(marketplace|view item|sponsored)$/i.test(aria) && parsePrice(aria) === null) return aria
    const titleAttr = clean(anchor.getAttribute('title'))
    if (titleAttr && titleAttr.length <= 180 && parsePrice(titleAttr) === null) return titleAttr
    const imgAlt = clean(card.querySelector('img')?.alt)
    if (imgAlt && imgAlt.length >= 3 && imgAlt.length <= 180 && !/image may contain|no photo/i.test(imgAlt)) return imgAlt
    return goodLines[0] || ''
  }

  function candidateLocation(card, title) {
    const lines = String(card.innerText || '').split(/\n+/).map(clean).filter(Boolean)
    const candidates = lines.filter(line => line !== title && parsePrice(line) === null && line.length <= 120)
    const explicit = candidates.find(line => /\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b/i.test(line))
      || candidates.find(line => /\b\d{4}\b/.test(line))
    return explicit || ''
  }

  function candidateFromAnchor(anchor, kind, pattern) {
    const href = abs(anchor.getAttribute('href') || anchor.href || '')
    const match = href.match(pattern)
    if (!match) return null
    const root = cardRoot(anchor, pattern)
    if (!visibleOrChild(anchor) && !visibleOrChild(root)) return null
    const rawText = text(root)
    if (!rawText || rawText.length < 4) return null
    const price = parsePrice(rawText)
    const priceText = rawText.match(/(?:A\$|AU\$|\$)\s*[0-9][0-9,.]*(?:\.\d{1,2})?/i)?.[0] || ''
    const title = candidateTitle(anchor, root, priceText)
    const locationText = candidateLocation(root, title)
    const image = [...root.querySelectorAll('img')]
      .filter(img => visible(img) && /^https?:/i.test(img.currentSrc || img.src || ''))
      .sort((a,b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0]

    return {
      listingId: match[1] || '',
      url: href,
      title,
      askingPrice: price,
      currency: 'AUD',
      location: locationText,
      regionCode: inferRegion(`${locationText} ${rawText}`),
      categoryLabel: inferCategory(title, rawText),
      condition: '',
      sellerName: '',
      thumbnailUrl: image?.currentSrc || image?.src || '',
      rawText: rawText.slice(0, 2200),
      platform: kind
    }
  }

  function pageLooksLikeCollection(kind, candidateCount) {
    if (isSingleListing(kind)) return false
    const title = clean(document.title)
    if (/\b\d+\s+results?\s+for\b/i.test(title)) return true
    if (/\/marketplace\/(search|category|you\/selling|you\/buying)/i.test(location.pathname)) return true
    if (/[?&](q|query|keyword|search)=/i.test(location.search)) return true
    return candidateCount >= 2
  }

  function collectionScan() {
    const kind = platform()
    const pattern = itemPattern(kind)
    if (isSingleListing(kind)) return { mode:'single', platform:kind, query:queryText(kind), candidates:[] }

    const anchors = [...document.querySelectorAll('a[href]')].filter(a => pattern.test(abs(a.getAttribute('href') || a.href || '')))
    const candidates = uniqBy(
      anchors.map(anchor => candidateFromAnchor(anchor, kind, pattern)).filter(Boolean),
      row => row.listingId || row.url
    ).filter(row => row.title || row.askingPrice !== null).slice(0, 100)

    const priced = candidates.map(c => c.askingPrice).filter(v => Number.isFinite(Number(v)))
    const regions = [...new Set(candidates.map(c => c.regionCode).filter(Boolean))]
    const categories = [...new Set(candidates.map(c => c.categoryLabel).filter(Boolean))]
    const looksCollection = pageLooksLikeCollection(kind, candidates.length)

    return {
      mode: looksCollection && candidates.length >= 2 ? 'collection' : 'single',
      collectionSignal: looksCollection,
      platform: kind,
      query: queryText(kind),
      candidates,
      visibleCount: candidates.length,
      averagePrice: priced.length ? priced.reduce((a,b) => a + Number(b), 0) / priced.length : null,
      regions,
      categories,
      pageUrl: location.href,
      pageTitle: clean(document.title),
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
