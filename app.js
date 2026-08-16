import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient(
  'https://msmpigerejpxepkylkxz.supabase.co',
  'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
)

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const app = $('#app')

const state = {
  session: null,
  bundle: null,
  view: 'home',
  focusWorkflowId: null,
  opps: [],
  inventory: [],
  tx: [],
  sales: [],
  saleListings: [],
  analyses: [],
  busy: false,
  temp: {}
}

const uid = () => state.session?.user?.id
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const arr = v => Array.isArray(v) ? v : []
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const num = v => v === null || v === undefined || v === '' ? null : Number(v)
const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v))
  ? '—'
  : new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))
const pct = v => v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`
const dateShort = v => v ? new Date(v).toLocaleDateString('en-AU', { day:'numeric', month:'short' }) : '—'

const iconPaths = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
  analyse: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6M8 11h6"/>',
  deals: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/>',
  inventory: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/>',
  learn: '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M7 9.5V15c2.5 2 7.5 2 10 0V9.5"/><path d="M21 7v6"/>',
  wallet: '<path d="M3 7h16v12H3z"/><path d="M3 9V5h13v2"/><path d="M15 12h6v4h-6a2 2 0 0 1 0-4Z"/>',
  trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M16 6h5v5"/>',
  activity: '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
  spark: '<path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Z"/><path d="m5 14 .9 2.6L8.5 18l-2.6.9L5 21.5l-.9-2.6L1.5 18l2.6-1.4L5 14Z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9H5v6h2M17 9h2v6h-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>'
}
const icon = (name, size = 20) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`

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
  document.body.classList.toggle('is-busy', on)
  $$('button').forEach(b => { b.disabled = on })
}

function route(view) {
  state.view = view
  state.temp = {}
  render()
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function friendlyName() {
  const profile = state.bundle?.profile || {}
  const meta = state.session?.user?.user_metadata || {}
  const raw = profile.display_name || meta.name || meta.full_name || state.session?.user?.email?.split('@')[0] || ''
  if (!raw) return ''
  return raw.split(/[._-]/)[0].replace(/^./, c => c.toUpperCase())
}

function latestAnalysisFor(opportunityId) {
  return state.analyses.find(a => a.opportunity_id === opportunityId) || null
}

function workflowForOpportunity(opportunityId) {
  return arr(state.bundle?.workflows).find(w => w.opportunity_id === opportunityId) || null
}

function workflowForInventory(inventoryId) {
  return arr(state.bundle?.workflows).find(w => w.inventory_item_id === inventoryId || w.inventory_items?.id === inventoryId) || null
}

function focusedWorkflow() {
  const workflows = arr(state.bundle?.workflows)
  if (state.focusWorkflowId) {
    const found = workflows.find(w => w.id === state.focusWorkflowId)
    if (found) return found
  }
  return state.bundle?.primary_workflow || workflows[0] || null
}

async function boot() {
  const { data } = await supabase.auth.getSession()
  state.session = data.session
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session
    session ? refresh() : renderAuth()
  })
  state.session ? await refresh() : renderAuth()
}

function renderAuth(error = '', success = '') {
  app.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="brand brand-large"><span class="brand-mark">${icon('spark', 19)}</span><span>FlippersAI</span></div>
        <div class="auth-copy">
          <h1>Find better deals.<br>Buy smarter. Sell faster.</h1>
          <p>AI-powered reselling analysis and guidance, from your first flip to a serious operation.</p>
        </div>
        ${success ? `<div class="notice success">${esc(success)}</div>` : ''}
        ${error ? `<div class="notice danger">${esc(error)}</div>` : ''}
        <form id="authForm" class="form-stack">
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
          <button class="button primary">Sign in</button>
          <button class="button secondary" type="button" id="signupButton">Create account</button>
        </form>
      </div>
    </div>`

  $('#authForm').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(f.get('email')).trim(),
      password: String(f.get('password'))
    })
    if (authError) renderAuth(authError.message)
  }

  $('#signupButton').onclick = async () => {
    const f = new FormData($('#authForm'))
    const email = String(f.get('email') || '').trim()
    const password = String(f.get('password') || '')
    if (!email || password.length < 6) return renderAuth('Enter an email and a password of at least 6 characters.')
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError) return renderAuth(signupError.message)
    data.session ? refresh() : renderAuth('', 'Account created. Confirm your email, then sign in.')
  }
}

async function ensureProfile() {
  const { data } = await supabase.from('profiles').select('id').eq('id', uid()).maybeSingle()
  if (!data) await supabase.from('profiles').insert({ id: uid() })
}

async function refresh() {
  if (!state.session) return renderAuth()
  busy(true)
  try {
    await ensureProfile()
    const { data: bundle, error: workflowError } = await supabase.functions.invoke('workflow-state', { method:'GET' })
    if (workflowError || bundle?.error) throw new Error(workflowError?.message || bundle?.error || 'Could not load workflow state')
    state.bundle = bundle

    const [opps, inventory, tx, sales, saleListings, analyses] = await Promise.all([
      supabase.from('opportunities').select('*').order('updated_at', { ascending:false }),
      supabase.from('inventory_items').select('*').order('updated_at', { ascending:false }),
      supabase.from('transactions').select('*').order('occurred_at', { ascending:false }).limit(150),
      supabase.from('sales').select('*').order('sold_at', { ascending:false }),
      supabase.from('sale_listings').select('*').order('updated_at', { ascending:false }),
      supabase.from('analyses').select('*').order('analysed_at', { ascending:false }).limit(250)
    ])

    state.opps = opps.data || []
    state.inventory = inventory.data || []
    state.tx = tx.data || []
    state.sales = sales.data || []
    state.saleListings = saleListings.data || []
    state.analyses = []
    const seen = new Set()
    for (const a of analyses.data || []) {
      if (!seen.has(a.opportunity_id)) {
        state.analyses.push(a)
        seen.add(a.opportunity_id)
      }
    }
    render()
  } catch (e) {
    app.innerHTML = `<div class="fatal"><div class="card"><h2>Could not load FlippersAI</h2><p>${esc(e.message || e)}</p><button class="button primary" onclick="location.reload()">Retry</button></div></div>`
  } finally {
    busy(false)
  }
}

const navItems = [
  ['home', 'Home', 'home'],
  ['analyse', 'Analyse', 'analyse'],
  ['deals', 'Deals', 'deals'],
  ['inventory', 'Inventory', 'inventory'],
  ['learn', 'Learn', 'learn']
]

function navMarkup(mobile = false) {
  return navItems.map(([view, label, iconName]) => `
    <button class="${mobile ? 'mobile-nav-item' : 'desktop-nav-item'} ${state.view === view ? 'active' : ''}" data-nav="${view}">
      ${icon(iconName, mobile ? 21 : 17)}<span>${label}</span>
    </button>`).join('')
}

function shell(content) {
  const profile = state.bundle?.profile || {}
  const initial = (friendlyName() || state.session?.user?.email || 'U').charAt(0).toUpperCase()
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <button class="brand brand-button" data-nav="home"><span class="brand-mark">${icon('spark', 18)}</span><span>FlippersAI</span></button>
          <nav class="desktop-nav">${navMarkup(false)}</nav>
          <div class="account-wrap">
            <button class="avatar" id="accountButton" aria-label="Account">${esc(initial)}</button>
            <div class="account-popover" id="accountPopover">
              <div class="account-email">${esc(state.session?.user?.email || '')}</div>
              <div class="popover-label">Guidance</div>
              <div class="guidance-switch">
                <button data-guidance="teach" class="${profile.guidance_level === 'teach' ? 'active' : ''}">Teach</button>
                <button data-guidance="assist" class="${profile.guidance_level === 'assist' ? 'active' : ''}">Assist</button>
                <button data-guidance="fast" class="${profile.guidance_level === 'fast' ? 'active' : ''}">Fast</button>
              </div>
              <button class="popover-action" data-nav="capital">${icon('wallet', 17)} Capital & history</button>
              <button class="popover-action" id="logoutButton">${icon('user', 17)} Sign out</button>
            </div>
          </div>
        </div>
      </header>
      <main class="content">${content}</main>
      <nav class="mobile-nav">${navMarkup(true)}</nav>
    </div>`

  $$('[data-nav]').forEach(b => b.onclick = () => route(b.dataset.nav))
  $('#accountButton')?.addEventListener('click', e => {
    e.stopPropagation()
    $('#accountPopover')?.classList.toggle('open')
    setTimeout(() => document.addEventListener('click', closeAccountPopover, { once:true }), 0)
  })
  $$('[data-guidance]').forEach(b => b.onclick = async e => {
    e.stopPropagation()
    await supabase.from('profiles').update({ guidance_level:b.dataset.guidance, updated_at:new Date().toISOString() }).eq('id', uid())
    await refresh()
  })
  $('#logoutButton')?.addEventListener('click', () => supabase.auth.signOut())
}

