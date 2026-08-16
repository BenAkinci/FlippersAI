import { api } from './api.js'
import { CONFIG, STEP_NAMES, MARKETPLACE_LABELS } from './config.js'

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const arr = v => Array.isArray(v) ? v : []
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const pct = v => v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`
const app = $('#app')
const mode = document.body.dataset.mode || 'side'
const params = new URLSearchParams(location.search)

const state = {
  session: null,
  user: null,
  bundle: null,
  view: params.get('workflow') ? 'work' : 'scan',
  scan: null,
  focusWorkflowId: params.get('workflow') || null,
  focusOpportunityId: params.get('opportunity') || null,
  opps: [],
  inventory: [],
  sales: [],
  saleListings: [],
  analyses: [],
  compact: false,
  busy: false,
  temp: {}
}

const icons = {
  spark:'<path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Z"/>',
  scan:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6M8 11h6"/>',
  deals:'<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/>',
  box:'<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  compact:'<path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>',
  web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
  camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1-2h6l1 2"/><circle cx="12" cy="13" r="4"/>',
  logout:'<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  wallet:'<path d="M3 7h16v12H3z"/><path d="M3 9V5h13v2"/><path d="M15 12h6v4h-6a2 2 0 0 1 0-4Z"/>',
  refresh:'<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6 8a7 7 0 0 1 12-2l2 6M18 16a7 7 0 0 1-12 2l-2-6"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>'
}
const icon = (name, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`

function toast(message) {
  $('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2400)
}

function busy(on) {
  state.busy = on
  document.body.classList.toggle('busy', on)
  $$('button').forEach(b => { b.disabled = on })
}

function friendlyStatus(status = '') {
  return ({ watching:'Watching', analysing:'Analysing', ready:'Ready', verify:'Verify', negotiating:'Negotiating', bought:'Bought', skipped:'Skipped', expired:'Expired', purchased:'Bought', preparing:'Preparing', ready_to_list:'Ready to list', listed:'Listed', sale_agreed:'Sale agreed', packed:'Packed', shipped:'Shipped', delivered:'Delivered', sold:'Sold', returned:'Returned', written_off:'Written off' })[status] || String(status).replaceAll('_', ' ')
}

function statusClass(status = '') {
  if (['sold','ready','bought','purchased','delivered'].includes(status)) return 'green'
  if (['verify','negotiating','preparing','sale_agreed','packed','shipped'].includes(status)) return 'amber'
  if (['skipped','returned','written_off'].includes(status)) return 'red'
  return ''
}

function recommendationLabel(rec = '') {
  return ({ strong_buy:'Strong buy', buy:'Buy', negotiate:'Negotiate', verify_first:'Verify first', skip:'Skip' })[rec] || String(rec).replaceAll('_', ' ')
}
function recommendationClass(rec = '') {
  if (rec === 'skip') return 'bad'
  if (rec === 'verify_first' || rec === 'negotiate') return 'warn'
  return 'good'
}

function structureText(value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { intro:'', choices:[], steps:[], paragraphs:[] }
  const markers = [...clean.matchAll(/(?:^|\s)\(([A-Z]|\d+)\)\s*/g)]
  if (markers.length >= 2) {
    let intro = clean.slice(0, markers[0].index ?? 0).trim().replace(/[,:;\s]+$/, '')
    intro = intro.replace(/\bPlease either$/i, 'Please provide one of the following')
    const choices = [], steps = []
    markers.forEach((m, i) => {
      const start = (m.index || 0) + m[0].length
      const end = i + 1 < markers.length ? (markers[i + 1].index || clean.length) : clean.length
      const item = clean.slice(start, end).replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim()
      if (!item) return
      if (/^\d+$/.test(m[1])) steps.push(item)
      else choices.push(item)
    })
    return { intro, choices, steps, paragraphs:[] }
  }
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x => x.trim()).filter(Boolean) || []
  if (clean.length > 320 && sentences.length >= 3) return { intro:sentences.shift(), choices:[], steps:[], paragraphs:sentences }
  return { intro:clean, choices:[], steps:[], paragraphs:[] }
}

