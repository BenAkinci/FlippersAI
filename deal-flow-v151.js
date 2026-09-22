// v0.151: Deal panel (Verify → Negotiate → I bought it) for Pipeline items, and the Stock page.
// Canonical records only: opportunities (status = stage, raw_listing.deal = negotiation/reply log),
// analyses (every re-check is a new row, so the audit trail is the analysis history),
// inventory_items / sale_listings / sales / transactions via the existing database functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const n = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
const money = v => n(v) === null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n(v))
const arr = v => Array.isArray(v) ? v : []
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const round5 = v => Math.round(v / 5) * 5
const floor5 = v => Math.floor(v / 5) * 5
const today = () => new Date().toISOString().slice(0, 10)
const daysSince = d => d ? Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 86400000)) : null
const app = () => window.flippersApp
const state = () => app()?.state || {}

function toast(text) {
  $('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done) } catch { toast('Could not copy — select the text and copy it manually.') }
}
async function user() {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) throw new Error('Sign in again to continue.')
  return data.user
}

// ---------------------------------------------------------------- styles
function styles() {
  if ($('#dealFlowV151Styles')) return
  const s = document.createElement('style')
  s.id = 'dealFlowV151Styles'
  s.textContent = `
  .dp-backdrop{position:fixed;inset:0;background:rgba(15,20,25,.32);z-index:90;animation:dpFade .15s ease}
  .dp{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:var(--bg,#fff);z-index:91;display:flex;flex-direction:column;box-shadow:-18px 0 50px rgba(15,20,25,.16);animation:dpIn .18s ease}
  @keyframes dpIn{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}
  @keyframes dpFade{from{opacity:0}to{opacity:1}}
  .dp-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--line)}
  .dp-top h2{margin:2px 0 0;font-size:19px;line-height:1.25;letter-spacing:-.01em}
  .dp-top .sv-row-sub{margin-top:6px}
  .dp-close{border:1px solid var(--line);background:var(--bg);border-radius:10px;width:34px;height:34px;flex:0 0 34px;font-size:20px;line-height:1;cursor:pointer;color:var(--ink)}
  .dp-body{flex:1;overflow-y:auto;padding:18px 20px 28px;display:flex;flex-direction:column;gap:18px;overscroll-behavior:contain}
  .dp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .dp-metric{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
  .dp-metric small{display:block;color:var(--muted);font-size:11.5px}
  .dp-metric b{display:block;font-size:17px;margin-top:2px}
  .dp-metric b.pos{color:var(--green)} .dp-metric b.neg{color:var(--red)}
  .dp-steps{display:flex;gap:6px;flex-wrap:wrap}
  .dp-step{border:1px solid var(--line);background:var(--bg);border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;font-weight:650;cursor:pointer;color:var(--muted)}
  .dp-step.active{background:var(--ink);border-color:var(--ink);color:#fff}
  .dp-step.done{color:var(--green);border-color:var(--green-soft,#d8f0e0)}
  .dp-card{border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px}
  .dp-card h3{margin:0;font-size:15.5px}
  .dp-card p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
  .dp-card label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650;color:var(--ink)}
  .dp-card textarea{min-height:92px;font:inherit;font-size:14px;line-height:1.45;padding:10px 12px;border:1px solid var(--line);border-radius:10px;resize:vertical}
  .dp-card input[type=number],.dp-card input[type=text],.dp-card input[type=url],.dp-card input[type=date],.dp-card select{font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--bg);min-width:0;width:100%}
  .dp-card input[type=file]{font-size:13px}
  .dp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .dp-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
  .dp-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .dp-actions .button{padding:9px 15px;min-height:0;font-size:13.5px}
  .dp-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  .dp-list li{display:flex;gap:10px;font-size:14px;line-height:1.45}
  .dp-list li:before{content:"";flex:0 0 6px;height:6px;border-radius:50%;background:#e28100;margin-top:8px}
  .dp-env{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .dp-env div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
  .dp-env div.hard{border-color:#f0c9a0;background:#fff8ef}
  .dp-env small{display:block;color:var(--muted);font-size:11.5px;font-weight:650;text-transform:uppercase;letter-spacing:.03em}
  .dp-env b{display:block;font-size:19px;margin-top:3px}
  .dp-env span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
  .dp-verdict{border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.45}
  .dp-verdict strong{font-size:15px}
  .dp-verdict.accept{background:var(--green-soft,#e9f7ee);color:#135c33}
  .dp-verdict.counter,.dp-verdict.hold{background:var(--amber-soft,#fff4df);color:#7a4a00}
  .dp-verdict.walk{background:var(--red-soft,#fdecec);color:#8a1f1f}
  .dp-verdict.info{background:var(--soft,#f4f6f8);color:var(--ink)}
  .dp-history{display:flex;flex-direction:column;gap:6px}
  .dp-history div{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:6px}
  .dp-history div:first-child{border-top:0;padding-top:0}
  .dp-history b{color:var(--ink);font-weight:650}
  .dp-history div>span:last-child{white-space:nowrap;flex:0 0 auto}
  .dp-note{font-size:12.5px;color:var(--muted)}
  .dp-checks{display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.45}
  .dp-busy{opacity:.55;pointer-events:none}
  .st-row-money{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
  .st-row-money b{color:var(--ink);font-weight:650}
  .st-row-money b.pos{color:var(--green)} .st-row-money b.neg{color:var(--red)}
  body.dp-open{overflow:hidden}
  @media (max-width:560px){
    .dp{width:100%;top:auto;height:92vh;border-radius:18px 18px 0 0;box-shadow:0 -12px 40px rgba(15,20,25,.2)}
    .dp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
    .dp-env{grid-template-columns:1fr}
    .dp-grid,.dp-grid.three{grid-template-columns:1fr}
    .dp-top{padding:16px 16px 12px}.dp-body{padding:16px 16px 28px}
  }`
  document.head.appendChild(s)
}

// ---------------------------------------------------------------- drawer shell
let current = null // { kind, id, render }
let dirty = false   // data changed while the panel was open → redraw the page on close
function closePanel() {
  $('.dp-backdrop')?.remove(); $('.dp')?.remove()
  document.body.classList.remove('dp-open')
  current = null
  if (dirty) { dirty = false; const y = window.scrollY; if (app()?.render) { app().render(); window.scrollTo(0, y) } }
}
function panel(headHtml) {
  styles()
  let el = $('.dp')
  if (!el) {
    const back = document.createElement('div'); back.className = 'dp-backdrop'; back.onclick = closePanel
    el = document.createElement('aside'); el.className = 'dp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true')
    el.innerHTML = `<div class="dp-top"><div class="dp-head" style="min-width:0"></div><button class="dp-close" aria-label="Close">×</button></div><div class="dp-body"></div>`
    $('.dp-close', el).onclick = closePanel
    document.body.append(back, el)
    document.body.classList.add('dp-open')
  }
  $('.dp-head', el).innerHTML = headHtml
  return $('.dp-body', el)
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) closePanel() })

async function withBusy(el, fn) {
  el?.classList.add('dp-busy')
  try { return await fn() } catch (e) { toast(e?.message || String(e)); return null } finally { el?.classList.remove('dp-busy') }
}
// Refresh app data without re-rendering the page under the panel, then redraw the panel.
async function refreshAll() {
  dirty = true
  await app()?.refresh?.({ render: false })
  if (current?.render) current.render()
}

// ---------------------------------------------------------------- economics
const REC = { strong_buy: ['Strong buy', 'good'], buy: ['Buy', 'good'], negotiate: ['Negotiate', 'warn'], verify_first: ['Verify first', 'warn'], skip: ['Skip', 'bad'] }
function latest(oppId) { return (state().analyses || []).find(a => a.opportunity_id === oppId) || null }
function oppById(id) { return (state().opps || []).find(o => o.id === id) || null }
function dealLog(o) { return obj(obj(o.raw_listing).deal) }
// Retail deals (Deal Radar / store pages) have a fixed price — no seller to message or haggle with.
const RETAIL = /(^|\.)(amazon\.com\.au|amazon\.com|bigw\.com\.au|jbhifi\.com\.au|kmart\.com\.au|target\.com\.au|harveynorman\.com\.au|officeworks\.com\.au|ebgames\.com\.au|myer\.com\.au|davidjones\.com|catch\.com\.au|thegoodguys\.com\.au|bunnings\.com\.au|rebelsport\.com\.au|jdsports\.com\.au|lego\.com|costco\.com\.au|aldi\.com\.au|woolworths\.com\.au|coles\.com\.au|dickSmith\.com\.au|mwave\.com\.au|scorptec\.com\.au|pbtech\.com|apple\.com|samsung\.com|nike\.com|adidas\.com\.au|zavvi\.com\.au|bestbuy\.com)$/i
function isRetail(o) {
  if (obj(o.raw_listing).source === 'deal_radar') return true
  try { return RETAIL.test(new URL(o.source_url).hostname.replace(/^www\./, '')) } catch { return false }
}