function closeAccountPopover(e) {
  if (!e.target.closest?.('.account-wrap')) $('#accountPopover')?.classList.remove('open')
}

function render() {
  if (!state.bundle) return
  if (state.view === 'home') return homePage()
  if (state.view === 'analyse') return analysePage()
  if (state.view === 'deals') return dealsPage()
  if (state.view === 'inventory') return inventoryPage()
  if (state.view === 'learn') return learnPage()
  if (state.view === 'capital') return capitalPage()
  route('home')
}

function dashboardMetrics() {
  const portfolio = state.bundle?.portfolio || {}
  const revenue = state.sales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)
  return `
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-top"><span>INVESTED</span>${icon('wallet', 18)}</div><strong>${money(portfolio.inventory_at_cost || 0)}</strong><small>across open items</small></div>
      <div class="metric-card"><div class="metric-top"><span>REVENUE</span>${icon('trend', 18)}</div><strong class="positive">${money(revenue)}</strong><small>${state.sales.length} sale${state.sales.length === 1 ? '' : 's'}</small></div>
      <div class="metric-card"><div class="metric-top"><span>NET PROFIT</span>${icon('trend', 18)}</div><strong class="positive">${money(portfolio.realized_profit || 0)}</strong><small>realised</small></div>
      <div class="metric-card"><div class="metric-top"><span>ACTIVE</span>${icon('inventory', 18)}</div><strong>${Number(portfolio.open_items || 0)}</strong><small>bought or selling</small></div>
    </div>`
}

function bankrollStrip() {
  const cash = Number(state.bundle?.portfolio?.available_cash || 0)
  return `<div class="bankroll-strip"><span>${icon('cash', 18)} Available to spend</span><strong>${money(cash)}</strong><button data-nav="capital">View finances ${icon('chevron', 15)}</button></div>`
}

function homePage() {
  if (!state.bundle.onboarding?.completed) return onboardingPage()
  const name = friendlyName()
  const w = focusedWorkflow()
  const recent = state.inventory.slice(0, 4)
  shell(`
    <section class="page-head home-head">
      <div><h1>Welcome back${name ? `, ${esc(name)}` : ''}</h1><p>Track flips, analyse deals, and grow your reselling business.</p></div>
      <div class="quick-actions">
        <button class="button secondary" id="analyseQuick">${icon('analyse', 18)} Analyse a deal</button>
        <button class="button primary" id="inventoryQuick">${icon('inventory', 18)} My inventory</button>
      </div>
    </section>
    ${bankrollStrip()}
    <section class="section-block">
      <div class="section-heading"><div><span class="eyebrow">WHAT'S NEXT?</span><h2>${w ? esc(w.opportunities?.listing_title || w.latest_analysis?.identified_name || 'Continue your flip') : 'Find your next opportunity'}</h2></div></div>
      ${w ? workflowCard(w, true) : emptyNextCard()}
    </section>
    <section class="section-block">${dashboardMetrics()}</section>
    <section class="section-block">
      <div class="section-heading"><h2>Recent inventory</h2><button class="text-button" id="viewInventory">View all ${icon('chevron', 15)}</button></div>
      ${recent.length ? `<div class="inventory-list compact">${recent.map(inventoryRow).join('')}</div>` : `<div class="card empty-card"><p>No inventory yet. Your first purchased deal will appear here automatically.</p></div>`}
    </section>`)

  $('#analyseQuick').onclick = () => route('analyse')
  $('#inventoryQuick').onclick = () => route('inventory')
  $('#viewInventory').onclick = () => route('inventory')
  if (w) bindWorkflow(w)
  $('#startAnalyse')?.addEventListener('click', () => route('analyse'))
}

function emptyNextCard() {
  return `<div class="next-card empty-next"><div class="next-icon">${icon('spark', 23)}</div><div><h3>Ready for another flip?</h3><p>Paste a listing or use Scout to bring an opportunity into FlippersAI.</p></div><button class="button primary" id="startAnalyse">Analyse a listing ${icon('chevron', 16)}</button></div>`
}

function onboardingPage() {
  const o = state.bundle.onboarding || {}
  const s = Number(o.step || 1)
  const cash = Number(state.bundle.portfolio?.available_cash || 0)
  let body = ''
  if (s === 1) {
    body = cash > 0
      ? `<div class="notice success">You already have <strong>${money(cash)}</strong> recorded as available reselling cash.</div><button class="button primary" id="useCash">Use my current balance ${icon('chevron', 16)}</button>`
      : `<form id="on1" class="form-stack"><label>Starting capital (AUD)<input name="capital" type="number" min="1" step="1" placeholder="100" required></label><button class="button primary">Set my starting capital ${icon('chevron', 16)}</button></form>`
  } else if (s === 2) {
    body = `<form id="on2" class="form-stack"><label>How involved do you want to be?<select name="effort"><option value="mostly_home">Mostly from home</option><option value="balanced" selected>Balanced</option><option value="local_active">Happy to collect locally</option><option value="max_profit">Whatever makes the most money</option></select></label><label class="checkbox-row"><input name="ship" type="checkbox" checked><span>I’m willing to ship items</span></label><label class="checkbox-row"><input name="collect" type="checkbox" checked><span>I can collect items locally</span></label><button class="button primary">Save preferences ${icon('chevron', 16)}</button></form>`
  } else if (s === 3) {
    body = `<form id="on3" class="form-stack"><div class="form-grid"><label>Monthly profit goal<input name="goal" type="number" min="0" step="50" placeholder="1000"></label><label>Experience<select name="experience"><option value="beginner">I’m starting out</option><option value="growing">I already resell</option><option value="pro">I’m experienced / high volume</option></select></label></div><label>How much guidance?<select name="guidance"><option value="teach">Teach me — walk me through everything</option><option value="assist">Assist me — recommendations, less explanation</option><option value="fast">Move fast — analysis and actions only</option></select></label><button class="button primary">Save and continue ${icon('chevron', 16)}</button></form>`
  } else {
    body = `<div class="onboarding-final"><div class="next-icon">${icon('analyse', 23)}</div><p>You're set. Bring in a marketplace listing and FlippersAI will guide you from there.</p><button class="button primary" id="finishOnboarding">Analyse my first deal ${icon('chevron', 16)}</button></div>`
  }

  const titles = ['Set your starting capital', 'Choose how you want to resell', 'Set your goal and guidance', 'Find your first opportunity']
  const descriptions = [
    'Tell FlippersAI how much money you are comfortable using. This becomes the bankroll used for deal and risk recommendations.',
    'Choose whether you prefer home-based flips, local collection, shipping, or whatever gives the best return.',
    'Choose your target and how much explanation you want. You can change this any time.',
    'You do not need to know what makes a good flip yet. Start with a listing and let FlippersAI help.'
  ]

  shell(`
    <section class="page-head"><div><h1>Set up FlippersAI</h1><p>Four quick steps, then you can start analysing deals.</p></div></section>
    <div class="onboarding-progress">${[1,2,3,4].map(n => `<span class="${n <= s ? 'active' : ''}"></span>`).join('')}</div>
    <div class="focused-card onboarding-card"><span class="eyebrow">STEP ${s} OF 4</span><h2>${titles[s-1]}</h2><p class="lead">${descriptions[s-1]}</p>${body}</div>`)
  bindOnboarding()
}

