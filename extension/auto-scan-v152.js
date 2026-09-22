// v0.152 Auto Scan: re-scans the user's saved marketplace searches in the background while Chrome is open.
// Runs in the service worker. Uses the user's own signed-in browser tabs (opened in the background and
// closed again), the same collection reader and Scout rating as a manual scan, and only rates listings
// FlippersAI hasn't seen before. Deliberately gentle: each search at most every few hours, a few at a time.
import { api } from './api.js'
import { CONFIG } from './config.js'

const KEY = 'flippers_saved_searches_v152'
const ALARM = 'flippers-autoscan-v152'
const CHECK_EVERY_MIN = 30
const MIN_HOURS = 3
const MAX_SEARCHES = 8
const MAX_NEW_PER_SEARCH = 25
const BATCH = 5
const PAGE_SETTLE_MS = 4500
const MAX_PER_TICK = 2 // keep each background run short (MV3 service workers are time-limited)
let running = false

const platformOf = url => { try { const h = new URL(url).hostname; return h.includes('facebook.com') ? 'facebook' : h.includes('ebay.com.au') ? 'ebay' : h.includes('gumtree.com.au') ? 'gumtree' : h.includes('depop.com') ? 'depop' : 'other' } catch { return 'other' } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function listSearches() { return (await chrome.storage.local.get(KEY))[KEY] || [] }
async function saveSearches(list) { await chrome.storage.local.set({ [KEY]: list }) }

export async function addSearch({ url, label, everyHours = 6 }) {
  const platform = platformOf(url)
  if (platform === 'other') throw new Error('Only Facebook Marketplace, eBay, Gumtree and Depop searches can be auto-scanned.')
  const list = await listSearches()
  if (list.some(s => s.url === url)) throw new Error('This search is already saved.')
  if (list.length >= MAX_SEARCHES) throw new Error(`You can auto-scan up to ${MAX_SEARCHES} searches. Remove one first.`)
  const s = { id: crypto.randomUUID(), url, label: String(label || '').slice(0, 80) || `${platform} search`, platform, every_hours: Math.max(MIN_HOURS, Number(everyHours) || 6), enabled: true, created_at: new Date().toISOString(), last_run: null, last_result: null }
  await saveSearches([...list, s])
  await ensureAlarm()
  return s
}
export async function removeSearch(id) { await saveSearches((await listSearches()).filter(s => s.id !== id)) }
export async function toggleSearch(id, enabled) { await saveSearches((await listSearches()).map(s => s.id === id ? { ...s, enabled } : s)) }

export async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM)
  if (!existing) await chrome.alarms.create(ALARM, { periodInMinutes: CHECK_EVERY_MIN, delayInMinutes: 2 })
}

async function waitForTab(tabId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab) throw new Error('Scan tab was closed.')
    if (tab.status === 'complete') return tab
    await sleep(500)
  }
  throw new Error('The marketplace page took too long to load.')
}

async function collect(tabId, scroll) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['scout-collection-content.js'] }).catch(() => {})
  const res = await chrome.tabs.sendMessage(tabId, { type: scroll ? 'FLIPPERS_SCROLL_RESULTS_V066' : 'FLIPPERS_SCAN_COLLECTION_V066' })
  if (!res?.ok) throw new Error(res?.error || 'Could not read the results page.')
  return res.data || {}
}

// Open the saved search in a background tab, read two screens of results, close it.
async function readSearch(s) {
  const tab = await chrome.tabs.create({ url: s.url, active: false })
  try {
    await waitForTab(tab.id)
    await sleep(PAGE_SETTLE_MS)
    const first = await collect(tab.id, false)
    if (first.mode !== 'collection') throw new Error(first.platform === 'facebook' ? 'Facebook showed a non-results page (are you signed in?).' : 'This page is not a search results page.')
    const more = await collect(tab.id, true).catch(() => ({ candidates: [] }))
    const seen = new Set(), candidates = []
    for (const c of [...(first.candidates || []), ...(more.candidates || [])]) { const k = c.listingId || c.url; if (k && !seen.has(k)) { seen.add(k); candidates.push(c) } }
    return { ...first, candidates }
  } finally { chrome.tabs.remove(tab.id).catch(() => {}) }
}

