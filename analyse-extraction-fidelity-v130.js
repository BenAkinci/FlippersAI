(() => {
  if (window.__flippersExtractionFidelity130) return
  window.__flippersExtractionFidelity130 = true

  const originalFetch = window.fetch.bind(window)
  const extractionUrl = input => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '')
    return /\/functions\/v1\/listing-visual-extraction(?:\?|$)/.test(url)
  }

  const clean = v => String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const linesFrom = x => [x.listing_title, x.description, x.extra_info, ...(Array.isArray(x.visible_item_details) ? x.visible_item_details : [])]
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

  function provenanceValue(x, field) {
    const candidates = [
      x?.[`${field}_provenance`],
      x?.[`${field}_source`],
      x?.provenance?.[field],
      x?.sources?.[field]
    ]
    return clean(candidates.find(Boolean)).toLowerCase()
  }

  function authoritativeProvenance(value) {
    return /(?:seller[_ -]?text|listing[_ -]?text|label[_ -]?code|style[_ -]?code|sku|product[_ -]?code|box[_ -]?label|authoritative|official[_ -]?match|catalog[_ -]?match)/i.test(value)
  }

  function descriptiveModel(value) {
    const v = clean(value)
    if (!v) return true
    if (v.length > 90) return true
    if (/\b(?:logo|on side|side logo|lace|laces|pull tab|sole|upper|silhouette|shape|style|styled|style shoe|tuned[- ]?style|trainer(?:s)?|sneaker(?:s)?|shoe(?:s)?|pair|footwear|low top|high top|mid top|chunky|mesh|leather upper|rubber sole)\b/i.test(v)) return true
    if (/^(?:men'?s|women'?s|unisex)?\s*(?:black|white|grey|gray|red|blue|green|brown|beige|cream|pink|purple|orange|yellow)(?:\s+\w+){0,2}$/i.test(v)) return true
    return false
  }

  function literalModel(x, lines) {
    const model = clean(x.model)
    if (!model || descriptiveModel(model)) return ''

    // Preserve a model only when the response carries authoritative provenance,
    // or the exact model string is visibly present in listing/seller evidence.
    const provenance = provenanceValue(x, 'model')
    if (authoritativeProvenance(provenance)) return model

    const haystack = [x.listing_title, ...lines].filter(Boolean).map(clean)
    const needle = model.toLowerCase()
    if (needle.length >= 3 && haystack.some(line => line.toLowerCase().includes(needle))) return model

    return ''
  }

  function officialColourDisplay(x) {
    const name = clean(x.official_colourway_name || x.official_colorway_name || x.colourway_name || x.colorway_name)
    const colours = clean(x.official_colour || x.official_color || x.official_colours || x.official_colors || x.manufacturer_colour || x.manufacturer_color)
    const provenance = clean(
      x.official_colourway_provenance || x.official_colorway_provenance ||
      x.colour_provenance || x.color_provenance || x.colour_source || x.color_source
    ).toLowerCase()

    if (!authoritativeProvenance(provenance) && !clean(x.official_colourway_verified || x.official_colorway_verified)) return ''
    if (name && colours) return `${name} — ${colours}`
    return name || colours
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

    // Literal listing/seller text outranks visual interpretation for seller-stated facts.
    const condition = sellerCondition(lines)
    const sellerColourValue = sellerColour(lines)
    const model = literalModel(x, lines)
    const title = likelyExactTitle(x, lines)
    const officialColour = officialColourDisplay(x)

    if (condition) x.condition = condition
    if (title) x.listing_title = title

    // Model is a strict identity field. A visual descriptor or unsupported guess is never a model.
    x.model = model || ''
    if (!model) {
      x.model_confidence = null
      x.model_unverified = true
    }

    // Prefer a verified official colourway; otherwise only preserve explicit seller wording.
    x.colour = officialColour || sellerColourValue || ''
    if (officialColour) x.colour_display = officialColour
    if (!officialColour && !sellerColourValue) x.colour_unverified = true

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
