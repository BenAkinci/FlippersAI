// v0.150: FlippersAI shell pages — Today, Find, Pipeline — plus "Save to Pipeline" in Analyse.
// app.js owns routing and the top bar; this module owns the content of the new sections.
// Data model: opportunities are the canonical item record (status = lifecycle stage),
// analyses hold the latest valuation, inventory_items are owned stock.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const n = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
const money = v => n(v) === null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n(v))
const ago = iso => { if (!iso) return ''; const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 48) return `${h}h ago`; return `${Math.round(h / 24)}d ago` }
const PREFILL_KEY = 'flippers:analyse-prefill'
// Older scraped records put page text into listing_location; keep only a real place name.
const cleanLocation = v => {
  const t = String(v || '').split(/\b(?:is approximate|Seller information|Seller details|Message|Details|Condition|Listed|Joined)\b/i)[0].replace(/[·|,\s]+$/, '').trim()
  return t.length > 0 && t.length <= 40 ? t : ''
}

function toast(text) {
  $('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}
const go = view => window.flippersApp?.route(view)

// ---------------------------------------------------------------- styles
function styles() {
  if ($('#shellV150Styles')) return
  const s = document.createElement('style')
  s.id = 'shellV150Styles'
  s.textContent = `
  /* Legacy nav buttons injected by older layers stay in the DOM (they drive Find tabs) but are hidden. */
  .desktop-nav .community-nav,.desktop-nav [data-web-v086],.mobile-nav .community-nav,.mobile-nav [data-web-v086]{display:none!important}
  .shell-view{display:flex;flex-direction:column;gap:28px}
  .shell-loading{color:var(--muted);padding:40px 0}
  .sv-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .sv-head h1{margin:2px 0 0;font-size:30px;letter-spacing:-.02em}
  .sv-head p{margin:6px 0 0;color:var(--muted);font-size:15px;max-width:640px}
  .sv-section{display:flex;flex-direction:column;gap:12px}
  .sv-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .sv-section-head h2{margin:0;font-size:18px}
  .sv-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .sv-metric{border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--bg);padding:14px 16px;min-width:0}
  .sv-metric small{display:block;color:var(--muted);font-size:12px}
  .sv-metric b{display:block;font-size:22px;margin-top:4px;letter-spacing:-.01em}
  .sv-metric .pos{color:var(--green)}
  .sv-list{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);overflow:hidden}
  .sv-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 16px;align-items:center;padding:14px 16px;border-top:1px solid var(--line)}
  .sv-row:first-child{border-top:0}
  .sv-row-main{min-width:0}
  .sv-row-title{font-weight:650;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sv-row-sub{color:var(--muted);font-size:13px;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .sv-row-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
  .sv-row-actions .button{padding:8px 14px;min-height:0;font-size:13px}
  .sv-chip{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--soft);color:var(--muted);border:1px solid var(--line);white-space:nowrap}
  .sv-chip.good{background:var(--green-soft);color:var(--green);border-color:transparent}
  .sv-chip.warn{background:var(--amber-soft);color:var(--amber);border-color:transparent}
  .sv-chip.bad{background:var(--red-soft);color:var(--red);border-color:transparent}
  .sv-empty{border:1px dashed var(--line);border-radius:var(--radius);padding:22px;color:var(--muted);font-size:14px;line-height:1.5}
  .sv-empty strong{color:var(--ink)}
  .sv-drop{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);padding:18px 20px;flex-wrap:wrap}
  .sv-drop strong{font-size:16px}
  .sv-drop p{margin:4px 0 0;color:var(--muted);font-size:14px}
  .sv-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin:0 0 4px;overflow-x:auto;scrollbar-width:none}
  .sv-tabs::-webkit-scrollbar{display:none}
  .sv-tab{border:0;background:transparent;padding:10px 14px;font:inherit;font-weight:650;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}
  .sv-tab.active{color:var(--ink);border-bottom-color:#e28100}
  .sv-filters{display:flex;gap:6px;flex-wrap:wrap}
  .sv-filter{border:1px solid var(--line);background:var(--bg);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink)}
  .sv-filter.active{background:var(--ink);color:#fff;border-color:var(--ink)}
  .sv-filter span{opacity:.6;margin-left:4px}
  .sv-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid var(--line);background:var(--soft);border-radius:var(--radius-sm);padding:12px 14px;font-size:14px}
  .sv-select{font:inherit;font-size:13px;padding:7px 8px;border:1px solid var(--line);border-radius:10px;background:var(--bg);width:auto!important;max-width:130px;min-height:0!important;flex:0 0 auto}
  .sv-row-actions{flex-wrap:nowrap}
  .sv-title-btn{border:0;background:none;padding:0;font:inherit;font-weight:650;color:var(--ink);cursor:pointer;text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:inherit}
  .sv-title-btn:hover{text-decoration:underline}
  .sv-link{border:0;background:none;padding:0;font:inherit;font-size:13px;color:var(--muted);cursor:pointer;text-decoration:underline}
  .find-tabs-wrap{margin:0 0 20px}
  /* Inside Find the section header replaces legacy page titles/eyebrows and marketing blurbs. */
  .find-legacy .page-head .eyebrow,.find-legacy .page-head h1,.find-legacy .intel-intro{display:none!important}
  .find-legacy .page-head{padding-top:0!important;border-bottom:0!important;margin-bottom:8px!important}
  .radar-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  @media (max-width:860px){.sv-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.sv-head h1{font-size:26px}}
  @media (max-width:560px){.sv-tabs{gap:0}.sv-tab{flex:1 1 0;min-width:0;padding:10px 4px;font-size:13px;line-height:1.25;text-align:center;white-space:normal}.sv-row{grid-template-columns:1fr}.sv-row-actions{justify-content:flex-start;flex-wrap:wrap}.sv-row-title{white-space:normal}}
  `
  document.head.appendChild(s)
}

// ---------------------------------------------------------------- shared data
const STAGES = [
  ['watching', 'Watching'],
  ['analysed', 'Analysed'],
  ['verify', 'Verify'],
  ['negotiating', 'Negotiating'],
  ['bought', 'Bought']
]
const stageOf = o => o.status === 'ready' || o.status === 'analysing' ? 'analysed' : o.status
const REC = { strong_buy: ['Strong buy', 'good'], buy: ['Buy', 'good'], negotiate: ['Negotiate', 'warn'], verify_first: ['Verify first', 'warn'], skip: ['Skip', 'bad'] }

function latestAnalysis(state, oppId) {
  return (state.analyses || []).find(a => a.opportunity_id === oppId) || null
}

function prefillAnalyse(o, label = 'your pipeline') {
  const raw = o.raw_listing || {}
  const plat = String(o.source_platform || '').replace('facebook_marketplace', 'facebook')
  const payload = {
    title: o.listing_title || '', price: o.seller_asking_price, currency: (o.currency || 'AUD').toUpperCase(),
    url: o.source_url || '', platform: ['facebook', 'depop', 'ebay', 'gumtree', 'vinted'].includes(plat) ? plat : '',
    location: cleanLocation(o.listing_location), seller: o.seller_name || '', condition: raw.condition || '',
    description: o.listing_text || '', source_label: label,
    shipping_cost: raw.shipping_cost ?? ''
  }
  try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify(payload)) } catch {}
  go('analyse')
  window.dispatchEvent(new CustomEvent('flippers:analyse-prefill'))
}

