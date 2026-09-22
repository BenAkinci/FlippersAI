// v0.150: Deal Radar component. Exposes window.flippersRadar.mount(container, { compact })
// used by Find > Radar (full) and Today (compact, top 3). No longer attaches to Intel.
// Reads qualified deals written by the deal-radar Edge Function (radar_deals,
// RLS: authenticated read of qualified rows only). "Check now" calls the
// function, which rate-limits itself server-side. Every control does real work.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $ = (s, r = document) => r.querySelector(s)
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v))
const pct = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v))}%`
const WINDOW_HOURS = 72
const MIN_GAP_MIN = 45
// True only while the daily pg_cron job (migration 20260922090000) is enabled.
const SCHEDULE_ENABLED = true
const BASIS = { sold: 'Sold prices', active: 'Active listings', estimate: 'Estimate', none: 'No evidence' }

let state = { deals: null, lastRun: null, error: '', polling: false, loading: false, unavailable: false }

function ago(iso) {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

function nextScheduled() {
  // pg_cron runs daily at 22:00 UTC = 8am Melbourne (9am during daylight saving).
  return 'daily at 8am'
}

function injectStyles() {
  if ($('#dealRadarStyles')) return
  const s = document.createElement('style')
  s.id = 'dealRadarStyles'
  s.textContent = `
  .radar{margin:0 0 28px;display:flex;flex-direction:column;gap:14px}
  .radar-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .radar-head h2{margin:4px 0 4px;font-size:22px;letter-spacing:-.01em}
  .radar-head p{margin:0;color:var(--muted);font-size:14px;line-height:1.45;max-width:620px}
  .radar-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:13px}
  .radar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .radar-card{border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}
  .radar-card h3{margin:0;font-size:16px;line-height:1.3;overflow-wrap:anywhere}
  .radar-sub{margin:2px 0 0;color:var(--muted);font-size:13px;overflow-wrap:anywhere}
  .radar-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .radar-metrics div{background:var(--soft);border-radius:var(--radius-sm);padding:8px 10px;min-width:0}
  .radar-metrics small{display:block;color:var(--muted);font-size:11px;letter-spacing:.02em}
  .radar-metrics b{display:block;font-size:15px;margin-top:2px;white-space:nowrap}
  .radar-metrics .pos{color:var(--green)}
  .radar-chips{display:flex;gap:6px;flex-wrap:wrap}
  .radar-chip{font-size:12px;padding:3px 8px;border-radius:999px;background:var(--soft);color:var(--muted);border:1px solid var(--line)}
  .radar-chip.good{background:var(--green-soft);color:var(--green);border-color:transparent}
  .radar-chip.warn{background:var(--amber-soft);color:var(--amber);border-color:transparent}
  .radar-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
  .radar-actions .button{flex:1 1 auto;justify-content:center}
  .radar-card details{font-size:13px;color:var(--ink)}
  .radar-card summary{cursor:pointer;color:var(--muted)}
  .radar-card details ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
  .radar-card details a{color:inherit;overflow-wrap:anywhere}
  .radar-card details p{margin:8px 0 0;line-height:1.45}
  .radar-empty{border:1px dashed var(--line);border-radius:var(--radius);padding:20px;color:var(--muted);font-size:14px;line-height:1.5}
  .radar-empty strong{color:var(--ink)}
  @media (max-width:520px){.radar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.radar-actions .button{flex:1 1 100%}}
  `
  document.head.appendChild(s)
}

function card(d, i) {
  const basisClass = d.resale_basis === 'sold' ? 'good' : 'warn'
  const posted = d.posted_at ? ago(d.posted_at) : ''
  const sub = [d.store, posted && `posted ${posted}`].filter(Boolean).join(' · ')
  const risks = (Array.isArray(d.risks) ? d.risks : []).slice(0, 2)
  const evidence = (Array.isArray(d.evidence) ? d.evidence : []).filter(e => /^https?:\/\//.test(e?.url || ''))
  return `<article class="radar-card" data-radar-index="${i}">
    <div><h3>${esc(d.product_name || d.title)}</h3>${sub ? `<p class="radar-sub">${esc(sub)}</p>` : ''}</div>
    <div class="radar-metrics">
      <div><small>Buy</small><b>${money(d.buy_price)}</b></div>
      <div><small>Resale</small><b>${money(d.resale_mid)}</b></div>
      <div><small>Profit</small><b class="pos">${money(d.expected_profit)}</b></div>
      <div><small>ROI</small><b>${pct(d.roi_percent)}</b></div>
    </div>
    <div class="radar-chips">
      <span class="radar-chip ${basisClass}">${esc(BASIS[d.resale_basis] || 'Evidence')}</span>
      <span class="radar-chip">${esc(`${d.confidence ?? 0}% confidence`)}</span>
      ${d.demand && d.demand !== 'unknown' ? `<span class="radar-chip">${esc(`${d.demand[0].toUpperCase()}${d.demand.slice(1)} demand`)}</span>` : ''}
      ${risks.map(r => { const t = String(r); const short = t.length > 48 ? `${t.slice(0, 46).replace(/[\s,;:.—-]+\S*$/, '')}…` : t; return `<span class="radar-chip warn" title="${esc(t)}">${esc(short)}</span>` }).join('')}
    </div>
    <details><summary>Evidence and maths</summary>
      <ul>
        <li>Resale range ${money(d.resale_low)}–${money(d.resale_high)} · selling costs ${money(d.selling_costs)}${d.buy_shipping ? ` · delivery ${money(d.buy_shipping)}` : ''}</li>
        <li>Max buy for target profit: ${money(d.max_buy)}${d.sell_time_days ? ` · typical sell time ~${esc(d.sell_time_days)} days` : ''}</li>
        ${evidence.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.source || 'Source')}</a>${e.price_aud ? ` — ${money(e.price_aud)}` : ''}${e.kind ? ` (${esc(e.kind)})` : ''}</li>`).join('')}
      </ul>
      ${d.summary ? `<p>${esc(d.summary)}</p>` : ''}
    </details>
    <div class="radar-actions">
      <button type="button" class="button primary" data-radar-analyse="${i}">Analyse</button>
      <a class="button secondary" href="${esc(d.store_url || d.source_url)}" target="_blank" rel="noopener noreferrer">Open deal</a>
    </div>
  </article>`
}

