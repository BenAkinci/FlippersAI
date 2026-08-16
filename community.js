import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient(
  'https://msmpigerejpxepkylkxz.supabase.co',
  'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
)

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const community = { open:false, feed:null, loading:false, type:'all', mode:'live', query:'', timer:null }

const icons = {
  intel:'<path d="M4 17h3l2-8 4 11 2-7h5"/><path d="M4 4h16v16H4z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
  bookmark:'<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  spark:'<path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Z"/>',
  arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message:'<path d="M4 5h16v12H9l-5 4V5Z"/>',
  refresh:'<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 6M18 16a7 7 0 0 1-12 2l-2-6"/>'
}
const icon = (name, size = 18) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`

function toast(message) {
  $('.community-toast')?.remove()
  const el = document.createElement('div')
  el.className = 'community-toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}

function relativeTime(value) {
  if (!value) return 'unknown'
  const ms = Date.now() - new Date(value).getTime()
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function typeLabel(type) {
  return ({ restock:'Restock', release:'Release', deal:'Deal', price:'Price intel', strategy:'Strategy', availability:'Availability', other:'Intel' })[type] || 'Intel'
}

function statusInfo(status) {
  return ({
    signal:['Early signal','signal'], developing:['Developing','developing'], confirmed:['Confirmed','confirmed'],
    disputed:['Disputed','disputed'], expired:['Outdated','expired']
  })[status] || ['Signal','signal']
}

function nextLevel(stats = {}) {
  const points = Number(stats.contribution_points || 0)
  const rel = Number(stats.reliability_score || 0)
  if (points < 25) return { name:'Contributor', target:25, remaining:25-points }
  if (points < 100) return { name:'Established Contributor', target:100, remaining:100-points }
  if (points < 300 || rel < 80) return { name:'Trusted Source', target:300, remaining:Math.max(0,300-points), reliability:80 }
  if (points < 750 || rel < 85) return { name:'Expert Source', target:750, remaining:Math.max(0,750-points), reliability:85 }
  return null
}

async function invoke(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('community-intelligence', { body:{ action, ...extra } })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Community intelligence request failed')
  return data
}

async function loadFeed(force = false) {
  if (community.feed && !force) return community.feed
  if (community.loading) {
    while (community.loading) await new Promise(r => setTimeout(r, 80))
    return community.feed
  }
  community.loading = true
  try {
    community.feed = await invoke('feed', { limit:100 })
    return community.feed
  } finally {
    community.loading = false
  }
}

function makeNavButton(mobile) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `${mobile ? 'mobile-nav-item' : 'desktop-nav-item'} community-nav`
  b.innerHTML = `${icon('intel', mobile ? 21 : 17)}<span>Intel</span>`
  b.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    community.open = true
    renderCommunity()
  })
  return b
}

function injectNav() {
  const desktop = $('.desktop-nav')
  if (desktop && !$('.community-nav', desktop)) {
    const b = makeNavButton(false)
    const home = $('[data-nav="home"]', desktop)
    home ? home.after(b) : desktop.prepend(b)
  }
  const mobile = $('.mobile-nav')
  if (mobile && !$('.community-nav', mobile)) {
    const b = makeNavButton(true)
    const home = $('[data-nav="home"]', mobile)
    home ? home.after(b) : mobile.prepend(b)
  }
  if (community.open) {
    $$('.desktop-nav-item,.mobile-nav-item').forEach(x => x.classList.remove('active'))
    $$('.community-nav').forEach(x => x.classList.add('active'))
  }
  maybeInjectHomeTeaser()
}

function scheduleInject() {
  clearTimeout(community.timer)
  community.timer = setTimeout(injectNav, 30)
}

new MutationObserver(scheduleInject).observe(document.getElementById('app'), { childList:true, subtree:true })
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-nav]')) community.open = false
}, true)
scheduleInject()

async function maybeInjectHomeTeaser() {
  if (community.open || !$('.home-head') || $('#communityTeaser')) return
  const bankroll = $('.bankroll-strip')
  if (!bankroll) return
  const holder = document.createElement('section')
  holder.id = 'communityTeaser'
  holder.className = 'section-block community-teaser'
  holder.innerHTML = `<div class="section-heading"><div><span class="eyebrow">COMMUNITY INTELLIGENCE</span><h2>What resellers are finding now</h2></div><button class="text-button community-open-intel">Open Intel ${icon('arrow',15)}</button></div><div class="community-mini-grid"><div class="community-mini skeleton"></div><div class="community-mini skeleton"></div><div class="community-mini skeleton"></div></div>`
  bankroll.insertAdjacentElement('afterend', holder)
  $('.community-open-intel', holder).onclick = () => { community.open = true; renderCommunity() }
  try {
    const feed = await loadFeed()
    if (!document.body.contains(holder)) return
    const live = (feed.items || []).filter(x => !['expired'].includes(x.status)).slice(0,3)
    $('.community-mini-grid', holder).innerHTML = live.length ? live.map(item => {
      const [label, cls] = statusInfo(item.status)
      return `<button class="community-mini" data-community-item="${item.id}"><div><span class="intel-status ${cls}">${label} · ${Math.round(Number(item.confidence_score || 0))}%</span><strong>${esc(item.title)}</strong><small>${esc([item.retailer,item.location_text].filter(Boolean).join(' · ') || typeLabel(item.intel_type))}</small></div><span>${icon('arrow',17)}</span></button>`
    }).join('') : `<div class="community-mini empty"><strong>Community is ready</strong><small>Be the first to share useful reseller intel.</small></div>`
    $$('[data-community-item]', holder).forEach(b => b.onclick = () => { community.open = true; renderCommunity(b.dataset.communityItem) })
  } catch {
    $('.community-mini-grid', holder).innerHTML = `<div class="community-mini empty"><strong>Community Intel</strong><small>Open the community feed to see current signals.</small></div>`
  }
}

async function renderCommunity(focusId = null) {
  const mount = $('.content')
  if (!mount) return
  injectNav()
  mount.innerHTML = `<div class="community-loading"><span class="community-spinner"></span><p>Loading community intelligence…</p></div>`
  try {
    const feed = await loadFeed()
    if (!community.open) return
    drawCommunity(feed, focusId)
  } catch (e) {
    mount.innerHTML = `<div class="card empty-card"><h3>Community Intel could not load</h3><p>${esc(e.message)}</p><button class="button primary" id="communityRetry">Retry</button></div>`
    $('#communityRetry')?.addEventListener('click', () => { community.feed = null; renderCommunity() })
  }
}

function contributorCard(stats = {}) {
  const score = stats.reliability_score == null ? '—' : `${Math.round(Number(stats.reliability_score))}`
  const next = nextLevel(stats)
  return `<div class="intel-side-card contributor-card">
    <div class="intel-card-title">${icon('users',18)} Your community standing</div>
    <div class="standing-level">${esc(stats.contribution_level || 'Member')}</div>
    <div class="standing-stats"><div><strong>${score}</strong><span>Reliability</span></div><div><strong>${Number(stats.contribution_points || 0)}</strong><span>Contribution</span></div><div><strong>${Number(stats.supported_count || 0)}</strong><span>Supported</span></div></div>
    <p>${stats.reliability_score == null ? 'Your reliability becomes established as community reports you support are confirmed or disputed.' : `${esc(stats.reliability_label || 'Developing')} track record based on community outcomes.`}</p>
    ${next ? `<div class="next-standing"><span>Next: <strong>${esc(next.name)}</strong></span><small>${next.remaining ? `${next.remaining} contribution points to go` : `Reliability ${next.reliability}+ required`}</small></div>` : `<div class="next-standing top"><span>Top contributor tier</span><small>Your information carries a strong community track record.</small></div>`}
    <div class="community-principle">Everyone can use the community. Helping other resellers earns standing and perks; staying quiet never locks you out.</div>
  </div>`
}

function askCard() {
  return `<div class="intel-side-card ask-card"><div class="intel-card-title">${icon('spark',18)} Community AI</div><h3>Ask the community without reading the noise.</h3><p>AI answers from current community intelligence and makes uncertainty clear.</p><form id="communityAsk" class="community-ask-form"><input name="question" placeholder="e.g. Any Pokémon restocks around Melbourne?" autocomplete="off"><button class="button primary" aria-label="Ask">${icon('arrow',17)}</button></form><div id="communityAnswer"></div></div>`
}

function filteredItems(items) {
  let out = [...items]
  if (community.mode === 'live') out = out.filter(x => x.status !== 'expired')
  if (community.mode === 'confirmed') out = out.filter(x => x.status === 'confirmed')
  if (community.mode === 'signals') out = out.filter(x => ['signal','developing','disputed'].includes(x.status))
  if (community.mode === 'saved') {
    const saved = new Set(community.feed?.saved_ids || [])
    out = out.filter(x => saved.has(x.id))
  }
  if (community.type !== 'all') out = out.filter(x => x.intel_type === community.type)
  const q = community.query.trim().toLowerCase()
  if (q) out = out.filter(x => [x.title,x.summary,x.product_name,x.category,x.retailer,x.location_text].some(v => String(v || '').toLowerCase().includes(q)))
  return out
}

function drawCommunity(feed, focusId = null) {
  const mount = $('.content')
  if (!mount) return
  const items = filteredItems(feed.items || [])
  mount.innerHTML = `
    <section class="page-head community-head"><div><span class="eyebrow">FLIPPERSAI INTEL</span><h1>Community Intelligence</h1><p>People helping people — with AI turning community knowledge into a clean, trustworthy reseller feed.</p></div><button class="button primary" id="shareIntel">${icon('plus',18)} Share intel</button></section>
    <section class="intel-intro"><div><strong>No Discord overload.</strong><span>Reports are combined, confidence is visible, stale information fades, and the raw community remains underneath when you want it.</span></div></section>
    <section class="intel-overview-grid">${contributorCard(feed.my_stats)}${askCard()}</section>
    <section class="intel-feed-section">
      <div class="intel-feed-tools">
        <div class="intel-mode-tabs">${[['live','Live'],['confirmed','Confirmed'],['signals','Early signals'],['saved','Saved']].map(([v,l]) => `<button data-intel-mode="${v}" class="${community.mode === v ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div class="intel-search">${icon('search',17)}<input id="communitySearch" placeholder="Search products, retailers, locations…" value="${esc(community.query)}"></div>
      </div>
      <div class="intel-type-chips">${[['all','All'],['restock','Restocks'],['release','Releases'],['deal','Deals'],['price','Price intel'],['strategy','Strategies']].map(([v,l]) => `<button data-intel-type="${v}" class="${community.type === v ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="intel-feed-count"><span>${items.length} ${items.length === 1 ? 'item' : 'items'}</span><small>AI-organised community knowledge</small></div>
      <div class="intel-feed" id="intelFeed">${items.length ? items.map(intelCard).join('') : `<div class="intel-empty"><div>${icon('intel',26)}</div><h3>Nothing matches yet</h3><p>Change the filters or share what you know. One person can create a signal; the community can strengthen it.</p><button class="button secondary" id="shareIntelEmpty">Share intel</button></div>`}</div>
    </section>`
  bindCommunityPage()
  if (focusId) setTimeout(() => document.querySelector(`[data-intel-card="${focusId}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' }), 80)
}

function intelCard(item) {
  const [statusLabel, statusClass] = statusInfo(item.status)
  const saved = new Set(community.feed?.saved_ids || []).has(item.id)
  const retail = Number(item.retail_price)
  const resale = Number(item.resale_mid)
  const gross = Number.isFinite(retail) && Number.isFinite(resale) && retail > 0 ? resale - retail : null
  const creator = item.creator || {}
  const sourceLine = creator.contribution_level && creator.contribution_level !== 'Member' ? creator.contribution_level : 'Community member'
  return `<article class="intel-card" data-intel-card="${item.id}">
    <div class="intel-card-main">
      <div class="intel-card-top"><div class="intel-badges"><span class="intel-status ${statusClass}">${statusLabel}</span><span class="intel-type">${esc(typeLabel(item.intel_type))}</span></div><button class="intel-save ${saved ? 'saved' : ''}" data-intel-action="save" data-id="${item.id}" aria-label="${saved ? 'Unsave' : 'Save'}">${icon('bookmark',18)}</button></div>
      <div class="intel-confidence"><div><span>Community confidence</span><strong>${Math.round(Number(item.confidence_score || 0))}%</strong></div><div class="intel-confidence-track"><span style="width:${Math.max(3,Number(item.confidence_score || 0))}%"></span></div></div>
      <h2>${esc(item.title)}</h2>
      <p class="intel-summary">${esc(item.summary || '')}</p>
      <div class="intel-meta">${item.retailer ? `<span><b>Retailer</b>${esc(item.retailer)}</span>` : ''}${item.location_text ? `<span><b>Location</b>${esc(item.location_text)}</span>` : ''}${item.category ? `<span><b>Category</b>${esc(item.category)}</span>` : ''}<span><b>Updated</b>${relativeTime(item.last_activity_at)}</span></div>
      ${(item.retail_price != null || item.resale_mid != null) ? `<div class="intel-economics"><div><span>RETAIL</span><strong>${money(item.retail_price)}</strong></div><div><span>RESALE</span><strong>${money(item.resale_mid)}</strong></div><div><span>GROSS GAP</span><strong class="${gross != null && gross > 0 ? 'positive' : ''}">${gross == null ? '—' : money(gross)}</strong></div></div>` : ''}
      <div class="intel-proof"><span>${icon('check',15)} ${Number(item.confirmations_count || 0)} confirmations</span><span>${icon('alert',15)} ${Number(item.challenges_count || 0)} challenges</span><span>${icon('message',15)} ${Number(item.reports_count || 0)} community inputs</span></div>
      <div class="intel-contributor"><span>Started by ${esc(creator.display_name || sourceLine)}</span>${creator.reliability_score != null ? `<span>Reliability ${Math.round(Number(creator.reliability_score))}</span>` : `<span>Unestablished source</span>`}</div>
    </div>
    <div class="intel-actions">
      <button data-intel-action="confirm" data-id="${item.id}">${icon('check',16)} Confirm</button>
      <button data-intel-action="update" data-id="${item.id}">${icon('refresh',16)} Add update</button>
      <button data-intel-action="challenge" data-id="${item.id}">${icon('alert',16)} Challenge</button>
      <button data-intel-action="thread" data-id="${item.id}">${icon('message',16)} Sources</button>
      <button class="analyse-intel" data-intel-action="analyse" data-id="${item.id}">Analyse for me ${icon('arrow',16)}</button>
    </div>
  </article>`
}

function bindCommunityPage() {
  $('#shareIntel')?.addEventListener('click', () => openShareModal())
  $('#shareIntelEmpty')?.addEventListener('click', () => openShareModal())
  $$('[data-intel-mode]').forEach(b => b.onclick = () => { community.mode = b.dataset.intelMode; drawCommunity(community.feed) })
  $$('[data-intel-type]').forEach(b => b.onclick = () => { community.type = b.dataset.intelType; drawCommunity(community.feed) })
  $('#communitySearch')?.addEventListener('input', e => {
    community.query = e.target.value
    const list = $('#intelFeed')
    const items = filteredItems(community.feed.items || [])
    if (list) list.innerHTML = items.length ? items.map(intelCard).join('') : `<div class="intel-empty"><h3>No matches</h3><p>Try a broader search.</p></div>`
    bindIntelActions()
  })
  $('#communityAsk')?.addEventListener('submit', askCommunity)
  bindIntelActions()
}

function bindIntelActions() {
  $$('[data-intel-action]').forEach(b => b.onclick = async () => {
    const item = (community.feed?.items || []).find(x => x.id === b.dataset.id)
    if (!item) return
    const action = b.dataset.intelAction
    if (action === 'save') return toggleSave(item)
    if (action === 'confirm') return quickReport(item, 'confirm', 'I can independently confirm this information.')
    if (action === 'update') return openUpdateModal(item)
    if (action === 'challenge') return openChallengeModal(item)
    if (action === 'thread') return openThread(item)
    if (action === 'analyse') return analyseCommunityItem(item)
  })
}

async function askCommunity(e) {
  e.preventDefault()
  const f = new FormData(e.currentTarget)
  const q = String(f.get('question') || '').trim()
  if (!q) return
  const box = $('#communityAnswer')
  box.innerHTML = `<div class="community-ai-thinking"><span class="community-spinner"></span> Reading the community…</div>`
  try {
    const data = await invoke('ask', { question:q })
    const answer = String(data.answer || '').replace(/\[id:[0-9a-f-]+\]/gi, '').trim()
    box.innerHTML = `<div class="community-ai-answer"><span>${icon('spark',16)}</span><p>${esc(answer).replace(/\n/g,'<br>')}</p></div>`
  } catch (err) {
    box.innerHTML = `<div class="community-ai-answer error"><p>${esc(err.message)}</p></div>`
  }
}

function openModal(content) {
  closeModal()
  const wrap = document.createElement('div')
  wrap.className = 'community-modal'
  wrap.innerHTML = `<div class="community-modal-backdrop"></div><div class="community-modal-panel"><button class="community-modal-close" aria-label="Close">×</button>${content}</div>`
  document.body.appendChild(wrap)
  $('.community-modal-backdrop', wrap).onclick = closeModal
  $('.community-modal-close', wrap).onclick = closeModal
  return wrap
}

function closeModal() { $('.community-modal')?.remove() }

function openShareModal() {
  const wrap = openModal(`<div class="modal-head"><span class="eyebrow">HELP THE COMMUNITY</span><h2>Share what you know</h2><p>You don't need insider information. Restocks, release details, prices, availability and useful corrections all make the network smarter.</p></div>
    <form id="shareIntelForm" class="form-stack">
      <div class="form-grid"><label>Type<select name="intel_type"><option value="restock">Restock</option><option value="release">Release</option><option value="deal">Deal / opportunity</option><option value="price">Price intel</option><option value="availability">Availability</option><option value="strategy">Strategy / useful knowledge</option><option value="other">Other</option></select></label><label>Category<input name="category" placeholder="Pokémon, sneakers, LEGO…"></label></div>
      <label>Product or topic<input name="product_name" placeholder="e.g. Pokémon 151 Elite Trainer Box"></label>
      <div class="form-grid"><label>Retailer / source<input name="retailer" placeholder="Big W"></label><label>Location<input name="location_text" placeholder="Highpoint, VIC or Online"></label></div>
      <label>What do you know?<textarea name="details" class="tall-text" placeholder="Share the useful details. AI will organise this with other reports." required></textarea></label>
      <div class="form-grid"><label>Retail price (optional)<input name="retail_price" type="number" min="0" step="0.01"></label><label>Observed resale (optional)<input name="resale_price" type="number" min="0" step="0.01"></label></div>
      <label>Source link / evidence link (optional)<input name="source_url" type="url" placeholder="https://..."></label>
      <div class="community-form-note">Your report can appear as an early signal immediately. Independent confirmations, evidence and contributor track record determine how much confidence the community should place in it.</div>
      <button class="button primary large-button">Share with community ${icon('arrow',17)}</button>
    </form>`)
  $('#shareIntelForm', wrap).onsubmit = async e => {
    e.preventDefault(); const button = $('button[type="submit"],button.button.primary', e.currentTarget); if (button) button.disabled = true
    try {
      const f = new FormData(e.currentTarget)
      const data = await invoke('submit', {
        report_kind:'origin', intel_type:f.get('intel_type'), category:f.get('category'), product_name:f.get('product_name'), retailer:f.get('retailer'),
        location_text:f.get('location_text'), details:f.get('details'), retail_price:f.get('retail_price') || null, resale_price:f.get('resale_price') || null, source_url:f.get('source_url')
      })
      closeModal(); community.feed = null; await loadFeed(true); drawCommunity(community.feed, data.item?.id); toast(data.merged_into_existing ? 'Added as an independent confirmation' : 'Shared with the community')
    } catch (err) { toast(err.message); if (button) button.disabled = false }
  }
}

function openUpdateModal(item) {
  const wrap = openModal(`<div class="modal-head"><span class="eyebrow">ADD AN UPDATE</span><h2>${esc(item.title)}</h2><p>Small updates matter — stock changes, new prices, new locations or anything that makes the current picture more accurate.</p></div>
    <form id="updateIntelForm" class="form-stack"><label>What's changed?<textarea name="details" required placeholder="e.g. Still in stock at 4:20pm, purchase limit is now 2 per customer."></textarea></label><div class="form-grid"><label>Location<input name="location_text" value="${esc(item.location_text || '')}"></label><label>Current retail price<input name="retail_price" type="number" min="0" step="0.01" value="${item.retail_price ?? ''}"></label></div><label>Source link (optional)<input name="source_url" type="url" value="${esc(item.source_url || '')}"></label><button class="button primary">Add update ${icon('arrow',17)}</button></form>`)
  $('#updateIntelForm', wrap).onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    try {
      await invoke('submit', { intel_id:item.id, report_kind:'update', details:f.get('details'), location_text:f.get('location_text'), retail_price:f.get('retail_price') || null, source_url:f.get('source_url') })
      closeModal(); community.feed = null; await loadFeed(true); drawCommunity(community.feed, item.id); toast('Community intel updated')
    } catch (err) { toast(err.message) }
  }
}

function openChallengeModal(item) {
  const wrap = openModal(`<div class="modal-head"><span class="eyebrow">CHALLENGE INFORMATION</span><h2>${esc(item.title)}</h2><p>Challenges help stop bad information spreading. Explain what appears wrong or outdated.</p></div><form id="challengeIntelForm" class="form-stack"><label>What is incorrect?<textarea name="details" required placeholder="Explain what you observed or why this information should be treated cautiously."></textarea></label><label>Supporting link (optional)<input name="source_url" type="url" placeholder="https://..."></label><button class="button primary">Submit challenge</button></form>`)
  $('#challengeIntelForm', wrap).onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    try {
      await invoke('submit', { intel_id:item.id, report_kind:'challenge', details:f.get('details'), source_url:f.get('source_url') })
      closeModal(); community.feed = null; await loadFeed(true); drawCommunity(community.feed, item.id); toast('Challenge recorded')
    } catch (err) { toast(err.message) }
  }
}

