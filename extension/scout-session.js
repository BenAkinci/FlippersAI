import { api } from './api.js'
import { CONFIG, MARKETPLACE_LABELS } from './config.js'

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const pct = v => v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`

let bypassSingleScan = false
let scout = null
let deepBusy = false

function toast(message) {
  $('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}

function setBusy(on) {
  deepBusy = on
  document.body.classList.toggle('busy', on)
  $$('.scout-action, .scout-candidate input').forEach(el => { el.disabled = on })
}

function marketplaceLabel(platform) {
  return MARKETPLACE_LABELS[platform] || platform || 'Marketplace'
}

function recommendationLabel(value = '') {
  return ({ strong_buy:'Strong lead', buy:'Strong lead', negotiate:'Promising', verify_first:'Needs verification', skip:'Skip' })[value] || (value ? String(value).replaceAll('_',' ') : 'Not analysed')
}

function recommendationClass(value = '') {
  if (value === 'skip') return 'bad'
  if (value === 'strong_buy' || value === 'buy') return 'good'
  if (value === 'negotiate' || value === 'verify_first') return 'warn'
  return ''
}

function rankScore(analysis = {}) {
  const rec = analysis.recommendation
  const recBonus = rec === 'strong_buy' ? 22 : rec === 'buy' ? 18 : rec === 'negotiate' ? 10 : rec === 'verify_first' ? 3 : rec === 'skip' ? -25 : 0
  const score = Number(analysis.overall_score || 0)
  const profit = Number(analysis.expected_profit || 0)
  const roi = Number(analysis.expected_roi_percent || 0)
  return Math.round((score + recBonus + Math.max(-15, Math.min(20, profit / 10)) + Math.max(-8, Math.min(8, roi / 20))) * 10) / 10
}

function summaryCounts() {
  const analysed = scout?.candidates?.filter(c => c.scan_status === 'analysed') || []
  return {
    strong: analysed.filter(c => ['strong_buy','buy'].includes(c.recommendation)).length,
    promising: analysed.filter(c => ['negotiate','verify_first'].includes(c.recommendation)).length,
    rejected: analysed.filter(c => c.recommendation === 'skip').length,
    needs: analysed.filter(c => !c.recommendation).length
  }
}

function candidateMarkup(c, index) {
  const analysed = c.scan_status === 'analysed'
  const selected = c.selected !== false
  const a = c.analysis || {}
  const recommendation = c.recommendation || a.recommendation || ''
  return `<article class="scout-candidate ${analysed ? 'analysed' : ''}" data-candidate="${esc(c.id || c.localId)}">
    <label class="scout-select"><input type="checkbox" ${selected ? 'checked' : ''} data-select-candidate><span>${index + 1}</span></label>
    <div class="scout-thumb">${c.thumbnail_url ? `<img src="${esc(c.thumbnail_url)}" alt="">` : `<div class="scout-thumb-placeholder">${index + 1}</div>`}</div>
    <div class="scout-candidate-main">
      <div class="scout-candidate-title-row"><strong>${esc(c.title || 'Untitled listing')}</strong>${analysed ? `<span class="scout-rec ${recommendationClass(recommendation)}">${esc(recommendationLabel(recommendation))}</span>` : `<span class="scout-rec">Quick scan</span>`}</div>
      <div class="scout-meta">${money(c.asking_price)}${c.location ? ` · ${esc(c.location)}` : ''}${c.condition ? ` · ${esc(c.condition)}` : ''}</div>
      ${analysed ? `<div class="scout-metrics"><span>Resale <b>${money(a.resale_mid)}</b></span><span>Profit <b class="${Number(a.expected_profit || 0) >= 0 ? 'positive' : 'negative'}">${money(a.expected_profit)}</b></span><span>ROI <b>${pct(a.expected_roi_percent)}</b></span><span>Score <b>${Math.round(Number(a.overall_score || 0))}/100</b></span></div>` : `<div class="scout-quick-note">Visible listing details captured. Deep scan opens the listing privately in the background before analysis.</div>`}
    </div>
    <div class="scout-candidate-actions">
      ${analysed ? `<button class="button primary small scout-action" data-start-flip>Start flip</button><button class="button secondary small scout-action" data-open-candidate>Open</button>` : `<button class="button secondary small scout-action" data-open-candidate>Open</button>`}
    </div>
  </article>`
}

function renderScout() {
  if (!scout) return
  const main = $('.ext-main')
  if (!main) return
  const selectedCount = scout.candidates.filter(c => c.selected !== false).length
  const analysedCount = scout.candidates.filter(c => c.scan_status === 'analysed').length
  const counts = summaryCounts()
  const sorted = [...scout.candidates].sort((a,b) => {
    const ar = Number(a.rank_score ?? -999)
    const br = Number(b.rank_score ?? -999)
    if (a.scan_status === 'analysed' || b.scan_status === 'analysed') return br - ar
    return Number(a.order_index || 0) - Number(b.order_index || 0)
  })

  main.innerHTML = `<section class="page-head scout-page-head"><div><span class="eyebrow">SCOUT SESSION</span><h1>${esc(scout.query || `${scout.candidates.length} marketplace listings`)}</h1><p>${esc(marketplaceLabel(scout.platform))} · ${scout.candidates.length} listings captured without adding them to Deals.</p></div><button class="button soft small scout-action" id="scoutRescan">Start over</button></section>
    <section class="scout-summary">
      <div><span>FOUND</span><strong>${scout.candidates.length}</strong></div>
      <div><span>SELECTED</span><strong>${selectedCount}</strong></div>
      <div><span>ANALYSED</span><strong>${analysedCount}</strong></div>
      <div class="scout-summary-good"><span>STRONG</span><strong>${counts.strong}</strong></div>
    </section>
    ${analysedCount ? `<section class="scout-insight"><strong>${counts.strong} strong opportunit${counts.strong === 1 ? 'y' : 'ies'} · ${counts.promising} promising · ${counts.rejected} rejected</strong><span>Only listings you choose become permanent Deal Files.</span></section>` : `<section class="scout-insight"><strong>Quick scan complete</strong><span>Select the listings worth investigating, then let FlippersAI deep-scan and rank them.</span></section>`}
    <div class="scout-toolbar">
      <label class="scout-select-all"><input type="checkbox" id="scoutSelectAll" ${selectedCount === scout.candidates.length ? 'checked' : ''}><span>Select all</span></label>
      <span class="top-spacer"></span>
      <button class="button secondary small scout-action" id="scanMoreResults">Scan more results ↓</button>
    </div>
    <div class="scout-list">${sorted.map(candidateMarkup).join('')}</div>
    <div class="scout-sticky-actions">
      <button class="button primary scout-action" id="deepScanSelected">Deep scan ${selectedCount} selected</button>
      <button class="button secondary scout-action" id="openScoutWebsite" ${scout.session?.id ? '' : 'disabled'}>Open Scout on website</button>
    </div>
    <div class="scout-footnote">Captured from your current ${esc(marketplaceLabel(scout.platform))} page. Review the detected listings before turning any of them into a Deal File.</div>`

  bindScoutUi()
}

function findCandidate(el) {
  const id = el.closest('[data-candidate]')?.dataset.candidate
  return scout?.candidates.find(c => String(c.id || c.localId) === String(id)) || null
}

function bindScoutUi() {
  $('#scoutRescan')?.addEventListener('click', () => location.reload())
  $('#scoutSelectAll')?.addEventListener('change', async e => {
    scout.candidates.forEach(c => { c.selected = e.target.checked })
    await persistSelection()
    renderScout()
  })
  $$('[data-select-candidate]').forEach(input => input.addEventListener('change', async e => {
    const c = findCandidate(e.target)
    if (!c) return
    c.selected = e.target.checked
    if (c.id) await api.update('scout_candidates', `id=eq.${c.id}`, { selected:c.selected, updated_at:new Date().toISOString() }).catch(() => {})
    await updateSessionCounts().catch(() => {})
    renderScout()
  }))
  $$('[data-open-candidate]').forEach(button => button.addEventListener('click', async e => {
    const c = findCandidate(e.target)
    if (c?.source_url) await chrome.tabs.create({ url:c.source_url, active:true })
  }))
  $$('[data-start-flip]').forEach(button => button.addEventListener('click', async e => {
    const c = findCandidate(e.target)
    if (!c) return
    setBusy(true)
    try { await createDealFromCandidate(c, false) }
    catch (error) { toast(error.message) }
    finally { setBusy(false) }
  }))
  $('#scanMoreResults')?.addEventListener('click', scanMoreResults)
  $('#deepScanSelected')?.addEventListener('click', deepScanSelected)
  $('#openScoutWebsite')?.addEventListener('click', () => {
    if (!scout?.session?.id) return
    chrome.tabs.create({ url:`${CONFIG.websiteUrl}?scout=${encodeURIComponent(scout.session.id)}` })
  })
}

async function persistSelection() {
  await Promise.all(scout.candidates.filter(c => c.id).map(c => api.update('scout_candidates', `id=eq.${c.id}`, { selected:c.selected, updated_at:new Date().toISOString() }).catch(() => null)))
  await updateSessionCounts()
}

async function updateSessionCounts() {
  if (!scout?.session?.id) return
  const counts = summaryCounts()
  const selected = scout.candidates.filter(c => c.selected !== false).length
  await api.update('scout_sessions', `id=eq.${scout.session.id}`, {
    candidate_count:scout.candidates.length,
    selected_count:selected,
    strong_count:counts.strong,
    promising_count:counts.promising,
    status:scout.candidates.some(c => c.scan_status === 'analysed') ? 'ready' : 'draft',
    updated_at:new Date().toISOString()
  }).catch(() => {})
}

async function createSession(collection, activeScan) {
  const user = await api.getUser()
  if (!user?.id) throw new Error('Connect FlippersAI before starting a Scout Session.')
  const session = await api.insert('scout_sessions', {
    user_id:user.id,
    platform:collection.platform || activeScan.platform || 'other',
    source_url:collection.pageUrl || activeScan.pageUrl || activeScan.url || '',
    query_text:collection.query || '',
    status:'draft',
    candidate_count:collection.candidates.length,
    selected_count:collection.candidates.length,
    metadata:{ source:'chrome_extension', quick_scan:true, captured_at:collection.capturedAt || new Date().toISOString() }
  }, { single:true })
  if (!session?.id) throw new Error('Could not create the Scout Session.')

  const rows = collection.candidates.map((c, i) => ({
    session_id:session.id,
    user_id:user.id,
    source_url:c.url,
    listing_id:c.listingId || null,
    title:c.title || null,
    asking_price:c.askingPrice ?? null,
    currency:c.currency || 'AUD',
    location:c.location || null,
    condition:c.condition || null,
    seller_name:c.sellerName || null,
    thumbnail_url:c.thumbnailUrl || null,
    raw_capture:{ raw_text:c.rawText || '', quick_scan:true, order_index:i },
    scan_status:'quick',
    selected:true,
    rank_score:null
  }))
  const saved = rows.length ? await api.insert('scout_candidates', rows) : []
  return { session, candidates:(saved || []).map((row, i) => ({ ...row, order_index:i, analysis:row.analysis || {} })) }
}

async function startCollection(activeScan, collection) {
  setBusy(true)
  try {
    const created = await createSession(collection, activeScan)
    scout = {
      session:created.session,
      candidates:created.candidates,
      tabId:activeScan.tabId,
      platform:collection.platform,
      query:collection.query || '',
      pageUrl:collection.pageUrl || activeScan.pageUrl
    }
    renderScout()
  } catch (error) { toast(error.message) }
  finally { setBusy(false) }
}

async function mergeNewCandidates(collection) {
  const existingUrls = new Set(scout.candidates.map(c => c.source_url))
  const fresh = collection.candidates.filter(c => !existingUrls.has(c.url))
  if (!fresh.length) return 0
  const user = await api.getUser()
  const rows = fresh.map((c, i) => ({
    session_id:scout.session.id,
    user_id:user.id,
    source_url:c.url,
    listing_id:c.listingId || null,
    title:c.title || null,
    asking_price:c.askingPrice ?? null,
    currency:c.currency || 'AUD',
    location:c.location || null,
    condition:c.condition || null,
    seller_name:c.sellerName || null,
    thumbnail_url:c.thumbnailUrl || null,
    raw_capture:{ raw_text:c.rawText || '', quick_scan:true, order_index:scout.candidates.length + i },
    scan_status:'quick',
    selected:true
  }))
  const saved = await api.insert('scout_candidates', rows)
  scout.candidates.push(...(saved || []).map((row, i) => ({ ...row, order_index:scout.candidates.length + i, analysis:row.analysis || {} })))
  await updateSessionCounts()
  return fresh.length
}

async function scanMoreResults() {
  if (!scout?.tabId) return toast('Return to the marketplace results tab first.')
  setBusy(true)
  try {
    const result = await chrome.tabs.sendMessage(scout.tabId, { type:'FLIPPERS_SCROLL_RESULTS' })
    if (!result?.ok) throw new Error(result?.error || 'Could not scan more results.')
    const added = await mergeNewCandidates(result.data)
    renderScout()
    toast(added ? `${added} more listing${added === 1 ? '' : 's'} added` : 'No new visible listings yet — scroll a little further and try again.')
  } catch (error) { toast(error.message) }
  finally { setBusy(false) }
}

function waitForTab(tabId, timeout = 14000) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      error ? reject(error) : resolve()
    }
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish() }
    chrome.tabs.onUpdated.addListener(listener)
    const timer = setTimeout(() => finish(new Error('Timed out loading listing.')), timeout)
    chrome.tabs.get(tabId).then(tab => { if (tab.status === 'complete') finish() }).catch(() => {})
  })
}

async function sendWithRetry(tabId, message) {
  let last
  for (let i = 0; i < 5; i++) {
    try { return await chrome.tabs.sendMessage(tabId, message) }
    catch (error) { last = error; await new Promise(r => setTimeout(r, 280 + i * 180)) }
  }
  throw last || new Error('Could not read listing tab.')
}

async function deepCaptureCandidate(c) {
  const tab = await chrome.tabs.create({ url:c.source_url, active:false })
  try {
    await waitForTab(tab.id)
    await new Promise(r => setTimeout(r, 550))
    const result = await sendWithRetry(tab.id, { type:'FLIPPERS_SCAN_PAGE' })
    if (!result?.ok) throw new Error(result?.error || 'Could not read listing.')
    return result.data
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {})
  }
}

async function analyseCandidate(c, capture, context) {
  const profile = context.profile || {}
  const portfolio = context.portfolio || {}
  const listingText = capture?.listingText || capture?.visibleText || c.raw_capture?.raw_text || ''
  const price = capture?.askingPrice ?? c.asking_price ?? null
  const title = capture?.title || c.title || ''
  const data = await api.invoke('analyse-listing-v2', {
    listing_url:c.source_url,
    listing_text:listingText,
    platform_fields:{
      asking_price:price,
      currency:c.currency || 'AUD',
      asking_price_verified:price != null,
      asking_price_confidence:price != null ? .9 : 0,
      listing_title:title,
      listing_location:capture?.location || c.location || '',
      seller_name:capture?.sellerName || c.seller_name || ''
    },
    user_overrides:{ asking_price:price, currency:c.currency || 'AUD' },
    bankroll:Number(portfolio.available_cash || 0),
    risk_profile:profile.risk_profile || 'conservative',
    reserve_percent:Number(profile.capital_reserve_percent ?? 30),
    max_exposure_percent:Number(profile.max_single_item_exposure_percent ?? 20),
    portfolio_context:portfolio,
    images:[]
  })
  if (data?.error) throw new Error(data.error)
  return { engine_version:data.engine_version || 'flippers-alpha-4-price-lock', analysis:data.analysis || {} }
}

async function deepScanSelected() {
  if (deepBusy) return
  const selected = scout.candidates.filter(c => c.selected !== false)
  if (!selected.length) return toast('Select at least one listing.')
  if (selected.length > 20 && !confirm(`Deep-scan ${selected.length} listings? This can take a while.`)) return
  setBusy(true)
  try {
    const context = await api.workflowState()
    await api.update('scout_sessions', `id=eq.${scout.session.id}`, { status:'scanning', updated_at:new Date().toISOString() })
    for (let i = 0; i < selected.length; i++) {
      const c = selected[i]
      toast(`Deep scanning ${i + 1} of ${selected.length}…`)
      try {
        const capture = await deepCaptureCandidate(c)
        const result = await analyseCandidate(c, capture, context)
        const a = result.analysis
        c.title = capture.title || c.title
        c.asking_price = capture.askingPrice ?? c.asking_price
        c.location = capture.location || c.location
        c.condition = capture.condition || c.condition
        c.seller_name = capture.sellerName || c.seller_name
        c.thumbnail_url = capture.imageUrls?.[0] || c.thumbnail_url
        c.deep_capture = capture
        c.analysis = { ...a, engine_version:result.engine_version }
        c.scan_status = 'analysed'
        c.recommendation = a.recommendation || null
        c.score = a.overall_score ?? null
        c.resale_mid = a.resale_mid ?? null
        c.expected_profit = a.expected_profit ?? null
        c.expected_roi_percent = a.expected_roi_percent ?? null
        c.rank_score = rankScore(a)
        await api.update('scout_candidates', `id=eq.${c.id}`, {
          title:c.title || null,
          asking_price:c.asking_price ?? null,
          location:c.location || null,
          condition:c.condition || null,
          seller_name:c.seller_name || null,
          thumbnail_url:c.thumbnail_url || null,
          deep_capture:c.deep_capture || {},
          analysis:c.analysis,
          scan_status:'analysed',
          recommendation:c.recommendation,
          score:c.score,
          resale_mid:c.resale_mid,
          expected_profit:c.expected_profit,
          expected_roi_percent:c.expected_roi_percent,
          rank_score:c.rank_score,
          updated_at:new Date().toISOString()
        })
      } catch (error) {
        c.scan_status = 'failed'
        c.analysis = { error:error.message }
        await api.update('scout_candidates', `id=eq.${c.id}`, { scan_status:'failed', analysis:c.analysis, updated_at:new Date().toISOString() }).catch(() => {})
      }
    }
    await updateSessionCounts()
    renderScout()
    const counts = summaryCounts()
    toast(`Scout complete: ${counts.strong} strong, ${counts.promising} promising.`)
  } catch (error) { toast(error.message) }
  finally { setBusy(false) }
}

async function waitForWorkflow(opportunityId) {
  for (let i = 0; i < 15; i++) {
    const rows = await api.select('flip_workflows', `select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`)
    if (rows?.[0]) return rows[0]
    await new Promise(r => setTimeout(r, 180))
  }
  throw new Error('Deal File saved, but workflow did not initialise.')
}

async function saveCandidateAnalysis(opportunityId, c, userId) {
  const x = c.analysis || {}
  if (!x.recommendation) return null
  const rec = {
    opportunity_id:opportunityId,
    user_id:userId,
    engine_version:x.engine_version || 'flippers-alpha-4-price-lock',
    identified_name:x.identified_name || c.title || '',
    brand:x.brand || '', model:x.model || '', variant:x.variant || '', category:x.category || '',
    identification_confidence:x.identification_confidence ?? 0,
    resale_low:x.resale_low, resale_mid:x.resale_mid, resale_high:x.resale_high, quick_sale_value:x.quick_sale_value,
    sell_time_low_days:x.sell_time_low_days, sell_time_mid_days:x.sell_time_mid_days, sell_time_high_days:x.sell_time_high_days,
    valuation_confidence:x.valuation_confidence ?? 0, overall_score:x.overall_score ?? 0, overall_risk:x.overall_risk ?? 0,
    recommendation:x.recommendation, recommended_offer:x.recommended_offer, max_buy:x.max_buy,
    break_even_sale_price:x.break_even_sale_price, expected_selling_costs:x.expected_selling_costs,
    expected_profit:x.expected_profit, expected_roi_percent:x.expected_roi_percent, quick_sale_profit:x.quick_sale_profit,
    next_action:x.next_action, questions_to_ask:x.questions_to_ask || [], inspection_checks:x.inspection_checks || [],
    risks:x.risks || {}, assumptions:x.assumptions || [], evidence_summary:x.evidence_summary || '', raw_model_output:x,
    action_summary:x.action_summary || '', action_steps:x.action_steps || [], action_cautions:x.action_cautions || [],
    seller_message:x.seller_message || '', photo_findings:x.photo_findings || [], photo_count:0,
    user_overrides:{ asking_price:c.asking_price }, seller_confidence:x.seller_confidence ?? null,
    seller_confidence_label:x.seller_confidence_label ?? null, seller_confidence_reason:x.seller_confidence_reason ?? null,
    seller_signals:x.seller_signals || {}, overall_confidence:x.overall_confidence ?? null
  }
  return api.insert('analyses', rec, { single:true })
}

async function createDealFromCandidate(c, openWebsite) {
  const user = await api.getUser()
  const capture = c.deep_capture || {}
  const listingText = capture.listingText || capture.visibleText || c.raw_capture?.raw_text || ''
  const opportunity = await api.insert('opportunities', {
    user_id:user.id,
    source_platform:scout.platform || 'other',
    source_url:c.source_url,
    listing_title:c.title || null,
    listing_text:listingText,
    seller_asking_price:c.asking_price ?? null,
    listing_location:c.location || null,
    seller_name:c.seller_name || null,
    currency:c.currency || 'AUD',
    status:c.recommendation === 'skip' ? 'skipped' : 'watching',
    raw_listing:{
      browser_scan:true,
      source:'scout_session',
      scout_session_id:scout.session.id,
      scout_candidate_id:c.id,
      listing_id:c.listing_id || null,
      condition:c.condition || null,
      captured_at:new Date().toISOString(),
      canonical_url:c.source_url
    },
    updated_at:new Date().toISOString()
  }, { single:true })
  if (!opportunity?.id) throw new Error('Could not create Deal File.')

  let workflow = await waitForWorkflow(opportunity.id)
  if (workflow.current_step === 'capture_listing') {
    await api.rpc('advance_flip_step', { p_workflow_id:workflow.id, p_step_key:'capture_listing', p_step_data:{ captured:true, source:'scout_session', scout_candidate_id:c.id } })
    workflow = await waitForWorkflow(opportunity.id)
  }
  const rows = await api.select('flip_workflows', `select=*&id=eq.${workflow.id}&limit=1`)
  workflow = rows?.[0] || workflow
  if (workflow.current_step === 'verify_listing' && c.title && c.asking_price != null) {
    await api.update('opportunities', `id=eq.${opportunity.id}`, { user_overrides:{ asking_price:c.asking_price }, updated_at:new Date().toISOString() })
    await api.rpc('advance_flip_step', { p_workflow_id:workflow.id, p_step_key:'verify_listing', p_step_data:{ asking_price:c.asking_price, verified:true, source:'scout_session' } })
  }

  await saveCandidateAnalysis(opportunity.id, c, user.id)
  const wfRows = await api.select('flip_workflows', `select=*&id=eq.${workflow.id}&limit=1`)
  workflow = wfRows?.[0] || workflow
  if (workflow.current_step === 'analyse_deal' && c.recommendation !== 'skip') {
    await api.rpc('advance_flip_step', { p_workflow_id:workflow.id, p_step_key:'analyse_deal', p_step_data:{ analysed:true, source:'scout_session', scout_candidate_id:c.id } })
  }
  await api.update('opportunities', `id=eq.${opportunity.id}`, { status:c.recommendation === 'skip' ? 'skipped' : c.recommendation === 'verify_first' ? 'verify' : c.recommendation === 'negotiate' ? 'negotiating' : 'ready', updated_at:new Date().toISOString() })

  if (openWebsite) {
    await chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE', workflowId:workflow.id, opportunityId:opportunity.id })
    return
  }
  const next = new URL(location.href)
  next.searchParams.set('workflow', workflow.id)
  next.searchParams.set('opportunity', opportunity.id)
  next.searchParams.delete('view')
  location.href = next.toString()
}

async function detectCollection(button) {
  const original = button.onclick
  try {
    const active = await chrome.runtime.sendMessage({ type:'FLIPPERS_SCAN_ACTIVE_TAB' })
    if (!active?.ok) throw new Error(active?.error || 'Could not scan this page.')
    const tabId = active.data?.tabId
    if (!tabId) throw new Error('Could not identify the marketplace tab.')
    const collection = await chrome.tabs.sendMessage(tabId, { type:'FLIPPERS_SCAN_COLLECTION' })
    if (collection?.ok && collection.data?.mode === 'collection' && collection.data.candidates?.length >= 2) {
      await startCollection(active.data, collection.data)
      return
    }
    bypassSingleScan = true
    try { await original?.call(button) } finally { setTimeout(() => { bypassSingleScan = false }, 0) }
  } catch (error) {
    toast(error.message)
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('#scanCurrent')
  if (!button || bypassSingleScan) return
  event.preventDefault()
  event.stopImmediatePropagation()
  detectCollection(button)
}, true)
