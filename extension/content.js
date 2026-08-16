(() => {
  if (window.__flippersAiScannerLoaded) return
  window.__flippersAiScannerLoaded = true

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const text = el => clean(el?.innerText || el?.textContent || '')
  const unique = list => [...new Set(list.filter(Boolean))]
  const visible = el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
  }

  function platform() {
    const host = location.hostname.toLowerCase()
    if (host.includes('facebook.com')) return 'facebook'
    if (host.includes('ebay.com.au')) return 'ebay'
    if (host.includes('gumtree.com.au')) return 'gumtree'
    if (host.includes('depop.com')) return 'depop'
    return 'other'
  }

  function meta(name, property = false) {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
    return clean(document.querySelector(selector)?.content)
  }

  function jsonLd() {
    const rows = []
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(node.textContent || 'null')
        if (Array.isArray(parsed)) rows.push(...parsed)
        else if (parsed?.['@graph']) rows.push(...parsed['@graph'])
        else if (parsed) rows.push(parsed)
      } catch {}
    }
    return rows
  }

  function productLd() {
    return jsonLd().find(row => {
      const type = row?.['@type']
      return type === 'Product' || (Array.isArray(type) && type.includes('Product'))
    }) || null
  }

  function numberFromPrice(value) {
    const raw = clean(value).replace(/,/g, '')
    const match = raw.match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i)
    if (!match) return null
    const n = Number(match[1])
    return Number.isFinite(n) && n >= 0 && n < 10000000 ? n : null
  }

  function priceCandidates(root = document) {
    const candidates = []
    const selectors = [
      '[itemprop="price"]', '[data-testid*="price" i]', '[class*="price" i]',
      'main span', 'main div', 'article span', 'article div'
    ]
    for (const selector of selectors) {
      for (const el of root.querySelectorAll(selector)) {
        if (!visible(el)) continue
        const value = text(el)
        if (!value || value.length > 40) continue
        if (!/^(?:A\$|AU\$|\$)\s*[0-9][0-9,.]*(?:\s*(?:AUD|ea|each))?$/i.test(value)) continue
        const price = numberFromPrice(value)
        if (price === null) continue
        const rect = el.getBoundingClientRect()
        candidates.push({ price, text: value, top: rect.top, size: parseFloat(getComputedStyle(el).fontSize) || 0 })
      }
      if (candidates.length) break
    }
    return candidates.sort((a, b) => (b.size - a.size) || (a.top - b.top))
  }

  function headingCandidates() {
    const list = []
    for (const el of document.querySelectorAll('main h1, article h1, h1, main h2, [role="main"] [dir="auto"]')) {
      if (!visible(el)) continue
      const value = text(el)
      if (value.length < 3 || value.length > 220) continue
      if (/marketplace|facebook|ebay|gumtree|depop|notifications|messages/i.test(value) && value.length < 40) continue
      const rect = el.getBoundingClientRect()
      const size = parseFloat(getComputedStyle(el).fontSize) || 0
      list.push({ value, size, top: rect.top, tag: el.tagName })
    }
    return list.sort((a, b) => {
      const ah = a.tag === 'H1' ? 100 : 0
      const bh = b.tag === 'H1' ? 100 : 0
      return (bh + b.size) - (ah + a.size) || a.top - b.top
    })
  }

  function facebookFields() {
    const main = document.querySelector('[role="main"]') || document.querySelector('main') || document.body
    const headings = headingCandidates()
    const prices = priceCandidates(main)
    const sellerAnchor = [...main.querySelectorAll('a[href]')].find(a => /marketplace\/profile|\/profile\.php|\/people\//i.test(a.getAttribute('href') || '') && text(a).length >= 2 && text(a).length < 90)
    const body = text(main)
    const conditionMatch = body.match(/\b(New|Used\s*[-–—]?\s*(?:Like new|Good|Fair)|Like new|Good|Fair)\b/i)
    const locationPatterns = [
      /(?:Listed\s+(?:\d+\s+\w+\s+ago\s+)?in\s+)([^·\n]{2,80})/i,
      /(?:Location\s*[:·]?\s*)([^·\n]{2,80})/i
    ]
    let locationText = ''
    for (const pattern of locationPatterns) {
      const match = body.match(pattern)
      if (match) { locationText = clean(match[1]); break }
    }
    const descriptionAnchor = [...main.querySelectorAll('span,div')].find(el => visible(el) && /^description$/i.test(text(el)))
    let description = ''
    if (descriptionAnchor) {
      const parent = descriptionAnchor.parentElement?.parentElement || descriptionAnchor.parentElement
      description = text(parent).replace(/^Description\s*/i, '').slice(0, 6000)
    }
    return {
      title: headings[0]?.value || '',
      price: prices[0]?.price ?? null,
      location: locationText,
      condition: conditionMatch ? clean(conditionMatch[1]) : '',
      sellerName: text(sellerAnchor),
      sellerProfileUrl: sellerAnchor?.href || '',
      description
    }
  }

  function ebayFields() {
    const product = productLd()
    const title = clean(product?.name) || text(document.querySelector('h1.x-item-title__mainTitle, h1'))
    const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers
    const price = Number(offer?.price || document.querySelector('[itemprop="price"]')?.getAttribute('content')) || priceCandidates()[0]?.price || null
    const condition = clean(product?.itemCondition?.name || text(document.querySelector('[data-testid="ux-labels-values__labels-content"]')))
    return { title, price, condition, description: clean(product?.description) }
  }

  function gumtreeFields() {
    const product = productLd()
    const title = clean(product?.name) || text(document.querySelector('h1'))
    const price = Number((Array.isArray(product?.offers) ? product.offers[0] : product?.offers)?.price) || priceCandidates()[0]?.price || null
    const main = document.querySelector('main') || document.body
    const body = text(main)
    const locationMatch = body.match(/(?:Location|Suburb)\s*[:·]?\s*([^·]{2,80})/i)
    return { title, price, location: clean(locationMatch?.[1]), description: clean(product?.description) }
  }

  function depopFields() {
    const product = productLd()
    const title = clean(product?.name) || text(document.querySelector('h1'))
    const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers
    const price = Number(offer?.price) || priceCandidates()[0]?.price || null
    return { title, price, description: clean(product?.description) }
  }

  function genericFields() {
    const product = productLd()
    const headings = headingCandidates()
    const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers
    return {
      title: clean(product?.name) || headings[0]?.value || meta('og:title', true) || clean(document.title),
      price: Number(offer?.price) || priceCandidates()[0]?.price || null,
      description: clean(product?.description) || meta('og:description', true) || meta('description')
    }
  }

  function imageUrls() {
    const images = []
    for (const img of document.images) {
      if (!visible(img)) continue
      const rect = img.getBoundingClientRect()
      const area = rect.width * rect.height
      if (area < 12000) continue
      const url = img.currentSrc || img.src
      if (!/^https?:/i.test(url || '')) continue
      const alt = clean(img.alt)
      const penalty = /profile|avatar|logo|emoji|icon/i.test(alt) ? 0.15 : 1
      images.push({ url, area: area * penalty, alt })
    }
    return unique(images.sort((a, b) => b.area - a.area).map(x => x.url)).slice(0, 14)
  }

  function listingId(kind) {
    const url = location.href
    if (kind === 'facebook') return url.match(/\/marketplace\/item\/(\d+)/)?.[1] || ''
    if (kind === 'ebay') return url.match(/\/itm\/(?:[^/]+\/)?(\d+)/)?.[1] || ''
    if (kind === 'gumtree') return url.match(/\/s-ad\/[^/]+\/[^/]+\/(\d+)/)?.[1] || ''
    return ''
  }

  function relevantVisibleText() {
    const root = document.querySelector('[role="main"]') || document.querySelector('main') || document.querySelector('article') || document.body
    let value = text(root)
    if (value.length > 30000) value = value.slice(0, 30000)
    return value
  }

  function confidence(fields) {
    let score = 0
    if (fields.title) score += 30
    if (fields.price !== null && fields.price !== undefined) score += 30
    if (fields.description) score += 12
    if (fields.location) score += 10
    if (fields.sellerName) score += 8
    if (fields.condition) score += 5
    if (imageUrls().length) score += 5
    return Math.min(100, score)
  }

  function scan() {
    const kind = platform()
    let fields = genericFields()
    if (kind === 'facebook') fields = { ...fields, ...facebookFields() }
    if (kind === 'ebay') fields = { ...fields, ...ebayFields() }
    if (kind === 'gumtree') fields = { ...fields, ...gumtreeFields() }
    if (kind === 'depop') fields = { ...fields, ...depopFields() }

    fields.title = clean(fields.title).replace(/^Marketplace\s*[-–—:]\s*/i, '')
    fields.description = clean(fields.description)
    fields.location = clean(fields.location)
    fields.condition = clean(fields.condition)
    fields.sellerName = clean(fields.sellerName)

    const visibleText = relevantVisibleText()
    const images = imageUrls()
    const scanConfidence = confidence(fields)
    const structured = {
      url: location.href,
      platform: kind,
      listingId: listingId(kind),
      title: fields.title || '',
      askingPrice: fields.price ?? null,
      location: fields.location || '',
      condition: fields.condition || '',
      sellerName: fields.sellerName || '',
      sellerProfileUrl: fields.sellerProfileUrl || '',
      description: fields.description || '',
      imageUrls: images,
      visibleText,
      scanConfidence,
      source: 'authenticated_browser_dom',
      documentTitle: clean(document.title),
      canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
      ogTitle: meta('og:title', true),
      ogDescription: meta('og:description', true)
    }

    structured.listingText = [
      structured.description ? `Description: ${structured.description}` : '',
      structured.condition ? `Condition: ${structured.condition}` : '',
      structured.location ? `Location: ${structured.location}` : '',
      structured.sellerName ? `Seller: ${structured.sellerName}` : '',
      `Rendered listing page text:\n${visibleText}`
    ].filter(Boolean).join('\n\n')

    return structured
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'FLIPPERS_SCAN_PAGE') return
    try { sendResponse({ ok: true, data: scan() }) }
    catch (error) { sendResponse({ ok: false, error: error.message || String(error) }) }
  })
})()