function structuredCopy(value) {
  const p = structureText(value)
  return `<div class="decision-structured">${p.intro ? `<p>${esc(p.intro)}</p>` : ''}${p.choices.length ? `<div class="copy-section"><span>What to provide</span><ul>${p.choices.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${p.steps.length ? `<div class="copy-section"><span>What FlippersAI will do next</span><ul>${p.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${p.paragraphs.length ? `<div class="copy-section"><ul>${p.paragraphs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>`
}

async function boot() {
  const compact = await chrome.storage.local.get('flippers_compact')
  state.compact = Boolean(compact.flippers_compact)
  document.body.classList.toggle('compact', state.compact)
  state.session = await api.getSession()
  if (!state.session) return renderAuth()
  try {
    state.user = await api.getUser()
    await refresh()
  } catch {
    renderAuth()
  }
}

function renderAuth() {
  app.innerHTML = `<div class="auth-shell"><div class="auth-card"><div class="brand"><span class="brand-mark">${icon('spark',17)}</span><span>FlippersAI</span></div><h1>Your marketplace, now readable by AI.</h1><p>Connect once, then FlippersAI can scan the authenticated listing you are actually viewing instead of relying on a blocked public URL.</p><div class="form-stack"><button class="button primary full" id="connectWebsite">Connect from FlippersAI website</button><div class="auth-divider"><span>or sign in here</span></div><form id="extensionLogin" class="form-stack"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button secondary full">Sign in</button></form><button class="text-button" id="openWebsiteAuth">Open FlippersAI website</button></div></div></div>`

  $('#connectWebsite').onclick = async () => {
    busy(true)
    try {
      const result = await chrome.runtime.sendMessage({ type:'FLIPPERS_IMPORT_WEBSITE_SESSION', openWhenMissing:false })
      if (!result?.ok) throw new Error(result?.error || 'Could not connect to the website.')
      if (!result.data?.found) {
        await chrome.runtime.sendMessage({ type:'FLIPPERS_IMPORT_WEBSITE_SESSION', openWhenMissing:true })
        return toast('Sign in on the website, then click Connect again.')
      }
      await api.importSession(result.data.session)
      state.session = await api.getSession()
      state.user = await api.getUser()
      await refresh()
    } catch (error) { toast(error.message) } finally { busy(false) }
  }
  $('#extensionLogin').onsubmit = async e => {
    e.preventDefault(); busy(true)
    const f = new FormData(e.currentTarget)
    try {
      await api.signIn(String(f.get('email')).trim(), String(f.get('password')))
      state.session = await api.getSession(); state.user = await api.getUser(); await refresh()
    } catch (error) { toast(error.message) } finally { busy(false) }
  }
  $('#openWebsiteAuth').onclick = () => chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE' })
}

async function refresh() {
  busy(true)
  try {
    const [bundle, opps, inventory, sales, listings, analyses] = await Promise.all([
      api.workflowState(),
      api.select('opportunities', 'select=*&order=updated_at.desc&limit=250'),
      api.select('inventory_items', 'select=*&order=updated_at.desc&limit=250'),
      api.select('sales', 'select=*&order=sold_at.desc&limit=250'),
      api.select('sale_listings', 'select=*&order=updated_at.desc&limit=250'),
      api.select('analyses', 'select=*&order=analysed_at.desc&limit=400')
    ])
    state.bundle = bundle
    state.opps = opps || []
    state.inventory = inventory || []
    state.sales = sales || []
    state.saleListings = listings || []
    state.analyses = analyses || []
    if (!state.focusWorkflowId && state.focusOpportunityId) state.focusWorkflowId = workflowForOpportunity(state.focusOpportunityId)?.id || null
    render()
  } catch (error) {
    app.innerHTML = `<div class="auth-shell"><div class="auth-card"><h1>Could not load FlippersAI</h1><p>${esc(error.message)}</p><button class="button primary full" id="retry">Retry</button></div></div>`
    $('#retry').onclick = refresh
  } finally { busy(false) }
}

function workflowForOpportunity(id) {
  return arr(state.bundle?.workflows).find(w => w.opportunity_id === id) || null
}
function workflowForInventory(id) {
  return arr(state.bundle?.workflows).find(w => w.inventory_item_id === id || w.inventory_items?.id === id) || null
}
function focusedWorkflow() {
  const list = arr(state.bundle?.workflows)
  if (state.focusWorkflowId) {
    const w = list.find(x => x.id === state.focusWorkflowId)
    if (w) return w
  }
  return state.bundle?.primary_workflow || list[0] || null
}
function latestAnalysis(opportunityId) {
  return state.analyses.find(a => a.opportunity_id === opportunityId) || null
}

function render() {
  if (!state.session) return renderAuth()
  if (state.view === 'scan') return scanPage()
  if (state.view === 'deals') return dealsPage()
  if (state.view === 'inventory') return inventoryPage()
  if (state.view === 'work') return workPage()
  state.view = 'scan'; scanPage()
}

function shell(content) {
  const active = state.view === 'work' ? 'deals' : state.view
  app.innerHTML = `<div class="ext-shell"><header class="ext-top"><div class="brand"><span class="brand-mark">${icon('spark',16)}</span><span class="brand-name">FlippersAI</span></div><span class="top-spacer"></span><button class="top-icon" id="compactToggle" title="${state.compact ? 'Show more detail' : 'Compact view'}">${icon(state.compact ? 'expand' : 'compact',16)}</button>${mode === 'side' ? `<button class="top-icon primary-lite" id="expandWorkspace" title="Expand workspace">${icon('expand',16)}</button>` : ''}<button class="top-icon" id="openWebsite" title="Open website">${icon('web',16)}</button><button class="top-icon" id="logout" title="Disconnect extension">${icon('logout',16)}</button></header><nav class="ext-nav"><button data-view="scan" class="${active === 'scan' ? 'active' : ''}">${icon('scan',14)} Scan</button><button data-view="deals" class="${active === 'deals' ? 'active' : ''}">${icon('deals',14)} Deals</button><button data-view="inventory" class="${active === 'inventory' ? 'active' : ''}">${icon('box',14)} Inventory</button></nav><main class="ext-main">${content}</main></div>`
  $$('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; state.temp = {}; render() })
  $('#compactToggle').onclick = async () => { state.compact = !state.compact; document.body.classList.toggle('compact', state.compact); await chrome.storage.local.set({ flippers_compact:state.compact }); render() }
  $('#expandWorkspace')?.addEventListener('click', () => chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WORKSPACE', workflowId:state.focusWorkflowId, opportunityId:state.focusOpportunityId }))
  $('#openWebsite').onclick = () => chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE', workflowId:state.focusWorkflowId, opportunityId:state.focusOpportunityId })
  $('#logout').onclick = async () => { await api.signOut(); state.session = null; state.bundle = null; renderAuth() }
}

function scanPage() {
  if (!state.scan) {
    shell(`<section class="page-head"><div><span class="eyebrow">BROWSER SCOUT</span><h1>Scan the listing you can see</h1><p>FlippersAI reads the rendered, logged-in marketplace page — including details the public website link cannot access.</p></div></section><div class="scan-hero"><div class="scan-hero-top"><div class="scan-icon">${icon('scan',21)}</div><div><h2>Open a marketplace listing</h2><p>Facebook Marketplace, eBay, Gumtree and Depop are supported. Stay logged in normally, then scan.</p></div></div><button class="button primary" id="scanCurrent">Scan current listing ${icon('arrow',15)}</button></div><div class="notice">The extension reads the listing in your browser session. Profile management, finances, resets, category administration and other account controls remain on the FlippersAI website.</div>`)
    $('#scanCurrent').onclick = scanCurrent
    return
  }

  const s = state.scan
  shell(`<section class="page-head"><div><span class="eyebrow">LISTING CAPTURE</span><h1>${esc(s.title || 'Review scanned listing')}</h1><p>Check the detected details before FlippersAI commits them to the Deal File.</p></div><button class="button soft small" id="rescan">${icon('refresh',13)} Rescan</button></section><div class="scan-layout"><div class="scan-hero"><div class="scan-status"><div><strong>${esc(MARKETPLACE_LABELS[s.platform] || 'Marketplace')} scan</strong><small>Authenticated browser DOM + ${arr(s.images).length} visual capture${arr(s.images).length === 1 ? '' : 's'}</small></div><span class="confidence-pill">${Math.round(Number(s.scanConfidence || 0))}% captured</span></div><div class="scan-source"><div><span>SOURCE</span><strong>Live browser</strong></div><div><span>LISTING ID</span><strong>${esc(s.listingId || 'Detected page')}</strong></div><div><span>IMAGES</span><strong>${arr(s.images).length}</strong></div></div><p>Unlike a pasted URL, this capture comes from the marketplace page after it has loaded inside your signed-in browser.</p></div><form id="scanReview" class="focused-card form-stack"><div class="form-grid"><label>Listing title<input name="title" value="${esc(s.title || '')}" required></label><label>Asking price (AUD)<input name="price" type="number" min="0" step="0.01" value="${s.askingPrice ?? ''}" placeholder="Confirm if missing"></label></div><div class="form-grid"><label>Location<input name="location" value="${esc(s.location || '')}"></label><label>Condition<input name="condition" value="${esc(s.condition || '')}"></label></div><label>Seller<input name="seller" value="${esc(s.sellerName || '')}"></label><label>Listing description / captured details<textarea name="description" class="tall">${esc(s.description || '')}</textarea></label><div class="notice good">Your click below confirms the visible title and price where present. FlippersAI will keep the raw browser capture as supporting context.</div><div class="button-row"><button class="button primary" name="destination" value="here">Analyse & continue here ${icon('arrow',14)}</button><button class="button secondary" name="destination" value="website">Analyse & open website ${icon('web',14)}</button></div></form></div>`)
  $('#rescan').onclick = scanCurrent
  $('#scanReview').onsubmit = saveScannedDeal
}

async function scanCurrent() {
  busy(true)
  try {
    const response = await chrome.runtime.sendMessage({ type:'FLIPPERS_SCAN_ACTIVE_TAB' })
    if (!response?.ok) throw new Error(response?.error || 'Could not scan this page.')
    state.scan = response.data
    render()
  } catch (error) { toast(error.message) } finally { busy(false) }
}

function dataUrlToBlob(dataUrl) {
  const [head, encoded] = String(dataUrl).split(',')
  const mime = head.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
  const binary = atob(encoded || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type:mime })
}

async function waitForWorkflow(opportunityId) {
  for (let i = 0; i < 12; i++) {
    const rows = await api.select('flip_workflows', `select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`)
    if (rows?.[0]) return rows[0]
    await new Promise(r => setTimeout(r, 180))
  }
  throw new Error('The Deal File was saved, but its workflow did not initialise yet.')
}

async function uploadScanImages(opportunityId, images, mediaType = 'listing_image') {
  const existing = await api.select('opportunity_media', `select=id&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=30`)
  let room = Math.max(0, CONFIG.maxStoredImages - (existing?.length || 0))
  let uploaded = 0
  for (const dataUrl of arr(images)) {
    if (room <= 0) break
    try {
      const blob = dataUrlToBlob(dataUrl)
      if (blob.size > 7_000_000) continue
      await api.uploadMedia(state.user.id, opportunityId, blob, mediaType, mediaType === 'seller_reply_image' ? 'seller-reply.jpg' : 'browser-listing.jpg')
      uploaded++; room--
    } catch {}
  }
  return uploaded
}

async function saveScannedDeal(e) {
  e.preventDefault(); busy(true)
  const f = new FormData(e.currentTarget)
  const destination = e.submitter?.value || 'here'
  try {
    const s = state.scan
    const title = String(f.get('title') || '').trim()
    const price = f.get('price') === '' ? null : Number(f.get('price'))
    const locationText = String(f.get('location') || '').trim()
    const condition = String(f.get('condition') || '').trim()
    const seller = String(f.get('seller') || '').trim()
    const description = String(f.get('description') || '').trim()
    const listingText = [
      description ? `Description: ${description}` : '',
      condition ? `Condition: ${condition}` : '',
      locationText ? `Location: ${locationText}` : '',
      seller ? `Seller: ${seller}` : '',
      `Authenticated browser scan (${s.capturedAt || new Date().toISOString()}):\n${String(s.visibleText || '').slice(0, 30000)}`
    ].filter(Boolean).join('\n\n')

    let opportunity = state.opps.find(o => o.source_url === s.pageUrl && o.status !== 'skipped') || null
    const rawListing = {
      browser_scan: true,
      source: 'authenticated_browser_dom',
      scan_confidence: s.scanConfidence,
      listing_id: s.listingId || null,
      condition: condition || null,
      seller_profile_url: s.sellerProfileUrl || null,
      image_urls: arr(s.imageUrls).slice(0, 14),
      captured_at: s.capturedAt,
      canonical_url: s.canonicalUrl || s.pageUrl
    }
    const row = {
      user_id: state.user.id,
      source_platform: s.platform || 'other',
      source_url: s.pageUrl,
      listing_title: title || null,
      listing_text: listingText,
      seller_asking_price: Number.isFinite(price) ? price : null,
      listing_location: locationText || null,
      seller_name: seller || null,
      currency: 'AUD',
      raw_listing: rawListing,
      updated_at: new Date().toISOString()
    }
    if (opportunity) opportunity = await api.update('opportunities', `id=eq.${opportunity.id}`, row, { single:true })
    else opportunity = await api.insert('opportunities', { ...row, status:'watching' }, { single:true })
    if (!opportunity?.id) throw new Error('Could not create the Deal File.')

    await uploadScanImages(opportunity.id, s.images)
    let workflow = workflowForOpportunity(opportunity.id) || await waitForWorkflow(opportunity.id)
    if (workflow.current_step === 'capture_listing') {
      await api.rpc('advance_flip_step', { p_workflow_id:workflow.id, p_step_key:'capture_listing', p_step_data:{ captured:true, source:'chrome_extension', scan_confidence:s.scanConfidence } })
    }

    let bundle = await api.workflowState()
    workflow = arr(bundle.workflows).find(w => w.opportunity_id === opportunity.id) || workflow
    if (workflow.current_step === 'verify_listing' && title && Number.isFinite(price)) {
      await api.update('opportunities', `id=eq.${opportunity.id}`, { listing_title:title, seller_asking_price:price, listing_location:locationText || null, user_overrides:{ asking_price:price }, updated_at:new Date().toISOString() })
      await api.rpc('advance_flip_step', { p_workflow_id:workflow.id, p_step_key:'verify_listing', p_step_data:{ asking_price:price, verified:true, source:'chrome_extension_scan_confirmation' } })
      bundle = await api.workflowState()
      workflow = arr(bundle.workflows).find(w => w.opportunity_id === opportunity.id) || workflow
    }

    state.focusWorkflowId = workflow.id
    state.focusOpportunityId = opportunity.id
    state.bundle = bundle
    await refresh()
    workflow = focusedWorkflow()
    if (workflow?.current_step === 'analyse_deal') {
      const saved = await runAnalysis(workflow)
      if (saved?.recommendation !== 'skip') await advanceRaw(workflow, { analysed:true, source:'chrome_extension' }, false)
      await refresh()
    }
    state.view = 'work'
    render()
    toast('Authenticated listing captured')
    if (destination === 'website') await chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE', workflowId:state.focusWorkflowId, opportunityId:state.focusOpportunityId })
  } catch (error) { toast(error.message) } finally { busy(false) }
}

async function runAnalysis(w, sellerUpdate = '') {
  const o = w.opportunities || state.opps.find(x => x.id === w.opportunity_id) || {}
  const a = w.latest_analysis || latestAnalysis(w.opportunity_id) || {}
  const profile = state.bundle?.profile || {}
  const portfolio = state.bundle?.portfolio || {}
  const images = await api.analysisImages(w.opportunity_id)
  const body = {
    listing_url:o.source_url || '', listing_text:o.listing_text || '',
    platform_fields:{ asking_price:o.seller_asking_price, currency:o.currency || 'AUD', asking_price_verified:o.seller_asking_price != null, asking_price_confidence:o.seller_asking_price != null ? 1 : 0, listing_title:o.listing_title, listing_location:o.listing_location, seller_name:o.seller_name, seller_rating:o.seller_rating, seller_review_count:o.seller_review_count },
    user_overrides:{ asking_price:o.seller_asking_price, currency:o.currency || 'AUD' },
    seller_update:sellerUpdate,
    prior_analysis_summary:a?.id ? JSON.stringify({ identified_name:a.identified_name, recommendation:a.recommendation, resale_mid:a.resale_mid, max_buy:a.max_buy, risks:a.risks }) : '',
    bankroll:Number(portfolio.available_cash || 0), risk_profile:profile.risk_profile || 'conservative', reserve_percent:Number(profile.capital_reserve_percent ?? 30), max_exposure_percent:Number(profile.max_single_item_exposure_percent ?? 20), portfolio_context:portfolio, images
  }
  const data = await api.invoke('analyse-listing-v2', body)
  if (data?.error) throw new Error(data.error)
  const x = data.analysis || {}
  const rec = {
    opportunity_id:w.opportunity_id, user_id:state.user.id, engine_version:data.engine_version || 'flippers-alpha-4-price-lock', identified_name:x.identified_name || '', brand:x.brand || '', model:x.model || '', variant:x.variant || '', category:x.category || '', identification_confidence:x.identification_confidence ?? 0, resale_low:x.resale_low, resale_mid:x.resale_mid, resale_high:x.resale_high, quick_sale_value:x.quick_sale_value, sell_time_low_days:x.sell_time_low_days, sell_time_mid_days:x.sell_time_mid_days, sell_time_high_days:x.sell_time_high_days, valuation_confidence:x.valuation_confidence ?? 0, overall_score:x.overall_score ?? 0, overall_risk:x.overall_risk ?? 0, recommendation:x.recommendation, recommended_offer:x.recommended_offer, max_buy:x.max_buy, break_even_sale_price:x.break_even_sale_price, expected_selling_costs:x.expected_selling_costs, expected_profit:x.expected_profit, expected_roi_percent:x.expected_roi_percent, quick_sale_profit:x.quick_sale_profit, next_action:x.next_action, questions_to_ask:x.questions_to_ask || [], inspection_checks:x.inspection_checks || [], risks:x.risks || {}, assumptions:x.assumptions || [], evidence_summary:x.evidence_summary || '', raw_model_output:x, action_summary:x.action_summary || '', action_steps:x.action_steps || [], action_cautions:x.action_cautions || [], seller_message:x.seller_message || '', photo_findings:x.photo_findings || [], photo_count:images.length, user_overrides:{ asking_price:o.seller_asking_price }, seller_confidence:x.seller_confidence ?? null, seller_confidence_label:x.seller_confidence_label ?? null, seller_confidence_reason:x.seller_confidence_reason ?? null, seller_signals:x.seller_signals || {}, overall_confidence:x.overall_confidence ?? null
  }
  const saved = await api.insert('analyses', rec, { single:true })
  if (arr(x.evidence).length && saved?.id) {
    await api.insert('evidence', arr(x.evidence).map(ev => ({ analysis_id:saved.id, user_id:state.user.id, evidence_type:ev.evidence_type, evidence_class:ev.evidence_class || 'estimated', marketplace:ev.marketplace || null, source_title:ev.source_title || null, source_url:ev.source_url || null, price:ev.price ?? null, currency:ev.currency || 'AUD', sold:ev.sold ?? null, condition_text:ev.condition_text || null, similarity_score:ev.similarity_score ?? null, match_quality:ev.match_quality || null, included:ev.included !== false, rejection_reason:ev.rejection_reason || null, metadata:{} })))
  }
  const status = x.recommendation === 'skip' ? 'skipped' : x.recommendation === 'verify_first' ? 'verify' : x.recommendation === 'negotiate' ? 'negotiating' : 'ready'
  await api.update('opportunities', `id=eq.${w.opportunity_id}`, { status, updated_at:new Date().toISOString() })
  return saved
}

async function advanceRaw(w, data = {}, refreshAfter = true) {
  await api.rpc('advance_flip_step', { p_workflow_id:w.id, p_step_key:w.current_step, p_step_data:data })
  state.focusWorkflowId = w.id
  if (refreshAfter) await refresh()
}

function decisionCard(a) {
  if (!a?.recommendation) return ''
  return `<div class="decision ${recommendationClass(a.recommendation)}"><div class="decision-head"><div><span class="decision-label">${esc(recommendationLabel(a.recommendation))}</span>${structuredCopy(a.action_summary || a.next_action || 'Deal analysed')}</div><div class="score"><strong>${Math.round(Number(a.overall_score || 0))}</strong><span>/100</span></div></div><div class="money-grid"><div><span>ASK</span><strong>${money(a.seller_asking_price)}</strong></div><div><span>RESALE</span><strong>${money(a.resale_mid)}</strong></div><div><span>PROFIT</span><strong class="${Number(a.expected_profit || 0) >= 0 ? 'positive' : 'negative'}">${money(a.expected_profit)}</strong></div><div><span>MAX BUY</span><strong>${money(a.max_buy)}</strong></div></div><details class="details"><summary>Why this result</summary><div class="details-body"><div class="metric-line"><span>Confidence <b>${pct(a.valuation_confidence)}</b></span><span>ROI <b>${pct(a.expected_roi_percent)}</b></span><span>Sell time <b>${a.sell_time_mid_days ?? '—'}d</b></span></div>${a.evidence_summary ? `<p>${esc(a.evidence_summary)}</p>` : ''}${arr(a.action_cautions).length ? `<div class="notice warn">${arr(a.action_cautions).map(x => `• ${esc(x)}`).join('<br>')}</div>` : ''}</div></details></div>`
}

function workPage() {
  const w = focusedWorkflow()
  if (!w) {
    state.view = 'deals'; return dealsPage()
  }
  state.focusWorkflowId = w.id
  state.focusOpportunityId = w.opportunity_id
  const progress = arr(w.progress)
  const done = progress.filter(p => p.state === 'completed').length
  const percent = Math.round(done / 18 * 100)
  const o = w.opportunities || {}
  const a = w.latest_analysis || latestAnalysis(w.opportunity_id) || {}
  shell(`<section class="page-head"><div><span class="eyebrow">DEAL WORKSPACE</span><h1>${esc(o.listing_title || a.identified_name || 'Deal File')}</h1><p>${esc(MARKETPLACE_LABELS[o.source_platform] || o.source_platform || 'Marketplace')} · ${money(o.seller_asking_price)}${o.listing_location ? ` · ${esc(o.listing_location)}` : ''}</p></div><button class="button secondary small" id="handoffSite">Open on website ${icon('web',12)}</button></section><div class="focused-card workflow-card"><div class="workflow-top"><span class="stage">Step ${w.current_step_order} of 18</span><span>${percent}% complete</span></div><div class="progress"><span style="width:${percent}%"></span></div><div class="next-copy"><span class="eyebrow">NEXT ACTION</span><h2>${esc(w.step?.title || STEP_NAMES[w.current_step] || 'Continue')}</h2>${structuredCopy(w.step?.instruction || w.step?.teach_instruction || '')}</div>${a.recommendation ? decisionCard(a) : ''}<div class="workflow-action">${stepAction(w)}</div><div class="workflow-footer"><button class="text-button journey-toggle" id="journeyToggle">View ${done}/18 completed</button>${w.inventory_item_id ? '' : `<button class="text-button skip" id="skipDeal">Skip this deal</button>`}</div><div id="journey" class="secondary-detail" hidden>${journeyMarkup(progress)}</div></div>`)
  $('#handoffSite').onclick = () => chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE', workflowId:w.id, opportunityId:w.opportunity_id })
  $('#journeyToggle').onclick = () => { const j = $('#journey'); j.hidden = !j.hidden }
  $('#skipDeal')?.addEventListener('click', async () => {
    if (!confirm('Skip this deal?')) return
    busy(true); try { await api.rpc('skip_flip', { p_workflow_id:w.id, p_reason:'Skipped from Chrome extension' }); state.focusWorkflowId = null; state.view = 'deals'; await refresh() } catch (error) { toast(error.message) } finally { busy(false) }
  })
  bindStep(w)
}

function journeyMarkup(progress) {
  return `<div class="list-shell" style="margin-top:10px">${progress.map(p => `<div class="list-row"><span class="status ${p.state === 'completed' ? 'green' : p.state === 'current' ? 'amber' : ''}">${p.state === 'completed' ? 'Done' : p.step_order}</span><div class="list-main"><strong>${esc(STEP_NAMES[p.step_key] || p.step_key)}</strong><small>${p.state === 'completed' ? 'Complete' : p.step_key}</small></div></div>`).join('')}</div>`
}

function questionRows(questions) {
  return `<div class="question-list">${questions.map((q, i) => `<div class="question-row" data-question><span class="question-num">${i + 1}</span><span class="question-text">${esc(q)}</span><div class="question-actions"><button class="icon-button" type="button" data-copy-q title="Copy">${icon('copy',13)}</button><button class="icon-button" type="button" data-edit-q title="Edit">${icon('edit',13)}</button></div><textarea class="question-edit">${esc(q)}</textarea></div>`).join('')}</div>`
}

function stepAction(w) {
  const k = w.current_step
  const a = w.latest_analysis || latestAnalysis(w.opportunity_id) || {}
  const o = w.opportunities || {}
  if (k === 'capture_listing') return `<div class="form-stack"><div class="notice">Scan the current marketplace tab to replace this step with a full browser capture.</div><button class="button primary full" id="workflowScan">Scan current listing ${icon('scan',14)}</button></div>`
  if (k === 'verify_listing') return `<form id="verifyStep" class="form-stack"><div class="form-grid"><label>Item title<input name="title" value="${esc(o.listing_title || a.identified_name || '')}" required></label><label>Exact asking price<input name="price" type="number" min="0" step="0.01" value="${o.seller_asking_price ?? ''}" required></label></div><label>Location<input name="location" value="${esc(o.listing_location || '')}"></label><button class="button primary">Confirm details ${icon('arrow',13)}</button></form>`
  if (k === 'analyse_deal') return `<div class="form-stack"><div class="notice">Uses the authenticated browser capture, stored screenshots, Australian sold evidence and your current bankroll.</div><button class="button primary" id="analyseNow">${a.recommendation === 'skip' ? 'Reanalyse deal' : 'Analyse deal'} ${icon('spark',14)}</button>${a.recommendation === 'skip' ? `<button class="button danger" id="analysisSkip">Skip this deal</button>` : ''}</div>`
  if (k === 'ask_seller') {
    const qs = arr(a.questions_to_ask)
    return `<div class="form-stack">${qs.length ? questionRows(qs) : `<div class="notice">No additional seller questions were generated.</div>`}<div class="button-row"><button class="button secondary" id="copyAllQuestions">${icon('copy',13)} Copy all questions</button><button class="button primary" id="questionsSent">I sent them ${icon('arrow',13)}</button></div></div>`
  }
  if (k === 'review_seller_reply') return `<form id="sellerReply" class="form-stack"><label>Seller reply<textarea name="reply" placeholder="Paste the reply here, or capture/upload a screenshot"></textarea></label><div class="button-row"><label class="upload full-mobile">${icon('camera',15)}<span><strong>Add screenshot</strong><small>PNG/JPEG/WebP</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><button type="button" class="button secondary" id="captureReply">${icon('camera',13)} Capture current tab</button></div><div id="replyCaptureState"></div><button class="button primary">Review reply with AI ${icon('spark',13)}</button></form>`
  if (k === 'negotiate') return `<div class="form-stack"><div class="offer-strip"><div><span>OPENING OFFER</span><strong>${money(a.recommended_offer)}</strong></div><div><span>HARD MAX</span><strong>${money(a.max_buy)}</strong></div></div><label>Offer message<textarea id="offerMessage">${esc(a.seller_message || `Would you take ${money(a.recommended_offer)}?`)}</textarea></label><div class="button-row"><button class="button secondary" id="copyOffer">${icon('copy',13)} Copy offer</button><button class="button primary" id="offerDone">Price agreed / continue ${icon('arrow',13)}</button></div></div>`
  if (k === 'arrange_transaction') return `<form id="arrangeStep" class="form-stack"><label>How will you receive it?<select name="method"><option value="pickup">Local pickup</option><option value="shipping">Seller ships it</option></select></label><label>Arrangement details<textarea name="details" placeholder="Time, location, payment method, shipping details"></textarea></label><button class="button primary">Arrangement confirmed ${icon('arrow',13)}</button></form>`
  if (k === 'inspect_before_buy') {
    const checks = arr(a.inspection_checks).length ? arr(a.inspection_checks) : ['Confirm exact model and included parts','Check condition against the listing','Test important functions','Check ownership or authenticity concerns']
    return `<div class="form-stack"><div class="question-list">${checks.map((q, i) => `<label class="checkbox"><input type="checkbox" class="inspect"><span>${esc(q)}</span></label>`).join('')}</div><button class="button primary" id="inspectionDone">All checks passed ${icon('arrow',13)}</button></div>`
  }
  if (k === 'record_purchase') return `<form id="purchaseStep" class="form-stack"><div class="form-grid"><label>Actual purchase price<input name="price" type="number" min="0" step="0.01" value="${o.seller_asking_price ?? ''}" required></label><label>Immediate extra costs<input name="costs" type="number" min="0" step="0.01" value="0"></label></div><button class="button primary">I bought it ${icon('arrow',13)}</button></form>`
  if (k === 'prepare_item') return `<div class="form-stack"><div id="salePlanMount"><div class="notice">Building preparation plan…</div></div><button class="button primary" id="prepDone">Item is ready to list ${icon('arrow',13)}</button></div>`
  if (k === 'create_listing') return `<div class="form-stack"><div id="salePlanMount"><div class="notice">Building listing plan…</div></div><button class="button primary" id="listingDone">Listing is ready ${icon('arrow',13)}</button></div>`
  if (k === 'publish_listing') return `<form id="publishStep" class="form-stack"><div class="form-grid"><label>Marketplace<input name="platform" placeholder="Facebook Marketplace" required></label><label>Listing price<input name="price" type="number" min="0" step="0.01" required></label></div><label>Live listing URL<input name="url" placeholder="https://..."></label><label>Minimum acceptable price<input name="minimum" type="number" min="0" step="0.01"></label><button class="button primary">Mark as listed ${icon('arrow',13)}</button></form>`
  if (k === 'manage_offers') return `<div class="form-stack"><form id="offerEval" class="form-grid"><label>Buyer offer<input name="offer" type="number" min="0" step="0.01" required></label><button class="button primary" style="align-self:end">Evaluate offer</button></form>${state.temp.offer ? `<div class="notice ${state.temp.offer.action === 'accept' ? 'good' : state.temp.offer.action === 'decline' ? 'bad' : 'warn'}"><strong>${esc(state.temp.offer.action.toUpperCase())}${state.temp.offer.counter ? ` · Counter ${money(state.temp.offer.counter)}` : ''}</strong><br>${esc(state.temp.offer.text)}</div>` : ''}<button class="button secondary" id="saleReady">Sale agreed / continue ${icon('arrow',13)}</button></div>`
  if (k === 'complete_sale') return `<form id="saleStep" class="form-stack"><div class="form-grid"><label>Platform<input name="platform" required></label><label>Agreed sale price<input name="price" type="number" min="0" step="0.01" required></label></div><div class="form-grid three"><label>Fees<input name="fees" type="number" min="0" step="0.01" value="0"></label><label>Shipping<input name="shipping" type="number" min="0" step="0.01" value="0"></label><label>Other costs<input name="other" type="number" min="0" step="0.01" value="0"></label></div><button class="button primary">Record sale agreement ${icon('arrow',13)}</button></form>`
  if (k === 'fulfil_order') return `<form id="fulfilStep" class="form-stack"><label>Fulfilment method<select name="method"><option value="shipping">Shipping</option><option value="pickup">Local pickup</option></select></label><div class="form-grid"><label>Carrier<input name="carrier" placeholder="Australia Post"></label><label>Tracking number<input name="tracking"></label></div><label>Notes<textarea name="notes"></textarea></label><button class="button primary">Order fulfilled ${icon('arrow',13)}</button></form>`
  if (k === 'confirm_delivery') return `<div class="form-stack"><div class="notice warn">Only continue once the buyer has actually received or collected the item.</div><button class="button primary" id="delivered">Buyer received the item ${icon('arrow',13)}</button></div>`
  if (k === 'confirm_funds') return `<form id="fundsStep" class="form-stack"><label>Amount actually received<input name="payout" type="number" min="0" step="0.01" value="${w.sales?.sale_price ?? ''}" required></label><button class="button primary">Funds received ${icon('arrow',13)}</button></form>`
  if (k === 'feedback_and_close') return `<form id="feedbackStep" class="form-stack"><label>Feedback / closing notes<textarea name="review" placeholder="Optional"></textarea></label><label>Rating received (optional)<input name="rating" type="number" min="1" max="5" step="0.1"></label><button class="button primary">Close this flip ${icon('check',13)}</button></form>`
  return `<button class="button primary" id="genericAdvance">Continue ${icon('arrow',13)}</button>`
}

async function copyText(value) {
  await navigator.clipboard.writeText(String(value || ''))
  toast('Copied')
}

async function bindStep(w) {
  const k = w.current_step
  $('#workflowScan')?.addEventListener('click', async () => { state.view = 'scan'; state.scan = null; render(); await scanCurrent() })
  $('#verifyStep')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget), price = Number(f.get('price'))
      await api.update('opportunities', `id=eq.${w.opportunity_id}`, { listing_title:f.get('title') || null, seller_asking_price:price, listing_location:f.get('location') || null, user_overrides:{ asking_price:price }, updated_at:new Date().toISOString() })
      await advanceRaw(w, { asking_price:price, verified:true, source:'chrome_extension' })
    } catch (error) { toast(error.message) } finally { busy(false) }
  })
  $('#analyseNow')?.addEventListener('click', async () => {
    busy(true); try { const a = await runAnalysis(w); if (a.recommendation !== 'skip') await advanceRaw(w, { analysed:true, source:'chrome_extension' }, false); await refresh() } catch (error) { toast(error.message) } finally { busy(false) }
  })
  $('#analysisSkip')?.addEventListener('click', async () => { try { await api.rpc('skip_flip', { p_workflow_id:w.id, p_reason:'AI recommended skip' }); state.view = 'deals'; state.focusWorkflowId = null; await refresh() } catch (e) { toast(e.message) } })

  $$('[data-question]').forEach(row => {
    $('[data-copy-q]', row).onclick = () => copyText($('.question-row.editing .question-edit', row)?.value || $('.question-text', row)?.textContent || '')
    $('[data-edit-q]', row).onclick = () => {
      const editing = row.classList.toggle('editing')
      const area = $('.question-edit', row), label = $('.question-text', row)
      if (!editing) label.textContent = area.value.trim() || label.textContent
      else { area.value = label.textContent.trim(); area.focus() }
    }
  })
  $('#copyAllQuestions')?.addEventListener('click', () => copyText($$('[data-question]').map(r => r.classList.contains('editing') ? $('.question-edit',r).value.trim() : $('.question-text',r).textContent.trim()).filter(Boolean).join('\n')))
  $('#questionsSent')?.addEventListener('click', async () => {
    const body = $$('[data-question]').map(r => r.classList.contains('editing') ? $('.question-edit',r).value.trim() : $('.question-text',r).textContent.trim()).filter(Boolean).join('\n')
    await api.insert('deal_messages', { user_id:state.user.id, workflow_id:w.id, direction:'outbound', counterparty_role:'seller', phase:'pre_purchase', body, source:'extension_edited' })
    await advanceRaw(w, { message_sent:true })
  })

  $('#captureReply')?.addEventListener('click', async () => {
    try {
      const r = await chrome.runtime.sendMessage({ type:'FLIPPERS_CAPTURE_VISIBLE' })
      if (!r?.ok) throw new Error(r?.error || 'Could not capture the tab.')
      state.temp.replyCapture = r.data.dataUrl
      $('#replyCaptureState').innerHTML = `<div class="notice good">Current tab screenshot captured.</div>`
    } catch (error) { toast(error.message) }
  })
  $('#sellerReply')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget), reply = String(f.get('reply') || '').trim(), files = [...(e.currentTarget.elements.images.files || [])]
      if (!reply && !files.length && !state.temp.replyCapture) throw new Error('Paste the reply or add a screenshot.')
      if (reply) await api.insert('deal_messages', { user_id:state.user.id, workflow_id:w.id, direction:'inbound', counterparty_role:'seller', phase:'pre_purchase', body:reply, source:'extension' })
      for (const file of files.slice(0, 6)) await api.uploadMedia(state.user.id, w.opportunity_id, file, 'seller_reply_image', file.name || 'seller-reply.jpg')
      if (state.temp.replyCapture) await api.uploadMedia(state.user.id, w.opportunity_id, dataUrlToBlob(state.temp.replyCapture), 'seller_reply_image', 'seller-reply-browser.jpg')
      const saved = await runAnalysis(w, reply || 'The seller reply is shown in the newly supplied screenshot. Extract and use the new seller information.')
      state.temp.replyCapture = null
      if (saved.recommendation !== 'skip') await advanceRaw(w, { seller_reply:reply || 'image supplied' }, false)
      await refresh()
    } catch (error) { toast(error.message) } finally { busy(false) }
  })

  $('#copyOffer')?.addEventListener('click', () => copyText($('#offerMessage')?.value || ''))
  $('#offerDone')?.addEventListener('click', () => advanceRaw(w, { negotiation_complete:true }))
  $('#arrangeStep')?.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await advanceRaw(w, { method:f.get('method'), details:f.get('details') }) })
  $('#inspectionDone')?.addEventListener('click', () => { if ($$('.inspect').some(x => !x.checked)) return toast('Complete every required inspection check first.'); advanceRaw(w, { inspection_passed:true }) })
  $('#purchaseStep')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget), a = w.latest_analysis || latestAnalysis(w.opportunity_id), o = w.opportunities || {}
      await api.rpc('record_purchase', { p_opportunity_id:w.opportunity_id, p_analysis_id:a.id, p_title:o.listing_title || a.identified_name || 'Purchased item', p_category:a.category || '', p_purchase_price:Number(f.get('price')), p_acquisition_costs:Number(f.get('costs') || 0) })
      toast('Purchase recorded'); await refresh()
    } catch (error) { toast(error.message) } finally { busy(false) }
  })

  if (k === 'prepare_item') { hydrateSalePlan(w, 'prepare'); $('#prepDone')?.addEventListener('click', () => advanceRaw(w, { prepared:true })) }
  if (k === 'create_listing') { hydrateSalePlan(w, 'listing'); $('#listingDone')?.addEventListener('click', () => advanceRaw(w, { listing_ready:true })) }
  if (k === 'publish_listing') {
    const plan = await makeSalePlan(w).catch(() => null)
    const pr = obj(plan?.pricing_plan), form = $('#publishStep')
    if (form && plan) { form.elements.platform.value = plan.recommended_platform || 'Facebook Marketplace'; form.elements.price.value = pr.list_price ?? ''; form.elements.minimum.value = pr.minimum_price ?? '' }
    form?.addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget), id = w.inventory_item_id || w.inventory_items?.id
      await api.insert('sale_listings', { user_id:state.user.id, inventory_item_id:id, platform:f.get('platform'), listing_url:f.get('url') || null, listing_price:Number(f.get('price')), expected_close_price:pr.expected_close_price ?? null, minimum_price:f.get('minimum') ? Number(f.get('minimum')) : pr.minimum_price ?? null, status:'active', listed_at:new Date().toISOString() })
      await api.update('inventory_items', `id=eq.${id}`, { status:'listed', updated_at:new Date().toISOString() })
      await advanceRaw(w, { published:true })
    })
  }
  $('#offerEval')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), offer = Number(f.get('offer')), id = w.inventory_item_id || w.inventory_items?.id
    const listing = state.saleListings.find(l => l.inventory_item_id === id && l.status === 'active')
    const p = await latestSalePlan(id), pr = obj(p?.pricing_plan), min = Number(listing?.minimum_price ?? pr.minimum_price ?? 0), expected = Number(listing?.expected_close_price ?? pr.expected_close_price ?? listing?.listing_price ?? 0)
    let action = 'decline', counter = null, text = `Below your minimum of ${money(min)}.`
    if (offer >= expected * .98) { action = 'accept'; text = 'At or above your expected close price. Accepting is reasonable.' }
    else if (offer >= min) { action = 'counter'; counter = Math.max(offer, Math.round(((offer + expected) / 2) / 5) * 5); text = `Profitable but below target. Counter around ${money(counter)}.` }
    state.temp.offer = { action, counter, text }
    await api.insert('offer_events', { user_id:state.user.id, inventory_item_id:id, sale_listing_id:listing?.id || null, buyer_offer:offer, recommended_action:action, recommended_counter:counter, response_text:text, metadata:{ minimum:min, expected_close:expected } })
    render()
  })
  $('#saleReady')?.addEventListener('click', () => advanceRaw(w, { offer_process_complete:true }))
  $('#saleStep')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), id = w.inventory_item_id || w.inventory_items?.id
    await api.rpc('record_sale_agreement', { p_inventory_item_id:id, p_platform:f.get('platform'), p_sale_price:Number(f.get('price')), p_selling_fees:Number(f.get('fees') || 0), p_shipping_cost:Number(f.get('shipping') || 0), p_other_costs:Number(f.get('other') || 0) })
    await refresh()
  })
  $('#fulfilStep')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), method = f.get('method'), id = w.inventory_item_id || w.inventory_items?.id
    await api.insert('fulfilments', { user_id:state.user.id, workflow_id:w.id, sale_id:w.sale_id, inventory_item_id:id, method, status:method === 'pickup' ? 'collected' : 'shipped', carrier:f.get('carrier') || null, tracking_number:f.get('tracking') || null, notes:f.get('notes') || null, shipped_at:method === 'shipping' ? new Date().toISOString() : null, collected_at:method === 'pickup' ? new Date().toISOString() : null })
    await advanceRaw(w, { method, fulfilled:true })
  })
  $('#delivered')?.addEventListener('click', async () => { await api.update('fulfilments', `workflow_id=eq.${w.id}&user_id=eq.${state.user.id}`, { status:'delivered', delivered_at:new Date().toISOString() }); await advanceRaw(w, { delivered:true }) })
  $('#fundsStep')?.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await api.rpc('record_funds_received', { p_sale_id:w.sale_id, p_payout_amount:Number(f.get('payout')) }); await refresh() })
  $('#feedbackStep')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    if (f.get('review') || f.get('rating')) await api.insert('feedback_records', { user_id:state.user.id, workflow_id:w.id, sale_id:w.sale_id, direction:'received', status:'completed', rating:f.get('rating') ? Number(f.get('rating')) : null, review_text:f.get('review') || null, completed_at:new Date().toISOString() })
    await advanceRaw(w, { feedback_complete:true })
  })
  $('#genericAdvance')?.addEventListener('click', () => advanceRaw(w, {}))
}

