// FlippersAI — eBay comps
//
// Real eBay Australia listing prices, instead of an AI guessing from web search.
// Two modes:
//   comps       what is this product actually listed at on eBay AU right now
//               (count, median, quartiles, condition split, sample links)
//   check       whether the stored credentials are the right shape (never their value)
//   underpriced listings in a search that sit well below that search's own median,
//               i.e. candidate buys - this is per-user sourcing, not a shared feed
//
// Honesty: eBay's public Browse API returns ACTIVE listings only. Sold prices need
// the Marketplace Insights API, which is limited-release. So everything here is
// labelled basis 'active' and callers must apply their own haircut - asking prices
// are not sale prices. Nothing in this function ever claims otherwise.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const ENGINE = 'ebay-comps-v1'
const OAUTH = 'https://api.ebay.com/identity/v1/oauth2/token'
const SEARCH = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
const MARKETPLACE = 'EBAY_AU'
const SCOPE = 'https://api.ebay.com/oauth/api_scope'
const MAX_LIMIT = 100
// A median from two listings is not a market. Below this, say so instead of pretending.
const MIN_FOR_STATS = 4
// "Well below the market" for the underpriced scan. Tight enough that noise does not qualify.
const UNDERPRICED_RATIO = 0.7

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

// One token per warm instance; eBay's client-credentials tokens last 2 hours.
let cached: { token: string, expires: number } | null = null

async function token() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  const id = Deno.env.get('EBAY_CLIENT_ID')
  const secret = Deno.env.get('EBAY_CLIENT_SECRET')
  if (!id || !secret) throw new Error('eBay is not configured on the server (missing credentials).')
  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Never echo the credentials, only what eBay said about them.
    const detail = body?.error_description || body?.error || `HTTP ${res.status}`
    throw new Error(`eBay rejected the API credentials: ${detail}`)
  }
  cached = { token: body.access_token, expires: Date.now() + (Number(body.expires_in || 7200) * 1000) }
  return cached.token
}

type Item = { title: string, price: number, currency: string, condition: string | null, url: string, seller: string | null, shipping: number | null, buyingOption: string[] }