function bindOnboarding() {
  $('#useCash')?.addEventListener('click', async () => {
    await supabase.from('profiles').update({ onboarding_step:2 }).eq('id', uid())
    await refresh()
  })
  $('#on1')?.addEventListener('submit', async e => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { error } = await supabase.rpc('add_funds', { p_amount:Number(f.get('capital')), p_description:'Starting reselling capital' })
    if (error) return toast(error.message)
    await supabase.from('profiles').update({ onboarding_step:2 }).eq('id', uid())
    await refresh()
  })
  $('#on2')?.addEventListener('submit', async e => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await supabase.from('profiles').update({
      effort_preference:f.get('effort'),
      willing_to_ship:f.get('ship') === 'on',
      can_collect_locally:f.get('collect') === 'on',
      onboarding_step:3
    }).eq('id', uid())
    await refresh()
  })
  $('#on3')?.addEventListener('submit', async e => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await supabase.from('profiles').update({
      monthly_profit_goal:f.get('goal') ? Number(f.get('goal')) : null,
      experience_level:f.get('experience'),
      guidance_level:f.get('guidance'),
      onboarding_step:4
    }).eq('id', uid())
    await refresh()
  })
  $('#finishOnboarding')?.addEventListener('click', async () => {
    await supabase.from('profiles').update({ onboarding_completed:true }).eq('id', uid())
    state.view = 'analyse'
    await refresh()
  })
}

const stepNames = {
  capture_listing:'Capture listing', verify_listing:'Verify details', analyse_deal:'Analyse deal', ask_seller:'Ask seller',
  review_seller_reply:'Review reply', negotiate:'Negotiate', arrange_transaction:'Arrange purchase', inspect_before_buy:'Inspect',
  record_purchase:'Record purchase', prepare_item:'Prepare item', create_listing:'Create listing', publish_listing:'Publish listing',
  manage_offers:'Manage offers', complete_sale:'Agree sale', fulfil_order:'Fulfil', confirm_delivery:'Confirm delivery',
  confirm_funds:'Receive funds', feedback_and_close:'Close flip'
}

function recommendationLabel(rec = '') {
  return ({ strong_buy:'Strong buy', buy:'Buy', negotiate:'Negotiate', verify_first:'Verify first', skip:'Skip' })[rec] || rec.replaceAll('_', ' ')
}

function recommendationClass(rec = '') {
  if (rec === 'skip') return 'bad'
  if (rec === 'verify_first' || rec === 'negotiate') return 'warn'
  return 'good'
}

function decisionCard(a) {
  if (!a?.recommendation) return ''
  const risks = obj(a.risks)
  return `
    <div class="decision-card ${recommendationClass(a.recommendation)}">
      <div class="decision-head"><div><span class="decision-label">${esc(recommendationLabel(a.recommendation))}</span><h3>${esc(a.action_summary || a.next_action || 'Deal analysed')}</h3></div><div class="score"><strong>${Math.round(Number(a.overall_score || 0))}</strong><span>/100</span></div></div>
      <div class="decision-money">
        <div><span>ASK</span><strong>${money(a.seller_asking_price)}</strong></div>
        <div><span>RESALE</span><strong>${money(a.resale_mid)}</strong></div>
        <div><span>PROFIT</span><strong class="positive">${money(a.expected_profit)}</strong></div>
        <div><span>MAX BUY</span><strong>${money(a.max_buy)}</strong></div>
      </div>
      <details class="details-card"><summary>Why this result</summary><div class="details-body">
        <div class="confidence-row"><span>Valuation confidence <b>${pct(a.valuation_confidence)}</b></span><span>Expected ROI <b>${pct(a.expected_roi_percent)}</b></span><span>Sell time <b>${a.sell_time_mid_days ?? '—'} days</b></span></div>
        ${a.evidence_summary ? `<p>${esc(a.evidence_summary)}</p>` : ''}
        ${Object.keys(risks).length ? `<div class="risk-grid">${Object.entries(risks).map(([k,v]) => `<div><span>${esc(k.replaceAll('_',' '))}</span><b>${Math.round(Number(v || 0))}/100</b></div>`).join('')}</div>` : ''}
        ${arr(a.action_cautions).length ? `<div class="notice warning">${arr(a.action_cautions).map(x => `<div>• ${esc(x)}</div>`).join('')}</div>` : ''}
      </div></details>
    </div>`
}

function workflowCard(w, home = false) {
  const step = w.step || {}
  const analysis = w.latest_analysis || {}
  const progress = arr(w.progress)
  const completeCount = progress.filter(p => p.state === 'completed').length
  const percent = Math.round((completeCount / 18) * 100)
  return `
    <div class="focused-card workflow-card ${home ? 'home-workflow' : ''}">
      <div class="workflow-topline"><span class="stage-pill">Step ${w.current_step_order} of 18</span><span>${percent}% complete</span></div>
      <div class="progress-track"><span style="width:${percent}%"></span></div>
      <div class="step-copy"><span class="eyebrow">NEXT ACTION</span><h3>${esc(step.title || stepNames[w.current_step] || 'Continue')}</h3><p>${esc(step.instruction || step.teach_instruction || '')}</p></div>
      ${analysis.recommendation ? decisionCard(analysis) : ''}
      <div class="step-action">${stepAction(w)}</div>
      <div class="workflow-secondary"><button class="text-danger" id="skipDeal">Skip this deal</button></div>
      <details class="journey-details"><summary>View full deal journey <span>${completeCount}/18 complete</span></summary><div class="journey-list">${progress.map(p => `
        <div class="journey-row ${p.state === 'completed' ? 'done' : p.step_key === w.current_step ? 'current' : ''}">
          <span class="journey-dot">${p.state === 'completed' ? icon('check', 14) : p.step_order}</span>
          <div><strong>${esc(stepNames[p.step_key] || p.step_key)}</strong><small>${p.state === 'completed' ? 'Complete' : p.step_key === w.current_step ? 'Current step' : ''}</small></div>
        </div>`).join('')}</div></details>
    </div>`
}

