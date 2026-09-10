(() => {
  if (window.__flippersExtractionChunkFallback140) return
  window.__flippersExtractionChunkFallback140 = true

  const rawFetch = window.fetch.bind(window)
  const isExtraction = input => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '')
    return /\/functions\/v1\/listing-visual-extraction(?:\?|$)/.test(url)
  }

  const nonEmpty = value => value !== null && value !== undefined && value !== ''
  const uniq = values => [...new Set(values.filter(nonEmpty).map(v => typeof v === 'string' ? v.trim() : v).filter(nonEmpty))]

  function mergeExtractions(parts) {
    const out = structuredClone(parts[0] || {})
    const textFields = [
      'listing_title','brand','model','colour','official_colourway','official_colour_string','size','size_system',
      'currency','shipping_currency','shipping_status','seller_name','listing_location','condition','description',
      'extra_info','marketplace','discount_text'
    ]
    const numericFields = ['asking_price','original_price','shipping_cost','seller_rating','seller_review_count','seller_items_sold']
    const arrayFields = [
      'included_items','included_item_evidence','known_flaws_damage','visible_item_details','authenticity_markers_visible',
      'not_applicable_fields','missing_important_fields','warnings'
    ]

    for (const part of parts.slice(1)) {
      for (const field of textFields) {
        if (!nonEmpty(out[field]) && nonEmpty(part[field])) out[field] = part[field]
      }
      for (const field of numericFields) {
        if (!nonEmpty(out[field]) && nonEmpty(part[field])) out[field] = part[field]
      }
      for (const field of arrayFields) {
        out[field] = uniq([...(Array.isArray(out[field]) ? out[field] : []), ...(Array.isArray(part[field]) ? part[field] : [])])
      }
      out.explicit_no_flaws = Boolean(out.explicit_no_flaws || part.explicit_no_flaws)
      out.is_discounted = out.is_discounted === true || part.is_discounted === true ? true : (out.is_discounted ?? part.is_discounted)

      if (Number(part.asking_price_confidence || 0) > Number(out.asking_price_confidence || 0) && nonEmpty(part.asking_price)) {
        out.asking_price = part.asking_price
        out.asking_price_confidence = part.asking_price_confidence
        if (part.currency) out.currency = part.currency
      }
    }

    for (const field of ['model','colour']) {
      const values = uniq(parts.map(p => p?.[field])).map(v => String(v))
      if (new Set(values.map(v => v.toLowerCase())).size > 1) {
        out[field] = ''
        out[`${field}_evidence`] = { source:'unknown', quote:'', unambiguous:false }
        if (field === 'colour') {
          out.official_colourway = ''
          out.official_colour_string = ''
        }
        out.warnings = uniq([...(out.warnings || []), `Conflicting ${field} evidence across screenshots; left unknown.`])
      } else {
        const source = parts.find(p => nonEmpty(p?.[field]))
        if (source) {
          out[field] = source[field]
          if (source[`${field}_evidence`]) out[`${field}_evidence`] = source[`${field}_evidence`]
          if (field === 'colour') {
            out.official_colourway = source.official_colourway || ''
            out.official_colour_string = source.official_colour_string || ''
          }
        }
      }
    }

    const confidences = parts.map(p => Number(p?.extraction_confidence)).filter(Number.isFinite)
    if (confidences.length) out.extraction_confidence = confidences.reduce((a,b) => a + b, 0) / confidences.length
    return out
  }

  async function payloadFrom(input, init) {
    try {
      if (typeof init?.body === 'string') return JSON.parse(init.body)
      if (input instanceof Request) return JSON.parse(await input.clone().text())
    } catch {}
    return null
  }

  async function jsonFrom(response) {
    try { return await response.clone().json() } catch { return null }
  }

  function retryRequest(input, init, body) {
    if (input instanceof Request) {
      const cloned = input.clone()
      return new Request(cloned.url, {
        method: cloned.method,
        headers: cloned.headers,
        body: JSON.stringify(body),
        mode: cloned.mode,
        credentials: cloned.credentials,
        cache: cloned.cache,
        redirect: cloned.redirect,
        referrer: cloned.referrer,
        referrerPolicy: cloned.referrerPolicy,
        integrity: cloned.integrity,
        keepalive: cloned.keepalive,
        signal: cloned.signal
      })
    }
    return input
  }

  window.fetch = async function(input, init) {
    if (!isExtraction(input)) return rawFetch(input, init)

    const payload = await payloadFrom(input, init)
    if (!payload || !Array.isArray(payload.images) || payload.images.length <= 1) {
      return rawFetch(input, init)
    }

    const first = await rawFetch(input, init)
    const firstData = await jsonFrom(first)
    if (first.ok && firstData?.ok !== false && firstData?.extraction) return first

    const successes = []
    const failed = []
    for (let i = 0; i < payload.images.length; i++) {
      const body = { ...payload, images: [payload.images[i]] }
      try {
        const requestInput = retryRequest(input, init, body)
        const requestInit = input instanceof Request ? undefined : { ...(init || {}), body: JSON.stringify(body) }
        const response = await rawFetch(requestInput, requestInit)
        const data = await jsonFrom(response)
        if (response.ok && data?.ok !== false && data?.extraction) successes.push({ index:i, extraction:data.extraction })
        else failed.push(i)
      } catch {
        failed.push(i)
      }
    }

    if (!successes.length) return first

    successes.sort((a,b) => a.index - b.index)
    const extraction = mergeExtractions(successes.map(x => x.extraction))
    extraction.warnings = uniq([
      ...(Array.isArray(extraction.warnings) ? extraction.warnings : []),
      ...(failed.length ? [`${failed.length} screenshot${failed.length === 1 ? '' : 's'} could not be read; usable data from the remaining screenshots was preserved.`] : [])
    ])

    return new Response(JSON.stringify({
      ok:true,
      extraction,
      partial:failed.length > 0,
      successful_image_indices:successes.map(x => x.index),
      failed_image_indices:failed,
      engine_version:'frontend-single-image-fallback-v140'
    }), {
      status:200,
      headers:{ 'Content-Type':'application/json', 'X-Flippers-Fallback':'single-image-v140' }
    })
  }
})()