async function quickReport(item, kind, details) {
  try {
    toast('Adding your confirmation…')
    await invoke('submit', { intel_id:item.id, report_kind:kind, details })
    community.feed = null
    await loadFeed(true)
    drawCommunity(community.feed, item.id)
    toast('Thanks — your confirmation strengthens the community')
  } catch (err) { toast(err.message) }
}

async function toggleSave(item) {
  const saved = new Set(community.feed?.saved_ids || [])
  try {
    if (saved.has(item.id)) {
      const { error } = await supabase.from('community_saved_intel').delete().eq('intel_id', item.id)
      if (error) throw error
      community.feed.saved_ids = (community.feed.saved_ids || []).filter(id => id !== item.id)
      toast('Removed from saved')
    } else {
      const { data:sessionData } = await supabase.auth.getSession()
      const id = sessionData.session?.user?.id
      if (!id) throw new Error('Sign in required')
      const { error } = await supabase.from('community_saved_intel').insert({ user_id:id, intel_id:item.id })
      if (error) throw error
      community.feed.saved_ids = [...(community.feed.saved_ids || []), item.id]
      toast('Saved')
    }
    drawCommunity(community.feed, item.id)
  } catch (err) { toast(err.message) }
}

async function openThread(item) {
  const wrap = openModal(`<div class="modal-head"><span class="eyebrow">COMMUNITY SOURCES</span><h2>${esc(item.title)}</h2><p>AI gives you the clean summary. This is the underlying human activity used to strengthen or challenge it.</p></div><div id="communityThread"><div class="community-loading compact"><span class="community-spinner"></span><p>Loading sources…</p></div></div>`)
  try {
    const data = await invoke('thread', { intel_id:item.id })
    const reports = data.reports || []
    $('#communityThread', wrap).innerHTML = reports.length ? `<div class="community-thread-list">${reports.map(r => `<div class="community-thread-row"><div class="thread-kind ${esc(r.report_kind)}">${esc(r.report_kind.replaceAll('_',' '))}</div><div class="thread-body"><div class="thread-user"><strong>${esc(r.contributor?.display_name || r.contributor?.contribution_level || 'Community member')}</strong>${r.contributor?.reliability_score != null ? `<span>Reliability ${Math.round(Number(r.contributor.reliability_score))}</span>` : `<span>Unestablished</span>`}<time>${relativeTime(r.created_at)}</time></div>${r.body ? `<p>${esc(r.body)}</p>` : `<p class="thread-quiet">No extra note.</p>`}${r.location_text ? `<small>${esc(r.location_text)}</small>` : ''}${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">View supplied source</a>` : ''}</div></div>`).join('')}</div>` : `<div class="intel-empty"><p>No source activity yet.</p></div>`
  } catch (err) { $('#communityThread', wrap).innerHTML = `<div class="intel-empty"><p>${esc(err.message)}</p></div>` }
}

async function analyseCommunityItem(item) {
  try {
    const { data:sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) throw new Error('Sign in required')
    const listingText = [
      `Community Intelligence: ${item.title}`,
      item.summary,
      item.retailer ? `Retailer/source: ${item.retailer}` : '',
      item.location_text ? `Location: ${item.location_text}` : '',
      `Community confidence at capture: ${Math.round(Number(item.confidence_score || 0))}%`,
      `${Number(item.confirmations_count || 0)} confirmations; ${Number(item.challenges_count || 0)} challenges.`,
      'Treat community intelligence as a lead, not proof. Independently verify purchase availability, item details and exact price before spending money.'
    ].filter(Boolean).join('\n')
    const { error } = await supabase.from('opportunities').insert({
      user_id:userId, source_platform:'community', source_url:item.source_url || null, listing_title:item.product_name || item.title,
      listing_text:listingText, seller_asking_price:item.retail_price ?? null, listing_location:item.location_text || null, currency:'AUD', status:'watching',
      raw_listing:{ community_intel_id:item.id, community_confidence:item.confidence_score, community_status:item.status }
    })
    if (error) throw error
    toast('Deal File created from Community Intel')
    community.open = false
    setTimeout(() => location.reload(), 450)
  } catch (err) { toast(err.message) }
}