async function latestSalePlan(inventoryId) {
  const rows = await api.select('sale_plans', `select=*&inventory_item_id=eq.${encodeURIComponent(inventoryId)}&order=created_at.desc&limit=1`)
  return rows?.[0] || null
}
async function makeSalePlan(w) {
  const id = w.inventory_item_id || w.inventory_items?.id
  if (!id) throw new Error('Purchase must be recorded before building a sale plan.')
  const existing = await latestSalePlan(id)
  if (existing) return existing
  const data = await api.invoke('build-sale-plan', { inventory:w.inventory_items || state.inventory.find(x => x.id === id) || {}, analysis:w.latest_analysis || latestAnalysis(w.opportunity_id) || {}, opportunity:w.opportunities || state.opps.find(x => x.id === w.opportunity_id) || {}, profile:state.bundle?.profile || {} })
  if (data?.error) throw new Error(data.error)
  const x = data.plan || {}
  return api.insert('sale_plans', { user_id:state.user.id, inventory_item_id:id, recommended_platform:x.recommended_platform, platform_rankings:x.platform_rankings || [], pricing_plan:x.pricing_plan || {}, negotiation_ladder:x.negotiation_ladder || {}, shipping_plan:x.shipping_plan || {}, photo_plan:x.photo_plan || [], listing_copy:x.listing_copy || {}, preparation_checklist:x.preparation_checklist || [], next_action:x.next_action || '', engine_version:data.engine_version || 'flippers-sale-alpha-1' }, { single:true })
}