// Listings already known to FlippersAI (any earlier scan) are skipped so we only pay to rate new ones.
async function newOnly(candidates) {
  const ids = candidates.map(c => c.listingId).filter(Boolean)
  if (!ids.length) return candidates
  const known = new Set()
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40).map(x => `"${String(x).replace(/"/g, '')}"`).join(',')
    const rows = await api.select('scout_candidates', `select=listing_id&listing_id=in.(${encodeURIComponent(chunk)})`).catch(() => [])
    for (const r of rows || []) known.add(String(r.listing_id))
  }
  return candidates.filter(c => !c.listingId || !known.has(String(c.listingId)))
}

function scoreRow(c, r, engine) {
  const a = { ...r, engine_version: engine || 'flippers-scout-batch-v090', scout_scan_depth: 'search_page', scout_enriched: false, auto_scan: true }
  const ask = Number(c.asking_price), profit = Number(a.expected_profit), roi = Number(a.expected_roi_percent), resale = Number(a.resale_mid)
  if ((Number.isFinite(profit) && profit <= 0) || (Number.isFinite(roi) && roi <= 0) || (Number.isFinite(ask) && Number.isFinite(resale) && resale < ask)) {
    a.overall_score = Math.min(Number(a.overall_score || 0), 49); a.success_potential = Math.min(Number(a.success_potential || 0), 45); a.recommendation = 'skip'
  }
  return a
}
const worthwhile = a => ['strong_buy', 'buy', 'negotiate'].includes(a.recommendation) || Number(a.overall_score || 0) >= 65

async function runSearch(s) {
  const user = await api.getUser()
  if (!user?.id) throw new Error('Sign in to FlippersAI in the extension first.')
  const page = await readSearch(s)
  const fresh = (await newOnly(page.candidates || [])).slice(0, MAX_NEW_PER_SEARCH)
  if (!fresh.length) return { found: page.candidates?.length || 0, fresh: 0, good: 0, goodTitles: [] }
  const session = await api.insert('scout_sessions', { user_id: user.id, platform: s.platform, source_url: s.url, query_text: s.label, status: 'running', candidate_count: fresh.length, selected_count: 0, metadata: { source: 'auto_scan', saved_search_id: s.id, captured_at: new Date().toISOString() } }, { single: true })
  if (!session?.id) throw new Error('Could not start the scan.')
  const rows = await api.insert('scout_candidates', fresh.map((c, i) => ({ session_id: session.id, user_id: user.id, source_url: c.url, listing_id: c.listingId || null, title: c.title || null, asking_price: c.askingPrice ?? null, currency: c.currency || 'AUD', location: c.location || null, condition: c.condition || null, seller_name: c.sellerName || null, thumbnail_url: c.thumbnailUrl || null, region_code: c.regionCode || null, category_label: c.categoryLabel || 'Other', raw_capture: { raw_text: c.rawText || '', order_index: i, round_index: 1, region_code: c.regionCode || '', category_label: c.categoryLabel || 'Other', auto_scan: true }, scan_status: 'quick', selected: false, rank_score: null, saved: false })))
  const good = []
  for (let i = 0; i < (rows || []).length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      const res = await api.invoke('scout-batch-screen', { items: batch.map(c => ({ id: String(c.id), title: c.title || '', asking_price: c.asking_price ?? null, location: c.location || '', category: c.category_label || 'Other', visible_text: c.raw_capture?.raw_text || '' })) })
      const byId = new Map((res?.results || []).map(r => [String(r.id), r]))
      for (const c of batch) {
        const r = byId.get(String(c.id))
        if (!r) { await api.update('scout_candidates', `id=eq.${c.id}`, { scan_status: 'failed', analysis: { error: 'No rating returned' }, updated_at: new Date().toISOString() }).catch(() => {}); continue }
        const a = scoreRow(c, r, res?.engine_version)
        await api.update('scout_candidates', `id=eq.${c.id}`, { analysis: a, scan_status: 'rated', recommendation: a.recommendation || null, score: a.overall_score ?? null, resale_mid: a.resale_mid ?? null, expected_profit: a.expected_profit ?? null, expected_roi_percent: a.expected_roi_percent ?? null, updated_at: new Date().toISOString() })
        if (worthwhile(a)) good.push({ title: c.title || 'Listing', profit: a.expected_profit })
      }
    } catch (e) {
      for (const c of batch) await api.update('scout_candidates', `id=eq.${c.id}`, { scan_status: 'failed', analysis: { error: String(e?.message || e) }, updated_at: new Date().toISOString() }).catch(() => {})
    }
  }
  await api.update('scout_sessions', `id=eq.${session.id}`, { status: 'completed' }).catch(() => {})
  return { found: page.candidates.length, fresh: fresh.length, good: good.length, goodTitles: good.slice(0, 3).map(g => g.title) }
}

