(() => {
  if (window.__flippersExtractionFidelity130) return
  window.__flippersExtractionFidelity130 = true

  const originalFetch = window.fetch.bind(window)
  const extractionUrl = input => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '')
    return /\/functions\/v1\/listing-visual-extraction(?:\?|$)/.test(url)
  }

  const clean = v => String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const linesFrom = x => [x.description, x.extra_info, ...(Array.isArray(x.visible_item_details) ? x.visible_item_details : [])]
    .filter(Boolean)
    .flatMap(v => String(v).split(/\n|\r|•|·/))
    .map(clean)
    .filter(Boolean)

  function sellerCondition(lines) {
    const rx = /\b(?:brand new|new with tags|new without tags|never worn|unworn|barely worn|worn once|worn twice|like new|excellent condition|great condition|good condition|fair condition|poor condition)\b/i
    for (const line of lines) {
      const m = line.match(rx)
      if (m) return m[0]
    }
    return ''
  }

  function sellerColour(lines) {
    for (const line of lines) {
      let m = line.match(/^(.{1,70}?)\s+colou?rway\b/i)
      if (m) return clean(m[1])
      m = line.match(/\bcolou?r\s*[:\-]\s*([^|;,.]{2,70})/i)
      if (m) return clean(m[1])
    }
    return ''
  }

  function sellerModel(lines, brand) {
    const b = clean(brand)
    if (!b) return ''
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rx = new RegExp(`^${escaped}\\s+(.+)$`, 'i')
    for (const line of lines) {
      const m = line.match(rx)
      if (!m) continue
      const model = clean(m[1]
        .replace(/\b(?:US|UK|EU|AU)\s*\d+(?:\.\d+)?(?:\s*1\/2)?\b.*$/i, '')
        .replace(/\bsize\s*(?:US|UK|EU|AU)?\s*\d+(?:\.\d+)?(?:\s*1\/2)?\b.*$/i, ''))
      if (model && model.length <= 80) return model
    }
    return ''
  }

  function sizesFrom(x, lines) {
    const text = [x.listing_title, x.size_system && x.size ? `${x.size_system} ${x.size}` : x.size, ...lines].filter(Boolean).join(' | ').toUpperCase()
    const out = []
    const rx = /\b(US|UK|EU|AU)\s*[-:]?\s*(\d+(?:\.\d+)?(?:\s*1\/2)?)\b/g
    let m
    while ((m = rx.exec(text))) {
      const system = m[1]
      const size = clean(m[2])
      if (!out.some(p => p.system === system && p.size === size)) out.push({ system, size })
    }
    return out
  }

  function likelyExactTitle(x, lines) {
    const current = clean(x.listing_title)
    const generic = /^(?:[a-z0-9 '&-]+\s+)?(?:shoes?|trainers?|sneakers?|jacket|shirt|top|pants|trousers|item)(?:\s*\(pair\))?$/i.test(current)
    if (!generic) return current
    const brand = clean(x.brand).toLowerCase()
    for (const line of lines) {
      if (line.length < 6 || line.length > 100) continue
      if (/^(?:size|seller|shipping|condition|colour|color|description|barely|like new|excellent|great|good|fair|poor)\b/i.test(line)) continue
      if (brand && !line.toLowerCase().includes(brand)) continue
      if (line.split(/\s+/).length >= 3) return line
    }
    return current
  }

  function reconcile(payload) {
    const x = payload?.extraction
    if (!x || typeof x !== 'object') return payload
    const lines = linesFrom(x)

    // Literal listing/seller text outranks visual interpretation for fields the seller explicitly states.
    const condition = sellerCondition(lines)
    const colour = sellerColour(lines)
    const model = sellerModel(lines, x.brand)
    const title = likelyExactTitle(x, lines)
    if (condition) x.condition = condition
    if (colour) x.colour = colour
    if (model) x.model = model
    if (title) x.listing_title = title

    // Multiple shoe-size systems are alternate representations, not automatically contradictions.
    const sizes = sizesFrom(x, lines)
    if (sizes.length) {
      const primary = sizes.find(p => p.system === 'US') || sizes[0]
      x.size = primary.size
      x.size_system = primary.system
      x.size_alternates = sizes
      if (sizes.length > 1) {
        x.size_display = sizes.map(p => `${p.system} ${p.size}`).join(' / ')
        x.warnings = (Array.isArray(x.warnings) ? x.warnings : []).filter(w => !/size.*(?:conflict|contradict|mismatch)|(?:conflict|contradict|mismatch).*size/i.test(String(w)))
      }
    }
    return payload
  }

  window.fetch = async function(input, init) {
    const response = await originalFetch(input instanceof Request ? input.clone() : input, init)
    if (!extractionUrl(input) || !response.ok) return response
    try {
      const data = reconcile(await response.clone().json())
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    } catch {
      return response
    }
  }
})()