async function hydrateSalePlan(w, kind) {
  const mount = $('#salePlanMount'); if (!mount) return
  try {
    const plan = await makeSalePlan(w), price = obj(plan.pricing_plan), copy = obj(plan.listing_copy)
    if (kind === 'prepare') mount.innerHTML = `<div class="sale-plan"><div><span class="section-title">Preparation checklist</span><div class="question-list" style="margin-top:7px">${arr(plan.preparation_checklist).map(x => `<label class="checkbox"><input type="checkbox"><span>${esc(x)}</span></label>`).join('')}</div></div><div><span class="section-title">Photos to take</span><div class="number-list" style="margin-top:7px">${arr(plan.photo_plan).map((x, i) => `<div class="number-row"><span>${i + 1}</span><p>${esc(x)}</p></div>`).join('')}</div></div></div>`
    else mount.innerHTML = `<div class="sale-plan"><div class="money-grid"><div><span>LIST</span><strong>${money(price.list_price)}</strong></div><div><span>EXPECTED</span><strong>${money(price.expected_close_price)}</strong></div><div><span>MINIMUM</span><strong>${money(price.minimum_price)}</strong></div><div><span>QUICK</span><strong>${money(price.quick_sale_price)}</strong></div></div><label>Title<textarea id="listingTitleCopy">${esc(copy.title || '')}</textarea></label><button class="button secondary small" id="copyListingTitle">${icon('copy',12)} Copy title</button><label>Description<textarea class="tall" id="listingDescriptionCopy">${esc(copy.description || '')}</textarea></label><button class="button secondary small" id="copyListingDescription">${icon('copy',12)} Copy description</button><div class="notice"><strong>Recommended platform:</strong> ${esc(plan.recommended_platform || '—')}<br>${esc(price.rationale || '')}</div></div>`
    $('#copyListingTitle')?.addEventListener('click', () => copyText($('#listingTitleCopy').value))
    $('#copyListingDescription')?.addEventListener('click', () => copyText($('#listingDescriptionCopy').value))
  } catch (error) { mount.innerHTML = `<div class="notice bad">${esc(error.message)}</div>` }
}

