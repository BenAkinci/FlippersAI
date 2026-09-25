// FlippersAI side panel (extension 0.96): the website itself (always the same app as the web version)
// plus a strip of marketplace tools that only the extension can do for the page you're on.
import { api } from './api.js'
import { CONFIG } from './config.js'

const $ = (s, r = document) => r.querySelector(s)
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const SITE = new URL(CONFIG.websiteUrl)
const PLATFORM = { facebook: 'Facebook Marketplace', ebay: 'eBay', gumtree: 'Gumtree', depop: 'Depop' }
const ITEM = { facebook: /\/marketplace\/item\/\d+/i, ebay: /\/itm\//i, gumtree: /\/s-ad\//i, depop: /\/products\//i }
const ago = iso => { if (!iso) return 'never'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago` }
const send = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra }).then(r => { if (!r?.ok) throw new Error(r?.error || 'Something went wrong'); return r.data })

let tab = null, kind = 'other', platform = 'other', connected = false, busy = false

// ---------------------------------------------------------------- the website
const frame = $('#site')
frame.src = `${SITE.origin}${SITE.pathname}?ext=1`
const toSite = msg => frame.contentWindow?.postMessage(msg, SITE.origin)
frame.addEventListener('load', () => toSite({ type: 'FLIPPERS_EXT_HELLO' }))
window.addEventListener('message', e => {
  if (e.origin !== SITE.origin || e.source !== frame.contentWindow) return
  // FLIPPERS_SITE_READY is informational for now (the site handles its own sign-in).
})

// ---------------------------------------------------------------- status line
function status(text, tone = '') {
  const el = $('#status')
  if (!text) { el.hidden = true; return }
  el.hidden = false
  el.className = `px-status ${tone}`
  el.innerHTML = text
}

// ---------------------------------------------------------------- what page is the user on?
function classify(url) {
  try {
    const u = new URL(url), h = u.hostname
    platform = h.includes('facebook.com') && u.pathname.startsWith('/marketplace') ? 'facebook' : h.includes('ebay.com.au') ? 'ebay' : h.includes('gumtree.com.au') ? 'gumtree' : h.includes('depop.com') ? 'depop' : 'other'
  } catch { platform = 'other' }
  if (platform === 'other') return 'other'
  return ITEM[platform].test(url) ? 'listing' : 'results'
}

async function refreshContext() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
  tab = t || null
  kind = classify(tab?.url || '')
  connected = !!(await api.getSession().catch(() => null))
  render()
}

function render() {
  const ctx = $('#context')
  ctx.classList.toggle('live', kind !== 'other')
  $('#contextText').textContent = kind === 'listing' ? `${PLATFORM[platform]} listing` : kind === 'results' ? `${PLATFORM[platform]} results` : 'Open a listing or search on Facebook Marketplace, eBay, Gumtree or Depop'
  const a = $('#actions')
  const btns = []
  if (kind === 'listing') btns.push('<button class="px-btn primary" data-act="analyse">Analyse this listing</button>')
  if (kind === 'results') btns.push('<button class="px-btn primary" data-act="scan">Scan these results</button>', '<button class="px-btn" data-act="save">Auto scan this search</button>')
  btns.push('<button class="px-btn" data-act="autoscan">Auto scan</button>')
  a.innerHTML = btns.join('')
  a.querySelectorAll('[data-act]').forEach(b => { b.disabled = busy; b.onclick = () => act(b.dataset.act) })
  if (!connected && kind === 'results' && !busy) status('Scanning needs a one-time connection to your account. <a href="#" id="connectLink">Connect scanning</a>')
  const link = $('#connectLink'); if (link) link.onclick = e => { e.preventDefault(); connectSheet() }
}

chrome.tabs.onActivated.addListener(() => refreshContext())
chrome.tabs.onUpdated.addListener((id, info) => { if (id === tab?.id && (info.url || info.status === 'complete')) refreshContext() })
chrome.windows?.onFocusChanged?.addListener(() => refreshContext())

// ---------------------------------------------------------------- actions
async function act(name) {
  if (name === 'autoscan') return autoScanSheet()
  if ((name === 'scan' || name === 'save') && !connected) return connectSheet(name)
  if (name === 'save') return autoScanSheet(true)
  busy = true; render()
  try {
    if (name === 'analyse') {
      status('Capturing the listing…', 'busy')
      const data = await send('FLIPPERS_SCAN_ACTIVE_TAB')
      const images = (data.images || []).filter(Boolean)
      if (!images.length) throw new Error('Could not capture this listing. Scroll so the photos and price are visible, then try again.')
      toSite({ type: 'FLIPPERS_EXT_ANALYSE', payload: { url: data.pageUrl || tab?.url || '', platform, images } })
      status(`Sent ${images.length} image${images.length === 1 ? '' : 's'} to Analyse — FlippersAI is reading the listing below.`, 'good')
    }
    if (name === 'scan') {
      status('Reading the results and rating new listings… (about a minute)', 'busy')
      const { result: r } = await send('FLIPPERS_AUTOSCAN_SCAN_TAB', { tabId: tab.id })
      if (r.rated?.length) chrome.runtime.sendMessage({ type: 'FLIPPERS_ROUTE_RATING_OVERLAY', enabled: true, ratings: r.rated }).catch(() => {})
      status(r.fresh ? `${r.found} listings · ${r.fresh} new · <b>${r.good} worth a look</b>${r.good ? ' — shown below in Marketplace finds.' : '.'}` : `${r.found} listings — all already checked. Scroll further down the page and scan again for more.`, r.good ? 'good' : '')
      toSite({ type: 'FLIPPERS_EXT_GOTO', view: 'find', tab: 'marketplace' })
    }
  } catch (e) { status(esc(e.message || e), 'bad') }
  finally { busy = false; render() }
}

// ---------------------------------------------------------------- sheets
function sheet(html) {
  closeSheet()
  const back = document.createElement('div'); back.className = 'px-backdrop'; back.onclick = closeSheet
  const el = document.createElement('div'); el.className = 'px-sheet'; el.innerHTML = `<button class="px-close" aria-label="Close">×</button>${html}`
  $('.px-close', el).onclick = closeSheet
  document.body.append(back, el)
  return el
}
function closeSheet() { $('.px-sheet')?.remove(); $('.px-backdrop')?.remove() }

function connectSheet(then) {
  const el = sheet(`<h3>Connect scanning</h3><p>Scanning and Auto scan run in the background, so the extension needs its own sign-in (once). Use your FlippersAI email and password.</p>
    <label>Email<input id="cEmail" type="email" autocomplete="email"></label>
    <label>Password<input id="cPass" type="password" autocomplete="current-password"></label>
    <div class="px-err" id="cErr"></div>
    <div class="px-actions"><button class="px-btn primary" id="cGo">Connect</button></div>`)
  $('#cGo', el).onclick = async () => {
    $('#cErr', el).textContent = ''
    try {
      await api.signIn($('#cEmail', el).value.trim(), $('#cPass', el).value)
      connected = true; closeSheet(); status('Scanning connected.', 'good'); render()
      if (then) act(then)
    } catch (e) { $('#cErr', el).textContent = e.message || 'Could not sign in.' }
  }
}

async function autoScanSheet(addCurrent = false) {
  let data
  try { data = await send('FLIPPERS_AUTOSCAN_LIST') } catch (e) { status(esc(e.message), 'bad'); return }
  const list = data.searches || []
  const canAdd = kind === 'results' && list.length < data.limits.max && !list.some(s => s.url === tab?.url)
  const el = sheet(`<h3>Auto scan</h3><p>FlippersAI re-checks these searches every few hours while Chrome is open, rates only new listings and notifies you when something's worth a look. Finds appear in Find → Marketplace finds.</p>
    ${canAdd ? `<div class="px-row"><b>Save the search you're on</b><label style="margin-top:8px">Name<input id="aLabel" value="${esc(tab?.title?.replace(/\s*[|–—-].*$/, '').slice(0, 60) || 'Marketplace search')}"></label>
      <label>How often<select id="aEvery"><option value="3">Every 3 hours</option><option value="6" selected>Every 6 hours</option><option value="12">Every 12 hours</option><option value="24">Once a day</option></select></label>
      <div class="px-err" id="aErr"></div><div class="px-actions"><button class="px-btn primary" id="aAdd">Save search</button></div></div>`
      : kind === 'results' ? '' : `<p><b>To add a search:</b> open a search results page on Facebook Marketplace, eBay, Gumtree or Depop, then tap Auto scan this search.</p>`}
    ${list.length ? list.map(s => { const r = s.last_result; const res = !r ? 'Not run yet' : r.ok ? `${r.found} listings · ${r.fresh} new · <b>${r.good} worth a look</b>` : `<span class="px-err">${esc(r.error)}</span>`
      return `<div class="px-row" data-id="${esc(s.id)}"><b>${esc(s.label)}</b><small>${esc(PLATFORM[s.platform] || s.platform)} · every ${s.every_hours}h · last run ${ago(s.last_run)}${s.enabled ? '' : ' · paused'}</small><small>${res}</small>
        <div class="px-actions"><button class="px-btn" data-run>Run now</button><button class="px-btn" data-toggle>${s.enabled ? 'Pause' : 'Resume'}</button><button class="px-btn" data-open>Open</button><button class="px-btn" data-remove>Remove</button></div></div>` }).join('') : '<p>No saved searches yet.</p>'}`)
  $('#aAdd', el)?.addEventListener('click', async () => {
    try { await send('FLIPPERS_AUTOSCAN_ADD', { url: tab.url, label: $('#aLabel', el).value, everyHours: Number($('#aEvery', el).value) }); autoScanSheet() }
    catch (e) { $('#aErr', el).textContent = e.message }
  })
  el.querySelectorAll('.px-row[data-id]').forEach(row => {
    const id = row.dataset.id, s = list.find(x => x.id === id)
    $('[data-remove]', row).onclick = async () => { await send('FLIPPERS_AUTOSCAN_REMOVE', { id }); autoScanSheet() }
    $('[data-toggle]', row).onclick = async () => { await send('FLIPPERS_AUTOSCAN_TOGGLE', { id, enabled: !s.enabled }); autoScanSheet() }
    $('[data-open]', row).onclick = () => chrome.tabs.create({ url: s.url })
    $('[data-run]', row).onclick = async e => {
      if (!connected) return connectSheet()
      e.target.disabled = true; e.target.textContent = 'Scanning… (about a minute)'
      try { await send('FLIPPERS_AUTOSCAN_RUN', { id }) } catch (x) { status(esc(x.message), 'bad') }
      autoScanSheet()
      toSite({ type: 'FLIPPERS_EXT_GOTO', view: 'find', tab: 'marketplace' })
    }
  })
  if (addCurrent && !canAdd && kind === 'results' && list.some(s => s.url === tab?.url)) status('This search is already in Auto scan.', '')
}

refreshContext()
