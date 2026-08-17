import { api } from './api.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const money = v => v == null || v === '' || Number.isNaN(Number(v))
  ? '—'
  : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const pct = v => v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`
const sleep = ms => new Promise(r => setTimeout(r, ms))

const S = {
  rows: new Map(), busy: false, started: false, autoNext: false, sort: 'best', badges: true,
  activeIds: new Set(), progress: null, contextPromise: null, observerTimer: null
}

function toast(message) {
  $('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}

const rated = c => ['rated','analysed'].includes(c?.scan_status) || Boolean(c?.recommendation || c?.analysis?.recommendation)
const deep = c => c?.scan_status === 'analysed'
const failed = c => c?.scan_status === 'failed'
const pending = c => !rated(c) && !failed(c)
const confidence = c => {
  const a = c?.analysis || {}
  return a.overall_confidence ?? a.valuation_confidence ?? a.identification_confidence ?? null
}
const recLabel = v => ({ strong_buy:'Strong lead', buy:'Strong lead', negotiate:'Promising', verify_first:'Needs verification', skip:'Skip' })[v] || 'Rated'
const recClass = v => ['strong_buy','buy'].includes(v) ? 'good' : ['negotiate','verify_first'].includes(v) ? 'warn' : v === 'skip' ? 'bad' : ''

function complexity(c = {}) {
  let n = 0
  const category = c.category_label || c.analysis?.category || 'Other'
  const raw = String(c.raw_capture?.raw_text || '')
  if (['Watches','Sneakers','Collectibles','Fashion'].includes(category)) n += 2
  else if (['Phones','Audio','Gaming','Computers','Cameras'].includes(category)) n += 1
  if (!c.title || c.title.length < 6) n += 2
  if (c.asking_price == null) n += 1.5
  if (raw.length < 50) n += 1
  if (/\b(bundle|lot|assorted|replica|fake|damaged|faulty|parts|unknown|unverified)\b/i.test(`${c.title || ''} ${raw}`)) n += 2
  return n
}

function batchSize(rows = []) {
  const sample = rows.slice(0, 10)
  if (!sample.length) return 0
  const avg = sample.reduce((s, c) => s + complexity(c), 0) / sample.length
  const missing = sample.filter(c => c.asking_price == null).length / sample.length
  if (avg >= 4 || missing > .4) return Math.min(3, rows.length)
  if (avg >= 2.5 || missing > .2) return Math.min(4, rows.length)
  return Math.min(5, rows.length)
}

function rankScore(a = {}) {
  const rec = a.recommendation
  const bonus = rec === 'strong_buy' ? 22 : rec === 'buy' ? 18 : rec === 'negotiate' ? 10 : rec === 'verify_first' ? 3 : rec === 'skip' ? -25 : 0
  const score = Number(a.overall_score || 0), profit = Number(a.expected_profit || 0), roi = Number(a.expected_roi_percent || 0), conf = Number(a.overall_confidence ?? a.valuation_confidence ?? 0)
  return Math.round((score + bonus + Math.max(-15, Math.min(20, profit / 10)) + Math.max(-8, Math.min(8, roi / 20)) + Math.max(0, Math.min(6, conf / 20))) * 10) / 10
}

function card(id) { return $(`.scout-candidate[data-candidate="${CSS.escape(String(id))}"]`) }

async function loadRows() {
  const ids = $$('.scout-candidate[data-candidate]').map(el => el.dataset.candidate).filter(Boolean)
  if (!ids.length) { S.rows = new Map(); return [] }
  const rows = await api.select('scout_candidates', `select=*&id=in.(${ids.join(',')})`).catch(() => [])
  const valid = new Set((rows || []).map(r => String(r.id)))
  ids.filter(id => !valid.has(String(id))).forEach(id => card(id)?.remove())
  S.rows = new Map((rows || []).map(r => [String(r.id), r]))
  return rows || []
}

function sortValue(c, mode) {
  const a = c?.analysis || {}
  if (mode === 'score') return Number(a.overall_score ?? c.score ?? -Infinity)
  if (mode === 'price_low') return c.asking_price == null ? Infinity : Number(c.asking_price)
  if (mode === 'resale') return Number(a.resale_mid ?? c.resale_mid ?? -Infinity)
  if (mode === 'profit') return Number(a.expected_profit ?? c.expected_profit ?? -Infinity)
  if (mode === 'roi') return Number(a.expected_roi_percent ?? c.expected_roi_percent ?? -Infinity)
  if (mode === 'confidence') return Number(confidence(c) ?? -Infinity)
  if (mode === 'newest') return Number(c.raw_capture?.order_index ?? c.order_index ?? 0)
  return Number(c.rank_score ?? -Infinity)
}

function sortCards() {
  const list = $('.scout-list')
  if (!list) return
  const visible = $$('.scout-candidate:not(.curation-queued)', list)
  const queued = $$('.scout-candidate.curation-queued', list)
  visible.sort((a, b) => {
    const ar = S.rows.get(String(a.dataset.candidate)) || {}, br = S.rows.get(String(b.dataset.candidate)) || {}
    const av = sortValue(ar, S.sort), bv = sortValue(br, S.sort)
    if (S.sort === 'price_low') { if (av !== bv) return av - bv }
    else if (av !== bv) return bv - av
    return Number(ar.raw_capture?.order_index ?? 0) - Number(br.raw_capture?.order_index ?? 0)
  })
  ;[...visible, ...queued].forEach(el => list.appendChild(el))
}

function ensureControls(rows) {
  const toolbar = $('.scout-toolbar')
  if (!toolbar) return
  let controls = $('.scout-curation-controls', toolbar)
  if (!controls) {
    controls = document.createElement('div')
    controls.className = 'scout-curation-controls'
    controls.innerHTML = `
      <label class="scout-sort-label">Sort
        <select id="scoutSortBy">
          <option value="best">Best overall</option><option value="score">Highest rating</option><option value="price_low">Lowest price</option>
          <option value="resale">Highest resale</option><option value="profit">Highest profit</option><option value="roi">Highest ROI</option>
          <option value="confidence">Highest confidence</option><option value="newest">Newest scanned</option>
        </select>
      </label>
      <button type="button" class="button soft small" id="removeScoutSkips">Remove skips</button>
      <label class="scout-market-toggle"><input type="checkbox" id="marketplaceBadgeToggle" checked><span>On-page ratings</span></label>`
    toolbar.insertBefore(controls, toolbar.querySelector('.top-spacer'))
  }
  $('#scoutSortBy', controls).value = S.sort
  $('#marketplaceBadgeToggle', controls).checked = S.badges
  const skips = rows.filter(c => rated(c) && (c.recommendation || c.analysis?.recommendation) === 'skip').length
  const remove = $('#removeScoutSkips', controls)
  remove.disabled = S.busy || skips === 0
  remove.textContent = skips ? `Remove skips (${skips})` : 'Remove skips'
}

function paint(c) {
  const el = card(c.id)
  if (!el) return
  const active = S.activeIds.has(String(c.id)), queued = pending(c) && !active
  el.classList.toggle('curation-queued', queued); el.classList.toggle('curation-active', active); el.classList.toggle('curation-rated', rated(c)); el.classList.toggle('curation-deep', deep(c)); el.classList.toggle('curation-failed', failed(c))

  let x = $('.scout-dismiss', el)
  if (!x) {
    x = document.createElement('button'); x.type = 'button'; x.className = 'scout-dismiss'; x.dataset.dismissCandidate = c.id; x.title = 'Remove this listing'; x.setAttribute('aria-label', 'Remove listing'); x.textContent = '×'; el.appendChild(x)
  }
  x.disabled = S.busy && active

  const input = $('[data-select-candidate]', el)
  if (input) { input.disabled = S.busy || !rated(c) || failed(c); input.checked = rated(c) && Boolean(c.selected) }
  const pill = $('.scout-rec', el), quick = $('.scout-quick-note', el), oldDepth = $('.scout-depth-label', el), oldMetrics = $('.scout-metrics', el), actions = $('.scout-candidate-actions', el)

  if (failed(c)) {
    if (pill) { pill.className = 'scout-rec bad'; pill.textContent = 'Could not rate' }
    if (quick) quick.textContent = c.analysis?.error || 'Could not rate this listing.'
    oldDepth?.remove(); oldMetrics?.remove(); return
  }
  if (!rated(c)) {
    if (pill) { pill.className = 'scout-rec quality-wait'; pill.textContent = active ? 'Rating batch…' : 'Queued' }
    if (quick) quick.textContent = active ? `Rating this together with ${Math.max(0, S.activeIds.size - 1)} other listing${S.activeIds.size === 2 ? '' : 's'} — no listing tabs opened.` : 'Waiting for the next small batch.'
    oldDepth?.remove(); oldMetrics?.remove(); actions?.querySelector('[data-curation-start]')?.remove(); return
  }

  const a = c.analysis || {}, rec = c.recommendation || a.recommendation || ''
  if (pill) { pill.className = `scout-rec ${recClass(rec)}`; pill.textContent = recLabel(rec) }
  quick?.remove()
  const depth = document.createElement('div'); depth.className = 'scout-depth-label'; depth.textContent = deep(c) ? 'DEEP SCAN' : 'SEARCH-PAGE RATING'; oldDepth?.replaceWith(depth) || $('.scout-meta', el)?.insertAdjacentElement('afterend', depth)
  const metrics = document.createElement('div'); metrics.className = 'scout-metrics'; metrics.innerHTML = `
    <span class="score-metric">Score <b>${Math.round(Number(a.overall_score ?? c.score ?? 0))}/100</b></span>
    <span>Profit <b class="${Number(a.expected_profit ?? c.expected_profit ?? 0) >= 0 ? 'positive' : 'negative'}">${money(a.expected_profit ?? c.expected_profit)}</b></span>
    <span>Resale <b>${money(a.resale_mid ?? c.resale_mid)}</b></span><span>ROI <b>${pct(a.expected_roi_percent ?? c.expected_roi_percent)}</b></span>
    ${confidence(c) == null ? '' : `<span>Confidence <b>${pct(confidence(c))}</b></span>`}`
  oldMetrics?.replaceWith(metrics) || depth.insertAdjacentElement('afterend', metrics)
  if (deep(c) && rec !== 'skip' && actions && !actions.querySelector('[data-curation-start]')) {
    const start = document.createElement('button'); start.type = 'button'; start.className = 'button primary small scout-action'; start.dataset.curationStart = c.id; start.textContent = 'Start flip'; actions.prepend(start)
  }
}

function renderSummary(rows) {
  const ratedRows = rows.filter(c => rated(c) && !S.activeIds.has(String(c.id))), pendingRows = rows.filter(c => pending(c) && !S.activeIds.has(String(c.id)))
  const strong = ratedRows.filter(c => ['strong_buy','buy'].includes(c.recommendation || c.analysis?.recommendation)).length
  const promising = ratedRows.filter(c => ['negotiate','verify_first'].includes(c.recommendation || c.analysis?.recommendation)).length
  const skips = ratedRows.filter(c => (c.recommendation || c.analysis?.recommendation) === 'skip').length, next = batchSize(pendingRows)
  const box = $('.scout-summary')
  if (box) {
    const cells = [...box.children]
    if (cells[0]) cells[0].innerHTML = `<span>FOUND</span><strong>${rows.length}</strong>`
    if (cells[1]) cells[1].innerHTML = `<span>RATED</span><strong>${ratedRows.length}</strong>`
    if (cells[2]) cells[2].innerHTML = `<span>QUEUED</span><strong>${pendingRows.length}</strong>`
    if (cells[3]) cells[3].innerHTML = `<span>STRONG</span><strong>${strong}</strong>`
  }
  const insight = $('.scout-insight')
  if (insight) {
    if (S.progress) { insight.classList.add('scanning'); insight.innerHTML = `<strong>${S.progress.mode === 'deep' ? 'Deep scanning' : 'Rating'} ${S.progress.total} listings together…</strong><span>${S.progress.done}/${S.progress.total} finished · the batch appears together when ready.</span>` }
    else { insight.classList.remove('scanning'); insight.innerHTML = ratedRows.length ? `<strong>${strong} strong · ${promising} promising · ${skips} skip</strong><span>${pendingRows.length ? `${pendingRows.length} waiting · next batch ${next}` : 'Keep scouting, delete the ones you do not want, or deep-scan a shortlist.'}</span>` : `<strong>Building first shortlist</strong><span>FlippersAI is rating a small batch from the search page.</span>` }
  }
  const more = $('#scanMoreResults'); if (more && !S.busy) more.textContent = pendingRows.length ? `Scan next ${next} results ↓` : 'Scan more results ↓'
  const checked = $$('.scout-candidate:not(.curation-queued) [data-select-candidate]:checked').map(i => i.closest('.scout-candidate')?.dataset.candidate).filter(Boolean)
  const eligible = checked.filter(id => rated(S.rows.get(String(id))) && !deep(S.rows.get(String(id)))).length
  const deepButton = $('#deepScanSelected'); if (deepButton) { deepButton.disabled = S.busy || eligible === 0; deepButton.textContent = `Deep scan ${eligible} selected` }
  const selectAll = $('#scoutSelectAll'); if (selectAll) { selectAll.disabled = S.busy || ratedRows.length === 0; const label = selectAll.closest('.scout-select-all')?.querySelector('span'); if (label) label.textContent = 'Select rated' }
  let mode = $('.scout-quality-mode')
  if (!mode && box) { mode = document.createElement('section'); mode.className = 'scout-quality-mode'; box.insertAdjacentElement('beforebegin', mode) }
  if (mode) mode.innerHTML = `<div><span>SCOUT MODE</span><strong>Small batches · fast shortlist · deeper scan second</strong></div><small>Search-page ratings do not open listing tabs. Deep scan only the candidates you actually care about.</small>`
  ensureControls(rows)
}

function preliminaryCapture(c) {
  const raw = String(c.raw_capture?.raw_text || '')
  return { title:c.title || '', askingPrice:c.asking_price ?? null, location:c.location || '', condition:c.condition || '', sellerName:c.seller_name || '', listingText:raw, visibleText:raw, imageUrls:c.thumbnail_url ? [c.thumbnail_url] : [] }
}

function toDataUrl(buffer, mime = 'image/jpeg') {
  const bytes = new Uint8Array(buffer); let binary = ''
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 32768, bytes.length)))
  return `data:${mime};base64,${btoa(binary)}`
}
async function loadImage(url) {
  if (!/^https?:/i.test(String(url || ''))) return null
  try {
    const response = await fetch(url, { credentials:'include', cache:'force-cache' }); if (!response.ok) return null
    const type = response.headers.get('content-type') || ''; if (!type.startsWith('image/')) return null
    const blob = await response.blob(); if (blob.size > 4_500_000) return null
    return toDataUrl(await blob.arrayBuffer(), type)
  } catch { return null }
}
async function context() { if (!S.contextPromise) S.contextPromise = api.workflowState(); return S.contextPromise }

async function analyse(c, captureData, images, mode) {
  const state = await context(), profile = state.profile || {}, portfolio = state.portfolio || {}, price = captureData.askingPrice ?? c.asking_price ?? null
  const data = await api.invoke('analyse-listing-v2', {
    listing_url:c.source_url, listing_text:captureData.listingText || captureData.visibleText || '',
    platform_fields:{ asking_price:price, currency:c.currency || 'AUD', asking_price_verified:price != null, asking_price_confidence:price != null ? .9 : 0, listing_title:captureData.title || c.title || '', listing_location:captureData.location || c.location || '', seller_name:captureData.sellerName || c.seller_name || '' },
    user_overrides:{ asking_price:price, currency:c.currency || 'AUD' }, bankroll:Number(portfolio.available_cash || 0), risk_profile:profile.risk_profile || 'conservative', reserve_percent:Number(profile.capital_reserve_percent ?? 30), max_exposure_percent:Number(profile.max_single_item_exposure_percent ?? 20), portfolio_context:portfolio, images,
    scan_context:{ mode, instruction:mode === 'deep' ? 'Deep Scout scan. Use the full listing and visual evidence. Resolve model, condition, authenticity, inclusions and resale uncertainty as far as the evidence supports.' : 'Fast Scout shortlist rating from the marketplace search card only. Use visible title, price, location, card text and thumbnail. Do not pretend hidden listing detail was inspected. Be conservative about model, condition, authenticity and inclusions until deep scan.' }
  })
  if (data?.error) throw new Error(data.error)
  return { engine_version:data.engine_version || 'flippers-alpha-4-price-lock', analysis:data.analysis || {} }
}

async function saveRating(c, captureData, result, status) {
  const a = result.analysis || {}
  const body = { title:captureData.title || c.title || null, asking_price:captureData.askingPrice ?? c.asking_price ?? null, location:captureData.location || c.location || null, condition:captureData.condition || c.condition || null, seller_name:captureData.sellerName || c.seller_name || null, thumbnail_url:captureData.imageUrls?.[0] || c.thumbnail_url || null, deep_capture:status === 'analysed' ? captureData : (c.deep_capture || {}), analysis:{ ...a, engine_version:result.engine_version, scout_scan_depth:status === 'analysed' ? 'deep' : 'search_page' }, scan_status:status, recommendation:a.recommendation || null, score:a.overall_score ?? null, resale_mid:a.resale_mid ?? null, expected_profit:a.expected_profit ?? null, expected_roi_percent:a.expected_roi_percent ?? null, rank_score:rankScore(a), selected:status === 'rated' ? false : Boolean(c.selected), updated_at:new Date().toISOString() }
  await api.update('scout_candidates', `id=eq.${c.id}`, body); Object.assign(c, body); S.rows.set(String(c.id), c)
}

async function waitTab(id, timeout = 16000) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = error => { if (done) return; done = true; clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); error ? reject(error) : resolve() }
    const listener = (tabId, info) => { if (tabId === id && info.status === 'complete') finish() }
    chrome.tabs.onUpdated.addListener(listener)
    const timer = setTimeout(() => finish(new Error('Timed out loading listing.')), timeout)
    chrome.tabs.get(id).then(tab => { if (tab.status === 'complete') finish() }).catch(() => {})
  })
}
async function sendWithRetry(id, message) {
  let last
  for (let i = 0; i < 5; i++) { try { return await chrome.tabs.sendMessage(id, message) } catch (error) { last = error; await sleep(280 + i * 180) } }
  throw last || new Error('Could not read listing.')
}
async function deepCapture(c) {
  const tab = await chrome.tabs.create({ url:c.source_url, active:false })
  try { await waitTab(tab.id); await sleep(600); const result = await sendWithRetry(tab.id, { type:'FLIPPERS_SCAN_PAGE' }); if (!result?.ok) throw new Error(result?.error || 'Could not read listing.'); return result.data }
  finally { if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {}) }
}

async function processOne(c, mode) {
  try {
    const captureData = mode === 'deep' ? await deepCapture(c) : preliminaryCapture(c), images = [], maxImages = mode === 'deep' ? 6 : (c.thumbnail_url ? 1 : 0)
    for (const url of (captureData.imageUrls || []).slice(0, maxImages)) { const data = await loadImage(url); if (data) images.push(data) }
    const result = await analyse(c, captureData, images, mode); await saveRating(c, captureData, result, mode === 'deep' ? 'analysed' : 'rated'); return { ok:true }
  } catch (error) {
    if (mode === 'deep' && rated(c)) { c.analysis = { ...(c.analysis || {}), deep_scan_error:error.message }; await api.update('scout_candidates', `id=eq.${c.id}`, { analysis:c.analysis, updated_at:new Date().toISOString() }).catch(() => {}) }
    else { c.scan_status = 'failed'; c.selected = false; c.analysis = { error:error.message, scout_scan_depth:mode }; await api.update('scout_candidates', `id=eq.${c.id}`, { scan_status:'failed', selected:false, analysis:c.analysis, updated_at:new Date().toISOString() }).catch(() => {}) }
    S.rows.set(String(c.id), c); return { ok:false, error }
  } finally { if (S.progress) { S.progress.done++; renderSummary([...S.rows.values()]) } }
}

async function rateBatch(rows, mode) {
  if (S.busy || !rows.length) return
  S.busy = true; S.activeIds = new Set(rows.map(c => String(c.id))); S.progress = { mode, total:rows.length, done:0 }
  rows.forEach(paint); renderSummary([...S.rows.values()]); toast(`${mode === 'deep' ? 'Deep scanning' : 'Rating'} ${rows.length} listings together…`)
  try { await Promise.allSettled(rows.map(c => processOne(c, mode))) }
  finally { S.progress = null; S.activeIds.clear(); S.busy = false; await hydrate(false); await syncMarketplaceBadges(); toast(mode === 'deep' ? 'Deep scan ready' : 'Batch ratings ready') }
}

async function marketplaceTab() {
  const tabs = await chrome.tabs.query({ url:['https://*.facebook.com/*','https://*.ebay.com.au/*','https://*.gumtree.com.au/*','https://*.depop.com/*'] })
  return tabs.sort((a,b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0))[0] || null
}
function badgePayload() {
  const rows = [...S.rows.values()].filter(rated)
  const top = new Set(rows.filter(c => (c.recommendation || c.analysis?.recommendation) !== 'skip').sort((a,b) => Number(b.rank_score ?? -999) - Number(a.rank_score ?? -999)).slice(0,2).map(c => String(c.id)))
  return rows.map(c => { const a = c.analysis || {}; return { id:String(c.id), listingId:c.listing_id || '', url:c.source_url || '', score:Math.round(Number(a.overall_score ?? c.score ?? 0)), recommendation:c.recommendation || a.recommendation || '', label:recLabel(c.recommendation || a.recommendation || ''), profit:a.expected_profit ?? c.expected_profit ?? null, resale:a.resale_mid ?? c.resale_mid ?? null, roi:a.expected_roi_percent ?? c.expected_roi_percent ?? null, confidence:confidence(c), topPick:top.has(String(c.id)) } })
}
async function syncMarketplaceBadges() { const tab = await marketplaceTab(); if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type:'FLIPPERS_RATING_OVERLAY', enabled:S.badges, ratings:badgePayload() }).catch(() => {}) }
async function removeMarketplaceBadges(rows) { const tab = await marketplaceTab(); if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type:'FLIPPERS_RATING_REMOVE', listings:rows.map(c => ({ listingId:c.listing_id || '', url:c.source_url || '' })) }).catch(() => {}) }

async function updateSessionCounts(sessionId) {
  if (!sessionId) return
  const rows = [...S.rows.values()], strong = rows.filter(c => rated(c) && ['strong_buy','buy'].includes(c.recommendation || c.analysis?.recommendation)).length, promising = rows.filter(c => rated(c) && ['negotiate','verify_first'].includes(c.recommendation || c.analysis?.recommendation)).length
  await api.update('scout_sessions', `id=eq.${sessionId}`, { candidate_count:rows.length, selected_count:rows.filter(c => c.selected).length, strong_count:strong, promising_count:promising, updated_at:new Date().toISOString() }).catch(() => {})
}
async function deleteRows(rows) {
  const unique = rows.filter(Boolean).filter((c,i,a) => a.findIndex(x => String(x.id) === String(c.id)) === i)
  if (!unique.length) return
  const sessionId = unique[0].session_id
  await Promise.all(unique.map(c => api.remove('scout_candidates', `id=eq.${c.id}`).catch(() => null)))
  unique.forEach(c => { S.rows.delete(String(c.id)); card(c.id)?.remove() })
  await removeMarketplaceBadges(unique); await updateSessionCounts(sessionId); renderSummary([...S.rows.values()]); sortCards(); toast(`${unique.length} listing${unique.length === 1 ? '' : 's'} removed`)
}
async function persistSelection(ids) {
  const wanted = new Set(ids.map(String)), rows = [...S.rows.values()]
  await Promise.all(rows.map(c => { const on = rated(c) && !failed(c) && wanted.has(String(c.id)); c.selected = on; const input = $(`[data-candidate="${CSS.escape(String(c.id))}"] [data-select-candidate]`); if (input) input.checked = on; return api.update('scout_candidates', `id=eq.${c.id}`, { selected:on, updated_at:new Date().toISOString() }).catch(() => null) }))
  renderSummary(rows)
}
async function deepSelected() {
  const ids = $$('.scout-candidate:not(.curation-queued) [data-select-candidate]:checked').map(x => x.closest('.scout-candidate')?.dataset.candidate).filter(Boolean)
  const rows = ids.map(id => S.rows.get(String(id))).filter(c => c && rated(c) && !deep(c))
  if (!rows.length) return toast('Select at least one rated listing first.')
  for (let i = 0; i < rows.length; i += 2) await rateBatch(rows.slice(i, i + 2), 'deep')
}

async function waitWorkflow(opportunityId) {
  for (let i = 0; i < 15; i++) { const rows = await api.select('flip_workflows', `select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`); if (rows?.[0]) return rows[0]; await sleep(180) }
  throw new Error('Deal File saved, but workflow did not initialise.')
}
async function saveAnalysis(opportunityId, c, userId) {
  const x = c.analysis || {}
  return api.insert('analyses', { opportunity_id:opportunityId,user_id:userId,engine_version:x.engine_version || 'flippers-alpha-4-price-lock',identified_name:x.identified_name || c.title || '',brand:x.brand || '',model:x.model || '',variant:x.variant || '',category:x.category || '',identification_confidence:x.identification_confidence ?? 0,resale_low:x.resale_low,resale_mid:x.resale_mid,resale_high:x.resale_high,quick_sale_value:x.quick_sale_value,sell_time_low_days:x.sell_time_low_days,sell_time_mid_days:x.sell_time_mid_days,sell_time_high_days:x.sell_time_high_days,valuation_confidence:x.valuation_confidence ?? 0,overall_score:x.overall_score ?? 0,overall_risk:x.overall_risk ?? 0,recommendation:x.recommendation,recommended_offer:x.recommended_offer,max_buy:x.max_buy,break_even_sale_price:x.break_even_sale_price,expected_selling_costs:x.expected_selling_costs,expected_profit:x.expected_profit,expected_roi_percent:x.expected_roi_percent,quick_sale_profit:x.quick_sale_profit,next_action:x.next_action,questions_to_ask:x.questions_to_ask || [],inspection_checks:x.inspection_checks || [],risks:x.risks || {},assumptions:x.assumptions || [],evidence_summary:x.evidence_summary || '',raw_model_output:x,action_summary:x.action_summary || '',action_steps:x.action_steps || [],action_cautions:x.action_cautions || [],seller_message:x.seller_message || '',photo_findings:x.photo_findings || [],photo_count:0,user_overrides:{asking_price:c.asking_price},seller_confidence:x.seller_confidence ?? null,seller_confidence_label:x.seller_confidence_label ?? null,seller_confidence_reason:x.seller_confidence_reason ?? null,seller_signals:x.seller_signals || {},overall_confidence:x.overall_confidence ?? null }, { single:true })
}
function platform(url = '') { let host = ''; try { host = new URL(url).hostname } catch {}; return host.includes('facebook.com') ? 'facebook' : host.includes('ebay.com.au') ? 'ebay' : host.includes('gumtree.com.au') ? 'gumtree' : host.includes('depop.com') ? 'depop' : 'other' }
async function startFlip(c) {
  if (!deep(c)) return toast('Deep scan this listing before starting the flip.')
  const user = await api.getUser(), capture = c.deep_capture || {}
  const opportunity = await api.insert('opportunities', { user_id:user.id,source_platform:platform(c.source_url),source_url:c.source_url,listing_title:c.title || null,listing_text:capture.listingText || capture.visibleText || c.raw_capture?.raw_text || '',seller_asking_price:c.asking_price ?? null,listing_location:c.location || null,seller_name:c.seller_name || null,currency:c.currency || 'AUD',status:c.recommendation === 'skip' ? 'skipped' : 'watching',raw_listing:{browser_scan:true,source:'scout_session',scout_session_id:c.session_id,scout_candidate_id:c.id,listing_id:c.listing_id || null,condition:c.condition || null,scout_scan_depth:'deep',captured_at:new Date().toISOString(),canonical_url:c.source_url},updated_at:new Date().toISOString() }, { single:true })
  if (!opportunity?.id) throw new Error('Could not create Deal File.')
  let workflow = await waitWorkflow(opportunity.id)
  if (workflow.current_step === 'capture_listing') { await api.rpc('advance_flip_step', { p_workflow_id:workflow.id,p_step_key:'capture_listing',p_step_data:{captured:true,source:'scout_session',scout_candidate_id:c.id} }); workflow = await waitWorkflow(opportunity.id) }
  workflow = (await api.select('flip_workflows', `select=*&id=eq.${workflow.id}&limit=1`))?.[0] || workflow
  if (workflow.current_step === 'verify_listing' && c.title && c.asking_price != null) { await api.update('opportunities', `id=eq.${opportunity.id}`, { user_overrides:{asking_price:c.asking_price},updated_at:new Date().toISOString() }); await api.rpc('advance_flip_step', { p_workflow_id:workflow.id,p_step_key:'verify_listing',p_step_data:{asking_price:c.asking_price,verified:true,source:'scout_session'} }) }
  await saveAnalysis(opportunity.id, c, user.id)
  workflow = (await api.select('flip_workflows', `select=*&id=eq.${workflow.id}&limit=1`))?.[0] || workflow
  if (workflow.current_step === 'analyse_deal' && c.recommendation !== 'skip') await api.rpc('advance_flip_step', { p_workflow_id:workflow.id,p_step_key:'analyse_deal',p_step_data:{analysed:true,source:'scout_session',scout_candidate_id:c.id} })
  await api.update('opportunities', `id=eq.${opportunity.id}`, { status:c.recommendation === 'skip' ? 'skipped' : c.recommendation === 'verify_first' ? 'verify' : c.recommendation === 'negotiate' ? 'negotiating' : 'ready',updated_at:new Date().toISOString() })
  const next = new URL(location.href); next.searchParams.set('workflow', workflow.id); next.searchParams.set('opportunity', opportunity.id); next.searchParams.delete('view'); location.href = next.toString()
}

async function hydrate(auto = true) {
  if (!$('.scout-list')) return
  const rows = await loadRows(); rows.forEach(paint); renderSummary(rows); sortCards()
  if (!auto || S.busy) return
  const waiting = rows.filter(pending)
  if (!S.started && waiting.length) { S.started = true; await rateBatch(waiting.slice(0, batchSize(waiting)), 'preliminary') }
  else if (S.autoNext && waiting.length) { S.autoNext = false; await rateBatch(waiting.slice(0, batchSize(waiting)), 'preliminary') }
}

document.addEventListener('click', event => {
  const dismiss = event.target.closest?.('[data-dismiss-candidate]')
  if (dismiss) { event.preventDefault(); event.stopImmediatePropagation(); if (S.busy) return; const row = S.rows.get(String(dismiss.dataset.dismissCandidate)); if (row) deleteRows([row]).catch(e => toast(e.message)); return }
  const clearSkips = event.target.closest?.('#removeScoutSkips')
  if (clearSkips) { event.preventDefault(); event.stopImmediatePropagation(); if (S.busy) return; const rows = [...S.rows.values()].filter(c => rated(c) && (c.recommendation || c.analysis?.recommendation) === 'skip'); if (rows.length && confirm(`Remove ${rows.length} skipped listing${rows.length === 1 ? '' : 's'}?`)) deleteRows(rows).catch(e => toast(e.message)); return }
  const more = event.target.closest?.('#scanMoreResults')
  if (more && !S.busy) { const waiting = [...S.rows.values()].filter(pending); if (waiting.length) { event.preventDefault(); event.stopImmediatePropagation(); rateBatch(waiting.slice(0, batchSize(waiting)), 'preliminary').catch(e => toast(e.message)) } else S.autoNext = true; return }
  const deepButton = event.target.closest?.('#deepScanSelected')
  if (deepButton) { event.preventDefault(); event.stopImmediatePropagation(); if (!S.busy) deepSelected().catch(e => toast(e.message)); return }
  const start = event.target.closest?.('[data-curation-start]')
  if (start) { event.preventDefault(); event.stopImmediatePropagation(); const row = S.rows.get(String(start.dataset.curationStart)); if (row) { start.disabled = true; startFlip(row).catch(e => { start.disabled = false; toast(e.message) }) } }
}, true)

document.addEventListener('change', event => {
  const sort = event.target.closest?.('#scoutSortBy'); if (sort) { S.sort = sort.value || 'best'; sortCards(); return }
  const toggle = event.target.closest?.('#marketplaceBadgeToggle'); if (toggle) { S.badges = toggle.checked; syncMarketplaceBadges().catch(() => {}); return }
  const all = event.target.closest?.('#scoutSelectAll')
  if (all) { event.stopImmediatePropagation(); const ids = all.checked ? [...S.rows.values()].filter(c => rated(c) && !failed(c)).map(c => String(c.id)) : []; persistSelection(ids).catch(() => {}) }
}, true)

document.addEventListener('flippers:bulk-select', event => persistSelection(event.detail?.ids || []).catch(() => {}))
function ownMutation(m) { const target = m.target; return Boolean(target.closest?.('.scout-candidate,.scout-summary,.scout-insight,.scout-quality-mode,.scout-curation-controls,#smartScoutOverview')) }
new MutationObserver(mutations => { if (!mutations.some(m => !ownMutation(m))) return; clearTimeout(S.observerTimer); S.observerTimer = setTimeout(() => hydrate(true).catch(() => {}), 100) }).observe(document.getElementById('app'), { childList:true, subtree:true })
hydrate(true).catch(() => {})