// Profit/ROI at any price, derived from the analysis numbers at the listed ask.
function economics(o, a) {
  const ask = n(obj(a?.user_overrides).asking_price) ?? n(o.seller_asking_price)
  const profitAtAsk = n(a?.expected_profit)
  const roiAtAsk = n(a?.expected_roi_percent)
  const extra = ask !== null && profitAtAsk !== null && roiAtAsk ? Math.max(0, profitAtAsk / (roiAtAsk / 100) - ask) : null
  const profitAt = p => ask === null || profitAtAsk === null || n(p) === null ? null : profitAtAsk + (ask - Number(p))
  const roiAt = p => { const pr = profitAt(p); return pr === null || extra === null ? null : pr / (Number(p) + extra) * 100 }
  return { ask, profitAt, roiAt, extra }
}

// Negotiation envelope. Hard max comes from the analysis' max buy (economics), never a discount %.
function envelope(o, a) {
  const e = economics(o, a)
  const max = n(a?.max_buy)
  if (max === null || max <= 0) return null
  let opening = n(a?.recommended_offer)
  if (opening === null || opening > max) opening = floor5(max * 0.85) || Math.floor(max)
  opening = Math.floor(Math.min(opening, max))
  let target = Math.min(max, round5((opening + max) / 2))
  if (target < opening) target = opening
  if (e.ask !== null && e.ask < target) target = e.ask
  return { ...e, opening, target, max, askUnderOpening: e.ask !== null && e.ask <= opening, askUnderMax: e.ask !== null && e.ask <= max }
}

function classifyCounter(env, counter, lastOffer) {
  const c = Number(counter)
  const last = n(lastOffer) ?? env.opening
  if (c <= env.target || c - env.target <= 5 && c <= env.max) return { action: 'accept', price: c }
  if (c <= env.max) {
    let next = round5((c + Math.max(last, env.opening)) / 2)
    if (next <= last) next = Math.min(env.max, last + 5)
    next = Math.min(next, env.max, c - 5)
    if (next <= last) return { action: 'accept', price: c }
    return { action: 'counter', price: next }
  }
  if (c <= env.max * 1.1) return { action: 'hold', price: env.max }
  return { action: 'walk', price: null }
}

function counterMessage(result, title) {
  const t = title || 'it'
  if (result.action === 'accept') return `Deal — $${Math.round(result.price)} works for me. When suits you for me to pick up ${t}? I can pay on collection.`
  if (result.action === 'counter') return `Thanks for coming back to me. Could you do $${Math.round(result.price)}? I can pick up quickly and pay straight away.`
  if (result.action === 'hold') return `I appreciate it, but $${Math.round(result.price)} is the most I can do for ${t}. If that works I can pick up today.`
  return `Thanks for the reply — that's a bit beyond what I can spend on ${t}, so I'll leave it this time. Good luck with the sale!`
}
const ACTION_LABEL = { accept: 'Accept', counter: 'Counter', hold: 'Hold at your max', walk: 'Walk away' }

