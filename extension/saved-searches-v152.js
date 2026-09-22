// v0.152 Auto Scan controls in the side panel. Lives outside #app (which app.js re-renders) as a small
// button + sheet. All actions go to auto-scan-v152.js in the service worker.
const $ = (s, r = document) => r.querySelector(s)
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const send = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra }).then(r => { if (!r?.ok) throw new Error(r?.error || 'Something went wrong'); return r.data })
const ago = iso => { if (!iso) return 'never'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago` }
const PLATFORM = { facebook: 'Facebook', ebay: 'eBay', gumtree: 'Gumtree', depop: 'Depop' }

function styles() {
  if ($('#as152Styles')) return
  const s = document.createElement('style')
  s.id = 'as152Styles'
  s.textContent = `
  .as152-fab{position:fixed;right:12px;bottom:12px;z-index:60;border:1px solid #f0c9a0;background:#fff8ef;color:#7a4a00;border-radius:999px;padding:8px 13px;font:600 12.5px/1 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.08)}
  .as152-sheet{position:fixed;inset:auto 0 0 0;max-height:82vh;overflow:auto;z-index:61;background:#fff;border-top:1px solid #e6e8eb;border-radius:16px 16px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.14);padding:16px;font:14px/1.45 system-ui,-apple-system,sans-serif;color:#15181c}
  .as152-sheet h3{margin:0 0 4px;font-size:16px}.as152-sheet p{margin:0 0 12px;color:#667;font-size:13px}
  .as152-row{border:1px solid #e6e8eb;border-radius:12px;padding:10px 12px;margin:0 0 8px}
  .as152-row b{display:block;font-size:14px}.as152-row small{display:block;color:#667;font-size:12px;margin-top:2px}
  .as152-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .as152-btn{border:1px solid #e6e8eb;background:#fff;border-radius:9px;padding:6px 10px;font:600 12.5px system-ui,sans-serif;cursor:pointer;color:#15181c}
  .as152-btn.primary{background:#e28100;border-color:#e28100;color:#fff}
  .as152-btn:disabled{opacity:.5;cursor:default}
  .as152-add{display:flex;flex-direction:column;gap:8px;border:1px dashed #e6e8eb;border-radius:12px;padding:10px 12px;margin:0 0 12px}
  .as152-add input,.as152-add select{font:inherit;font-size:13px;padding:7px 9px;border:1px solid #e6e8eb;border-radius:9px}
  .as152-close{position:absolute;right:12px;top:12px;border:1px solid #e6e8eb;background:#fff;border-radius:9px;width:30px;height:30px;cursor:pointer}
  .as152-err{color:#8a1f1f;font-size:12.5px}`
  document.head.appendChild(s)
}

async function currentSearch() {
  const tab = await send('FLIPPERS_GET_MARKETPLACE_TAB')
  const scan = await chrome.runtime.sendMessage({ type: 'FLIPPERS_SCAN_COLLECTION_ACTIVE' })
  if (!scan?.ok || scan.data?.mode !== 'collection') throw new Error('Open a search results page on Facebook Marketplace, eBay, Gumtree or Depop first (not a single listing).')
  return { url: tab.url, label: scan.data.query || `${PLATFORM[tab.platform] || tab.platform} search` }
}

async function render(sheet) {
  let data
  try { data = await send('FLIPPERS_AUTOSCAN_LIST') } catch (e) { sheet.innerHTML = `<p class="as152-err">${esc(e.message)}</p>`; return }
  const list = data.searches || []
  sheet.innerHTML = `<button class="as152-close" aria-label="Close">×</button>
    <h3>Auto scan</h3>
    <p>FlippersAI re-checks these searches every few hours while Chrome is open, rates only new listings, and puts good ones in FlippersAI → Find → Marketplace finds. You'll get a notification when it finds something.</p>
    <div class="as152-add"><div><b>Save the search you're on</b><small style="display:block;color:#667">Open a Marketplace/eBay/Gumtree/Depop search results page, then save it here.</small></div>
      <div id="as152Form" hidden><input id="as152Label" placeholder="Name"><select id="as152Every"><option value="3">Every 3 hours</option><option value="6" selected>Every 6 hours</option><option value="12">Every 12 hours</option><option value="24">Once a day</option></select></div>
      <div class="as152-actions"><button class="as152-btn primary" id="as152Add">${list.length >= data.limits.max ? `Limit of ${data.limits.max} reached` : 'Save this search'}</button></div><div class="as152-err" id="as152AddErr"></div></div>
    ${list.length ? list.map(s => {
      const r = s.last_result
      const res = !r ? 'Not run yet' : r.ok ? `${r.found} listings · ${r.fresh} new · <b style="display:inline;color:${r.good ? '#135c33' : 'inherit'}">${r.good} worth a look</b>` : `<span class="as152-err">${esc(r.error)}</span>`
      return `<div class="as152-row" data-id="${esc(s.id)}"><b>${esc(s.label)}</b><small>${esc(PLATFORM[s.platform] || s.platform)} · every ${s.every_hours}h · last run ${ago(s.last_run)}${s.enabled ? '' : ' · paused'}</small><small>${res}</small>
        <div class="as152-actions"><button class="as152-btn" data-run>Run now</button><button class="as152-btn" data-toggle>${s.enabled ? 'Pause' : 'Resume'}</button><button class="as152-btn" data-open>Open</button><button class="as152-btn" data-remove>Remove</button></div></div>`
    }).join('') : '<p>No saved searches yet.</p>'}`
  $('.as152-close', sheet).onclick = () => sheet.remove()
  const add = $('#as152Add', sheet)
  add.disabled = list.length >= data.limits.max
  add.onclick = async () => {
    const err = $('#as152AddErr', sheet); err.textContent = ''
    const form = $('#as152Form', sheet)
    try {
      if (form.hidden) { const cur = await currentSearch(); form.hidden = false; form.dataset.url = cur.url; $('#as152Label', sheet).value = cur.label; add.textContent = 'Save'; return }
      add.disabled = true
      await send('FLIPPERS_AUTOSCAN_ADD', { url: form.dataset.url, label: $('#as152Label', sheet).value, everyHours: Number($('#as152Every', sheet).value) })
      render(sheet)
    } catch (e) { err.textContent = e.message; add.disabled = false }
  }
  sheet.querySelectorAll('.as152-row').forEach(row => {
    const id = row.dataset.id, s = list.find(x => x.id === id)
    $('[data-remove]', row).onclick = async () => { await send('FLIPPERS_AUTOSCAN_REMOVE', { id }); render(sheet) }
    $('[data-toggle]', row).onclick = async () => { await send('FLIPPERS_AUTOSCAN_TOGGLE', { id, enabled: !s.enabled }); render(sheet) }
    $('[data-open]', row).onclick = () => chrome.tabs.create({ url: s.url })
    $('[data-run]', row).onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Scanning… (about a minute)'
      try { await send('FLIPPERS_AUTOSCAN_RUN', { id }) } catch (x) { alert(x.message) }
      render(sheet)
    }
  })
}

function open() {
  styles()
  let sheet = $('.as152-sheet')
  if (!sheet) { sheet = document.createElement('div'); sheet.className = 'as152-sheet'; document.body.appendChild(sheet) }
  sheet.innerHTML = '<p>Loading…</p>'
  render(sheet)
}

styles()
const fab = document.createElement('button')
fab.className = 'as152-fab'
fab.textContent = 'Auto scan'
fab.onclick = open
document.body.appendChild(fab)