function runLine() {
  const r = state.lastRun
  if (!r) return 'Not checked yet'
  if (isRunning(r)) return 'Checking deals now…'
  if (r.status === 'running') return `Last check did not finish (${ago(r.started_at)})`
  const s = r.stats || {}
  const when = ago(r.finished_at || r.started_at)
  if (r.status === 'error') return `Last check failed ${when}`
  return `Last checked ${when}${Number.isFinite(s.fetched) ? ` · ${s.fetched} deals scanned, ${s.evaluated ?? 0} price-checked` : ''}${SCHEDULE_ENABLED ? ` · checks ${nextScheduled()}` : ''}`
}

const STALE_RUN_MS = 5 * 60000
const isRunning = r => r?.status === 'running' && Date.now() - Date.parse(r.started_at) < STALE_RUN_MS

function canCheck() {
  const r = state.lastRun
  if (state.polling || isRunning(r)) return false
  if (!r || r.status === 'error') return true
  return Date.now() - Date.parse(r.started_at) > MIN_GAP_MIN * 60000
}

function body() {
  if (state.error) return `<div class="radar-empty"><strong>Deal Radar couldn't load.</strong> ${esc(state.error)}</div>`
  if (state.deals === null) return `<div class="radar-empty">Loading today's flips…</div>`
  if (!state.deals.length && (state.polling || isRunning(state.lastRun))) return `<div class="radar-empty"><strong>Checking the latest deals…</strong> This takes about 2 minutes. Results appear here automatically.</div>`
  if (!state.deals.length) {
    if (!state.lastRun) return `<div class="radar-empty"><strong>Deal Radar hasn't run yet.</strong> It checks Australian retail deals against current resale prices and only shows items with a real profit margin.</div>`
    return `<div class="radar-empty"><strong>Nothing passed the profit bar in the last ${WINDOW_HOURS} hours.</strong> Radar only shows deals where resale evidence supports at least A$25 or 20% profit after fees. Meanwhile, use Analyse on any listing you find.</div>`
  }
  return `<div class="radar-grid">${state.deals.map(card).join('')}</div>`
}

let mountEl = null
let compact = false