// ---------------------------------------------------------------- images
async function compressImage(file, maxDim = 1800, quality = 0.84) {
  if (!file?.type?.startsWith('image/')) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = url })
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise(resolve => canvas.toBlob(b => resolve(b || file), 'image/jpeg', quality))
  } finally { URL.revokeObjectURL(url) }
}
// Stores images against the opportunity (same bucket/table the rest of the app uses). Max 6 per item.
async function uploadImages(opportunityId, fileList, mediaType = 'listing_image') {
  const files = [...(fileList || [])].filter(f => f.type?.startsWith('image/'))
  if (!files.length) return 0
  const u = await user()
  const { count } = await supabase.from('opportunity_media').select('*', { count: 'exact', head: true }).eq('opportunity_id', opportunityId)
  const room = Math.max(0, 6 - Number(count || 0))
  let done = 0
  for (const file of files.slice(0, room)) {
    const blob = await compressImage(file)
    const path = `${u.id}/${opportunityId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('listing-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    const { error: rowError } = await supabase.from('opportunity_media').insert({ user_id: u.id, opportunity_id: opportunityId, storage_path: path, file_name: file.name || 'image.jpg', mime_type: 'image/jpeg', size_bytes: blob.size, media_type: mediaType })
    if (rowError) { await supabase.storage.from('listing-media').remove([path]); throw rowError }
    done++
  }
  return done
}
async function loadImages(opportunityId) {
  const { data: media } = await supabase.from('opportunity_media').select('storage_path,media_type,created_at').eq('opportunity_id', opportunityId).order('created_at', { ascending: false }).limit(12)
  const sorted = arr(media).sort((x, y) => (x.media_type === 'seller_reply_image' ? 0 : 1) - (y.media_type === 'seller_reply_image' ? 0 : 1)).slice(0, 6)
  const out = []
  for (const m of sorted) {
    const { data } = await supabase.storage.from('listing-media').download(m.storage_path)
    if (data) out.push(await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(data) }))
  }
  return out
}

// ---------------------------------------------------------------- re-check with seller reply
const STATUS_FOR_REC = { strong_buy: 'ready', buy: 'ready', negotiate: 'negotiating', verify_first: 'verify', skip: 'skipped' }
async function recheck(o, a, reply, files, shipOverride = null) {
  const u = await user()
  if (files?.length) await uploadImages(o.id, files, 'seller_reply_image')
  const images = await loadImages(o.id)
  const raw = obj(o.raw_listing)
  const bundle = state().bundle || {}
  const profile = bundle.profile || {}, portfolio = bundle.portfolio || {}
  // Acquisition shipping is required for profit; use what was saved, else what the previous analysis used.
  const prevX = obj(obj(a?.raw_model_output).analysis)
  let shipping = n(shipOverride) ?? n(raw.shipping_cost) ?? n(prevX.acquisition_shipping_cost) ?? n(obj(a?.user_overrides).shipping_cost)
  if (shipping === null) {
    const { data: past } = await supabase.from('analyses').select('raw_model_output,user_overrides').eq('opportunity_id', o.id).order('analysed_at', { ascending: false }).limit(10)
    for (const p of arr(past)) { const v = n(obj(obj(p.raw_model_output).analysis).acquisition_shipping_cost) ?? n(obj(p.user_overrides).shipping_cost); if (v !== null) { shipping = v; break } }
  }
  const sellerUpdate = reply || 'The seller reply is in the newly supplied screenshot image(s). Extract and use the new seller information.'
  const body = {
    listing_url: o.source_url || '', listing_text: o.listing_text || '',
    platform_fields: {
      asking_price: o.seller_asking_price, currency: o.currency || 'AUD', asking_price_verified: o.seller_asking_price != null, asking_price_confidence: o.seller_asking_price != null ? 1 : 0,
      listing_title: o.listing_title, listing_location: o.listing_location, seller_name: o.seller_name, seller_rating: o.seller_rating, seller_review_count: o.seller_review_count,
      condition: raw.condition || '', size: raw.size || '', colour: raw.colour || '', source_platform: o.source_platform || '',
      brand: raw.brand || a?.brand || '', shipping_cost: shipping, acquisition_shipping_cost: shipping
    },
    user_overrides: { asking_price: o.seller_asking_price, currency: o.currency || 'AUD', ...(shipping !== null ? { shipping_cost: shipping } : {}) },
    seller_update: sellerUpdate,
    prior_analysis_summary: a ? JSON.stringify({ identified_name: a.identified_name, recommendation: a.recommendation, resale_mid: a.resale_mid, max_buy: a.max_buy, risks: a.risks, questions_to_ask: a.questions_to_ask }) : '',
    bankroll: Number(portfolio.available_cash || 0), risk_profile: profile.risk_profile || 'conservative',
    reserve_percent: Number(profile.capital_reserve_percent ?? 30), max_exposure_percent: Number(profile.max_single_item_exposure_percent ?? 20),
    portfolio_context: portfolio, images
  }
  const { data, error } = await supabase.functions.invoke('analyse-listing-v2', { body })
  if (error || data?.error) throw new Error(`Re-check failed: ${error?.message || data?.error}. Your reply is kept — try again.`)
  const x = data.analysis || {}
  const rec = {
    opportunity_id: o.id, user_id: u.id, engine_version: data.engine_version || x.engine_version || 'analyse-listing-v2',
    identified_name: x.identified_name || a?.identified_name || '', brand: x.brand || '', model: x.model || '', variant: x.variant || '', category: x.category || '',
    identification_confidence: x.identification_confidence ?? null, resale_low: x.resale_low ?? null, resale_mid: x.resale_mid ?? null, resale_high: x.resale_high ?? null,
    quick_sale_value: x.quick_sale_value ?? null, sell_time_low_days: x.sell_time_low_days ?? null, sell_time_mid_days: x.sell_time_mid_days ?? null, sell_time_high_days: x.sell_time_high_days ?? null,
    valuation_confidence: x.valuation_confidence ?? null, overall_score: x.overall_score ?? null, overall_risk: x.overall_risk ?? null, recommendation: x.recommendation || null,
    recommended_offer: x.recommended_offer ?? null, max_buy: x.max_buy ?? null, break_even_sale_price: x.break_even_sale_price ?? null, expected_selling_costs: x.expected_selling_costs ?? null,
    expected_profit: x.expected_profit ?? null, expected_roi_percent: x.expected_roi_percent ?? null, quick_sale_profit: x.quick_sale_profit ?? null, next_action: x.next_action || null,
    questions_to_ask: x.questions_to_ask || [], inspection_checks: x.inspection_checks || [], risks: x.risks || {}, assumptions: x.assumptions || [], evidence_summary: x.evidence_summary || '',
    raw_model_output: data, action_summary: x.action_summary || '', action_steps: x.action_steps || [], action_cautions: x.action_cautions || [], seller_message: x.seller_message || '',
    photo_findings: x.photo_findings || [], photo_count: images.length, user_overrides: { asking_price: o.seller_asking_price, shipping_cost: shipping, seller_reply: reply || '(screenshot)' },
    seller_confidence: x.seller_confidence ?? null, seller_confidence_label: x.seller_confidence_label ?? null, seller_confidence_reason: x.seller_confidence_reason ?? null,
    seller_signals: x.seller_signals || {}, overall_confidence: x.overall_confidence ?? null
  }
  const { error: saveError } = await supabase.from('analyses').insert(rec)
  if (saveError) throw saveError
  const deal = dealLog(o)
  const replies = [...arr(deal.replies), { at: new Date().toISOString(), text: reply || '', screenshots: files?.length || 0, before: a?.recommendation || null, after: x.recommendation || null }]
  const status = STATUS_FOR_REC[x.recommendation] || o.status
  const { error: oppError } = await supabase.from('opportunities').update({ status, raw_listing: { ...obj(o.raw_listing), deal: { ...deal, replies } }, updated_at: new Date().toISOString() }).eq('id', o.id)
  if (oppError) throw oppError
  return x
}

async function saveDeal(o, patch, extra = {}) {
  const deal = { ...dealLog(o), ...patch }
  const { error } = await supabase.from('opportunities').update({ raw_listing: { ...obj(o.raw_listing), deal }, updated_at: new Date().toISOString(), ...extra }).eq('id', o.id)
  if (error) throw error
}

// ---------------------------------------------------------------- deal panel
const stepTab = {}
function defaultStep(o, a) {
  if (['bought', 'purchased'].includes(o.status)) return 'buy'
  const deal = dealLog(o)
  if (isRetail(o)) return 'buy'
  if (n(deal.agreed_price) !== null) {
    if (!deal.arrangement) return 'arrange'
    if (obj(deal.inspection).result !== 'pass') return 'inspect'
    return 'buy'
  }
  if (o.status === 'verify' || a?.recommendation === 'verify_first') return 'verify'
  if (o.status === 'negotiating' || a?.recommendation === 'negotiate') return 'negotiate'
  if (['buy', 'strong_buy'].includes(a?.recommendation)) {
    const env = a ? envelope(o, a) : null
    return env && !env.askUnderOpening ? 'negotiate' : 'buy'
  }
  return 'verify'
}

async function openDeal(oppId) {
  const draw = async () => {
    const o = oppById(oppId)
    if (!o) { closePanel(); return }
    const a = latest(o.id)
    const [rl, rc] = a ? (REC[a.recommendation] || ['Analysed', '']) : ['Not analysed', '']
    const body = panel(`<span class="eyebrow">Deal</span><h2>${esc(o.listing_title || a?.identified_name || 'Item')}</h2>
      <div class="sv-row-sub"><span class="sv-chip ${rc}">${esc(rl)}</span>${a && n(a.overall_score) !== null ? `<span>${Math.round(a.overall_score)}/100</span>` : ''}${o.source_url ? `<a href="${esc(o.source_url)}" target="_blank" rel="noopener">Open listing ↗</a>` : ''}</div>`)
    if (!a) {
      body.innerHTML = `<div class="dp-card"><h3>Analyse it first</h3><p>FlippersAI needs a full analysis before it can plan questions, offers and a maximum price for this item.</p><div class="dp-actions"><button class="button primary" data-dp-analyse>Analyse this item</button></div></div>`
      $('[data-dp-analyse]', body).onclick = () => { closePanel(); window.flippersShell?.prefillAnalyse?.(o) }
      return
    }
    const bought = ['bought', 'purchased'].includes(o.status)
    const step = stepTab[o.id] || defaultStep(o, a)
    const deal = dealLog(o)
    const e = economics(o, a)
    body.innerHTML = `
      <div class="dp-metrics">
        <div class="dp-metric"><small>Ask</small><b>${money(e.ask)}</b></div>
        <div class="dp-metric"><small>Resale</small><b>${money(a.resale_mid)}</b></div>
        <div class="dp-metric"><small>Profit at ask</small><b class="${n(a.expected_profit) === null ? '' : n(a.expected_profit) > 0 ? 'pos' : 'neg'}">${money(a.expected_profit)}</b></div>
        <div class="dp-metric"><small>Max buy</small><b>${money(a.max_buy)}</b></div>
      </div>
      <div class="dp-steps" role="tablist">
        ${(isRetail(o) ? [['verify', 'Check'], ['negotiate', 'Price'], ['buy', bought ? 'Bought' : 'I bought it']] : [['verify', 'Verify'], ['negotiate', 'Negotiate'], ['arrange', 'Arrange'], ['inspect', 'Inspect'], ['buy', bought ? 'Bought' : 'I bought it']]).map(([k, l]) => `<button class="dp-step ${step === k ? 'active' : ''} ${(k === 'verify' && arr(deal.replies).length) || (k === 'negotiate' && n(deal.agreed_price) !== null) || (k === 'arrange' && deal.arrangement) || (k === 'inspect' && obj(deal.inspection).result === 'pass') || (k === 'buy' && bought) ? 'done' : ''}" data-dp-step="${k}">${l}</button>`).join('')}
      </div>
      <div id="dpStep"></div>
      <div class="dp-card"><h3>History</h3><div class="dp-history" id="dpHistory"><div><span>Loading…</span></div></div></div>`
    $$('[data-dp-step]', body).forEach(b => b.onclick = () => { stepTab[o.id] = b.dataset.dpStep; draw() })
    const mount = $('#dpStep', body)
    if (step === 'verify') verifyStep(mount, o, a)
    else if (step === 'negotiate') negotiateStep(mount, o, a)
    else if (step === 'arrange') arrangeStep(mount, o, a)
    else if (step === 'inspect') inspectStep(mount, o, a)
    else buyStep(mount, o, a)
    history($('#dpHistory', body), o)
  }
  current = { kind: 'deal', id: oppId, render: draw }
  await draw()
}

async function history(el, o) {
  const { data } = await supabase.from('analyses').select('recommendation,expected_profit,max_buy,overall_score,analysed_at,user_overrides').eq('opportunity_id', o.id).order('analysed_at', { ascending: false }).limit(10)
  const deal = dealLog(o)
  const rows = arr(data).map(x => ({ at: x.analysed_at, text: `${obj(x.user_overrides).seller_reply ? 'Re-checked with seller reply' : 'Analysed'} → <b>${esc((REC[x.recommendation] || [x.recommendation || '—'])[0])}</b>${n(x.expected_profit) !== null ? ` · profit ${money(x.expected_profit)}` : ''}${n(x.max_buy) !== null ? ` · max ${money(x.max_buy)}` : ''}` }))
  arr(deal.counters).forEach(c => rows.push({ at: c.at, text: `Seller countered ${money(c.price)} → <b>${esc(ACTION_LABEL[c.action] || c.action)}</b>${n(c.reply_price) !== null ? ` at ${money(c.reply_price)}` : ''}` }))
  if (n(deal.agreed_price) !== null) rows.push({ at: deal.agreed_at, text: `Price agreed <b>${money(deal.agreed_price)}</b>` })
  if (deal.arrangement) rows.push({ at: deal.arrangement.at, text: `Arranged <b>${deal.arrangement.method === 'ship' ? 'delivery' : 'pickup'}</b>${deal.arrangement.when ? ` · ${esc(deal.arrangement.when)}` : ''}` })
  if (obj(deal.inspection).result) rows.push({ at: deal.inspection.at, text: `Inspection → <b>${esc({ pass: 'Passed', issue: 'Problem found', walk: 'Walked away' }[deal.inspection.result] || deal.inspection.result)}</b>${deal.inspection.notes ? ` · ${esc(deal.inspection.notes)}` : ''}` })
  rows.sort((x, y) => Date.parse(y.at || 0) - Date.parse(x.at || 0))
  el.innerHTML = rows.length ? rows.map(r => `<div><span>${r.text}</span><span>${r.at ? new Date(r.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}</span></div>`).join('') : '<div><span>No history yet.</span></div>'
}

function verifyStep(mount, o, a) {
  const qs = arr(a.questions_to_ask).map(q => typeof q === 'string' ? q : q?.question || q?.text || '').filter(Boolean)
  const msg = a.seller_message || (qs.length ? `Hi! Is this still available? A couple of quick questions before I come over:\n${qs.map(q => `• ${q}`).join('\n')}` : '')
  const replies = arr(dealLog(o).replies)
  if (isRetail(o)) {
    mount.innerHTML = `<div class="dp-card"><h3>Nothing to ask — it's a store listing</h3><p>There's no seller to message. Check the store page still shows the same price and stock, then buy it. If the price changed, re-analyse it with the new price.</p><div class="dp-actions">${o.source_url ? `<a class="button secondary" href="${esc(o.source_url)}" target="_blank" rel="noopener">Open the store page ↗</a>` : ''}<button class="button secondary" data-dp-reanalyse>Re-analyse</button><button class="button primary" data-dp-goto="buy">I bought it</button></div></div>`
    $$('[data-dp-goto]', mount).forEach(b => b.onclick = () => { stepTab[o.id] = b.dataset.dpGoto; current?.render() })
    $('[data-dp-reanalyse]', mount).onclick = () => { closePanel(); window.flippersShell?.prefillAnalyse?.(o) }
    return
  }
  mount.innerHTML = `
    ${qs.length || msg ? `<div class="dp-card"><h3>Ask the seller</h3>
      ${qs.length ? `<p>FlippersAI still needs:</p><ul class="dp-list">${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      ${msg ? `<label>Message to send<textarea id="dpSellerMsg">${esc(msg)}</textarea></label><div class="dp-actions"><button class="button secondary" id="dpCopyMsg">Copy message</button></div>` : ''}
    </div>` : `<div class="dp-card"><h3>Nothing to verify</h3><p>This analysis doesn't need anything else from the seller. Go to Negotiate or record the purchase.</p></div>`}
    <div class="dp-card" id="dpReply"><h3>Seller replied?</h3><p>Paste their reply or add a screenshot. FlippersAI re-checks the item, economics and verdict with it.</p>
      <label>Seller's reply<textarea id="dpReplyText" placeholder="Paste the seller's message here"></textarea></label>
      <label>Or screenshots of the reply / new photos<input type="file" id="dpReplyFiles" accept="image/jpeg,image/png,image/webp" multiple></label>
      <label>Your cost to get it (shipping / travel — 0 for pickup)<input type="number" id="dpShip" min="0" step="0.01" value="${esc(n(obj(o.raw_listing).shipping_cost) ?? n(obj(obj(a.raw_model_output).analysis).acquisition_shipping_cost) ?? '')}" placeholder="0"></label>
      <div class="dp-actions"><button class="button primary" id="dpRecheck">Re-check with this reply</button></div>
      ${replies.length ? `<p class="dp-note">${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} checked so far. Latest: ${esc((REC[replies[replies.length - 1].before] || ['—'])[0])} → ${esc((REC[replies[replies.length - 1].after] || ['—'])[0])}.</p>` : ''}
    </div>`
  $('#dpCopyMsg', mount)?.addEventListener('click', () => copy($('#dpSellerMsg', mount).value, 'Message copied — paste it to the seller.'))
  $('#dpRecheck', mount).onclick = () => {
    const card = $('#dpReply', mount)
    const text = $('#dpReplyText', mount).value.trim()
    const files = $('#dpReplyFiles', mount).files
    if (!text && !files.length) { toast('Paste the reply or add a screenshot first.'); return }
    $('#dpRecheck', mount).textContent = 'Re-checking… (about 30–60 s)'
    withBusy(card, async () => {
      const before = a.recommendation
      const shipIn = n($('#dpShip', mount).value)
      const x = await recheck(o, a, text, files, shipIn)
      delete stepTab[o.id]
      await refreshAll()
      const after = x.recommendation
      toast(before === after ? `Re-checked: still ${(REC[after] || [after])[0]}.` : `Re-checked: ${(REC[before] || [before])[0]} → ${(REC[after] || [after])[0]}.`)
    }).finally(() => { const b = $('#dpRecheck'); if (b) b.textContent = 'Re-check with this reply' })
  }
}

function negotiateStep(mount, o, a) {
  const env = envelope(o, a)
  const deal = dealLog(o)
  const title = o.listing_title || a.identified_name || 'the item'
  if (!env) {
    mount.innerHTML = `<div class="dp-card"><h3>No safe maximum yet</h3><p>This analysis has no maximum buy price, so FlippersAI can't set offers. Re-analyse it (check the price and shipping are filled in).</p><div class="dp-actions"><button class="button primary" data-dp-reanalyse>Re-analyse</button></div></div>`
    $('[data-dp-reanalyse]', mount).onclick = () => { closePanel(); window.flippersShell?.prefillAnalyse?.(o) }
    return
  }
  const pr = p => { const x = env.profitAt(p), r = env.roiAt(p); return x === null ? '' : `profit ${money(x)}${r !== null ? ` · ${Math.round(r)}% ROI` : ''}` }
  if (isRetail(o)) {
    const ok = env.ask !== null && env.ask <= env.max
    mount.innerHTML = `<div class="dp-card"><h3>Retail price — no haggling</h3>
      <div class="dp-verdict ${ok ? 'accept' : 'hold'}"><strong>${ok ? `Buy while it's ${money(env.ask)} or less` : `Only worth it at ${money(env.max)} or less`}</strong>Your hard max is ${money(env.max)} (${pr(env.max)}). ${ok ? 'Check the store price is still the same, then buy.' : 'Wait for a lower price or a coupon.'}</div>
      <div class="dp-actions">${o.source_url ? `<a class="button secondary" href="${esc(o.source_url)}" target="_blank" rel="noopener">Open the store page ↗</a>` : ''}<button class="button primary" data-dp-goto="buy">I bought it</button></div></div>`
    $$('[data-dp-goto]', mount).forEach(b => b.onclick = () => { stepTab[o.id] = b.dataset.dpGoto; current?.render() })
    return
  }
  const counters = arr(deal.counters)
  const lastOffer = counters.length ? n(counters[counters.length - 1].reply_price) ?? env.opening : env.opening
  const opener = env.askUnderOpening
    ? `<div class="dp-verdict accept"><strong>The ask is already a good price</strong>${money(env.ask)} is at or under your opening offer. Buy at the asking price — haggling risks losing it.</div>`
    : `<label>Opening message<textarea id="dpOfferMsg">${esc(`Hi! Is ${title} still available? Would you take $${Math.round(env.opening)}? I can pick up quickly and pay straight away.`)}</textarea></label><div class="dp-actions"><button class="button secondary" id="dpCopyOffer">Copy offer (${money(env.opening)})</button></div>`
  mount.innerHTML = `
    <div class="dp-card"><h3>Your price range</h3>
      <div class="dp-env">
        <div><small>Opening offer</small><b>${money(env.opening)}</b><span>${pr(env.opening)}</span></div>
        <div><small>Good buy</small><b>${money(env.target)}</b><span>${pr(env.target)}</span></div>
        <div class="hard"><small>Hard max</small><b>${money(env.max)}</b><span>${pr(env.max)}</span></div>
      </div>
      <p class="dp-note">Hard max is the most you can pay and still hit your target profit. Never go above it.</p>
      ${opener}
    </div>
    ${n(deal.agreed_price) !== null ? `<div class="dp-card"><div class="dp-verdict accept"><strong>Price agreed: ${money(deal.agreed_price)}</strong>${pr(deal.agreed_price)}. Next: arrange pickup or delivery, check it, then record the purchase.</div><div class="dp-actions"><button class="button primary" data-dp-goto="arrange">Arrange pickup / delivery</button><button class="sv-link" id="dpUnagree">Undo agreed price</button></div></div>` : `
    <div class="dp-card" id="dpCounter"><h3>Seller countered?</h3>
      <div class="dp-grid"><label>Their price<input type="number" id="dpCounterPrice" min="0" step="1" placeholder="e.g. ${Math.round(env.max)}"></label><div style="display:flex;align-items:flex-end"><button class="button primary" id="dpClassify" style="width:100%">What should I do?</button></div></div>
      <div id="dpCounterResult"></div>
      <div class="dp-actions"><button class="button secondary" id="dpAgreeOpen">They accepted my offer</button></div>
    </div>`}`
  $('#dpCopyOffer', mount)?.addEventListener('click', () => copy($('#dpOfferMsg', mount).value, 'Offer copied — paste it to the seller.'))
  $$('[data-dp-goto]', mount).forEach(b => b.onclick = () => { stepTab[o.id] = b.dataset.dpGoto; current?.render() })
  $('#dpUnagree', mount)?.addEventListener('click', () => withBusy(mount, async () => { await saveDeal(o, { agreed_price: null, agreed_at: null }); await refreshAll() }))
  const agree = (price, extra = {}) => withBusy(mount, async () => {
    await saveDeal(o, { ...extra, agreed_price: Number(price), agreed_at: new Date().toISOString() }, { status: 'negotiating' })
    stepTab[o.id] = 'arrange'
    await refreshAll()
    toast(`Agreed at ${money(price)}. Next: arrange pickup or delivery.`)
  })
  $('#dpAgreeOpen', mount)?.addEventListener('click', () => agree(counters.length ? lastOffer : env.askUnderOpening ? env.ask : env.opening))
  $('#dpClassify', mount)?.addEventListener('click', () => {
    const price = n($('#dpCounterPrice', mount).value)
    if (price === null || price <= 0) { toast('Enter the price the seller came back with.'); return }
    const r = classifyCounter(env, price, lastOffer)
    const text = counterMessage(r, title)
    const why = r.action === 'accept' ? `${money(price)} is ${price <= env.target ? 'at or under your good-buy price' : 'within $5 of your good-buy price'} (${pr(price)}).`
      : r.action === 'counter' ? `${money(price)} still works (${pr(price)}), but you can likely do better. Counter at ${money(r.price)}.`
      : r.action === 'hold' ? `${money(price)} is above your hard max of ${money(env.max)}. Offer your max once — if they won't take it, walk.`
      : `${money(price)} is well above your hard max of ${money(env.max)}${env.profitAt(price) !== null ? ` (profit would be ${money(env.profitAt(price))})` : ''}. Walk away.`
    $('#dpCounterResult', mount).innerHTML = `<div class="dp-verdict ${r.action}"><strong>${ACTION_LABEL[r.action]}${r.price && r.action !== 'accept' ? ` · ${money(r.price)}` : ''}</strong>${esc(why)}</div>
      <label>Reply to send<textarea id="dpCounterMsg">${esc(text)}</textarea></label>
      <div class="dp-actions"><button class="button secondary" id="dpCopyCounter">Copy reply</button>${r.action === 'accept' ? `<button class="button primary" id="dpAgree">Agree at ${money(price)}</button>` : ''}</div>`
    $('#dpCopyCounter', mount).onclick = async () => {
      await copy($('#dpCounterMsg', mount).value, 'Reply copied — paste it to the seller.')
      if (r.action !== 'accept') {
        await saveDeal(o, { counters: [...counters, { at: new Date().toISOString(), price, action: r.action, reply_price: r.price }] }, r.action === 'walk' ? {} : { status: 'negotiating' }).catch(() => {})
        await refreshAll()
      }
    }
    $('#dpAgree', mount)?.addEventListener('click', () => agree(price, { counters: [...counters, { at: new Date().toISOString(), price, action: 'accept', reply_price: price }] }))
  })
}

// Arrange: only the factors that matter for this transaction (pickup vs delivery).
function arrangeStep(mount, o, a) {
  const deal = dealLog(o)
  const ar = obj(deal.arrangement)
  const price = n(deal.agreed_price) ?? n(o.seller_asking_price)
  const title = o.listing_title || a.identified_name || 'the item'
  const method = ar.method || (o.listing_location ? 'pickup' : 'ship')
  const tips = m => m === 'ship'
    ? ['Pay with buyer protection: PayPal Goods & Services, eBay checkout or Facebook checkout — never a bank transfer or PayID to a stranger for a shipped item.', 'Ask for tracked postage and the tracking number before you consider it done.', `Ask for a photo of the item packed with today's date or your name if it's high value.`]
    : ['Meet in daylight somewhere public or with people around (a shopping centre, or the seller\'s front door if it\'s a big item).', `Check the item before paying. Bring exact cash or pay by PayID once you're happy — ${money(price)} agreed.`, 'Bring a charger, cable or tape measure if you need to test or measure it.']
  const msg = m => m === 'ship'
    ? `Great, thanks! Could you post ${title} with tracking? I'll pay ${price !== null ? `$${Math.round(price)} ` : ''}via PayPal Goods & Services — could you send your PayPal email and the postage cost?`
    : `Great, thanks! When suits for me to pick up ${title}? I can pay ${price !== null ? `$${Math.round(price)} ` : ''}cash or PayID on collection after a quick look over it.`
  mount.innerHTML = `<div class="dp-card" id="dpArrange"><h3>Arrange the handover</h3>
    <div class="dp-grid"><label>How are you getting it?<select id="dpMethod"><option value="pickup" ${method === 'pickup' ? 'selected' : ''}>I'll pick it up</option><option value="ship" ${method === 'ship' ? 'selected' : ''}>Seller posts it</option></select></label>
      <label>When (optional)<input type="text" id="dpWhen" value="${esc(ar.when || '')}" placeholder="Sat 10am"></label></div>
    <ul class="dp-list" id="dpTips"></ul>
    <label>Message to send<textarea id="dpArrMsg"></textarea></label>
    <div class="dp-actions"><button class="button secondary" id="dpCopyArr">Copy message</button><button class="button primary" id="dpArranged">It's arranged</button></div></div>`
  const draw = () => { const m = $('#dpMethod', mount).value; $('#dpTips', mount).innerHTML = tips(m).map(t => `<li>${esc(t)}</li>`).join(''); $('#dpArrMsg', mount).value = msg(m) }
  $('#dpMethod', mount).onchange = draw; draw()
  $('#dpCopyArr', mount).onclick = () => copy($('#dpArrMsg', mount).value, 'Message copied — paste it to the seller.')
  $('#dpArranged', mount).onclick = () => withBusy($('#dpArrange', mount), async () => {
    await saveDeal(o, { arrangement: { method: $('#dpMethod', mount).value, when: $('#dpWhen', mount).value.trim(), at: new Date().toISOString() } })
    stepTab[o.id] = 'inspect'
    await refreshAll()
    toast('Arranged. Check the item against the list before you pay.')
  })
}

// Inspect: item-specific checks from the analysis, then pass / problem (re-check) / walk away.
function inspectStep(mount, o, a) {
  const deal = dealLog(o)
  const ins = obj(deal.inspection)
  const checks = arr(a.inspection_checks).map(c => typeof c === 'string' ? c : c?.check || c?.text || '').filter(Boolean)
  const shipped = obj(deal.arrangement).method === 'ship'
  mount.innerHTML = `<div class="dp-card" id="dpInspect"><h3>${shipped ? 'Check it when it arrives' : 'Check it before you pay'}</h3>
    ${checks.length ? `<div class="dp-checks">${checks.map((c, i) => `<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" data-chk="${i}" style="margin-top:3px"> <span>${esc(c)}</span></label>`).join('')}</div>` : `<p>Check it matches the listing photos and description, and that it works.</p>`}
    ${ins.result === 'issue' ? `<div class="dp-verdict hold"><strong>Problem noted</strong>${esc(ins.notes || '')}</div>` : ''}
    <div class="dp-actions"><button class="button primary" id="dpPass">All good — buy it</button><button class="button secondary" id="dpIssue">Something's off</button><button class="sv-link" id="dpWalk">Walk away</button></div>
    <div id="dpIssueBox"></div></div>`
  const box = $('#dpInspect', mount)
  $('#dpPass', mount).onclick = () => withBusy(box, async () => {
    const unchecked = checks.length - $$('[data-chk]:checked', mount).length
    await saveDeal(o, { inspection: { result: 'pass', unchecked, at: new Date().toISOString() } })
    stepTab[o.id] = 'buy'
    await refreshAll()
  })
  $('#dpWalk', mount).onclick = () => withBusy(box, async () => {
    const now = new Date().toISOString()
    await saveDeal(o, { inspection: { result: 'walk', at: now } }, { dismissed_at: now })
    closePanel()
    await app()?.refresh?.()
    toast('Walked away — moved to Archived. There will be another one.')
  })
  $('#dpIssue', mount).onclick = () => {
    $('#dpIssueBox', mount).innerHTML = `<label>What's wrong?<textarea id="dpIssueText" placeholder="e.g. scratch on the screen, missing charger, box damaged"></textarea></label>
      <div class="dp-actions"><button class="button primary" id="dpIssueCheck">Re-check the price with this</button></div>
      <p class="dp-note">FlippersAI re-values it with the problem and gives you a new maximum to renegotiate from (about 30–60 s).</p>`
    $('#dpIssueCheck', mount).onclick = () => {
      const text = $('#dpIssueText', mount).value.trim()
      if (!text) { toast('Describe the problem first.'); return }
      withBusy(box, async () => {
        const x = await recheck(o, a, `Inspection before purchase found a problem not shown in the listing: ${text}. Re-value the item in this condition and set max_buy / recommended_offer for renegotiation.`, null)
        await app()?.refresh?.({ render: false })
        const fresh = oppById(o.id) || o
        await saveDeal(fresh, { inspection: { result: 'issue', notes: text, at: new Date().toISOString() }, agreed_price: null, agreed_at: null })
        stepTab[o.id] = 'negotiate'
        await refreshAll()
        toast(`Re-valued with the problem: max buy now ${money(x.max_buy)}. Renegotiate from here.`)
      })
    }
  }
}

function buyStep(mount, o, a) {
  const deal = dealLog(o)
  const inv = (state().inventory || []).find(i => i.opportunity_id === o.id)
  if (['bought', 'purchased'].includes(o.status) || inv) {
    mount.innerHTML = `<div class="dp-card"><div class="dp-verdict accept"><strong>Bought${inv ? ` for ${money(n(inv.purchase_price) + (n(inv.acquisition_costs) || 0))}` : ''}</strong>It's in your Stock. Next: prepare it and list it.</div><div class="dp-actions"><button class="button primary" id="dpToStock">Open Stock</button></div></div>`
    $('#dpToStock', mount).onclick = () => { closePanel(); app()?.route('inventory') }
    return
  }
  const env = envelope(o, a)
  const price = n(deal.agreed_price) ?? n(o.seller_asking_price) ?? ''
  const over = env && n(price) !== null && n(price) > env.max
  mount.innerHTML = `
    <div class="dp-card" id="dpBuy"><h3>I bought it</h3><p>Enter what you actually paid. This becomes the cost for your profit tracking, and the item moves to Stock.</p>
      <div class="dp-grid three">
        <label>Price paid<input type="number" id="dpPaid" min="0" step="0.01" value="${esc(price)}"></label>
        <label>Shipping / travel<input type="number" id="dpCosts" min="0" step="0.01" value="0"></label>
        <label>Date<input type="date" id="dpDate" value="${today()}"></label>
      </div>
      <div id="dpBuyWarn">${over ? `<div class="dp-verdict hold"><strong>Above your hard max</strong>${money(price)} is more than ${money(env.max)}. You'll likely miss your target profit.</div>` : ''}</div>
      <div class="dp-actions"><button class="button primary" id="dpRecord">Record purchase</button></div>
      <p class="dp-note">Before paying: check it matches the listing and works${arr(a.inspection_checks).length ? ' — see the checklist below' : ''}.</p>
    </div>
    ${arr(a.inspection_checks).length ? `<div class="dp-card"><h3>Check before you pay</h3><ul class="dp-list">${arr(a.inspection_checks).map(c => `<li>${esc(typeof c === 'string' ? c : c?.check || c?.text || '')}</li>`).join('')}</ul></div>` : ''}`
  $('#dpPaid', mount).oninput = e => {
    const p = n(e.target.value)
    $('#dpBuyWarn', mount).innerHTML = env && p !== null && p > env.max ? `<div class="dp-verdict hold"><strong>Above your hard max</strong>${money(p)} is more than ${money(env.max)}. You'll likely miss your target profit.</div>` : ''
  }
  $('#dpRecord', mount).onclick = () => withBusy($('#dpBuy', mount), async () => {
    const paid = n($('#dpPaid', mount).value)
    if (paid === null || paid < 0) throw new Error('Enter the price you paid.')
    const costs = n($('#dpCosts', mount).value) || 0
    const { error } = await supabase.rpc('record_purchase', {
      p_opportunity_id: o.id, p_analysis_id: a.id, p_title: o.listing_title || a.identified_name || 'Purchased item', p_category: a.category || '',
      p_purchase_price: paid, p_acquisition_costs: costs, p_purchase_date: $('#dpDate', mount).value || today()
    })
    if (error) throw error
    const { data: after } = await supabase.from('opportunities').select('status').eq('id', o.id).maybeSingle()
    if (!['bought', 'purchased'].includes(after?.status)) {
      const { error: sErr } = await supabase.from('opportunities').update({ status: 'bought', updated_at: new Date().toISOString() }).eq('id', o.id)
      if (sErr) console.warn('[FlippersAI] could not mark opportunity bought', sErr)
    }
    await refreshAll()
    toast(`Recorded — ${money(paid + costs)} is now in your Stock.`)
  })
}

// ---------------------------------------------------------------- STOCK
const INV_GROUPS = [
  ['prepare', 'To prepare', ['purchased', 'preparing']],
  ['ready', 'Ready to list', ['ready_to_list']],
  ['listed', 'Listed', ['listed']],
  ['sold', 'Sold', ['sale_agreed', 'packed', 'shipped', 'delivered']],
  ['done', 'Paid out', ['sold']],
  ['closed', 'Returned / written off', ['returned', 'written_off']]
]
const INV_STATUS = { purchased: 'To prepare', preparing: 'Preparing', ready_to_list: 'Ready to list', listed: 'Listed', sale_agreed: 'Sold — awaiting payment', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', sold: 'Paid out', returned: 'Returned', written_off: 'Written off' }
const costBasis = i => (n(i.purchase_price) || 0) + (n(i.acquisition_costs) || 0)
let stockFilter = 'all'

function saleFor(i) { return (state().sales || []).find(s => s.inventory_item_id === i.id) || null }
function listingFor(i) { return (state().saleListings || []).find(l => l.inventory_item_id === i.id && l.status === 'active') || (state().saleListings || []).find(l => l.inventory_item_id === i.id) || null }
// The ledger treats payout_amount as the NET amount received (after platform fees).
function actualProfit(i, s) {
  if (!s) return null
  const net = n(s.payout_amount) ?? ((n(s.sale_price) || 0) - (n(s.selling_fees) || 0))
  return net - (n(s.shipping_cost) || 0) - (n(s.other_costs) || 0) - costBasis(i)
}

function stockView(root, api) {
  styles()
  const st = api.state
  const items = st.inventory || []
  const p = st.bundle?.portfolio || {}
  const unsold = items.filter(i => !['sold', 'returned', 'written_off'].includes(i.status))
  const atCost = unsold.reduce((s, i) => s + costBasis(i), 0)
  const estValue = unsold.reduce((s, i) => s + (n(i.predicted_resale_mid) || 0), 0)
  const groupOf = i => (INV_GROUPS.find(([, , ss]) => ss.includes(i.status)) || ['prepare'])[0]
  const counts = Object.fromEntries(INV_GROUPS.map(([k]) => [k, items.filter(i => groupOf(i) === k).length]))
  const list = items.filter(i => stockFilter === 'all' || groupOf(i) === stockFilter)

  const row = (i, idx) => {
    const s = saleFor(i), l = listingFor(i), ap = actualProfit(i, s)
    const held = daysSince(i.purchase_date || i.created_at)
    const next = nextStockAction(i, s)
    const money1 = [
      `<span>Cost <b>${money(costBasis(i))}</b></span>`,
      s ? `<span>Sold <b>${money(s.sale_price)}</b></span>` : n(i.predicted_resale_mid) !== null ? `<span>Est. resale <b>${money(i.predicted_resale_mid)}</b></span>` : '',
      l && !s ? `<span>Listed at <b>${money(l.listing_price)}</b>${l.platform ? ` on ${esc(l.platform)}` : ''}</span>` : '',
      ap !== null && i.status === 'sold' ? `<span>Profit <b class="${ap >= 0 ? 'pos' : 'neg'}">${money(ap)}</b></span>` : !s && n(i.predicted_profit) !== null ? `<span>Est. profit <b class="${n(i.predicted_profit) >= 0 ? 'pos' : 'neg'}">${money(i.predicted_profit)}</b></span>` : '',
      held !== null && !['sold', 'returned', 'written_off'].includes(i.status) ? `<span>Held <b>${held}d</b></span>` : ''
    ].filter(Boolean).join('')
    return `<div class="sv-row" data-stock="${idx}"><div class="sv-row-main"><div class="sv-row-title">${esc(i.title || 'Stock item')}</div>
      <div class="sv-row-sub"><span class="sv-chip ${i.status === 'sold' ? 'good' : ['returned', 'written_off'].includes(i.status) ? 'bad' : groupOf(i) === 'sold' ? 'warn' : ''}">${esc(INV_STATUS[i.status] || i.status)}</span></div>
      <div class="st-row-money" style="margin-top:6px">${money1}</div></div>
      <div class="sv-row-actions">${next ? `<button class="button primary" data-stock-act>${esc(next.label)}</button>` : ''}<button class="button secondary" data-stock-open>Details</button></div></div>`
  }

  root.innerHTML = `
    <section class="sv-head"><div><h1>Stock</h1><p>Everything you've bought — what it cost, what it should sell for, and what to do next.</p></div>
      <button class="button secondary" data-nav-legacy="capital">Capital & history</button></section>
    <div class="sv-metrics">
      <div class="sv-metric"><small>Available to spend</small><b>${money(p.available_cash || 0)}</b></div>
      <div class="sv-metric"><small>Stock at cost</small><b>${money(atCost)}</b></div>
      <div class="sv-metric"><small>Est. stock value</small><b>${money(estValue)}</b></div>
      <div class="sv-metric"><small>Realised profit</small><b class="pos">${money(p.realized_profit || 0)}</b></div>
    </div>
    ${items.length ? `<div class="sv-filters">${[['all', 'All', items.length], ...INV_GROUPS.filter(([k]) => counts[k]).map(([k, l]) => [k, l, counts[k]])].map(([k, l, c]) => `<button class="sv-filter ${stockFilter === k ? 'active' : ''}" data-stock-filter="${k}">${l}<span>${c}</span></button>`).join('')}</div>` : ''}
    ${list.length ? `<div class="sv-list">${list.map(row).join('')}</div>` : items.length ? `<div class="sv-empty">Nothing in this group.</div>` : `<div class="sv-empty"><strong>No stock yet.</strong> When you buy something from your Pipeline, press <em>I bought it</em> — it lands here with its real cost, ready to prepare and list.</div><div><button class="button primary" data-shell-go="pipeline">Open Pipeline</button></div>`}`
  $$('[data-stock-filter]', root).forEach(b => b.onclick = () => { stockFilter = b.dataset.stockFilter; stockView(root, api) })
  $$('[data-stock]', root).forEach(el => {
    const i = list[Number(el.dataset.stock)]
    $('[data-stock-open]', el).onclick = () => openStock(i.id)
    $('[data-stock-act]', el)?.addEventListener('click', () => openStock(i.id, nextStockAction(i, saleFor(i))?.kind))
  })
}

function nextStockAction(i, s) {
  if (['purchased', 'preparing'].includes(i.status)) return { label: 'Plan the sale', kind: 'plan' }
  if (i.status === 'ready_to_list') return { label: 'Mark as listed', kind: 'list' }
  if (i.status === 'listed') return { label: 'Record sale', kind: 'sale' }
  if (['sale_agreed', 'packed', 'shipped', 'delivered'].includes(i.status) && s) return { label: 'Payment received', kind: 'funds' }
  return null
}

function openStock(itemId, focus) {
  const draw = () => {
    const i = (state().inventory || []).find(x => x.id === itemId)
    if (!i) { closePanel(); return }
    const s = saleFor(i), l = listingFor(i), ap = actualProfit(i, s)
    const body = panel(`<span class="eyebrow">Stock</span><h2>${esc(i.title || 'Stock item')}</h2><div class="sv-row-sub"><span class="sv-chip">${esc(INV_STATUS[i.status] || i.status)}</span>${i.purchase_date ? `<span>Bought ${new Date(i.purchase_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>` : ''}</div>`)
    const next = focus || nextStockAction(i, s)?.kind
    body.innerHTML = `
      <div class="dp-metrics">
        <div class="dp-metric"><small>Cost</small><b>${money(costBasis(i))}</b></div>
        <div class="dp-metric"><small>${s ? 'Sold for' : 'Est. resale'}</small><b>${money(s ? s.sale_price : i.predicted_resale_mid)}</b></div>
        <div class="dp-metric"><small>${ap !== null ? 'Profit' : 'Est. profit'}</small><b class="${(ap ?? n(i.predicted_profit) ?? 0) >= 0 ? 'pos' : 'neg'}">${money(ap ?? i.predicted_profit)}</b></div>
        <div class="dp-metric"><small>Quick sale</small><b>${money(i.predicted_quick_sale)}</b></div>
      </div>
      <div id="stStep"></div>
      <details class="dp-card"><summary style="cursor:pointer;font-weight:650">Edit or remove</summary><div id="stEdit" style="display:flex;flex-direction:column;gap:12px;margin-top:12px"></div></details>`
    const mount = $('#stStep', body)
    if (next === 'plan') planStep(mount, i)
    else if (next === 'list') listStep(mount, i)
    else if (next === 'sale') saleStep(mount, i, l)
    else if (next === 'funds') fundsStep(mount, i, s)
    else mount.innerHTML = i.status === 'sold' ? `<div class="dp-card"><div class="dp-verdict ${ap >= 0 ? 'accept' : 'walk'}"><strong>Flip complete · ${money(ap)} profit</strong>Sold for ${money(s?.sale_price)}, ${money(s?.payout_amount)} received after fees${n(s?.shipping_cost) ? `, ${money(s.shipping_cost)} postage` : ''}.</div></div>` : ''
    editStep($('#stEdit', body), i)
  }
  current = { kind: 'stock', id: itemId, render: draw }
  focus = focus || null
  draw()
  focus = null
}

async function salePlan(i) {
  const { data: existing } = await supabase.from('sale_plans').select('*').eq('inventory_item_id', i.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) return existing
  const u = await user()
  const st = state()
  const opp = (st.opps || []).find(o => o.id === i.opportunity_id) || {}
  const analysis = (st.analyses || []).find(a => a.id === i.acquisition_analysis_id) || (st.analyses || []).find(a => a.opportunity_id === i.opportunity_id) || {}
  const { data, error } = await supabase.functions.invoke('build-sale-plan', { body: { inventory: i, analysis, opportunity: opp, profile: st.bundle?.profile || {} } })
  if (error || data?.error) throw new Error(error?.message || data?.error || 'Could not build the sale plan')
  const x = data.plan || {}
  const row = { user_id: u.id, inventory_item_id: i.id, recommended_platform: x.recommended_platform, platform_rankings: x.platform_rankings || [], pricing_plan: x.pricing_plan || {}, negotiation_ladder: x.negotiation_ladder || {}, shipping_plan: x.shipping_plan || {}, photo_plan: x.photo_plan || [], listing_copy: x.listing_copy || {}, preparation_checklist: x.preparation_checklist || [], next_action: x.next_action || '', engine_version: data.engine_version || 'flippers-sale-alpha-1' }
  const { data: saved, error: saveError } = await supabase.from('sale_plans').insert(row).select('*').single()
  if (saveError) throw saveError
  return saved
}

function planMarkup(pl) {
  const pr = obj(pl.pricing_plan), cp = obj(pl.listing_copy)
  return `
    <div class="dp-env"><div><small>List at</small><b>${money(pr.list_price)}</b></div><div><small>Expect</small><b>${money(pr.expected_close_price)}</b></div><div class="hard"><small>Lowest</small><b>${money(pr.minimum_price)}</b></div></div>
    ${pl.recommended_platform ? `<p><strong>Sell on:</strong> ${esc(pl.recommended_platform)}${pr.rationale ? ` — ${esc(pr.rationale)}` : ''}</p>` : ''}
    ${arr(pl.preparation_checklist).length ? `<h3>Prepare</h3><ul class="dp-list">${arr(pl.preparation_checklist).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${arr(pl.photo_plan).length ? `<h3>Photos to take</h3><ul class="dp-list">${arr(pl.photo_plan).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${cp.title ? `<label>Listing title<textarea id="stTitle" style="min-height:52px">${esc(cp.title)}</textarea></label>` : ''}
    ${cp.description ? `<label>Description<textarea id="stDesc" style="min-height:150px">${esc(cp.description)}</textarea></label>` : ''}
    <div class="dp-actions">${cp.title ? '<button class="button secondary" data-st-copy="#stTitle">Copy title</button>' : ''}${cp.description ? '<button class="button secondary" data-st-copy="#stDesc">Copy description</button>' : ''}</div>`
}

function planStep(mount, i) {
  mount.innerHTML = `<div class="dp-card" id="stPlan"><h3>Sale plan</h3><p>Building your price, listing copy and prep checklist… (about 30–60 s, only the first time)</p></div>`
  const card = $('#stPlan', mount)
  salePlan(i).then(pl => {
    card.innerHTML = `<h3>Sale plan</h3>${planMarkup(pl)}<div class="dp-actions"><button class="button primary" id="stReady">It's ready to list</button></div>`
    $$('[data-st-copy]', card).forEach(b => b.onclick = () => copy($(b.dataset.stCopy, card).value, 'Copied.'))
    $('#stReady', card).onclick = () => withBusy(card, async () => {
      const { error } = await supabase.from('inventory_items').update({ status: 'ready_to_list', updated_at: new Date().toISOString() }).eq('id', i.id)
      if (error) throw error
      await refreshAll()
      toast('Marked ready to list.')
    })
  }).catch(e => { card.innerHTML = `<h3>Sale plan</h3><div class="dp-verdict walk"><strong>Couldn't build the plan</strong>${esc(e.message || e)}</div><div class="dp-actions"><button class="button secondary" id="stRetry">Try again</button><button class="button primary" id="stReady2">Skip — it's ready to list</button></div>`; $('#stRetry', card).onclick = () => planStep(mount, i); $('#stReady2', card).onclick = () => withBusy(card, async () => { const { error } = await supabase.from('inventory_items').update({ status: 'ready_to_list', updated_at: new Date().toISOString() }).eq('id', i.id); if (error) throw error; await refreshAll() }) })
}

function listStep(mount, i) {
  mount.innerHTML = `<div class="dp-card" id="stList"><h3>Mark as listed</h3><p>Once it's live, record where and for how much so FlippersAI can track it.</p>
    <div class="dp-grid"><label>Where<input type="text" id="stPlatform" placeholder="Facebook Marketplace"></label><label>Listed at<input type="number" id="stPrice" min="0" step="1"></label></div>
    <label>Listing link (optional)<input type="url" id="stUrl" placeholder="https://"></label>
    <div class="dp-actions"><button class="button primary" id="stListed">It's listed</button></div><div id="stPlanMini"></div></div>`
  const card = $('#stList', mount)
  salePlan(i).then(pl => {
    const pr = obj(pl.pricing_plan)
    if (!$('#stPlatform', card).value && pl.recommended_platform) $('#stPlatform', card).value = pl.recommended_platform
    if (!$('#stPrice', card).value && n(pr.list_price) !== null) $('#stPrice', card).value = Math.round(pr.list_price)
    $('#stPlanMini', card).innerHTML = `<details><summary style="cursor:pointer;font-size:13px;color:var(--muted)">Show the sale plan</summary><div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">${planMarkup(pl)}</div></details>`
    $$('[data-st-copy]', card).forEach(b => b.onclick = () => copy($(b.dataset.stCopy, card).value, 'Copied.'))
  }).catch(() => {})
  $('#stListed', card).onclick = () => withBusy(card, async () => {
    const platform = $('#stPlatform', card).value.trim(), price = n($('#stPrice', card).value)
    if (!platform || price === null) throw new Error('Add where it is listed and the price.')
    const u = await user()
    const pl = await salePlan(i).catch(() => null), pr = obj(pl?.pricing_plan)
    const { error } = await supabase.from('sale_listings').insert({ user_id: u.id, inventory_item_id: i.id, platform, listing_url: $('#stUrl', card).value.trim() || null, listing_price: price, expected_close_price: pr.expected_close_price ?? null, minimum_price: pr.minimum_price ?? null, status: 'active', listed_at: new Date().toISOString() })
    if (error) throw error
    const { error: e2 } = await supabase.from('inventory_items').update({ status: 'listed', updated_at: new Date().toISOString() }).eq('id', i.id)
    if (e2) throw e2
    await refreshAll()
    toast(`Listed at ${money(price)}.`)
  })
}

function saleStep(mount, i, l) {
  mount.innerHTML = `<div class="dp-card" id="stSale"><h3>Record the sale</h3><p>Enter the agreed price and what the sale costs you. FlippersAI tracks payment next.</p>
    <div class="dp-grid"><label>Sold on<input type="text" id="stSPlatform" value="${esc(l?.platform || '')}"></label><label>Sale price<input type="number" id="stSPrice" min="0" step="0.01" value="${esc(l?.listing_price ?? '')}"></label></div>
    <div class="dp-grid three"><label>Platform fees<input type="number" id="stFees" min="0" step="0.01" value="0"></label><label>Postage<input type="number" id="stShip" min="0" step="0.01" value="0"></label><label>Other<input type="number" id="stOther" min="0" step="0.01" value="0"></label></div>
    <div id="stSaleCalc"></div>
    <div class="dp-actions"><button class="button primary" id="stSold">Record sale</button></div></div>`
  const card = $('#stSale', mount)
  const calc = () => {
    const p = n($('#stSPrice', card).value)
    if (p === null) { $('#stSaleCalc', card).innerHTML = ''; return }
    const profit = p - (n($('#stFees', card).value) || 0) - (n($('#stShip', card).value) || 0) - (n($('#stOther', card).value) || 0) - costBasis(i)
    $('#stSaleCalc', card).innerHTML = `<div class="dp-verdict ${profit >= 0 ? 'accept' : 'walk'}"><strong>Profit on this sale: ${money(profit)}</strong>${n(i.predicted_profit) !== null ? `Predicted at purchase: ${money(i.predicted_profit)}.` : ''}</div>`
  }
  $$('input', card).forEach(x => x.oninput = calc); calc()
  $('#stSold', card).onclick = () => withBusy(card, async () => {
    const platform = $('#stSPlatform', card).value.trim(), price = n($('#stSPrice', card).value)
    if (!platform || price === null) throw new Error('Add where it sold and the price.')
    const { error } = await supabase.rpc('record_sale_agreement', { p_inventory_item_id: i.id, p_platform: platform, p_sale_price: price, p_selling_fees: n($('#stFees', card).value) || 0, p_shipping_cost: n($('#stShip', card).value) || 0, p_other_costs: n($('#stOther', card).value) || 0 })
    if (error) throw error
    await refreshAll()
    toast('Sale recorded. Mark the payment once it lands.')
  })
}

function fundsStep(mount, i, s) {
  mount.innerHTML = `<div class="dp-card" id="stFunds"><h3>Payment received?</h3><p>Only confirm once the money is actually in your account.</p>
    <label>Amount that landed in your account (after platform fees)<input type="number" id="stPayout" min="0" step="0.01" value="${esc(s ? Math.round(((n(s.sale_price) || 0) - (n(s.selling_fees) || 0)) * 100) / 100 : '')}"></label>
    <div class="dp-actions"><button class="button primary" id="stPaid">Payment received</button></div></div>`
  const card = $('#stFunds', mount)
  $('#stPaid', card).onclick = () => withBusy(card, async () => {
    const amt = n($('#stPayout', card).value)
    if (amt === null) throw new Error('Enter the amount you received.')
    const { error } = await supabase.rpc('record_funds_received', { p_sale_id: s.id, p_payout_amount: amt })
    if (error) throw error
    await refreshAll()
    toast('Payment recorded — flip complete.')
  })
}

function editStep(mount, i) {
  const statuses = Object.keys(INV_STATUS)
  mount.innerHTML = `
    <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650">Title<input type="text" id="stETitle" value="${esc(i.title || '')}" style="font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:10px"></label>
    <div class="dp-grid three" style="display:grid">
      <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650">Price paid<input type="number" id="stEPrice" value="${esc(i.purchase_price ?? 0)}" min="0" step="0.01" style="font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:10px;min-width:0"></label>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650">Extra costs<input type="number" id="stECosts" value="${esc(i.acquisition_costs ?? 0)}" min="0" step="0.01" style="font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:10px;min-width:0"></label>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650">Status<select id="stEStatus" style="font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:10px;min-width:0">${statuses.map(x => `<option value="${x}" ${x === i.status ? 'selected' : ''}>${esc(INV_STATUS[x])}</option>`).join('')}</select></label>
    </div>
    <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:650">Notes<textarea id="stENotes" style="min-height:70px;font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--line);border-radius:10px">${esc(i.notes || '')}</textarea></label>
    <p class="dp-note">Changing the price or costs also updates your finance ledger.</p>
    <div class="dp-actions"><button class="button primary" id="stESave">Save changes</button><button class="button secondary" id="stEDelete">Delete item</button></div>`
  $('#stESave', mount).onclick = () => withBusy(mount, async () => {
    const { error } = await supabase.rpc('update_inventory_record', { p_inventory_id: i.id, p_title: $('#stETitle', mount).value.trim() || i.title, p_category_id: i.category_id || null, p_tags: i.tags || [], p_status: $('#stEStatus', mount).value, p_purchase_price: n($('#stEPrice', mount).value) || 0, p_acquisition_costs: n($('#stECosts', mount).value) || 0, p_notes: $('#stENotes', mount).value || null })
    if (error) throw error
    await refreshAll()
    toast('Saved.')
  })
  const del = $('#stEDelete', mount)
  del.onclick = () => {
    if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'Tap again to delete for good'; setTimeout(() => { if (del.isConnected) { del.dataset.armed = ''; del.textContent = 'Delete item' } }, 4000); return }
    withBusy(mount, async () => {
      const { error } = await supabase.rpc('delete_inventory_record', { p_inventory_id: i.id })
      if (error) throw error
      closePanel()
      await app()?.refresh?.()
      toast('Deleted.')
    })
  }
}

// ---------------------------------------------------------------- wiring
styles()
window.flippersDeal = { open: openDeal, openStock, uploadImages, envelope, classifyCounter, isRetail }
window.flippersViews = { ...(window.flippersViews || {}), inventory: stockView }
const register = () => { window.flippersViews = { ...(window.flippersViews || {}), inventory: stockView }; window.dispatchEvent(new CustomEvent('flippers:views-ready')) }
if (window.flippersViews?.today) register()
else window.addEventListener('flippers:views-ready', () => { if (!window.flippersViews?.inventory) register() }, { once: true })
