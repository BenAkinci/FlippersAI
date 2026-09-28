// v0.155: eBay finds — the user's own sourcing channel.
//
// Retail flips are shared with every FlippersAI user, so the good ones go fast. This is the
// opposite: the user says what they are hunting, and FlippersAI works out what that product
// actually sells for on eBay AU right now and shows the listings sitting well below it.
// Two people hunting different things never collide, and a search nobody else has run is a
// market nobody else is watching.
//
// Every number comes from the ebay-comps Edge Function, which cites real listings. It is
// honest about its limit: eBay's public API exposes ACTIVE listings, not sold prices, so the
// median is what people are ASKING. That is said on screen rather than buried.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v))
const MAX_SAVED = 12

let state = { query: '', result: null, error: '', busy: false, saved: [], loadedSaved: false }
let mountEl = null

function styles() {
  if ($('#ebayFindsStyles')) return
  const s = document.createElement('style')
  s.id = 'ebayFindsStyles'
  s.textContent = `
  .ef{display:flex;flex-direction:column;gap:16px}
  .ef-head h2{margin:4px 0 4px;font-size:22px;letter-spacing:-.01em}
  .ef-head p{margin:0;color:var(--muted);font-size:14px;line-height:1.45;max-width:640px}
  .ef-form{display:flex;gap:8px;flex-wrap:wrap}
  .ef-form input{flex:1 1 280px;min-width:0;font:inherit;font-size:15px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--bg);color:var(--ink)}
  .ef-saved{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--muted)}
  .ef-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--bg);border-radius:999px;padding:4px 6px 4px 11px;font-size:12.5px;color:var(--ink);cursor:pointer}
  .ef-chip button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:50%}
  .ef-chip button:hover{color:var(--ink)}
  .ef-market{border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;background:var(--soft)}
  .ef-market b{color:var(--ink)}
  .ef-market small{display:block;margin-top:6px;color:var(--muted);font-size:12.5px;line-height:1.5}
  .ef-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .ef-card{border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}
  .ef-card h3{margin:0;font-size:15px;line-height:1.35;overflow-wrap:anywhere}
  .ef-nums{display:flex;gap:8px;flex-wrap:wrap}
  .ef-nums div{background:var(--soft);border-radius:var(--radius-sm);padding:8px 10px;flex:1 1 90px;min-width:0}
  .ef-nums small{display:block;color:var(--muted);font-size:11px}
  .ef-nums b{display:block;font-size:15px;margin-top:2px;white-space:nowrap}
  .ef-nums b.good{color:var(--green)}
  .ef-tags{display:flex;gap:6px;flex-wrap:wrap}
  .ef-tag{font-size:12px;padding:3px 8px;border-radius:999px;background:var(--soft);color:var(--muted);border:1px solid var(--line)}
  .ef-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
  .ef-actions .button{flex:1 1 auto;justify-content:center}
  .ef-empty{border:1px dashed var(--line);border-radius:var(--radius);padding:20px;color:var(--muted);font-size:14px;line-height:1.55}
  .ef-empty strong{color:var(--ink)}
  @media (max-width:520px){.ef-actions .button{flex:1 1 100%}}
  `
  document.head.appendChild(s)
}

async function uid() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id || null
}

async function loadSaved() {
  if (state.loadedSaved) return
  state.loadedSaved = true
  const id = await uid()
  if (!id) return
  const { data } = await supabase.from('profiles').select('ebay_searches').eq('id', id).maybeSingle()
  state.saved = Array.isArray(data?.ebay_searches) ? data.ebay_searches : []
  render()
}

async function writeSaved(list) {
  state.saved = list
  render()
  const id = await uid()
  if (id) await supabase.from('profiles').update({ ebay_searches: list.length ? list : null }).eq('id', id)
}

async function run(q) {
  const query = String(q || '').trim()
  if (!query || state.busy) return
  state.query = query
  state.busy = true
  state.error = ''
  state.result = null
  render()
  try {
    const { data, error } = await supabase.functions.invoke('ebay-comps', { body: { mode: 'underpriced', query } })
    if (error) throw new Error(data?.error || error.message || 'Could not reach eBay just now.')
    if (data?.ok === false) throw new Error(data.error || 'Could not reach eBay just now.')
    state.result = data
    // Only remember searches that actually returned a usable market.
    if (data?.enough_for_a_market_view !== false && !state.saved.includes(query)) {
      writeSaved([query, ...state.saved].slice(0, MAX_SAVED))
      return
    }
  } catch (e) {
    state.error = e?.message || 'Something went wrong.'
  } finally {
    state.busy = false
    render()
  }
}