async function search(q: string, opts: { limit?: number, filter?: string, sort?: string } = {}) {
  const params = new URLSearchParams({ q, limit: String(Math.min(opts.limit ?? 50, MAX_LIMIT)) })
  if (opts.filter) params.set('filter', opts.filter)
  if (opts.sort) params.set('sort', opts.sort)
  const res = await fetch(`${SEARCH}?${params}`, {
    headers: {
      Authorization: `Bearer ${await token()}`,
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
      'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=AU'
    }
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`eBay search failed: ${body?.errors?.[0]?.message || `HTTP ${res.status}`}`)
  const items: Item[] = (body.itemSummaries || []).map((x: any) => ({
    title: String(x.title || ''),
    price: Number(x.price?.value ?? NaN),
    currency: String(x.price?.currency || 'AUD'),
    condition: x.condition || null,
    url: String(x.itemWebUrl || x.itemHref || ''),
    seller: x.seller?.username || null,
    shipping: Number(x.shippingOptions?.[0]?.shippingCost?.value ?? NaN),
    buyingOption: x.buyingOptions || []
  })).filter((i: Item) => Number.isFinite(i.price) && i.price > 0 && i.currency === 'AUD')
  return { items, total: Number(body.total || items.length) }
}

const median = (ns: number[]) => {
  if (!ns.length) return null
  const s = [...ns].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100
}
const quantile = (ns: number[], q: number) => {
  if (!ns.length) return null
  const s = [...ns].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return Math.round((s[lo] + (s[hi] - s[lo]) * (pos - lo)) * 100) / 100
}
// Asking prices have long tails (bundles, lots, mispriced junk). Trim both ends before
// calling anything a market price.
function trimmed(items: Item[]) {
  if (items.length < 8) return items
  const p = items.map(i => i.price)
  const lo = quantile(p, 0.05)!, hi = quantile(p, 0.95)!
  return items.filter(i => i.price >= lo && i.price <= hi)
}

function stats(items: Item[]) {
  const core = trimmed(items)
  const prices = core.map(i => i.price)
  const byCondition: Record<string, number> = {}
  for (const i of core) byCondition[i.condition || 'Unspecified'] = (byCondition[i.condition || 'Unspecified'] || 0) + 1
  return {
    listings: items.length,
    used_for_stats: core.length,
    enough_for_a_market_view: core.length >= MIN_FOR_STATS,
    low: quantile(prices, 0.25),
    median: median(prices),
    high: quantile(prices, 0.75),
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    by_condition: byCondition
  }
}

const sample = (items: Item[], n = 6) =>
  [...items].sort((a, b) => a.price - b.price).slice(0, n)
    .map(i => ({ title: i.title, price_aud: i.price, condition: i.condition, url: i.url, shipping_aud: Number.isFinite(i.shipping) ? i.shipping : null }))

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'comps')
    const q = String(body.query || body.product_name || '').trim()
    if (!q) return json({ ok: false, error: 'Tell me what to look up (query).' }, 400)

    // Configuration check. Reports the SHAPE of the credentials only - never any part of
    // their value - so a bad paste can be diagnosed without anyone seeing the keys.
    if (mode === 'check') {
      const id = Deno.env.get('EBAY_CLIENT_ID') || ''
      const secret = Deno.env.get('EBAY_CLIENT_SECRET') || ''
      const env = /-PRD-/i.test(id) ? 'production' : /-SBX-/i.test(id) ? 'sandbox' : 'unrecognised'
      return json({
        ok: true, engine: ENGINE,
        client_id_present: Boolean(id), client_secret_present: Boolean(secret),
        client_id_environment: env,
        client_id_length: id.length, client_secret_length: secret.length,
        client_id_has_stray_whitespace: id !== id.trim(),
        client_secret_has_stray_whitespace: secret !== secret.trim(),
        looks_swapped: /-PRD-|-SBX-/i.test(secret) && !/-PRD-|-SBX-/i.test(id),
        expected: 'client_id looks like BenAkinc-FlippersA-PRD-xxxxxxxxx-xxxxxxxx (about 40 chars); client_secret is PRD-xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxx (about 37 chars)'
      })
    }

    if (mode === 'comps') {
      // Fixed-price only: auctions mid-flight are not a price anyone paid.
      const { items, total } = await search(q, { limit: 100, filter: 'buyingOptions:{FIXED_PRICE}' })
      const s = stats(items)
      return json({
        ok: true, engine: ENGINE, marketplace: MARKETPLACE, query: q, basis: 'active',
        note: 'Current eBay AU asking prices, not sold prices. Asking prices typically sit above what items sell for.',
        total_matches: total, ...s, cheapest: sample(items)
      })
    }

    if (mode === 'underpriced') {
      const { items } = await search(q, { limit: 100, filter: 'buyingOptions:{FIXED_PRICE}' })
      const s = stats(items)
      if (!s.enough_for_a_market_view || s.median === null) {
        return json({ ok: true, engine: ENGINE, query: q, enough_for_a_market_view: false, candidates: [], note: `Only ${s.used_for_stats} comparable listings — not enough to tell what is underpriced.` })
      }
      const cut = s.median * UNDERPRICED_RATIO
      const candidates = items
        .filter(i => i.price <= cut)
        .sort((a, b) => a.price - b.price)
        .slice(0, 10)
        .map(i => ({
          title: i.title, price_aud: i.price, condition: i.condition, url: i.url, seller: i.seller,
          shipping_aud: Number.isFinite(i.shipping) ? i.shipping : null,
          percent_below_median: Math.round((1 - i.price / s.median!) * 100)
        }))
      return json({
        ok: true, engine: ENGINE, marketplace: MARKETPLACE, query: q, basis: 'active',
        note: 'Candidates only. A low price usually means a reason - condition, missing parts, a bad seller or the wrong item. Each one still needs Analyse.',
        median: s.median, low: s.low, high: s.high, listings: s.listings, candidates
      })
    }

    return json({ ok: false, error: `Unknown mode "${mode}".` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return json({ ok: false, engine: ENGINE, error: message }, 502)
  }
})