function stepAction(w) {
  const k = w.current_step
  const a = w.latest_analysis || {}
  const o = w.opportunities || {}

  if (k === 'capture_listing') return `
    <form id="capture" class="form-stack">
      <label>Marketplace link<input name="url" value="${esc(o.source_url || '')}" placeholder="Paste listing link"></label>
      <label>Listing text / description<textarea name="text" placeholder="Paste anything useful from the listing">${esc(o.listing_text || '')}</textarea></label>
      <label class="upload-box">${icon('analyse', 20)}<span><strong>Add screenshots or photos</strong><small>JPEG, PNG or WebP · up to 6</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <button class="button primary">Capture listing ${icon('chevron', 16)}</button>
    </form>`

  if (k === 'verify_listing') return `
    <form id="verify" class="form-stack">
      <div class="form-grid"><label>Item title<input name="title" value="${esc(o.listing_title || a.identified_name || '')}"></label><label>Exact asking price (AUD)<input name="price" type="number" min="0" step="0.01" value="${o.seller_asking_price ?? ''}" required></label></div>
      <label>Location<input name="location" value="${esc(o.listing_location || '')}" placeholder="Suburb / city"></label>
      <div class="notice warning"><strong>Price lock:</strong> confirm the seller's exact asking price before FlippersAI trusts profit, ROI or buy recommendations.</div>
      <button class="button primary">Confirm details ${icon('chevron', 16)}</button>
    </form>`

  if (k === 'analyse_deal') return `<div class="action-panel"><p>FlippersAI will research current Australian resale evidence, calculate the economics and tell you what to do.</p><button class="button primary" id="runAnalysis">Analyse this deal ${icon('spark', 17)}</button></div>`

  if (k === 'ask_seller') {
    const qs = arr(a.questions_to_ask)
    return `<div class="form-stack">${qs.length ? `<div class="check-list">${qs.map(q => `<div class="plain-check">${icon('check', 15)}<span>${esc(q)}</span></div>`).join('')}</div>` : ''}<label>Ready-to-send message<textarea id="sellerMsg">${esc(a.seller_message || qs.join('\n'))}</textarea></label><div class="button-row"><button class="button secondary" id="copySeller">Copy message</button><button class="button primary" id="sentSeller">I sent it ${icon('chevron', 16)}</button></div></div>`
  }

  if (k === 'review_seller_reply') return `
    <form id="reply" class="form-stack">
      <label>Seller's reply<textarea name="reply" placeholder="Paste the seller's response here"></textarea></label>
      <label class="upload-box">${icon('analyse', 20)}<span><strong>Or add a screenshot of the reply</strong><small>FlippersAI can read it from the image</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <button class="button primary">Review reply ${icon('spark', 17)}</button>
    </form>`

  if (k === 'negotiate') return `
    <div class="form-stack"><div class="offer-strip"><div><span>OPENING OFFER</span><strong>${money(a.recommended_offer)}</strong></div><div><span>HARD MAX</span><strong>${money(a.max_buy)}</strong></div></div><label>Offer message<textarea id="offerMsg">${esc(a.seller_message || `Would you take ${money(a.recommended_offer)}?`)}</textarea></label><div class="button-row"><button class="button secondary" id="copyOffer">Copy offer</button><button class="button primary" id="offerDone">Price agreed / continue ${icon('chevron', 16)}</button></div></div>`

  if (k === 'arrange_transaction') return `<form id="arrange" class="form-stack"><label>How will you receive it?<select name="method"><option value="pickup">Local pickup</option><option value="shipping">Seller ships it</option></select></label><label>Arrangement details<textarea name="details" placeholder="Time, location, payment method, shipping arrangement"></textarea></label><button class="button primary">Arrangement confirmed ${icon('chevron', 16)}</button></form>`

  if (k === 'inspect_before_buy') {
    const checks = arr(a.inspection_checks)
    const items = checks.length ? checks : ['Confirm the exact model and included parts','Check condition against the listing','Test all important functions','Check for ownership or authenticity concerns']
    return `<div class="form-stack"><div class="check-list">${items.map(q => `<label class="checkbox-row checklist"><input type="checkbox" class="inspect"><span>${esc(q)}</span></label>`).join('')}</div><button class="button primary" id="inspectionDone">All checks passed ${icon('chevron', 16)}</button></div>`
  }

  if (k === 'record_purchase') return `<form id="purchase" class="form-stack"><div class="form-grid"><label>Actual purchase price<input name="price" type="number" min="0" step="0.01" value="${o.seller_asking_price ?? ''}" required></label><label>Immediate extra costs<input name="costs" type="number" min="0" step="0.01" value="0"></label></div><button class="button primary">I bought it ${icon('chevron', 16)}</button></form>`

  if (k === 'prepare_item') return `<div class="form-stack"><div id="salePlan"><div class="skeleton tall"></div></div><button class="button primary" id="prepDone">Item is ready to list ${icon('chevron', 16)}</button></div>`
  if (k === 'create_listing') return `<div class="form-stack"><div id="salePlan"><div class="skeleton tall"></div></div><button class="button primary" id="listingDone">Listing is ready ${icon('chevron', 16)}</button></div>`

  if (k === 'publish_listing') return `<form id="publish" class="form-stack"><div class="form-grid"><label>Marketplace<input name="platform" placeholder="Facebook Marketplace" required></label><label>Listing price<input name="price" type="number" min="0" step="0.01" required></label></div><label>Live listing URL<input name="url" placeholder="https://..."></label><label>Minimum acceptable price<input name="minimum" type="number" min="0" step="0.01"></label><button class="button primary">Mark as listed ${icon('chevron', 16)}</button></form>`

  if (k === 'manage_offers') return `<div class="form-stack"><form id="offerEval" class="inline-form"><label>Buyer offer<input name="offer" type="number" min="0" step="0.01" required></label><button class="button primary">Evaluate offer</button></form>${state.temp.offer ? `<div class="offer-result ${state.temp.offer.action}"><strong>${esc(state.temp.offer.action.toUpperCase())}${state.temp.offer.counter ? ` · Counter ${money(state.temp.offer.counter)}` : ''}</strong><p>${esc(state.temp.offer.text)}</p></div>` : ''}<button class="button secondary" id="saleReady">Sale agreed / continue ${icon('chevron', 16)}</button></div>`

  if (k === 'complete_sale') return `<form id="sale" class="form-stack"><div class="form-grid"><label>Platform<input name="platform" required></label><label>Agreed sale price<input name="price" type="number" min="0" step="0.01" required></label></div><div class="form-grid three"><label>Fees<input name="fees" type="number" min="0" step="0.01" value="0"></label><label>Shipping<input name="shipping" type="number" min="0" step="0.01" value="0"></label><label>Other costs<input name="other" type="number" min="0" step="0.01" value="0"></label></div><button class="button primary">Record sale agreement ${icon('chevron', 16)}</button></form>`

  if (k === 'fulfil_order') return `<form id="fulfil" class="form-stack"><label>Fulfilment method<select name="method"><option value="shipping">Shipping</option><option value="pickup">Local pickup</option></select></label><div class="form-grid"><label>Carrier<input name="carrier" placeholder="Australia Post"></label><label>Tracking number<input name="tracking"></label></div><label>Notes<textarea name="notes"></textarea></label><button class="button primary">Order fulfilled ${icon('chevron', 16)}</button></form>`

  if (k === 'confirm_delivery') return `<div class="action-panel"><div class="notice warning">Only continue once the buyer has actually received or collected the item.</div><button class="button primary" id="delivered">Buyer received the item ${icon('chevron', 16)}</button></div>`
  if (k === 'confirm_funds') return `<form id="funds" class="form-stack"><label>Amount actually received<input name="payout" type="number" min="0" step="0.01" value="${w.sales?.sale_price ?? ''}" required></label><button class="button primary">Funds received ${icon('chevron', 16)}</button></form>`
  if (k === 'feedback_and_close') return `<form id="feedback" class="form-stack"><label>Feedback you left / received<textarea name="review" placeholder="Optional review or rating notes"></textarea></label><label>Rating received (optional)<input name="rating" type="number" min="1" max="5" step="0.1"></label><button class="button primary">Close this flip ${icon('check', 16)}</button></form>`
  return `<button class="button primary" id="advance">Continue ${icon('chevron', 16)}</button>`
}

async function advance(w, data = {}) {
  const { error } = await supabase.rpc('advance_flip_step', {
    p_workflow_id:w.id,
    p_step_key:w.current_step,
    p_step_data:data
  })
  if (error) return toast(error.message)
  state.focusWorkflowId = w.id
  await refresh()
}