export async function runDue(force = false, onlyId = null) {
  if (running) return { skipped: 'already running' }
  running = true
  const out = []
  try {
    const list = await listSearches()
    let done = 0
    for (const s of list) {
      if (!force && done >= MAX_PER_TICK) break
      if (onlyId && s.id !== onlyId) continue
      if (!onlyId && !s.enabled) continue
      const due = force || !s.last_run || Date.now() - Date.parse(s.last_run) >= s.every_hours * 3600000
      if (!due) continue
      let result
      try { result = { ok: true, ...(await runSearch(s)) } } catch (e) { result = { ok: false, error: String(e?.message || e) } }
      const now = new Date().toISOString()
      await saveSearches((await listSearches()).map(x => x.id === s.id ? { ...x, last_run: now, last_result: result } : x))
      out.push({ id: s.id, label: s.label, ...result })
      done++
      if (result.ok && result.good) {
        chrome.notifications?.create(`flippers-auto-${s.id}-${Date.now()}`, { type: 'basic', iconUrl: 'icons/icon128.png', title: `${result.good} new find${result.good === 1 ? '' : 's'}: ${s.label}`, message: result.goodTitles.join(' · ').slice(0, 180) || 'Open FlippersAI → Find → Marketplace finds.', priority: 1 })
      }
      await sleep(8000) // space searches out
    }
  } finally { running = false }
  return out
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === ALARM) runDue(false).catch(() => {}) })
chrome.notifications?.onClicked.addListener(id => { if (id.startsWith('flippers-auto-')) chrome.tabs.create({ url: `${CONFIG.websiteUrl}` }) })
chrome.runtime.onInstalled.addListener(() => { ensureAlarm().catch(() => {}) })
chrome.runtime.onStartup.addListener(() => { ensureAlarm().catch(() => {}) })

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handlers = {
    FLIPPERS_AUTOSCAN_LIST: async () => ({ searches: await listSearches(), limits: { max: MAX_SEARCHES, minHours: MIN_HOURS } }),
    FLIPPERS_AUTOSCAN_ADD: async () => ({ search: await addSearch(message) }),
    FLIPPERS_AUTOSCAN_REMOVE: async () => { await removeSearch(message.id); return {} },
    FLIPPERS_AUTOSCAN_TOGGLE: async () => { await toggleSearch(message.id, message.enabled !== false); return {} },
    FLIPPERS_AUTOSCAN_RUN: async () => ({ results: await runDue(true, message.id || null) })
  }
  const h = handlers[message?.type]
  if (!h) return false
  h().then(data => sendResponse({ ok: true, data })).catch(e => sendResponse({ ok: false, error: String(e?.message || e) }))
  return true
})