function dealsPage() {
  const workflows = arr(state.bundle?.workflows)
  shell(`<section class="page-head"><div><span class="eyebrow">DEALS</span><h1>Your Deal Files</h1><p>Scan on the marketplace, then continue the entire buying workflow here or on the website.</p></div><button class="button primary small" id="dealScan">${icon('scan',12)} Scan listing</button></section>${workflows.length ? `<div class="list-shell">${workflows.map(w => { const o = w.opportunities || {}, a = w.latest_analysis || {}; return `<button class="list-row" style="width:100%;border-left:0;border-right:0;border-top:0;text-align:left" data-workflow="${w.id}"><span class="status ${statusClass(o.status)}">${esc(friendlyStatus(o.status || w.current_step))}</span><div class="list-main"><strong>${esc(o.listing_title || a.identified_name || 'Untitled deal')}</strong><small>Step ${w.current_step_order}/18 · ${esc(STEP_NAMES[w.current_step] || w.current_step)} · ${money(o.seller_asking_price)}</small></div>${icon('arrow',14)}</button>` }).join('')}</div>` : `<div class="empty"><strong>No active deals</strong>Scan a marketplace listing to create one.</div>`}<div style="height:14px"></div><span class="eyebrow">ALL OPPORTUNITIES</span><div class="list-shell" style="margin-top:7px">${state.opps.length ? state.opps.map(o => { const w = workflowForOpportunity(o.id), a = latestAnalysis(o.id) || {}; return `<div class="list-row"><span class="status ${statusClass(o.status)}">${esc(friendlyStatus(o.status))}</span><div class="list-main"><strong>${esc(o.listing_title || a.identified_name || 'Untitled listing')}</strong><small>${esc(MARKETPLACE_LABELS[o.source_platform] || o.source_platform || 'Marketplace')} · ${money(o.seller_asking_price)}</small></div>${w ? `<button class="icon-button" data-workflow="${w.id}">${icon('arrow',14)}</button>` : ''}</div>` }).join('') : `<div class="empty"><strong>Nothing saved yet</strong></div>`}</div>`)
  $('#dealScan').onclick = () => { state.view = 'scan'; state.scan = null; render() }
  $$('[data-workflow]').forEach(b => b.onclick = () => { state.focusWorkflowId = b.dataset.workflow; state.view = 'work'; state.temp = {}; render() })
}