async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file?.type?.startsWith('image/')) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob || file
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function uploadOpportunityImages(opportunityId, fileList, mediaType = 'listing_image') {
  const files = [...(fileList || [])].filter(f => f.type?.startsWith('image/'))
  if (!files.length) return 0
  const { count } = await supabase.from('opportunity_media').select('*', { count:'exact', head:true }).eq('opportunity_id', opportunityId)
  const room = Math.max(0, 6 - Number(count || 0))
  if (!room) {
    toast('This deal already has 6 images')
    return 0
  }
  let uploaded = 0
  for (const file of files.slice(0, room)) {
    const blob = await compressImage(file)
    const path = `${uid()}/${opportunityId}/${crypto.randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage.from('listing-media').upload(path, blob, { contentType:'image/jpeg', upsert:false })
    if (uploadError) throw uploadError
    const { error: rowError } = await supabase.from('opportunity_media').insert({
      user_id:uid(), opportunity_id:opportunityId, storage_path:path,
      file_name:file.name || 'listing-image.jpg', mime_type:'image/jpeg', size_bytes:blob.size, media_type:mediaType
    })
    if (rowError) {
      await supabase.storage.from('listing-media').remove([path])
      throw rowError
    }
    uploaded++
  }
  return uploaded
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function loadAnalysisImages(opportunityId) {
  const { data: media } = await supabase.from('opportunity_media').select('storage_path').eq('opportunity_id', opportunityId).order('created_at').limit(6)
  const images = []
  for (const m of media || []) {
    const { data, error } = await supabase.storage.from('listing-media').download(m.storage_path)
    if (!error && data) images.push(await blobToDataUrl(data))
  }
  return images
}

async function latestSalePlan(w) {
  const id = w.inventory_item_id || w.inventory_items?.id
  if (!id) return null
  const { data } = await supabase.from('sale_plans').select('*').eq('inventory_item_id', id).order('created_at', { ascending:false }).limit(1).maybeSingle()
  return data
}

async function makeSalePlan(w) {
  let p = await latestSalePlan(w)
  if (p) return p
  const { data, error } = await supabase.functions.invoke('build-sale-plan', {
    body:{ inventory:w.inventory_items || {}, analysis:w.latest_analysis || {}, opportunity:w.opportunities || {}, profile:state.bundle.profile || {} }
  })
  if (error || data?.error) throw new Error(error?.message || data?.error || 'Could not build sale plan')
  const x = data.plan || {}
  const id = w.inventory_item_id || w.inventory_items?.id
  const row = {
    user_id:uid(), inventory_item_id:id, recommended_platform:x.recommended_platform,
    platform_rankings:x.platform_rankings || [], pricing_plan:x.pricing_plan || {}, negotiation_ladder:x.negotiation_ladder || {},
    shipping_plan:x.shipping_plan || {}, photo_plan:x.photo_plan || [], listing_copy:x.listing_copy || {},
    preparation_checklist:x.preparation_checklist || [], next_action:x.next_action || '', engine_version:data.engine_version || 'flippers-sale-alpha-1'
  }
  const { data:saved, error:saveError } = await supabase.from('sale_plans').insert(row).select('*').single()
  if (saveError) throw saveError
  return saved
}

async function hydratePlan(w, mode) {
  const mount = $('#salePlan')
  if (!mount) return
  try {
    const p = await makeSalePlan(w)
    const price = obj(p.pricing_plan)
    const copy = obj(p.listing_copy)
    if (mode === 'prepare') {
      mount.innerHTML = `<div class="sale-plan"><h4>Preparation checklist</h4><div class="check-list">${arr(p.preparation_checklist).map(x => `<label class="checkbox-row checklist"><input type="checkbox"><span>${esc(x)}</span></label>`).join('')}</div><h4>Photos to take</h4><div class="number-list">${arr(p.photo_plan).map((x,i) => `<div><span>${i+1}</span><p>${esc(x)}</p></div>`).join('')}</div></div>`
    } else {
      mount.innerHTML = `<div class="sale-plan"><div class="decision-money"><div><span>LIST</span><strong>${money(price.list_price)}</strong></div><div><span>EXPECTED</span><strong>${money(price.expected_close_price)}</strong></div><div><span>MINIMUM</span><strong>${money(price.minimum_price)}</strong></div><div><span>QUICK</span><strong>${money(price.quick_sale_price)}</strong></div></div><label>Title<textarea id="copyTitle">${esc(copy.title || '')}</textarea></label><button class="button secondary copy" data-copy="#copyTitle">Copy title</button><label>Description<textarea id="copyDesc" class="tall-text">${esc(copy.description || '')}</textarea></label><button class="button secondary copy" data-copy="#copyDesc">Copy description</button><div class="notice neutral"><strong>Recommended platform:</strong> ${esc(p.recommended_platform || '—')}<br>${esc(price.rationale || '')}</div></div>`
      $$('.copy').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText($(b.dataset.copy)?.value || ''); toast('Copied') })
    }
  } catch (e) {
    mount.innerHTML = `<div class="notice danger">${esc(e.message)}</div>`
  }
}

async function analyseDeal(w, sellerUpdate = '') {
  const o = w.opportunities || {}
  const a = w.latest_analysis || {}
  const profile = state.bundle.profile || {}
  const portfolio = state.bundle.portfolio || {}
  const images = await loadAnalysisImages(w.opportunity_id)
  const body = {
    listing_url:o.source_url || '', listing_text:o.listing_text || '',
    platform_fields:{ asking_price:o.seller_asking_price, currency:o.currency || 'AUD', asking_price_verified:o.seller_asking_price != null, asking_price_confidence:o.seller_asking_price != null ? 1 : 0, listing_title:o.listing_title, listing_location:o.listing_location, seller_name:o.seller_name, seller_rating:o.seller_rating, seller_review_count:o.seller_review_count },
    user_overrides:{ asking_price:o.seller_asking_price, currency:o.currency || 'AUD' },
    seller_update:sellerUpdate,
    prior_analysis_summary:a?.id ? JSON.stringify({ identified_name:a.identified_name, recommendation:a.recommendation, resale_mid:a.resale_mid, max_buy:a.max_buy, risks:a.risks }) : '',
    bankroll:Number(portfolio.available_cash || 0), risk_profile:profile.risk_profile || 'conservative',
    reserve_percent:Number(profile.capital_reserve_percent ?? 30), max_exposure_percent:Number(profile.max_single_item_exposure_percent ?? 20),
    portfolio_context:portfolio, images
  }
  const { data, error } = await supabase.functions.invoke('analyse-listing-v2', { body })
  if (error || data?.error) throw new Error(error?.message || data?.error || 'Analysis failed')
  const x = data.analysis || {}
  const rec = {
    opportunity_id:w.opportunity_id, user_id:uid(), engine_version:data.engine_version || 'flippers-alpha-4-price-lock',
    identified_name:x.identified_name || '', brand:x.brand || '', model:x.model || '', variant:x.variant || '', category:x.category || '',
    identification_confidence:x.identification_confidence ?? 0, resale_low:x.resale_low, resale_mid:x.resale_mid, resale_high:x.resale_high,
    quick_sale_value:x.quick_sale_value, sell_time_low_days:x.sell_time_low_days, sell_time_mid_days:x.sell_time_mid_days, sell_time_high_days:x.sell_time_high_days,
    valuation_confidence:x.valuation_confidence ?? 0, overall_score:x.overall_score ?? 0, overall_risk:x.overall_risk ?? 0, recommendation:x.recommendation,
    recommended_offer:x.recommended_offer, max_buy:x.max_buy, break_even_sale_price:x.break_even_sale_price, expected_selling_costs:x.expected_selling_costs,
    expected_profit:x.expected_profit, expected_roi_percent:x.expected_roi_percent, quick_sale_profit:x.quick_sale_profit, next_action:x.next_action,
    questions_to_ask:x.questions_to_ask || [], inspection_checks:x.inspection_checks || [], risks:x.risks || {}, assumptions:x.assumptions || [],
    evidence_summary:x.evidence_summary || '', raw_model_output:x, action_summary:x.action_summary || '', action_steps:x.action_steps || [],
    action_cautions:x.action_cautions || [], seller_message:x.seller_message || '', photo_findings:x.photo_findings || [], photo_count:images.length,
    user_overrides:{ asking_price:o.seller_asking_price }, seller_confidence:x.seller_confidence ?? null, seller_confidence_label:x.seller_confidence_label ?? null,
    seller_confidence_reason:x.seller_confidence_reason ?? null, seller_signals:x.seller_signals || {}, overall_confidence:x.overall_confidence ?? null
  }
  const { data:saved, error:saveError } = await supabase.from('analyses').insert(rec).select('*').single()
  if (saveError) throw saveError
  if (arr(x.evidence).length) {
    await supabase.from('evidence').insert(arr(x.evidence).map(e => ({
      analysis_id:saved.id, user_id:uid(), evidence_type:e.evidence_type, evidence_class:e.evidence_class || 'estimated', marketplace:e.marketplace || null,
      source_title:e.source_title || null, source_url:e.source_url || null, price:e.price ?? null, currency:e.currency || 'AUD', sold:e.sold ?? null,
      condition_text:e.condition_text || null, similarity_score:e.similarity_score ?? null, match_quality:e.match_quality || null, included:e.included !== false,
      rejection_reason:e.rejection_reason || null, metadata:{}
    })))
  }
  const status = x.recommendation === 'skip' ? 'skipped' : x.recommendation === 'verify_first' ? 'verify' : x.recommendation === 'negotiate' ? 'negotiating' : 'ready'
  await supabase.from('opportunities').update({ status, updated_at:new Date().toISOString() }).eq('id', w.opportunity_id)
  return saved
}

function bindWorkflow(w) {
  const k = w.current_step
  $('#skipDeal')?.addEventListener('click', async () => {
    if (!confirm('Skip this deal and remove it from your active workflow?')) return
    const { error } = await supabase.rpc('skip_flip', { p_workflow_id:w.id, p_reason:'Skipped by user' })
    if (error) return toast(error.message)
    state.focusWorkflowId = null
    toast('Deal skipped')
    await refresh()
  })
  if (k === 'capture_listing') $('#capture')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget)
      await supabase.from('opportunities').update({ source_url:f.get('url') || null, listing_text:f.get('text') || null, updated_at:new Date().toISOString() }).eq('id', w.opportunity_id)
      await uploadOpportunityImages(w.opportunity_id, e.currentTarget.elements.images.files)
      await advance(w, { captured:true })
    } catch (err) { toast(err.message) } finally { busy(false) }
  })

  if (k === 'verify_listing') $('#verify')?.addEventListener('submit', async e => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const price = Number(f.get('price'))
    await supabase.from('opportunities').update({ listing_title:f.get('title') || null, seller_asking_price:price, listing_location:f.get('location') || null, user_overrides:{ asking_price:price }, updated_at:new Date().toISOString() }).eq('id', w.opportunity_id)
    await advance(w, { asking_price:price, verified:true })
  })

  if (k === 'analyse_deal') $('#runAnalysis')?.addEventListener('click', async () => {
    busy(true); try { await analyseDeal(w); await advance(w, { analysed:true }) } catch (e) { toast(e.message) } finally { busy(false) }
  })

  if (k === 'ask_seller') {
    $('#copySeller')?.addEventListener('click', async () => { await navigator.clipboard.writeText($('#sellerMsg')?.value || ''); toast('Copied') })
    $('#sentSeller')?.addEventListener('click', async () => {
      await supabase.from('deal_messages').insert({ user_id:uid(), workflow_id:w.id, direction:'outbound', counterparty_role:'seller', phase:'pre_purchase', body:$('#sellerMsg')?.value || '', source:'generated' })
      await advance(w, { message_sent:true })
    })
  }

  if (k === 'review_seller_reply') $('#reply')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget)
      const reply = String(f.get('reply') || '').trim()
      const files = e.currentTarget.elements.images.files
      if (!reply && !files.length) throw new Error('Paste the seller reply or add a screenshot.')
      if (reply) await supabase.from('deal_messages').insert({ user_id:uid(), workflow_id:w.id, direction:'inbound', counterparty_role:'seller', phase:'pre_purchase', body:reply, source:'pasted' })
      if (files.length) await uploadOpportunityImages(w.opportunity_id, files, 'seller_reply_image')
      await analyseDeal(w, reply || 'The seller reply is shown in the newly supplied screenshot image(s). Extract and use the new seller information.')
      await advance(w, { seller_reply:reply || 'image supplied' })
    } catch (x) { toast(x.message) } finally { busy(false) }
  })

  if (k === 'negotiate') {
    $('#copyOffer')?.addEventListener('click', async () => { await navigator.clipboard.writeText($('#offerMsg')?.value || ''); toast('Copied') })
    $('#offerDone')?.addEventListener('click', () => advance(w, { negotiation_complete:true }))
  }

  if (k === 'arrange_transaction') $('#arrange')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); await advance(w, { method:f.get('method'), details:f.get('details') })
  })

  if (k === 'inspect_before_buy') $('#inspectionDone')?.addEventListener('click', () => {
    if ($$('.inspect').some(x => !x.checked)) return toast('Complete every required inspection check first.')
    advance(w, { inspection_passed:true })
  })

  if (k === 'record_purchase') $('#purchase')?.addEventListener('submit', async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget), a = w.latest_analysis, o = w.opportunities
      const { error } = await supabase.rpc('record_purchase', {
        p_opportunity_id:w.opportunity_id, p_analysis_id:a.id, p_title:o.listing_title || a.identified_name || 'Purchased item',
        p_category:a.category || '', p_purchase_price:Number(f.get('price')), p_acquisition_costs:Number(f.get('costs') || 0)
      })
      if (error) throw error
      toast('Purchase recorded')
      await refresh()
    } catch (e) { toast(e.message) } finally { busy(false) }
  })

  if (k === 'prepare_item') { hydratePlan(w, 'prepare'); $('#prepDone')?.addEventListener('click', () => advance(w, { prepared:true })) }
  if (k === 'create_listing') { hydratePlan(w, 'listing'); $('#listingDone')?.addEventListener('click', () => advance(w, { listing_ready:true })) }

  if (k === 'publish_listing') {
    ;(async () => {
      const p = await makeSalePlan(w), pr = obj(p.pricing_plan), form = $('#publish')
      if (form) { form.elements.platform.value = p.recommended_platform || 'Facebook Marketplace'; form.elements.price.value = pr.list_price ?? ''; form.elements.minimum.value = pr.minimum_price ?? '' }
    })()
    $('#publish')?.addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget), id = w.inventory_item_id || w.inventory_items?.id, p = await latestSalePlan(w), pr = obj(p?.pricing_plan)
      const { error } = await supabase.from('sale_listings').insert({ user_id:uid(), inventory_item_id:id, platform:f.get('platform'), listing_url:f.get('url') || null, listing_price:Number(f.get('price')), expected_close_price:pr.expected_close_price ?? null, minimum_price:f.get('minimum') ? Number(f.get('minimum')) : pr.minimum_price ?? null, status:'active', listed_at:new Date().toISOString() })
      if (error) return toast(error.message)
      await supabase.from('inventory_items').update({ status:'listed' }).eq('id', id)
      await advance(w, { published:true })
    })
  }

  if (k === 'manage_offers') {
    $('#offerEval')?.addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget), offer = Number(f.get('offer')), id = w.inventory_item_id || w.inventory_items?.id
      const { data:list } = await supabase.from('sale_listings').select('*').eq('inventory_item_id', id).eq('status', 'active').order('created_at', { ascending:false }).limit(1).maybeSingle()
      const p = await latestSalePlan(w), pr = obj(p?.pricing_plan), min = Number(list?.minimum_price ?? pr.minimum_price ?? 0), expected = Number(list?.expected_close_price ?? pr.expected_close_price ?? list?.listing_price ?? 0)
      let action = 'decline', counter = null, text = `Below your minimum of ${money(min)}.`
      if (offer >= expected * .98) { action = 'accept'; text = 'At or above your expected close price. Accepting is reasonable.' }
      else if (offer >= min) { action = 'counter'; counter = Math.max(offer, Math.round(((offer + expected) / 2) / 5) * 5); text = `Profitable but below target. Counter around ${money(counter)}.` }
      state.temp.offer = { action, counter, text }
      await supabase.from('offer_events').insert({ user_id:uid(), inventory_item_id:id, sale_listing_id:list?.id || null, buyer_offer:offer, recommended_action:action, recommended_counter:counter, response_text:text, metadata:{ minimum:min, expected_close:expected } })
      render()
    })
    $('#saleReady')?.addEventListener('click', () => advance(w, { offer_process_complete:true }))
  }

  if (k === 'complete_sale') $('#sale')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), id = w.inventory_item_id || w.inventory_items?.id
    const { error } = await supabase.rpc('record_sale_agreement', { p_inventory_item_id:id, p_platform:f.get('platform'), p_sale_price:Number(f.get('price')), p_selling_fees:Number(f.get('fees') || 0), p_shipping_cost:Number(f.get('shipping') || 0), p_other_costs:Number(f.get('other') || 0) })
    if (error) return toast(error.message)
    await refresh()
  })

  if (k === 'fulfil_order') $('#fulfil')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), method = f.get('method'), id = w.inventory_item_id || w.inventory_items?.id
    const { error } = await supabase.from('fulfilments').insert({ user_id:uid(), workflow_id:w.id, sale_id:w.sale_id, inventory_item_id:id, method, status:method === 'pickup' ? 'collected' : 'shipped', carrier:f.get('carrier') || null, tracking_number:f.get('tracking') || null, notes:f.get('notes') || null, shipped_at:method === 'shipping' ? new Date().toISOString() : null, collected_at:method === 'pickup' ? new Date().toISOString() : null })
    if (error) return toast(error.message)
    await advance(w, { method, fulfilled:true })
  })

  if (k === 'confirm_delivery') $('#delivered')?.addEventListener('click', async () => {
    await supabase.from('fulfilments').update({ status:'delivered', delivered_at:new Date().toISOString() }).eq('workflow_id', w.id).eq('user_id', uid())
    await advance(w, { delivered:true })
  })

  if (k === 'confirm_funds') $('#funds')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const { error } = await supabase.rpc('record_funds_received', { p_sale_id:w.sale_id, p_payout_amount:Number(f.get('payout')) })
    if (error) return toast(error.message)
    await refresh()
  })

  if (k === 'feedback_and_close') $('#feedback')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    if (f.get('review') || f.get('rating')) await supabase.from('feedback_records').insert({ user_id:uid(), workflow_id:w.id, sale_id:w.sale_id, direction:'received', status:'completed', rating:f.get('rating') ? Number(f.get('rating')) : null, review_text:f.get('review') || null, completed_at:new Date().toISOString() })
    await advance(w, { feedback_complete:true })
  })
  $('#advance')?.addEventListener('click', () => advance(w, {}))
}

function analysePage() {
  shell(`
    <section class="page-head"><div><span class="eyebrow">DEAL ANALYSER</span><h1>Show FlippersAI the listing</h1><p>Paste what you have. FlippersAI will turn it into a deal file and take you through the next step.</p></div></section>
    <div class="focused-card analyser-card">
      <form id="newDeal" class="form-stack">
        <label>Marketplace link<input name="url" placeholder="Facebook Marketplace, eBay, Gumtree…"></label>
        <div class="or-divider"><span>or add what you can see</span></div>
        <label class="upload-box large">${icon('analyse', 24)}<span><strong>Add screenshots or photos</strong><small>Listing screenshots, product photos, seller details · up to 6</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="form-grid"><label>Listing title <small>optional</small><input name="title" placeholder="Nintendo Switch OLED"></label><label>Asking price <small>optional for now</small><input name="price" type="number" min="0" step="0.01" placeholder="250"></label></div>
        <label>Listing text / description <small>optional</small><textarea name="text" placeholder="Paste the listing description or other visible details"></textarea></label>
        <button class="button primary large-button">Create deal file ${icon('chevron', 17)}</button>
      </form>
    </div>
    <div class="analyser-note">${icon('spark', 17)} You do not need to research the item first. That's FlippersAI's job.</div>`)

  $('#newDeal').onsubmit = async e => {
    e.preventDefault(); busy(true)
    try {
      const f = new FormData(e.currentTarget), url = String(f.get('url') || '').trim(), text = String(f.get('text') || '').trim(), files = e.currentTarget.elements.images.files
      if (!url && !text && !files.length) throw new Error('Add a listing link, listing text, or at least one screenshot.')
      const platform = url.includes('facebook') ? 'facebook' : url.includes('ebay') ? 'ebay' : url.includes('gumtree') ? 'gumtree' : url.includes('depop') ? 'depop' : 'other'
      const { data:opp, error } = await supabase.from('opportunities').insert({ user_id:uid(), source_platform:platform, source_url:url || null, listing_title:f.get('title') || null, listing_text:text || null, seller_asking_price:f.get('price') ? Number(f.get('price')) : null, status:'watching', currency:'AUD' }).select('*').single()
      if (error) throw error
      if (files.length) await uploadOpportunityImages(opp.id, files)
      const { data:w } = await supabase.from('flip_workflows').select('*').eq('opportunity_id', opp.id).eq('user_id', uid()).maybeSingle()
      if (w) {
        await supabase.rpc('advance_flip_step', { p_workflow_id:w.id, p_step_key:'capture_listing', p_step_data:{ captured:true, source:'direct_analyser' } })
        state.focusWorkflowId = w.id
      }
      state.view = 'home'
      await refresh()
    } catch (err) { toast(err.message) } finally { busy(false) }
  }
}

function dealsPage() {
  const active = arr(state.bundle.workflows)
  shell(`
    <section class="page-head split"><div><span class="eyebrow">DEALS</span><h1>Your opportunities</h1><p>Everything you're considering, negotiating or moving toward a purchase.</p></div><button class="button primary" id="newOpp">${icon('analyse', 17)} Analyse a deal</button></section>
    ${active.length ? `<section class="section-block"><div class="section-heading"><h2>Active deals</h2><span>${active.length}</span></div><div class="deal-grid">${active.map(dealCard).join('')}</div></section>` : ''}
    <section class="section-block"><div class="section-heading"><h2>All opportunities</h2><span>${state.opps.length}</span></div>${state.opps.length ? `<div class="opportunity-list">${state.opps.map(opportunityRow).join('')}</div>` : `<div class="card empty-card"><p>No opportunities yet.</p></div>`}</section>`)
  $('#newOpp').onclick = () => route('analyse')
  $$('[data-workflow]').forEach(b => b.onclick = () => { state.focusWorkflowId = b.dataset.workflow; route('home') })
}

function dealCard(w) {
  const a = w.latest_analysis || {}
  const o = w.opportunities || {}
  return `<div class="deal-card"><div class="deal-card-top"><span class="stage-pill">Step ${w.current_step_order}/18</span>${a.recommendation ? `<span class="rec-text ${recommendationClass(a.recommendation)}">${esc(recommendationLabel(a.recommendation))}</span>` : ''}</div><h3>${esc(o.listing_title || a.identified_name || 'Untitled deal')}</h3><p>${esc(w.step?.title || stepNames[w.current_step] || '')}</p><div class="deal-numbers"><span>Ask <b>${money(o.seller_asking_price)}</b></span><span>Resale <b>${money(a.resale_mid)}</b></span><span>Profit <b class="positive">${money(a.expected_profit)}</b></span></div><button class="button secondary full" data-workflow="${w.id}">Continue ${icon('chevron', 15)}</button></div>`
}

function opportunityRow(o) {
  const w = workflowForOpportunity(o.id)
  const a = w?.latest_analysis || latestAnalysisFor(o.id) || {}
  return `<div class="opportunity-row"><div class="opportunity-main"><strong>${esc(o.listing_title || a.identified_name || 'Untitled listing')}</strong><small>${esc(o.source_platform || 'marketplace')} · ${money(o.seller_asking_price)}${a.overall_score != null ? ` · ${Math.round(Number(a.overall_score))}/100` : ''}</small></div><span class="status-badge ${statusClass(o.status)}">${esc(friendlyStatus(o.status))}</span>${w ? `<button class="icon-button" data-workflow="${w.id}" aria-label="Continue">${icon('chevron', 17)}</button>` : ''}</div>`
}

function friendlyStatus(status = '') {
  return ({ watching:'Watching', analysing:'Analysing', ready:'Ready', verify:'Verify', negotiating:'Negotiating', bought:'Bought', skipped:'Skipped', expired:'Expired', purchased:'Bought', preparing:'Preparing', ready_to_list:'Ready to list', listed:'Listed', sale_agreed:'Sale agreed', packed:'Packed', shipped:'Shipped', delivered:'Delivered', sold:'Sold', returned:'Returned', written_off:'Written off' })[status] || status.replaceAll('_',' ')
}
function statusClass(status = '') {
  if (['sold','ready','bought','purchased','delivered'].includes(status)) return 'green'
  if (['skipped','returned','written_off'].includes(status)) return 'red'
  if (['verify','negotiating','preparing','sale_agreed','packed','shipped'].includes(status)) return 'amber'
  return 'gray'
}

function inventoryRow(i) {
  const sale = state.sales.find(s => s.inventory_item_id === i.id)
  const listing = state.saleListings.find(l => l.inventory_item_id === i.id)
  const payout = sale?.payout_amount ?? sale?.sale_price
  const actualProfit = sale ? Number(payout || 0) - Number(sale.selling_fees || 0) - Number(sale.shipping_cost || 0) - Number(sale.other_costs || 0) - Number(i.purchase_price || 0) - Number(i.acquisition_costs || 0) : null
  const predicted = Number(i.predicted_profit || 0)
  return `<div class="inventory-row"><div class="inventory-copy"><strong>${esc(i.title || 'Inventory item')}</strong><small>Paid ${money(i.purchase_price)}${listing?.listing_price != null ? ` · Listed ${money(listing.listing_price)}` : ''}${sale?.sale_price != null ? ` · Sold ${money(sale.sale_price)}` : ''}</small></div><div class="inventory-right">${actualProfit != null ? `<b class="positive">${actualProfit >= 0 ? '+' : ''}${money(actualProfit)}</b>` : predicted ? `<b class="muted-profit">Est. ${money(predicted)}</b>` : ''}<span class="status-badge ${statusClass(i.status)}">${esc(friendlyStatus(i.status))}</span></div></div>`
}

function inventoryPage() {
  shell(`
    <section class="page-head"><div><span class="eyebrow">INVENTORY</span><h1>Your stock</h1><p>Everything you've bought, from preparation through to payout.</p></div></section>
    ${bankrollStrip()}
    <section class="section-block">${state.inventory.length ? `<div class="inventory-list">${state.inventory.map(inventoryRow).join('')}</div>` : `<div class="card empty-card"><h3>No inventory yet</h3><p>When you record a purchase, FlippersAI creates the inventory item automatically. You never need to re-enter the deal.</p><button class="button primary" id="emptyAnalyse">Analyse a deal</button></div>`}</section>`)
  $('#emptyAnalyse')?.addEventListener('click', () => route('analyse'))
}

const lessons = [
  { title:'How reselling actually works', sub:'Buy undervalued, sell at fair market value, keep the difference.', points:['Profit is the sale price minus what you paid and every cost needed to complete the sale.','A cheap item is not automatically a good flip. Demand and resale evidence matter.','Your goal is repeatable decisions, not gambling on one lucky item.'] },
  { title:'What to look for', sub:'Learn the signals that make a listing worth investigating.', points:['Look for recognisable products with clear demand and enough margin after fees.','Poor photos, vague titles and badly written listings can create opportunities — but also uncertainty.','FlippersAI should help you separate genuine underpricing from hidden problems.'] },
  { title:'Researching resale value', sub:'Work from real market evidence, not optimistic asking prices.', points:['Recent sold comparables are more useful than unsold listings.','Match the exact model, variant, condition and included accessories wherever possible.','Use a conservative range and know your quick-sale value before buying.'] },
  { title:'Making an offer and negotiating', sub:'Know your opening offer, target and walk-away price before messaging.', points:['Your maximum buy price is a ceiling, not a target.','A lower purchase price protects you from fees, defects and slower-than-expected sales.','Stay willing to walk away. There will always be another listing.'] },
  { title:'Buying safely', sub:'Verify the item and transaction before handing over money.', points:['Confirm the exact model, condition, ownership and key functions.','Use appropriate payment protection when shipping is involved.','If an important fact cannot be verified, reduce the price or skip the deal.'] },
  { title:'Prepping and photographing', sub:'Turn the item you bought into something buyers trust.', points:['Clean, test and reset the product before listing it.','Photograph the item clearly from useful angles and show flaws honestly.','Small preparation improvements can materially improve sale speed and price.'] },
  { title:'Writing a listing that sells', sub:'Make the product easy to understand and easy to trust.', points:['Use a specific title with the exact model and important variant details.','Describe condition accurately and include what is and is not included.','Price with a target close price and negotiation room, not a random round number.'] },
  { title:'Shipping and getting paid', sub:'A sale is not finished when the buyer says yes.', points:['Package the item properly and retain tracking or pickup evidence.','Track marketplace fees and the amount that actually reaches your account.','Treat the flip as complete only after delivery and funds are confirmed.'] },
  { title:'Tracking, learning and growing', sub:'Use your real results to make the next flip better.', points:['Compare predicted value, profit and sale time with what actually happened.','Watch which categories and marketplaces perform best for you.','Scale by making more good decisions, not by taking bigger blind risks.'] }
]

function learnPage() {
  shell(`
    <section class="page-head"><div><span class="eyebrow">LEARN</span><h1>Learn to resell</h1><p>A practical guide from total beginner to your first profitable flip. Learn here when you want to; FlippersAI will also teach these ideas at the exact moment you need them.</p></div></section>
    <div class="learn-actions"><button class="button secondary" id="learnAnalyse">${icon('analyse', 17)} Try the Deal Analyser</button><button class="button primary" id="learnStart">${icon('inventory', 17)} Start your first flip</button></div>
    <div class="lesson-list">${lessons.map((l,i) => `<details class="lesson" ${i === 0 ? 'open' : ''}><summary><div><strong>${i+1} · ${esc(l.title)}</strong><span>${esc(l.sub)}</span></div><span class="lesson-chevron">⌄</span></summary><div class="lesson-body">${l.points.map((p,n) => `<div class="lesson-point"><span>${n+1}</span><p>${esc(p)}</p></div>`).join('')}</div></details>`).join('')}</div>`)
  $('#learnAnalyse').onclick = () => route('analyse')
  $('#learnStart').onclick = () => route('analyse')
}

function capitalPage() {
  const p = state.bundle.portfolio || {}
  const goal = state.bundle.profile?.monthly_profit_goal
  shell(`
    <section class="page-head"><div><span class="eyebrow">FINANCES</span><h1>Capital & history</h1><p>Where your flipping money is and what has actually been realised.</p></div></section>
    <div class="capital-hero"><div><span>AVAILABLE CASH</span><strong>${money(p.available_cash || 0)}</strong></div><div><span>INVENTORY AT COST</span><strong>${money(p.inventory_at_cost || 0)}</strong></div><div><span>EST. INVENTORY VALUE</span><strong>${money(p.estimated_inventory_value || 0)}</strong></div><div><span>REALISED PROFIT</span><strong class="positive">${money(p.realized_profit || 0)}</strong></div></div>
    ${goal ? `<div class="goal-card"><span>Monthly profit goal</span><strong>${money(goal)}</strong></div>` : ''}
    <section class="section-block"><div class="section-heading"><h2>Recent transactions</h2></div>${state.tx.length ? `<div class="transaction-list">${state.tx.map(t => `<div class="transaction-row"><div><strong>${esc(t.description || friendlyStatus(t.transaction_type))}</strong><small>${new Date(t.occurred_at).toLocaleString('en-AU')}</small></div><b class="${Number(t.cash_delta) >= 0 ? 'positive' : ''}">${Number(t.cash_delta) >= 0 ? '+' : ''}${money(t.cash_delta)}</b></div>`).join('')}</div>` : `<div class="card empty-card"><p>No transactions recorded.</p></div>`}</section>`)
}

boot()