async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done) } catch { toast('Could not copy — select and copy the text manually.') }
}

function offerMessage(o, a) {
  const offer = n(a?.recommended_offer)
  const title = o.listing_title || 'the item'
  return offer ? `Hi! Is ${title} still available? Would you take $${Math.round(offer)}? I can pick up quickly and pay straight away.` : ''
}

// Next action for a pipeline item: always something the app can actually do now.
// v0.151: Verify / Negotiate / Buy open the deal panel (deal-flow-v151.js).
function nextAction(o, a) {
  const stage = stageOf(o)
  const hasPanel = !!window.flippersDeal
  if (stage === 'bought') return { label: 'View in Stock', kind: 'stock' }
  if (!a) return { label: 'Analyse', kind: 'analyse' }
  const agreed = n(o.raw_listing?.deal?.agreed_price)
  if (agreed !== null && hasPanel) return { label: 'Record purchase', kind: 'deal' }
  if (hasPanel && window.flippersDeal.isRetail?.(o) && a.recommendation !== 'skip') return { label: 'Buy it', kind: 'deal' }
  if (stage === 'verify' || a.recommendation === 'verify_first') {
    if (hasPanel) return { label: 'Verify with seller', kind: 'deal' }
    return a.seller_message ? { label: 'Copy seller questions', kind: 'copy-seller' } : { label: 'Re-analyse', kind: 'analyse' }
  }
  if (stage === 'negotiating' || a.recommendation === 'negotiate') {
    if (hasPanel && n(a.max_buy) !== null) return { label: 'Negotiate', kind: 'deal' }
    return offerMessage(o, a) ? { label: `Copy offer (${money(a.recommended_offer)})`, kind: 'copy-offer' } : { label: 'Re-analyse', kind: 'analyse' }
  }
  if (['buy', 'strong_buy'].includes(a.recommendation)) return hasPanel ? { label: 'Buy it', kind: 'deal' } : { label: 'Open listing', kind: 'open' }
  return { label: 'Re-analyse', kind: 'analyse' }
}