function render() {
  const el = mountEl
  if (!el || !el.isConnected) return
  injectStyles()
  if (state.unavailable) { el.innerHTML = ''; return }
  el.classList.add('radar')
  const check = canCheck()
  const r = state.lastRun
  const checkTitle = check ? 'Check the latest deals now (takes about 2 minutes)' : (state.polling || isRunning(r)) ? 'A check is running' : `Checked ${ago(r?.started_at)} — available again ${MIN_GAP_MIN} minutes after the last check`
  if (compact) {
    const top = (state.deals || []).slice(0, 3)
    el.innerHTML = `<div class="radar-head"><div><h2>Best flips right now</h2><p>${esc(runLine())}</p></div><button type="button" class="button secondary" data-shell-go="find">See all</button></div>
      ${state.deals === null ? '<div class="radar-empty">Loading…</div>' : top.length ? `<div class="radar-grid">${top.map(card).join('')}</div>` : `<div class="radar-empty"><strong>No flips passed the profit bar in the last ${WINDOW_HOURS} hours.</strong> Radar checks again daily at 8am.</div>`}`
  } else {
    el.innerHTML = `<div class="radar-head"><div><h2>Retail flips</h2><p>New Australian retail deals checked against resale prices. Only items with evidence of real profit after fees appear here.</p></div>
      <div class="radar-meta"><span>${esc(runLine())}</span><button type="button" class="button secondary" id="radarCheck" ${check ? '' : 'disabled'} title="${esc(checkTitle)}">${state.polling || isRunning(r) ? 'Checking…' : 'Check now'}</button></div></div>
      ${body()}`
  }
  el.querySelector('#radarCheck')?.addEventListener('click', checkNow)
  el.querySelectorAll('[data-radar-analyse]').forEach(b => b.addEventListener('click', () => analyse(state.deals[Number(b.dataset.radarAnalyse)])))
}

async function load() {
  if (state.loading) return
  state.loading = true
  try {
    const { data: session } = await supabase.auth.getSession()
    if (!session?.session) { state.deals = []; state.error = 'Sign in to see Deal Radar.'; return }
    const since = new Date(Date.now() - WINDOW_HOURS * 3600000).toISOString()
    const [deals, runs] = await Promise.all([
      supabase.from('radar_deals').select('*').gte('checked_at', since).order('expected_profit', { ascending: false }).limit(24),
      supabase.from('radar_runs').select('*').order('started_at', { ascending: false }).limit(1)
    ])
    if (deals.error) throw deals.error
    const now = Date.now()
    state.deals = (deals.data || []).filter(d => !d.expires_at || Date.parse(d.expires_at) > now).slice(0, 12)
    state.lastRun = runs.data?.[0] || null
    state.error = ''
  } catch (e) {
    if (/does not exist|schema cache|relation/i.test(String(e?.message))) state.unavailable = true
    state.error = e?.message || 'Please refresh and try again.'
    state.deals = []
  } finally {
    state.loading = false
    render()
  }
}

async function checkNow() {
  if (!canCheck()) return
  state.polling = true
  render()
  try {
    const { data, error } = await supabase.functions.invoke('deal-radar', { body: { trigger: 'manual' } })
    if (error || data?.ok === false) throw new Error(data?.error || error?.message || 'Check failed')
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 10000))
      const { data: runs } = await supabase.from('radar_runs').select('*').order('started_at', { ascending: false }).limit(1)
      state.lastRun = runs?.[0] || state.lastRun
      if (!isRunning(state.lastRun)) break
      render()
    }
  } catch (e) {
    state.error = e?.message || 'Check failed'
  } finally {
    state.polling = false
    state.deals = null
    render()
    await load()
  }
}

function analyse(d) {
  if (!d) return
  const payload = {
    title: d.product_name || d.title,
    price: d.buy_price,
    currency: 'AUD',
    url: d.store_url || d.source_url,
    platform: 'other',
    condition: 'New (retail purchase)',
    shipping_cost: d.buy_shipping ?? '',
    extra_info: `Retail deal${d.store ? ` from ${d.store}` : ''} found by Deal Radar: ${d.title} (${d.source_url})`,
    source_label: 'Deal Radar'
  }
  try { sessionStorage.setItem('flippers:analyse-prefill', JSON.stringify(payload)) } catch {}
  document.querySelector('[data-nav="analyse"]')?.click()
  window.dispatchEvent(new CustomEvent('flippers:analyse-prefill'))
}

// Public API: mount into any container. Data is fetched once and cached for 5 minutes.
let loadedAt = 0
window.flippersRadar = {
  mount(container, opts = {}) {
    mountEl = container
    compact = Boolean(opts.compact)
    render()
    if (!loadedAt || Date.now() - loadedAt > 5 * 60000) { loadedAt = Date.now(); state.deals = null; render(); load() }
  },
  get deals() { return state.deals }
}
window.dispatchEvent(new CustomEvent('flippers:radar-ready'))
