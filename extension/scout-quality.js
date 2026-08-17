import { api } from './api.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money = v => v == null || v === '' || Number.isNaN(Number(v))
  ? '—'
  : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const pct = v => v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`

const R = {
  busy: false,
  started: false,
  next: false,
  ctxPromise: null,
  rows: new Map(),
  stats: { attempted:0, completed:0, failed:0, totalMs:0 },
  timer: null,
  progress: null,
  activeIds: new Set()
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
const failed = c => c?.scan_status === 'failed'
const pending = c => !rated(c) && !failed(c)
const deep = c => c?.scan_status === 'analysed'
const confidence = c => {
  const a = c?.analysis || {}
  return a.overall_confidence ?? a.valuation_confidence ?? a.identification_confidence ?? null
}
const recLabel = v => ({
  strong_buy:'Strong lead',
  buy:'Strong lead',
  negotiate:'Promising',
  verify_first:'Needs verification',
  skip:'Skip'
})[v] || (v ? String(v).replaceAll('_',' ') : 'Not rated')
const recClass = v => ['strong_buy','buy'].includes(v) ? 'good' : ['negotiate','verify_first'].includes(v) ? 'warn' : v === 'skip' ? 'bad' : ''
const category = c => c.category_label || c.raw_capture?.category_label || c.analysis?.category || 'Other'

function rankScore(a = {}) {
  const r = a.recommendation
  const bonus = r === 'strong_buy' ? 22 : r === 'buy' ? 18 : r === 'negotiate' ? 10 : r === 'verify_first' ? 3 : r === 'skip' ? -25 : 0
  const score = Number(a.overall_score || 0)
  const profit = Number(a.expected_profit || 0)
  const roi = Number(a.expected_roi_percent || 0)
  const conf = Number(a.overall_confidence ?? a.valuation_confidence ?? 0)
  return Math.round((score + bonus + Math.max(-15, Math.min(20, profit / 10)) + Math.max(-8, Math.min(8, roi / 20)) + Math.max(0, Math.min(6, conf / 20))) * 10) / 10
}

function complexity(c = {}) {
  let n = 0
  const k = category(c)
  const raw = String(c.raw_capture?.raw_text || '')
  if (['Watches','Sneakers','Collectibles','Fashion'].includes(k)) n += 2.2
  else if (['Phones','Audio','Gaming','Computers','Cameras'].includes(k)) n += 1
  if (!c.title || c.title.length < 6) n += 2
  if (c.asking_price == null) n += 1.6
  if (!c.location) n += .5
  if (raw.length < 40) n += 1.2
  if (/\b(bundle|lot|assorted|mixed|collection|replica|fake|damaged|faulty|parts|unknown|unverified)\b/i.test(`${c.title || ''} ${raw}`)) n += 1.8
  return n
}

/*
  Small, parallel batches are deliberate:
  - normal listings: 5 at once
  - moderately ambiguous: 4 at once
  - difficult/high-risk/incomplete: 3 at once
  This keeps first-pass results fast while protecting analysis quality.
*/
function batchSize(rows = []) {
  if (!rows.length) return 0
  const sample = rows.slice(0, 12)
  const avg = sample.reduce((sum, c) => sum + complexity(c), 0) / sample.length
  const missingPrice = sample.filter(c => c.asking_price == null).length / sample.length
  const mixedCategories = new Set(sample.map(category)).size
  const failureRate = R.stats.attempted ? R.stats.failed / R.stats.attempted : 0

  let n = 5
  if (avg >= 4 || missingPrice > .4 || failureRate > .15) n = 3
  else if (avg >= 2.5 || mixedCategories >= 4 || missingPrice > .2 || failureRate > .05) n = 4
  return Math.min(n, rows.length)
}

function imageLimit(c, capture = {}) {
  const k = category(c)
  if (['Watches','Sneakers','Collectibles','Fashion'].includes(k)) return 2
  if (!c.title || c.asking_price == null || (capture.listingText || '').length < 120) return 2
  if (['Phones','Audio','Gaming','Computers','Cameras'].includes(k)) return 1
  return 0
}

async function loadRecords() {
  const ids = $$('.scout-candidate[data-candidate]').map(x => x.dataset.candidate).filter(Boolean)
  if (!ids.length) return []
  const rows = await api.select('scout_candidates', `select=*&id=in.(${ids.join(',')})`).catch(() => [])
  R.rows = new Map((rows || []).map(x => [String(x.id), x]))
  return rows || []
}

const card = id => $(`.scout-candidate[data-candidate="${CSS.escape(String(id))}"]`)
const signature = c => [c.scan_status,c.recommendation,c.score,c.resale_mid,c.expected_profit,c.expected_roi_percent,c.rank_score,confidence(c)].join('|')

function setHTML(el, html) {
  if (el && el.innerHTML !== html) el.innerHTML = html
}

function resetCard(c) {
  const el = card(c.id)
  if (!el) return
  delete el.dataset.qualitySig
  delete el.dataset.qualityActive
}

function paint(c) {
  const el = card(c.id)
  if (!el) return

  const id = String(c.id)
  const active = R.activeIds.has(id)
  const queued = pending(c) && !active
  const sig = signature(c)

  el.classList.toggle('quality-queued', queued)
  el.classList.toggle('quality-active', active)
  el.classList.toggle('quality-rated', rated(c))
  el.classList.toggle('quality-deep', deep(c))
  el.classList.toggle('quality-failed', failed(c))
  el.dataset.qualityRank = String(c.rank_score ?? -999)

  const activeSig = active ? '1' : '0'
  if (el.dataset.qualitySig === sig && el.dataset.qualityActive === activeSig) return
  el.dataset.qualitySig = sig
  el.dataset.qualityActive = activeSig

  const input = $('[data-select-candidate]', el)
  if (input) {
    if (!rated(c)) {
      input.checked = false
      input.disabled = true
    } else {
      input.disabled = R.busy
      input.checked = Boolean(c.selected)
    }
  }

  const titleRow = $('.scout-candidate-title-row', el)
  const pill = $('.scout-rec', titleRow)
  const quick = $('.scout-quick-note', el)
  const oldMetrics = $('.scout-metrics', el)
  const oldDepth = $('.scout-depth-label', el)
  const actions = $('.scout-candidate-actions', el)

  if (failed(c)) {
    if (pill) {
      pill.className = 'scout-rec bad'
      pill.textContent = 'Could not rate'
    }
    if (quick) quick.textContent = c.analysis?.error || 'This listing could not be rated. You can retry it with the next batch.'
    oldMetrics?.remove()
    oldDepth?.remove()
    return
  }

  if (!rated(c)) {
    if (pill) {
      pill.className = 'scout-rec quality-wait'
      pill.textContent = active ? 'Rating batch…' : 'Queued'
    }
    if (quick) {
      quick.textContent = active
        ? `Analysing this listing in parallel with the rest of the current ${R.activeIds.size}-listing batch.`
        : 'Waiting for the next small rating batch.'
    }
    oldMetrics?.remove()
    oldDepth?.remove()
    actions?.querySelector('[data-quality-start]')?.remove()
    return
  }

  const a = c.analysis || {}
  const rv = c.recommendation || a.recommendation || ''
  if (pill) {
    pill.className = `scout-rec ${recClass(rv)}`
    pill.textContent = recLabel(rv)
  }
  quick?.remove()

  const depth = document.createElement('div')
  depth.className = 'scout-depth-label'
  depth.textContent = deep(c) ? 'DEEP SCAN' : 'PRELIMINARY RATING'
  oldDepth?.replaceWith(depth) || $('.scout-meta', el)?.insertAdjacentElement('afterend', depth)

  const cf = confidence(c)
  const metrics = document.createElement('div')
  metrics.className = 'scout-metrics'
  metrics.innerHTML = `
    <span class="score-metric">Score <b>${Math.round(Number(a.overall_score ?? c.score ?? 0))}/100</b></span>
    <span>Est. profit <b class="${Number(a.expected_profit ?? c.expected_profit ?? 0) >= 0 ? 'positive' : 'negative'}">${money(a.expected_profit ?? c.expected_profit)}</b></span>
    <span>Est. resale <b>${money(a.resale_mid ?? c.resale_mid)}</b></span>
    <span>ROI <b>${pct(a.expected_roi_percent ?? c.expected_roi_percent)}</b></span>
    ${cf == null ? '' : `<span>Confidence <b>${pct(cf)}</b></span>`}
  `
  oldMetrics?.replaceWith(metrics) || depth.insertAdjacentElement('afterend', metrics)

  if (deep(c) && rv !== 'skip' && actions && !actions.querySelector('[data-quality-start]')) {
    const b = document.createElement('button')
    b.className = 'button primary small scout-action'
    b.dataset.qualityStart = c.id
    b.textContent = 'Start flip'
    actions.prepend(b)
  }
}

function sortCards() {
  const list = $('.scout-list')
  if (!list) return
  const cards = $$('.scout-candidate', list)
  const visible = cards.filter(el => !el.classList.contains('quality-queued'))
  const queued = cards.filter(el => el.classList.contains('quality-queued'))
  visible.sort((a,b) => Number(b.dataset.qualityRank ?? -999) - Number(a.dataset.qualityRank ?? -999))
  ;[...visible, ...queued].forEach(el => list.appendChild(el))
}

function summary(rows) {
  const allRatedRows = rows.filter(rated)
  const ratedRows = R.progress
    ? allRatedRows.filter(c => !R.activeIds.has(String(c.id)))
    : allRatedRows
  const pendingRows = rows.filter(c => pending(c) && !R.activeIds.has(String(c.id)))
  const failedRows = rows.filter(failed)
  const strong = ratedRows.filter(c => ['strong_buy','buy'].includes(c.recommendation || c.analysis?.recommendation)).length
  const promising = ratedRows.filter(c => ['negotiate','verify_first'].includes(c.recommendation || c.analysis?.recommendation)).length
  const rejected = ratedRows.filter(c => (c.recommendation || c.analysis?.recommendation) === 'skip').length
  const nextN = batchSize(pendingRows)

  const summaryBox = $('.scout-summary')
  if (summaryBox) {
    const cells = [...summaryBox.children]
    if (cells[0]) setHTML(cells[0], `<span>FOUND</span><strong>${rows.length}</strong>`)
    if (cells[1]) setHTML(cells[1], `<span>RATED</span><strong>${ratedRows.length}</strong>`)
    if (cells[2]) setHTML(cells[2], `<span>QUEUED</span><strong>${pendingRows.length}</strong>`)
    if (cells[3]) setHTML(cells[3], `<span>STRONG</span><strong>${strong}</strong>`)
  }

  const insight = $('.scout-insight')
  if (insight) {
    let html = ''
    if (R.progress) {
      const done = R.progress.done || 0
      html = `<strong>${R.progress.mode === 'deep' ? 'Deep scanning' : 'Rating'} ${R.progress.total} listings together…</strong><span>${done}/${R.progress.total} finished in the background · results appear together when the batch is complete.</span>`
    } else if (ratedRows.length) {
      html = `<strong>${strong} strong · ${promising} promising · ${rejected} skip</strong><span>${pendingRows.length ? `${pendingRows.length} more found · next batch ${nextN}` : 'Choose the best rated listings for a deeper scan.'}${failedRows.length ? ` · ${failedRows.length} failed` : ''}</span>`
    }
    if (html) setHTML(insight, html)
    insight.classList.toggle('scanning', Boolean(R.progress))
  }

  const more = $('#scanMoreResults')
  if (more && !R.busy) {
    more.textContent = pendingRows.length ? `Scan next ${nextN} results ↓` : 'Scan more results ↓'
  }

  const selectAll = $('#scoutSelectAll')
  if (selectAll) {
    selectAll.checked = false
    selectAll.disabled = R.busy || ratedRows.length === 0
    const label = selectAll.closest('.scout-select-all')?.querySelector('span')
    if (label) label.textContent = 'Select rated'
  }

  const checked = $$('.scout-candidate:not(.quality-queued) [data-select-candidate]:checked')
    .map(x => x.closest('.scout-candidate')?.dataset.candidate)
    .filter(Boolean)
  const eligible = checked.filter(id => rated(R.rows.get(String(id))) && !deep(R.rows.get(String(id)))).length
  const deepButton = $('#deepScanSelected')
  if (deepButton) {
    deepButton.disabled = R.busy || !eligible
    deepButton.textContent = `Deep scan ${eligible} selected`
  }

  let quality = $('.scout-quality-mode')
  if (!quality && summaryBox) {
    quality = document.createElement('section')
    quality.className = 'scout-quality-mode'
    summaryBox.insertAdjacentElement('beforebegin', quality)
  }
  if (quality) {
    setHTML(quality, `
      <div>
        <span>BATCH SCOUT</span>
        <strong>Small batches · rated together</strong>
      </div>
      <small>FlippersAI rates up to 5 listings in parallel, reveals the batch together, then waits for you to scan the next group.</small>
    `)
  }
}

async function hydrate() {
  if (!$('.scout-list')) return
  const rows = await loadRecords()
  rows.forEach(paint)
  sortCards()
  summary(rows)

  const waiting = rows.filter(pending)
  if (!R.started && waiting.length && !R.busy) {
    R.started = true
    const n = batchSize(waiting)
    rateBatch(waiting.slice(0, n), 'preliminary').catch(e => toast(e.message))
  } else if (R.next && waiting.length && !R.busy) {
    R.next = false
    const n = batchSize(waiting)
    rateBatch(waiting.slice(0, n), 'preliminary').catch(e => toast(e.message))
  }
}

function waitTab(id, timeout = 16000) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = error => {
      if (done) return
      done = true
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      error ? reject(error) : resolve()
    }
    const listener = (tabId, info) => {
      if (tabId === id && info.status === 'complete') finish()
    }
    chrome.tabs.onUpdated.addListener(listener)
    const timer = setTimeout(() => finish(new Error('Timed out loading listing.')), timeout)
    chrome.tabs.get(id).then(tab => {
      if (tab.status === 'complete') finish()
    }).catch(() => {})
  })
}

async function send(id, msg) {
  let last
  for (let i = 0; i < 5; i++) {
    try { return await chrome.tabs.sendMessage(id, msg) }
    catch (e) {
      last = e
      await new Promise(r => setTimeout(r, 300 + i * 180))
    }
  }
  throw last || new Error('Could not read listing tab.')
}

async function capture(c) {
  const tab = await chrome.tabs.create({ url:c.source_url, active:false })
  try {
    await waitTab(tab.id)
    await new Promise(r => setTimeout(r, 650))
    const result = await send(tab.id, { type:'FLIPPERS_SCAN_PAGE' })
    if (!result?.ok) throw new Error(result?.error || 'Could not read listing.')
    return result.data
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {})
  }
}

function dataUrl(buffer, mime = 'image/jpeg') {
  const bytes = new Uint8Array(buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 32768) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + 32768, bytes.length)))
  }
  return `data:${mime};base64,${btoa(s)}`
}

async function image(url) {
  try {
    const response = await fetch(url, { credentials:'include', cache:'force-cache' })
    if (!response.ok) return null
    const type = response.headers.get('content-type') || ''
    if (!type.startsWith('image/')) return null
    const blob = await response.blob()
    if (blob.size > 4_500_000) return null
    return dataUrl(await blob.arrayBuffer(), type)
  } catch {
    return null
  }
}

async function images(captureData, limit) {
  const out = []
  const seen = new Set()
  for (const url of captureData?.imageUrls || []) {
    if (out.length >= limit) break
    if (!/^https?:/i.test(String(url || '')) || seen.has(url)) continue
    seen.add(url)
    const d = await image(url)
    if (d) out.push(d)
  }
  return out
}

async function context() {
  if (!R.ctxPromise) R.ctxPromise = api.workflowState()
  return R.ctxPromise
}

async function analyse(c, captureData, imgs, mode) {
  const C = await context()
  const profile = C.profile || {}
  const portfolio = C.portfolio || {}
  const listingText = captureData?.listingText || captureData?.visibleText || c.raw_capture?.raw_text || ''
  const price = captureData?.askingPrice ?? c.asking_price ?? null
  const title = captureData?.title || c.title || ''

  const data = await api.invoke('analyse-listing-v2', {
    listing_url:c.source_url,
    listing_text:listingText,
    platform_fields:{
      asking_price:price,
      currency:c.currency || 'AUD',
      asking_price_verified:price != null,
      asking_price_confidence:price != null ? .9 : 0,
      listing_title:title,
      listing_location:captureData?.location || c.location || '',
      seller_name:captureData?.sellerName || c.seller_name || ''
    },
    user_overrides:{ asking_price:price, currency:c.currency || 'AUD' },
    bankroll:Number(portfolio.available_cash || 0),
    risk_profile:profile.risk_profile || 'conservative',
    reserve_percent:Number(profile.capital_reserve_percent ?? 30),
    max_exposure_percent:Number(profile.max_single_item_exposure_percent ?? 20),
    portfolio_context:portfolio,
    images:imgs,
    scan_context:{
      mode,
      instruction:mode === 'deep'
        ? 'Deep Scout scan. Use full listing detail and all available visual evidence. Resolve model, condition, authenticity, inclusions and resale uncertainty as far as the evidence supports.'
        : 'Preliminary Scout rating. Produce a useful shortlist rating now from the full listing and market evidence, while staying conservative about anything that still requires deeper visual verification.'
    }
  })

  if (data?.error) throw new Error(data.error)
  return { engine_version:data.engine_version || 'flippers-alpha-4-price-lock', analysis:data.analysis || {} }
}

async function save(c, captureData, result, status) {
  const a = result.analysis || {}
  const body = {
    title:captureData?.title || c.title || null,
    asking_price:captureData?.askingPrice ?? c.asking_price ?? null,
    location:captureData?.location || c.location || null,
    condition:captureData?.condition || c.condition || null,
    seller_name:captureData?.sellerName || c.seller_name || null,
    thumbnail_url:captureData?.imageUrls?.[0] || c.thumbnail_url || null,
    deep_capture:captureData || {},
    analysis:{ ...a, engine_version:result.engine_version, scout_scan_depth:status === 'analysed' ? 'deep' : 'preliminary' },
    scan_status:status,
    recommendation:a.recommendation || null,
    score:a.overall_score ?? null,
    resale_mid:a.resale_mid ?? null,
    expected_profit:a.expected_profit ?? null,
    expected_roi_percent:a.expected_roi_percent ?? null,
    rank_score:rankScore(a),
    selected: status === 'rated' ? false : Boolean(c.selected),
    updated_at:new Date().toISOString()
  }
  await api.update('scout_candidates', `id=eq.${c.id}`, body)
  Object.assign(c, body)
  R.rows.set(String(c.id), c)
}

async function processOne(c, mode) {
  const start = Date.now()
  R.stats.attempted++
  try {
    const captureData = await capture(c)
    const limit = mode === 'deep' ? 6 : imageLimit(c, captureData)
    const imgs = await images(captureData, limit)
    const result = await analyse(c, captureData, imgs, mode)
    await save(c, captureData, result, mode === 'deep' ? 'analysed' : 'rated')
    R.stats.completed++
    R.stats.totalMs += Date.now() - start
    return { ok:true, c }
  } catch (error) {
    R.stats.failed++
    if (mode === 'deep' && rated(c)) {
      const a = { ...(c.analysis || {}), deep_scan_error:error.message }
      await api.update('scout_candidates', `id=eq.${c.id}`, { analysis:a, updated_at:new Date().toISOString() }).catch(() => {})
      c.analysis = a
    } else {
      const a = { error:error.message, scout_scan_depth:mode }
      await api.update('scout_candidates', `id=eq.${c.id}`, { scan_status:'failed', selected:false, analysis:a, updated_at:new Date().toISOString() }).catch(() => {})
      c.scan_status = 'failed'
      c.selected = false
      c.analysis = a
    }
    R.rows.set(String(c.id), c)
    return { ok:false, c, error }
  } finally {
    if (R.progress) {
      R.progress.done++
      summary([...R.rows.values()])
    }
  }
}

async function rateBatch(rows, mode) {
  if (R.busy || !rows.length) return
  R.busy = true
  R.activeIds = new Set(rows.map(c => String(c.id)))
  R.progress = { mode, total:rows.length, done:0 }

  document.body.classList.add('quality-scanning')
  rows.forEach(c => {
    resetCard(c)
    paint(c)
  })
  summary([...R.rows.values()])
  toast(`${mode === 'deep' ? 'Deep scanning' : 'Rating'} ${rows.length} listings together…`)

  try {
    await Promise.allSettled(rows.map(c => processOne(c, mode)))
  } finally {
    R.progress = null
    R.activeIds.clear()
    R.busy = false
    document.body.classList.remove('quality-scanning')
    rows.forEach(resetCard)
    await hydrate()

    const ratedRows = [...R.rows.values()].filter(rated)
    const strong = ratedRows.filter(c => ['strong_buy','buy'].includes(c.recommendation || c.analysis?.recommendation)).length
    toast(`${mode === 'deep' ? 'Deep scan' : 'Batch ratings'} ready · ${strong} strong lead${strong === 1 ? '' : 's'}`)
  }
}

async function deepSelected() {
  const ids = $$('.scout-candidate:not(.quality-queued) [data-select-candidate]:checked')
    .map(x => x.closest('.scout-candidate')?.dataset.candidate)
    .filter(Boolean)
  if (!ids.length) return toast('Select at least one rated listing first.')

  await loadRecords()
  const rows = ids.map(id => R.rows.get(String(id))).filter(Boolean).filter(c => rated(c) && !deep(c))
  if (!rows.length) return toast('Those listings are already deep-scanned.')

  for (let i = 0; i < rows.length; i += 3) {
    await rateBatch(rows.slice(i, i + 3), 'deep')
  }
}

async function bulk(ids) {
  const set = new Set(ids.map(String))
  const rows = [...R.rows.values()]
  await Promise.all(rows.map(c => {
    const selectable = rated(c) && !failed(c)
    const on = selectable && set.has(String(c.id))
    const input = $(`[data-candidate="${CSS.escape(String(c.id))}"] [data-select-candidate]`)
    if (input) input.checked = on
    c.selected = on
    return api.update('scout_candidates', `id=eq.${c.id}`, { selected:on, updated_at:new Date().toISOString() }).catch(() => null)
  }))
  summary(rows)
}

const platform = url => {
  let host = ''
  try { host = new URL(url).hostname } catch {}
  return host.includes('facebook.com') ? 'facebook'
    : host.includes('ebay.com.au') ? 'ebay'
    : host.includes('gumtree.com.au') ? 'gumtree'
    : host.includes('depop.com') ? 'depop'
    : 'other'
}

async function workflow(opportunityId) {
  for (let i = 0; i < 15; i++) {
    const rows = await api.select('flip_workflows', `select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`)
    if (rows?.[0]) return rows[0]
    await new Promise(r => setTimeout(r, 180))
  }
  throw new Error('Deal File saved, but workflow did not initialise.')
}

async function saveAnalysis(opportunityId, c, userId) {
  const x = c.analysis || {}
  if (!x.recommendation) return null
  return api.insert('analyses', {
    opportunity_id:opportunityId,
    user_id:userId,
    engine_version:x.engine_version || 'flippers-alpha-4-price-lock',
    identified_name:x.identified_name || c.title || '',
    brand:x.brand || '',
    model:x.model || '',
    variant:x.variant || '',
    category:x.category || '',
    identification_confidence:x.identification_confidence ?? 0,
    resale_low:x.resale_low,
    resale_mid:x.resale_mid,
    resale_high:x.resale_high,
    quick_sale_value:x.quick_sale_value,
    sell_time_low_days:x.sell_time_low_days,
    sell_time_mid_days:x.sell_time_mid_days,
    sell_time_high_days:x.sell_time_high_days,
    valuation_confidence:x.valuation_confidence ?? 0,
    overall_score:x.overall_score ?? 0,
    overall_risk:x.overall_risk ?? 0,
    recommendation:x.recommendation,
    recommended_offer:x.recommended_offer,
    max_buy:x.max_buy,
    break_even_sale_price:x.break_even_sale_price,
    expected_selling_costs:x.expected_selling_costs,
    expected_profit:x.expected_profit,
    expected_roi_percent:x.expected_roi_percent,
    quick_sale_profit:x.quick_sale_profit,
    next_action:x.next_action,
    questions_to_ask:x.questions_to_ask || [],
    inspection_checks:x.inspection_checks || [],
    risks:x.risks || {},
    assumptions:x.assumptions || [],
    evidence_summary:x.evidence_summary || '',
    raw_model_output:x,
    action_summary:x.action_summary || '',
    action_steps:x.action_steps || [],
    action_cautions:x.action_cautions || [],
    seller_message:x.seller_message || '',
    photo_findings:x.photo_findings || [],
    photo_count:0,
    user_overrides:{ asking_price:c.asking_price },
    seller_confidence:x.seller_confidence ?? null,
    seller_confidence_label:x.seller_confidence_label ?? null,
    seller_confidence_reason:x.seller_confidence_reason ?? null,
    seller_signals:x.seller_signals || {},
    overall_confidence:x.overall_confidence ?? null
  }, { single:true })
}

async function start(c) {
  if (!deep(c)) return toast('Deep scan this listing before starting the flip.')
  const user = await api.getUser()
  const x = c.deep_capture || {}
  const opportunity = await api.insert('opportunities', {
    user_id:user.id,
    source_platform:platform(c.source_url),
    source_url:c.source_url,
    listing_title:c.title || null,
    listing_text:x.listingText || x.visibleText || c.raw_capture?.raw_text || '',
    seller_asking_price:c.asking_price ?? null,
    listing_location:c.location || null,
    seller_name:c.seller_name || null,
    currency:c.currency || 'AUD',
    status:c.recommendation === 'skip' ? 'skipped' : 'watching',
    raw_listing:{
      browser_scan:true,
      source:'scout_session',
      scout_session_id:c.session_id,
      scout_candidate_id:c.id,
      listing_id:c.listing_id || null,
      condition:c.condition || null,
      scout_scan_depth:'deep',
      captured_at:new Date().toISOString(),
      canonical_url:c.source_url
    },
    updated_at:new Date().toISOString()
  }, { single:true })

  if (!opportunity?.id) throw new Error('Could not create Deal File.')

  let w = await workflow(opportunity.id)
  if (w.current_step === 'capture_listing') {
    await api.rpc('advance_flip_step', {
      p_workflow_id:w.id,
      p_step_key:'capture_listing',
      p_step_data:{ captured:true, source:'scout_session', scout_candidate_id:c.id }
    })
    w = await workflow(opportunity.id)
  }

  w = (await api.select('flip_workflows', `select=*&id=eq.${w.id}&limit=1`))?.[0] || w
  if (w.current_step === 'verify_listing' && c.title && c.asking_price != null) {
    await api.update('opportunities', `id=eq.${opportunity.id}`, {
      user_overrides:{ asking_price:c.asking_price },
      updated_at:new Date().toISOString()
    })
    await api.rpc('advance_flip_step', {
      p_workflow_id:w.id,
      p_step_key:'verify_listing',
      p_step_data:{ asking_price:c.asking_price, verified:true, source:'scout_session' }
    })
  }

  await saveAnalysis(opportunity.id, c, user.id)
  w = (await api.select('flip_workflows', `select=*&id=eq.${w.id}&limit=1`))?.[0] || w

  if (w.current_step === 'analyse_deal' && c.recommendation !== 'skip') {
    await api.rpc('advance_flip_step', {
      p_workflow_id:w.id,
      p_step_key:'analyse_deal',
      p_step_data:{ analysed:true, source:'scout_session', scout_candidate_id:c.id }
    })
  }

  await api.update('opportunities', `id=eq.${opportunity.id}`, {
    status:c.recommendation === 'skip' ? 'skipped'
      : c.recommendation === 'verify_first' ? 'verify'
      : c.recommendation === 'negotiate' ? 'negotiating'
      : 'ready',
    updated_at:new Date().toISOString()
  })

  const next = new URL(location.href)
  next.searchParams.set('workflow', w.id)
  next.searchParams.set('opportunity', opportunity.id)
  next.searchParams.delete('view')
  location.href = next.toString()
}

document.addEventListener('click', event => {
  const deepButton = event.target.closest?.('#deepScanSelected')
  if (deepButton) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!R.busy) deepSelected().catch(e => toast(e.message))
    return
  }

  const more = event.target.closest?.('#scanMoreResults')
  if (more && !R.busy) {
    const waiting = [...R.rows.values()].filter(pending)
    if (waiting.length) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const n = batchSize(waiting)
      rateBatch(waiting.slice(0, n), 'preliminary').catch(e => toast(e.message))
    } else {
      R.next = true
    }
    return
  }

  const startButton = event.target.closest?.('[data-quality-start]')
  if (startButton) {
    event.preventDefault()
    event.stopImmediatePropagation()
    const c = R.rows.get(String(startButton.dataset.qualityStart))
    if (c) {
      startButton.disabled = true
      start(c).catch(e => {
        startButton.disabled = false
        toast(e.message)
      })
    }
  }
}, true)

document.addEventListener('change', event => {
  const selectAll = event.target.closest?.('#scoutSelectAll')
  if (!selectAll) return
  event.stopImmediatePropagation()
  const ids = selectAll.checked
    ? $$('.scout-candidate:not(.quality-queued):not(.quality-failed)').map(el => el.dataset.candidate).filter(id => rated(R.rows.get(String(id))))
    : []
  bulk(ids).catch(() => {})
}, true)

document.addEventListener('flippers:bulk-select', event => bulk(event.detail?.ids || []).catch(() => {}))

function ownMutation(m) {
  const t = m.target
  if (t.closest?.('.scout-candidate,.scout-summary,.scout-insight,.scout-quality-mode,#smartScoutOverview')) return true
  if (t.classList?.contains('scout-list')) {
    const nodes = [...m.addedNodes, ...m.removedNodes].filter(n => n.nodeType === 1)
    return nodes.length && nodes.every(n => n.matches?.('.scout-candidate'))
  }
  return false
}

new MutationObserver(mutations => {
  if (!mutations.some(m => !ownMutation(m))) return
  clearTimeout(R.timer)
  R.timer = setTimeout(() => hydrate().catch(() => {}), 90)
}).observe(document.getElementById('app'), { childList:true, subtree:true })

hydrate().catch(() => {})