function inventoryPage() {
  shell(`<section class="page-head"><div><span class="eyebrow">INVENTORY</span><h1>Buying → selling</h1><p>Operational stock is available here. Profile, finance and data administration stay on the website.</p></div><button class="button secondary small" id="inventoryWebsite">Manage on website ${icon('web',12)}</button></section>${state.inventory.length ? `<div class="list-shell">${state.inventory.map(i => { const w = workflowForInventory(i.id), sale = state.sales.find(s => s.inventory_item_id === i.id), listing = state.saleListings.find(l => l.inventory_item_id === i.id); return `<div class="list-row"><span class="status ${statusClass(i.status)}">${esc(friendlyStatus(i.status))}</span><div class="list-main"><strong>${esc(i.title || 'Inventory item')}</strong><small>Paid ${money(i.purchase_price)}${listing?.listing_price != null ? ` · Listed ${money(listing.listing_price)}` : ''}${sale?.sale_price != null ? ` · Sold ${money(sale.sale_price)}` : ''}</small></div>${w ? `<button class="icon-button" data-workflow="${w.id}">${icon('arrow',14)}</button>` : ''}</div>` }).join('')}</div>` : `<div class="empty"><strong>No inventory yet</strong>Record a purchase from a Deal File and it appears here automatically.</div>`)
  $('#inventoryWebsite').onclick = () => chrome.runtime.sendMessage({ type:'FLIPPERS_OPEN_WEBSITE' })
  $$('[data-workflow]').forEach(b => b.onclick = () => { state.focusWorkflowId = b.dataset.workflow; state.view = 'work'; render() })
}

boot()