// Hand a candidate to Analyse exactly as a pasted listing would arrive, so the full
// economics, verdict and workflow apply - this screen never pretends to be an analysis.
function analyse(c) {
  if (!c) return
  const payload = {
    title: c.title,
    price: c.price_aud,
    currency: 'AUD',
    url: c.url,
    platform: 'ebay',
    condition: c.condition || '',
    shipping_cost: c.shipping_aud ?? '',
    extra_info: `Found by FlippersAI on eBay AU at ${money(c.price_aud)}, ${c.percent_below_median}% below the ${money(state.result?.median)} median asking price across ${state.result?.listings ?? 0} comparable listings for "${state.query}".`,
    source_label: 'eBay finds'
  }
  try { sessionStorage.setItem('flippers:analyse-prefill', JSON.stringify(payload)) } catch {}
  window.flippersApp?.route('analyse')
  window.dispatchEvent(new CustomEvent('flippers:analyse-prefill'))
}

function card(c, i) {
  return `<article class="ef-card">
    <h3>${esc(c.title)}</h3>
    <div class="ef-nums">
      <div><small>Asking</small><b>${money(c.price_aud)}</b></div>
      <div><small>Below market</small><b class="good">${esc(String(c.percent_below_median))}%</b></div>
      ${c.shipping_aud ? `<div><small>Postage</small><b>${money(c.shipping_aud)}</b></div>` : ''}
    </div>
    <div class="ef-tags">${c.condition ? `<span class="ef-tag">${esc(c.condition)}</span>` : ''}<span class="ef-tag">Asking prices, not sold</span></div>
    <div class="ef-actions">
      <button type="button" class="button primary" data-ef-analyse="${i}">Analyse</button>
      <a class="button secondary" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open on eBay</a>
    </div>
  </article>`
}

function body() {
  if (state.busy) return `<div class="ef-empty">Checking what <strong>${esc(state.query)}</strong> sells for on eBay AU, then looking for listings below it…</div>`
  if (state.error) return `<div class="ef-empty"><strong>That search didn't work.</strong> ${esc(state.error)}</div>`
  const r = state.result
  if (!r) return `<div class="ef-empty"><strong>Search for something you know.</strong> A specific product works best — "Nintendo Switch OLED", "Dyson V15 Detect", "LEGO 10497". FlippersAI works out what it actually goes for on eBay AU, then shows you the listings priced well under that.</div>`
  if (r.enough_for_a_market_view === false) return `<div class="ef-empty"><strong>Not enough comparable listings for "${esc(state.query)}".</strong> ${esc(r.note || '')} Try the exact model name or set number.</div>`
  const cands = r.candidates || []
  const market = `<div class="ef-market"><b>${money(r.median)}</b> is the typical asking price for <b>${esc(state.query)}</b> on eBay AU right now, from ${r.listings} comparable listing${r.listings === 1 ? '' : 's'} (${money(r.low)}–${money(r.high)}).
    <small>These are asking prices, not sold prices — items usually sell for less than they are listed at, so treat the gap as a lead, not a profit. ${r.dropped_as_irrelevant ? `${Object.values(r.dropped_as_irrelevant).reduce((a, b) => a + b, 0)} accessories, bundles and unrelated listings were filtered out.` : ''} Analyse checks each one properly.</small></div>`
  if (!cands.length) return `${market}<div class="ef-empty"><strong>Nothing is priced unusually low right now.</strong> Everything on eBay AU for this is sitting near the market. Save the search and come back — mispriced listings appear and disappear within hours.</div>`
  return `${market}<div class="ef-list">${cands.map(card).join('')}</div>`
}

function render() {
  const el = mountEl
  if (!el || !el.isConnected) return
  styles()
  el.classList.add('ef')
  el.innerHTML = `
    <div class="ef-head"><h2>eBay finds</h2><p>Your own sourcing channel. Tell FlippersAI what you're hunting and it finds eBay Australia listings priced well below what that product normally goes for. Nobody else sees your searches.</p></div>
    <form class="ef-form" id="efForm"><input id="efQuery" type="search" placeholder="Nintendo Switch OLED" value="${esc(state.query)}" autocomplete="off"><button class="button primary" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? 'Looking…' : 'Find underpriced'}</button></form>
    ${state.saved.length ? `<div class="ef-saved"><span>Recent:</span>${state.saved.map(q => `<span class="ef-chip" data-ef-run="${esc(q)}">${esc(q)}<button type="button" data-ef-forget="${esc(q)}" aria-label="Remove ${esc(q)}">×</button></span>`).join('')}</div>` : ''}
    ${body()}`

  $('#efForm', el).onsubmit = e => { e.preventDefault(); run($('#efQuery', el).value) }
  $$('[data-ef-run]', el).forEach(c => c.addEventListener('click', e => {
    if (e.target.hasAttribute('data-ef-forget')) return
    run(c.dataset.efRun)
  }))
  $$('[data-ef-forget]', el).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation()
    writeSaved(state.saved.filter(q => q !== b.dataset.efForget))
  }))
  $$('[data-ef-analyse]', el).forEach(b => b.addEventListener('click', () => analyse((state.result?.candidates || [])[Number(b.dataset.efAnalyse)])))
}

function mount(el) {
  mountEl = el
  render()
  loadSaved()
}

window.flippersEbay = { mount }
window.dispatchEvent(new CustomEvent('flippers:ebay-ready'))