async function runAction(kind, o, a) {
  if (kind === 'deal') return window.flippersDeal?.open(o.id)
  if (kind === 'stock') return go('inventory')
  if (kind === 'analyse') return prefillAnalyse(o)
  if (kind === 'open') { if (o.source_url) window.open(o.source_url, '_blank', 'noopener'); return }
  if (kind === 'copy-seller') return copy(a.seller_message, 'Seller questions copied — paste them into your chat with the seller.')
  if (kind === 'copy-offer') return copy(offerMessage(o, a), 'Offer message copied — paste it to the seller.')
}

// ---------------------------------------------------------------- TODAY
function todayView(root, api) {
  const { state } = api
  const meta = state.session?.user?.user_metadata || {}
  // Only greet by name when a real name is set — never by email prefix.
  const emailPrefix = String(state.session?.user?.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const notEmail = v => v && String(v).toLowerCase().replace(/[^a-z0-9]/g, '') !== emailPrefix
  const rawName = [state.bundle?.profile?.display_name, meta.name, meta.full_name].find(notEmail) || ''
  const name = rawName ? rawName.split(/[._\s-]/)[0].replace(/^./, c => c.toUpperCase()) : ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const portfolio = state.bundle?.portfolio || {}
  const active = (state.opps || []).filter(o => !o.dismissed_at && ['watching', 'analysing', 'ready', 'verify', 'negotiating'].includes(o.status))
  const potential = active.reduce((sum, o) => { const p = n(latestAnalysis(state, o.id)?.expected_profit); return p && p > 0 ? sum + p : sum }, 0)

  // Action queue: pipeline items with a concrete next step, then stock that needs selling work.
  const actions = []
  for (const o of active) {
    const a = latestAnalysis(state, o.id)
    if (!a) continue
    const act = nextAction(o, a)
    if (act.kind === 'analyse') continue
    actions.push({ o, a, act, when: o.updated_at })
  }
  const stock = (state.inventory || []).filter(i => ['purchased', 'preparing', 'ready_to_list'].includes(i.status))
  const actionRows = actions.slice(0, 5).map(({ o, a, act }, i) => {
    const [rl, rc] = REC[a.recommendation] || ['Analysed', '']
    return `<div class="sv-row"><div class="sv-row-main"><div class="sv-row-title">${esc(o.listing_title || a.identified_name || 'Item')}</div>
      <div class="sv-row-sub"><span class="sv-chip ${rc}">${esc(rl)}</span>${n(a.expected_profit) !== null ? `<span>Profit ${money(a.expected_profit)}</span>` : ''}${n(o.seller_asking_price) !== null ? `<span>Ask ${money(o.seller_asking_price)}</span>` : ''}</div></div>
      <div class="sv-row-actions"><button class="button primary" data-today-act="${i}">${esc(act.label)}</button></div></div>`
  })
  const stockRows = stock.slice(0, 3).map(i => `<div class="sv-row"><div class="sv-row-main"><div class="sv-row-title">${esc(i.title || 'Stock item')}</div>
      <div class="sv-row-sub"><span class="sv-chip">${esc(String(i.status).replace(/_/g, ' '))}</span><span>Cost ${money(i.purchase_price)}</span></div></div>
      <div class="sv-row-actions"><button class="button secondary" data-stock-open="${esc(i.id)}">Plan the sale</button></div></div>`)

  root.innerHTML = `
    <section class="sv-head"><div><span class="eyebrow">${esc(greeting)}${name ? `, ${esc(name)}` : ''}</span><h1>Today</h1><p>Your best opportunities and what needs doing next.</p></div></section>
    <section class="sv-drop"><div><strong>Found something?</strong><p>Drop in listing screenshots and FlippersAI tells you whether it's worth buying.</p></div><button class="button primary" data-shell-go="analyse">Analyse a listing</button></section>
    <section class="sv-section" id="todayRadar"></section>
    <section class="sv-section"><div class="sv-section-head"><h2>Needs your action</h2>${actions.length ? '<button class="button secondary" data-shell-go="pipeline">Open pipeline</button>' : ''}</div>
      ${actionRows.length || stockRows.length ? `<div class="sv-list">${actionRows.join('')}${stockRows.join('')}</div>` : `<div class="sv-empty"><strong>Nothing waiting on you.</strong> Analyse a listing or pick one of the flips above — anything you save shows up here with its next step.</div>`}
    </section>
    <section class="sv-section"><div class="sv-section-head"><h2>Your numbers</h2><button class="button secondary" data-nav-legacy="capital">Capital & history</button></div>
      <div class="sv-metrics">
        <div class="sv-metric"><small>In pipeline</small><b>${active.length}</b></div>
        <div class="sv-metric"><small>Pipeline profit potential</small><b class="pos">${money(potential)}</b></div>
        <div class="sv-metric"><small>Stock at cost</small><b>${money(portfolio.inventory_at_cost || 0)}</b></div>
        <div class="sv-metric"><small>Realised profit</small><b class="pos">${money(portfolio.realized_profit || 0)}</b></div>
      </div>
    </section>`
  $$('[data-today-act]', root).forEach(b => b.onclick = () => { const x = actions[Number(b.dataset.todayAct)]; runAction(x.act.kind, x.o, x.a) })
  $$('[data-stock-open]', root).forEach(b => b.onclick = () => window.flippersDeal ? window.flippersDeal.openStock(b.dataset.stockOpen) : go('inventory'))
  mountRadar($('#todayRadar', root), true)
}

function mountRadar(el, compact) {
  if (!el) return
  const doMount = () => window.flippersRadar?.mount(el, { compact })
  if (window.flippersRadar) doMount()
  else { el.innerHTML = '<div class="sv-empty">Loading flips…</div>'; window.addEventListener('flippers:radar-ready', doMount, { once: true }) }
}

// ---------------------------------------------------------------- FIND
let findTab = 'radar'
function findTabsMarkup() {
  return `<div class="sv-tabs" id="findTabs" role="tablist">${[['radar', 'Retail flips'], ['marketplace', 'Marketplace finds'], ['community', 'Community']].map(([k, l]) => `<button class="sv-tab ${findTab === k ? 'active' : ''}" role="tab" aria-selected="${findTab === k}" data-find-tab="${k}">${l}</button>`).join('')}</div>`
}
function bindFindTabs(root) {
  $$('[data-find-tab]', root).forEach(b => b.onclick = () => { findTab = b.dataset.findTab; openFindTab() })
}
function findView(root) {
  findTab = findTab || 'radar'
  if (findTab !== 'radar') return openFindTab()
  root.innerHTML = `<section class="sv-head"><div><h1>Find</h1><p>Opportunities worth your time — from retail deals, marketplace listings and the community.</p></div></section>${findTabsMarkup()}<section class="sv-section" id="findRadar"></section>`
  bindFindTabs(root)
  mountRadar($('#findRadar', root), false)
}
// Marketplace and Community are rendered by their existing modules (website-hq, community);
// this shell adds the Find header + tabs above them.
function openFindTab() {
  if (findTab === 'radar' || window.flippersApp?.view !== 'find') { go('find'); return } // findView takes over from here
  const legacy = findTab === 'marketplace' ? $('[data-web-v086="shortlist"]') : $('.community-nav')
  legacy?.click()
  setTimeout(ensureFindChrome, 60)
}
function ensureFindChrome() {
  if (window.flippersApp?.view !== 'find' || findTab === 'radar') { $('.content.find-legacy')?.classList.remove('find-legacy'); return }
  const content = $('.content')
  if (!content || $('#findTabs', content)) return
  const wrap = document.createElement('div')
  wrap.className = 'find-tabs-wrap'
  wrap.innerHTML = `<section class="sv-head" style="margin-bottom:12px"><div><h1>Find</h1></div></section>${findTabsMarkup()}`
  content.prepend(wrap)
  bindFindTabs(wrap)
  content.classList.add('find-legacy')
}

// ---------------------------------------------------------------- PIPELINE
let pipeFilter = 'all'
let showArchived = false
async function pipelineView(root, api) {
  const { state } = api
  const all = (state.opps || [])
  const live = all.filter(o => !o.dismissed_at && !['skipped', 'expired'].includes(o.status))
  const archived = all.filter(o => o.dismissed_at || ['skipped', 'expired'].includes(o.status))
  const counts = Object.fromEntries(STAGES.map(([k]) => [k, live.filter(o => stageOf(o) === k).length]))
  // Stale = never analysed, still at first look, untouched for 3+ days (the old 18-step imports).
  const staleCut = Date.now() - 3 * 86400000
  const stale = live.filter(o => ['watching', 'analysed'].includes(stageOf(o)) && !latestAnalysis(state, o.id) && Date.parse(o.updated_at || o.created_at) < staleCut)
  const list = showArchived ? archived : live.filter(o => pipeFilter === 'all' || stageOf(o) === pipeFilter)

  const row = (o, i) => {
    const a = latestAnalysis(state, o.id)
    const scoutRec = o.raw_listing?.scout_recommendation
    const [rl, rc] = a ? (REC[a.recommendation] || ['Analysed', '']) : scoutRec ? ['Scout-rated', ''] : ['Not analysed', '']
    const act = nextAction(o, a)
    const sub = [o.source_platform && o.source_platform !== 'other' ? String(o.source_platform).replace(/_/g, ' ') : '', cleanLocation(o.listing_location), ago(o.updated_at)].filter(Boolean).join(' · ')
    return `<div class="sv-row" data-pipe="${i}"><div class="sv-row-main"><div class="sv-row-title">${a && window.flippersDeal && !showArchived ? `<button class="sv-title-btn" data-pipe-open>${esc(o.listing_title || a?.identified_name || 'Untitled item')}</button>` : esc(o.listing_title || a?.identified_name || 'Untitled item')}</div>
      <div class="sv-row-sub"><span class="sv-chip ${rc}">${esc(rl)}</span>${n(o.seller_asking_price) !== null ? `<span>Ask ${money(o.seller_asking_price)}</span>` : ''}${a && n(a.expected_profit) !== null ? `<span>Profit ${money(a.expected_profit)}</span>` : ''}${a && n(a.max_buy) !== null ? `<span>Max buy ${money(a.max_buy)}</span>` : ''}${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>
      <div class="sv-row-actions">
        ${showArchived ? `<button class="button secondary" data-pipe-restore>Restore</button>` : `
        <select class="sv-select" data-pipe-stage aria-label="Stage">${STAGES.filter(([k]) => k !== 'bought' || stageOf(o) === 'bought').map(([k, l]) => `<option value="${k}" ${stageOf(o) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="button primary" data-pipe-act>${esc(act.label)}</button>
        <button class="sv-link" data-pipe-archive title="Hide from pipeline (can be restored)">Archive</button>`}
      </div></div>`
  }

  root.innerHTML = `
    <section class="sv-head"><div><h1>Pipeline</h1><p>Everything you're considering, from first look to purchase. Each item shows its next step.</p></div>
      <button class="button primary" data-shell-go="analyse">Analyse a listing</button></section>
    ${stale.length && !showArchived ? `<div class="sv-banner"><span><strong>${stale.length}</strong> older item${stale.length === 1 ? ' has' : 's have'} no full analysis and ${stale.length === 1 ? "hasn't" : "haven't"} been touched in 3+ days.</span><button class="button secondary" id="archiveStale">Archive them</button></div>` : ''}
    <div class="sv-filters">
      ${showArchived ? '' : [['all', 'All', live.length], ...STAGES.map(([k, l]) => [k, l, counts[k]])].map(([k, l, c]) => `<button class="sv-filter ${pipeFilter === k ? 'active' : ''}" data-pipe-filter="${k}">${l}<span>${c}</span></button>`).join('')}
      <button class="sv-filter ${showArchived ? 'active' : ''}" id="toggleArchived">${showArchived ? '← Back to pipeline' : `Archived<span>${archived.length}</span>`}</button>
    </div>
    ${list.length ? `<div class="sv-list">${list.map(row).join('')}</div>` : `<div class="sv-empty">${showArchived ? 'Nothing archived.' : '<strong>Nothing here yet.</strong> Analyse a listing and press <em>Save to Pipeline</em>, or save a flip from Find.'}</div>`}`

  $$('[data-pipe-filter]', root).forEach(b => b.onclick = () => { pipeFilter = b.dataset.pipeFilter; pipelineView(root, api) })
  $('#toggleArchived', root).onclick = () => { showArchived = !showArchived; pipelineView(root, api) }
  $('#archiveStale', root)?.addEventListener('click', async e => {
    e.currentTarget.disabled = true
    await archive(stale.map(o => o.id), true)
    toast(`Archived ${stale.length} items. Find them under Archived.`)
    await api.refresh()
  })
  $$('[data-pipe]', root).forEach(el => {
    const o = list[Number(el.dataset.pipe)]
    const a = latestAnalysis(state, o.id)
    $('[data-pipe-act]', el)?.addEventListener('click', () => runAction(nextAction(o, a).kind, o, a))
    $('[data-pipe-open]', el)?.addEventListener('click', () => window.flippersDeal?.open(o.id))
    $('[data-pipe-archive]', el)?.addEventListener('click', async () => { await archive([o.id], true); toast('Archived.'); await api.refresh() })
    $('[data-pipe-restore]', el)?.addEventListener('click', async () => { await archive([o.id], false); toast('Restored to pipeline.'); await api.refresh() })
    $('[data-pipe-stage]', el)?.addEventListener('change', async e => {
      const stage = e.target.value
      const status = stage === 'analysed' ? 'ready' : stage
      const { error } = await supabase.from('opportunities').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id)
      if (error) { toast(`Could not update: ${error.message}`); return }
      toast(`Moved to ${STAGES.find(([k]) => k === stage)?.[1]}.`)
      await api.refresh()
    })
  })
}

// Archive = hide from pipeline (dismissed_at) and pause any guided workflow; fully reversible.
async function archive(ids, on) {
  const now = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const patch = on ? { dismissed_at: now, updated_at: now } : { dismissed_at: null, status: 'watching', updated_at: now }
    const { error } = await supabase.from('opportunities').update(patch).in('id', chunk)
    if (error) { toast(`Could not archive: ${error.message}`); return }
    await supabase.from('flip_workflows').update({ status: on ? 'paused' : 'active', updated_at: now }).in('opportunity_id', chunk).in('status', on ? ['active'] : ['paused'])
  }
}

// ---------------------------------------------------------------- Analyse → Save to Pipeline
const STATUS_FOR_REC = { strong_buy: 'ready', buy: 'ready', negotiate: 'negotiating', verify_first: 'verify', skip: 'skipped' }
async function saveAnalysisToPipeline(button) {
  const payload = window.__flippersLastAuditedAnalysis
  const x = payload?.analysis
  const form = $('#newDeal')
  if (!x || !form) { toast('Run an analysis first.'); return }
  button.disabled = true
  button.textContent = 'Saving…'
  try {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) throw new Error('Sign in to save.')
    const f = new FormData(form)
    const url = String(f.get('url') || '').trim()
    const plat = String(f.get('platform') || '')
    const now = new Date().toISOString()
    const opp = {
      user_id: user.id, source_platform: plat === 'facebook' ? 'facebook_marketplace' : (plat || 'other'), source_url: url || null,
      listing_title: String(f.get('title') || x.identified_name || '').trim() || null,
      listing_text: String(f.get('description') || '').trim() || null,
      seller_asking_price: n(f.get('price')), currency: String(f.get('currency') || 'AUD') || 'AUD',
      listing_location: String(f.get('location') || '').trim() || null, seller_name: String(f.get('seller') || '').trim() || null,
      raw_listing: { condition: String(f.get('condition') || '') || null, size: String(f.get('size') || '') || null, colour: String(f.get('colour') || '') || null, brand: String(f.get('brand') || '') || null, shipping_cost: n(f.get('shipping_cost')) ?? n(x.acquisition_shipping_cost), saved_from: 'analyse' },
      status: STATUS_FOR_REC[x.recommendation] || 'ready', is_saved: true, saved_at: now, updated_at: now
    }
    let oppId = null
    if (url) {
      const { data: existing } = await supabase.from('opportunities').select('id').eq('user_id', user.id).eq('source_url', url).limit(1)
      oppId = existing?.[0]?.id || null
    }
    if (oppId) {
      const { error } = await supabase.from('opportunities').update({ ...opp, dismissed_at: null }).eq('id', oppId)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('opportunities').insert(opp).select('id').single()
      if (error) throw error
      oppId = data.id
    }
    const { error: aErr } = await supabase.from('analyses').insert({
      opportunity_id: oppId, user_id: user.id, engine_version: x.engine_version || 'analyse-listing-v2',
      identified_name: x.identified_name || opp.listing_title || '', brand: x.brand || '', model: x.model || '', variant: x.variant || '', category: x.category || '',
      identification_confidence: x.identification_confidence ?? null, resale_low: x.resale_low ?? null, resale_mid: x.resale_mid ?? null, resale_high: x.resale_high ?? null,
      quick_sale_value: x.quick_sale_value ?? null, sell_time_low_days: x.sell_time_low_days ?? null, sell_time_mid_days: x.sell_time_mid_days ?? null, sell_time_high_days: x.sell_time_high_days ?? null,
      valuation_confidence: x.valuation_confidence ?? null, overall_score: x.overall_score ?? x.opportunity_score ?? null, overall_risk: x.overall_risk ?? null,
      recommendation: x.recommendation || null, recommended_offer: x.recommended_offer ?? null, max_buy: x.max_buy ?? null, break_even_sale_price: x.break_even_sale_price ?? null,
      expected_selling_costs: x.expected_selling_costs ?? null, expected_profit: x.expected_profit ?? null, expected_roi_percent: x.expected_roi_percent ?? null, quick_sale_profit: x.quick_sale_profit ?? null,
      next_action: x.next_action || null, questions_to_ask: x.questions_to_ask || [], inspection_checks: x.inspection_checks || [], risks: x.risks || {}, assumptions: x.assumptions || [],
      evidence_summary: x.evidence_summary || '', raw_model_output: payload, action_summary: x.action_summary || '', action_steps: x.action_steps || [], action_cautions: x.action_cautions || [],
      seller_message: x.seller_message || '', photo_findings: x.photo_findings || [], user_overrides: { asking_price: opp.seller_asking_price, shipping_cost: opp.raw_listing.shipping_cost },
      seller_confidence: x.seller_confidence ?? null, seller_confidence_label: x.seller_confidence_label ?? null, seller_confidence_reason: x.seller_confidence_reason ?? null,
      seller_signals: x.seller_signals || {}, overall_confidence: x.overall_confidence ?? null
    })
    if (aErr) throw aErr
    // v0.151: keep the listing screenshots with the item so a later seller-reply re-check has the evidence.
    const shots = $('#manualEvidenceInput')?.files
    if (shots?.length && window.flippersDeal?.uploadImages) {
      try { await window.flippersDeal.uploadImages(oppId, shots) } catch (e) { console.warn('[FlippersAI] screenshots not stored', e); toast('Saved — but the screenshots could not be stored with it.') }
    }
    button.textContent = 'Saved · Open Pipeline'
    button.disabled = false
    button.onclick = () => go('pipeline')
    toast('Saved to your pipeline.')
    window.flippersApp?.refresh?.({ render: false })
  } catch (e) {
    button.disabled = false
    button.textContent = 'Save to Pipeline'
    toast(`Could not save: ${e?.message || e}`)
  }
}
function ensureSaveButton() {
  const result = $('#directAnalysisResult')
  if (!result || result.classList.contains('direct-analysis-loading') || result.classList.contains('direct-analysis-error')) return
  if ($('[data-save-pipeline]', result) || !window.__flippersLastAuditedAnalysis?.analysis) return
  const holder = $('.analyse-new-item-actions', result)
  if (!holder) return
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'button primary'
  b.dataset.savePipeline = '1'
  b.textContent = 'Save to Pipeline'
  b.onclick = () => saveAnalysisToPipeline(b)
  holder.prepend(b)
}

// ---------------------------------------------------------------- wiring
// Defensive: a preserved top bar from an older session state may carry disabled buttons.
function reenableNav() {
  $$('.topbar button:disabled, .mobile-nav button:disabled').forEach(b => { b.disabled = false })
}

function syncNavActive() {
  const view = window.flippersApp?.view
  if (!view) return
  $$('.desktop-nav-item[data-nav],.mobile-nav-item[data-nav]').forEach(b => {
    const on = b.dataset.nav === view
    b.classList.toggle('active', on)
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
  })
}

document.addEventListener('click', e => {
  const goBtn = e.target.closest?.('[data-shell-go]')
  if (goBtn) { e.preventDefault(); if (goBtn.dataset.shellGo === 'find') findTab = 'radar'; go(goBtn.dataset.shellGo); return }
  const legacy = e.target.closest?.('[data-nav-legacy]')
  if (legacy) { e.preventDefault(); go(legacy.dataset.navLegacy) }
  // Leaving Find through the top nav resets the tab so Find always opens on Retail flips.
  const nav = e.target.closest?.('[data-nav]')
  if (nav && nav.dataset.nav === 'find') findTab = 'radar'
}, true)

let t
const appEl = document.getElementById('app')
if (appEl) new MutationObserver(() => {
  clearTimeout(t)
  t = setTimeout(() => { reenableNav(); syncNavActive(); ensureFindChrome(); ensureSaveButton() }, 40)
}).observe(appEl, { childList: true, subtree: true })

styles()
window.flippersViews = { ...(window.flippersViews || {}), today: todayView, find: findView, pipeline: pipelineView }
window.flippersShell = { prefillAnalyse }
window.dispatchEvent(new CustomEvent('flippers:views-ready'))
