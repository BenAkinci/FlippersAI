import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const clean = (value: unknown, max = 12000) => String(value ?? '').trim().slice(0, max)
const num = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const uniq = <T>(items: T[]) => [...new Set(items)]

function platformFromUrl(url: URL) {
  const host = url.hostname.toLowerCase()
  if (host.includes('depop.')) return 'depop'
  if (host.includes('ebay.')) return 'ebay'
  if (host.includes('facebook.')) return 'facebook'
  if (host.includes('gumtree.')) return 'gumtree'
  return 'other'
}

function listingIdFromUrl(url: URL, platform: string) {
  const path = url.pathname.replace(/\/+$/, '')
  if (platform === 'depop') {
    const m = path.match(/\/products\/([^/]+)/i)
    return m?.[1] || ''
  }
  if (platform === 'ebay') {
    const m = path.match(/\/(?:itm\/)?(?:[^/]+\/)?(\d{9,})/i)
    return m?.[1] || ''
  }
  return path.split('/').filter(Boolean).at(-1) || ''
}

function attr(html: string, selectorName: string, attrName = 'content') {
  const esc = selectorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+${attrName}=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+${attrName}=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["'][^>]*>`, 'i')
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return decodeHtml(m[1])
  }
  return ''
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseJsonLd(html: string) {
  const blocks: any[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {}
  }
  return blocks
}

function flattenJsonLd(nodes: any[]) {
  const out: any[] = []
  const walk = (x: any) => {
    if (!x || typeof x !== 'object') return
    if (Array.isArray(x)) return x.forEach(walk)
    out.push(x)
    if (x['@graph']) walk(x['@graph'])
    if (x.itemListElement) walk(x.itemListElement)
  }
  nodes.forEach(walk)
  return out
}

function firstProduct(nodes: any[]) {
  return flattenJsonLd(nodes).find(x => {
    const t = x?.['@type']
    return t === 'Product' || (Array.isArray(t) && t.includes('Product'))
  }) || null
}

function offerOf(product: any) {
  const o = product?.offers
  if (Array.isArray(o)) return o.find(Boolean) || null
  return o && typeof o === 'object' ? o : null
}

function sellerOf(product: any, offer: any) {
  const seller = offer?.seller || product?.seller || product?.brand
  if (typeof seller === 'string') return seller
  return clean(seller?.name || seller?.alternateName || '', 300)
}

function conditionOf(product: any, offer: any) {
  const raw = clean(offer?.itemCondition || product?.itemCondition || '', 500)
  if (!raw) return ''
  const tail = raw.split('/').filter(Boolean).at(-1) || raw
  return tail.replace(/Condition$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}

function imageList(product: any, html: string) {
  const values: string[] = []
  const add = (v: any) => {
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) values.push(v)
    else if (v && typeof v === 'object') add(v.url || v.contentUrl)
  }
  const p = product?.image
  if (Array.isArray(p)) p.forEach(add); else add(p)
  add(attr(html, 'og:image'))
  const twitter = attr(html, 'twitter:image')
  if (twitter) add(twitter)
  return uniq(values).slice(0, 12)
}

function descriptionFromHtml(html: string) {
  return attr(html, 'og:description') || attr(html, 'description') || attr(html, 'twitter:description')
}

async function fetchPage(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-AU,en;q=0.9'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: cors })

  const diagnosticId = crypto.randomUUID()
  try {
    const body = await req.json()
    const rawUrl = clean(body?.listing_url, 4000)
    if (!rawUrl) return new Response(JSON.stringify({ error: 'listing_url is required' }), { status: 400, headers: cors })

    let parsed: URL
    try { parsed = new URL(rawUrl) } catch {
      return new Response(JSON.stringify({ error: 'Invalid listing URL' }), { status: 400, headers: cors })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return new Response(JSON.stringify({ error: 'Unsupported URL protocol' }), { status: 400, headers: cors })

    const platform = platformFromUrl(parsed)
    const listingId = listingIdFromUrl(parsed, platform)
    const started = Date.now()
    let response: Response
    try {
      response = await fetchPage(parsed.toString())
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return new Response(JSON.stringify({
        acquired: false,
        platform,
        listing_id: listingId,
        listing_url: parsed.toString(),
        diagnostic_id: diagnosticId,
        acquisition_status: 'fetch_failed',
        detail: clean(detail, 600),
        retryable: true
      }), { status: 200, headers: cors })
    }

    const contentType = response.headers.get('content-type') || ''
    const html = contentType.includes('text') || contentType.includes('html') ? await response.text() : ''
    if (!response.ok || !html) {
      return new Response(JSON.stringify({
        acquired: false,
        platform,
        listing_id: listingId,
        listing_url: response.url || parsed.toString(),
        diagnostic_id: diagnosticId,
        acquisition_status: response.status === 403 || response.status === 401 ? 'blocked' : 'http_error',
        http_status: response.status,
        retryable: response.status >= 500 || response.status === 429
      }), { status: 200, headers: cors })
    }

    const ld = parseJsonLd(html)
    const product = firstProduct(ld)
    const offer = offerOf(product)
    const metaTitle = attr(html, 'og:title') || attr(html, 'twitter:title')
    const titleTag = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '')
    const title = clean(product?.name || metaTitle || titleTag, 500)
    const description = clean(product?.description || descriptionFromHtml(html), 12000)
    const price = num(offer?.price ?? offer?.lowPrice ?? attr(html, 'product:price:amount'))
    const currency = clean(offer?.priceCurrency || attr(html, 'product:price:currency') || 'AUD', 12).toUpperCase()
    const sellerName = sellerOf(product, offer)
    const condition = conditionOf(product, offer)
    const images = imageList(product, html)

    const locationCandidates = [
      clean(offer?.availableAtOrFrom?.address?.addressLocality, 200),
      clean(offer?.areaServed?.name, 200),
      clean(product?.offers?.shippingDetails?.shippingDestination?.addressCountry, 200)
    ].filter(Boolean)

    const facts = {
      source_platform: platform,
      listing_id: listingId,
      listing_url: response.url || parsed.toString(),
      listing_title: title,
      description,
      asking_price: price,
      currency,
      asking_price_verified: price !== null,
      asking_price_confidence: price !== null ? 0.98 : 0,
      seller_name: sellerName,
      listing_location: locationCandidates[0] || '',
      condition,
      image_urls: images,
      source_http_status: response.status
    }

    const provenance: Record<string, string> = {}
    if (title) provenance.listing_title = product?.name ? 'json_ld_product.name' : metaTitle ? 'og:title' : 'title_tag'
    if (description) provenance.description = product?.description ? 'json_ld_product.description' : 'meta_description'
    if (price !== null) provenance.asking_price = offer?.price != null ? 'json_ld_offer.price' : offer?.lowPrice != null ? 'json_ld_offer.lowPrice' : 'product:price:amount'
    if (sellerName) provenance.seller_name = offer?.seller ? 'json_ld_offer.seller' : product?.seller ? 'json_ld_product.seller' : 'json_ld_product.brand'
    if (condition) provenance.condition = 'json_ld_itemCondition'
    if (images.length) provenance.image_urls = product?.image ? 'json_ld_product.image' : 'social_meta_image'

    const missing = ['listing_title','asking_price','seller_name','condition','image_urls']
      .filter(k => {
        const v = (facts as any)[k]
        return v === null || v === '' || (Array.isArray(v) && !v.length)
      })

    return new Response(JSON.stringify({
      acquired: true,
      acquisition_status: missing.length ? 'partial' : 'complete',
      diagnostic_id: diagnosticId,
      duration_ms: Date.now() - started,
      facts,
      provenance,
      missing_fields: missing,
      page_signals: {
        json_ld_blocks: ld.length,
        product_schema_found: Boolean(product),
        html_bytes: html.length
      },
      engine_version: 'listing-acquisition-alpha-1'
    }), { headers: cors })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('listing-acquisition', { diagnosticId, detail })
    return new Response(JSON.stringify({ error: 'Listing acquisition failed', diagnostic_id: diagnosticId, detail: clean(detail, 700) }), { status: 500, headers: cors })
  }
})
