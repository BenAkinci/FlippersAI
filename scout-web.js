const scoutParams = new URLSearchParams(location.search)
const scoutId = scoutParams.get('scout')

if (scoutId) {
  const SUPABASE_URL = 'https://msmpigerejpxepkylkxz.supabase.co'
  const SUPABASE_KEY = 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
  const PROJECT_REF = 'msmpigerejpxepkylkxz'
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
  const pct = v => v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`

  function authSession() {
    const keys = Object.keys(localStorage)
    const key = keys.find(k => k === `sb-${PROJECT_REF}-auth-token`) || keys.find(k => k.includes(PROJECT_REF) && k.includes('auth-token'))
    if (!key) return null
    try {
      let value = JSON.parse(localStorage.getItem(key))
      if (value?.currentSession) value = value.currentSession
      if (value?.session) value = value.session
      if (Array.isArray(value)) value = value[0]
      return value?.access_token ? value : null
    } catch { return null }
  }

  async function request(path, options={}) {
    const session = authSession()
    if (!session) throw new Error('Sign in to FlippersAI to open this Scout Session.')
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json', ...(options.headers||{}) }
    })
    const text = await response.text()
    let data = null
    if (text) { try { data = JSON.parse(text) } catch { data = text } }
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status})`)
    return data
  }

  const select = (table, query='') => request(`/rest/v1/${table}${query ? `?${query}` : ''}`, { headers:{Accept:'application/json'} })
  async function insert(table, body, single=false) {
    const data = await request(`/rest/v1/${table}`, { method:'POST', headers:{Prefer:'return=representation'}, body:JSON.stringify(body) })
    return single ? (Array.isArray(data) ? data[0] : data) : data
  }
  async function update(table, filter, body) {
    return request(`/rest/v1/${table}?${filter}`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:JSON.stringify(body) })
  }
  const rpc = (name, body) => request(`/rest/v1/rpc/${name}`, { method:'POST', body:JSON.stringify(body) })

  function recLabel(v='') { return ({strong_buy:'Strong lead',buy:'Strong lead',negotiate:'Promising',verify_first:'Needs verification',skip:'Skip'})[v] || 'Not analysed' }
  function recClass(v='') { return ['strong_buy','buy'].includes(v) ? 'good' : ['negotiate','verify_first'].includes(v) ? 'warn' : v === 'skip' ? 'bad' : '' }

  async function waitWorkflow(opportunityId) {
    for (let i=0;i<15;i++) {
      const rows = await select('flip_workflows', `select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`)
      if (rows?.[0]) return rows[0]
      await new Promise(r=>setTimeout(r,180))
    }
    throw new Error('Deal File saved, but workflow did not initialise.')
  }

  async function currentUser() {
    return request('/auth/v1/user', { headers:{Accept:'application/json'} })
  }

  async function saveAnalysis(opportunityId, c, userId) {
    const x = c.analysis || {}
    if (!x.recommendation) return null
    return insert('analyses', {
      opportunity_id:opportunityId,user_id:userId,engine_version:x.engine_version||'flippers-alpha-4-price-lock',identified_name:x.identified_name||c.title||'',brand:x.brand||'',model:x.model||'',variant:x.variant||'',category:x.category||'',identification_confidence:x.identification_confidence??0,resale_low:x.resale_low,resale_mid:x.resale_mid,resale_high:x.resale_high,quick_sale_value:x.quick_sale_value,sell_time_low_days:x.sell_time_low_days,sell_time_mid_days:x.sell_time_mid_days,sell_time_high_days:x.sell_time_high_days,valuation_confidence:x.valuation_confidence??0,overall_score:x.overall_score??0,overall_risk:x.overall_risk??0,recommendation:x.recommendation,recommended_offer:x.recommended_offer,max_buy:x.max_buy,break_even_sale_price:x.break_even_sale_price,expected_selling_costs:x.expected_selling_costs,expected_profit:x.expected_profit,expected_roi_percent:x.expected_roi_percent,quick_sale_profit:x.quick_sale_profit,next_action:x.next_action,questions_to_ask:x.questions_to_ask||[],inspection_checks:x.inspection_checks||[],risks:x.risks||{},assumptions:x.assumptions||[],evidence_summary:x.evidence_summary||'',raw_model_output:x,action_summary:x.action_summary||'',action_steps:x.action_steps||[],action_cautions:x.action_cautions||[],seller_message:x.seller_message||'',photo_findings:x.photo_findings||[],photo_count:0,user_overrides:{asking_price:c.asking_price},seller_confidence:x.seller_confidence??null,seller_confidence_label:x.seller_confidence_label??null,seller_confidence_reason:x.seller_confidence_reason??null,seller_signals:x.seller_signals||{},overall_confidence:x.overall_confidence??null
    }, true)
  }

  async function startFlip(c) {
    const user = await currentUser()
    const capture = c.deep_capture || {}
    const opportunity = await insert('opportunities', {
      user_id:user.id,source_platform:c.raw_capture?.platform||'other',source_url:c.source_url,listing_title:c.title||null,listing_text:capture.listingText||capture.visibleText||c.raw_capture?.raw_text||'',seller_asking_price:c.asking_price??null,listing_location:c.location||null,seller_name:c.seller_name||null,currency:c.currency||'AUD',status:c.recommendation==='skip'?'skipped':'watching',raw_listing:{browser_scan:true,source:'scout_session',scout_session_id:c.session_id,scout_candidate_id:c.id,listing_id:c.listing_id||null,condition:c.condition||null,captured_at:new Date().toISOString(),canonical_url:c.source_url},updated_at:new Date().toISOString()
    }, true)
    let workflow = await waitWorkflow(opportunity.id)
    if (workflow.current_step === 'capture_listing') {
      await rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'capture_listing',p_step_data:{captured:true,source:'scout_session',scout_candidate_id:c.id}})
      workflow = (await select('flip_workflows',`select=*&id=eq.${workflow.id}&limit=1`))?.[0] || workflow
    }
    if (workflow.current_step === 'verify_listing' && c.title && c.asking_price != null) {
      await update('opportunities',`id=eq.${opportunity.id}`,{user_overrides:{asking_price:c.asking_price},updated_at:new Date().toISOString()})
      await rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'verify_listing',p_step_data:{asking_price:c.asking_price,verified:true,source:'scout_session'}})
      workflow = (await select('flip_workflows',`select=*&id=eq.${workflow.id}&limit=1`))?.[0] || workflow
    }
    await saveAnalysis(opportunity.id,c,user.id)
    if (workflow.current_step === 'analyse_deal' && c.recommendation !== 'skip') await rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'analyse_deal',p_step_data:{analysed:true,source:'scout_session',scout_candidate_id:c.id}})
    await update('opportunities',`id=eq.${opportunity.id}`,{status:c.recommendation==='skip'?'skipped':c.recommendation==='verify_first'?'verify':c.recommendation==='negotiate'?'negotiating':'ready',updated_at:new Date().toISOString()})
    const next = new URL(location.href)
    next.searchParams.delete('scout')
    next.searchParams.set('workflow',workflow.id)
    next.searchParams.set('opportunity',opportunity.id)
    location.href = next.toString()
  }

  function render(session,candidates) {
    const analysed = candidates.filter(c=>c.scan_status==='analysed')
    const strong = analysed.filter(c=>['strong_buy','buy'].includes(c.recommendation)).length
    const promising = analysed.filter(c=>['negotiate','verify_first'].includes(c.recommendation)).length
    const rejected = analysed.filter(c=>c.recommendation==='skip').length
    const overlay = document.createElement('div')
    overlay.id='scoutWebOverlay'
    overlay.innerHTML=`<div class="scout-web-shell"><header class="scout-web-head"><div><span>SCOUT SESSION</span><h1>${esc(session.query_text||'Marketplace Scout')}</h1><p>${candidates.length} listings · ${strong} strong · ${promising} promising · ${rejected} rejected</p></div><button id="closeScoutWeb">Back to FlippersAI</button></header><div class="scout-web-grid">${candidates.sort((a,b)=>Number(b.rank_score||-999)-Number(a.rank_score||-999)).map(c=>`<article class="scout-web-card"><div class="scout-web-thumb">${c.thumbnail_url?`<img src="${esc(c.thumbnail_url)}" alt="">`:''}</div><div class="scout-web-main"><div class="scout-web-title"><strong>${esc(c.title||'Untitled listing')}</strong><span class="${recClass(c.recommendation)}">${esc(recLabel(c.recommendation))}</span></div><p>${money(c.asking_price)}${c.location?` · ${esc(c.location)}`:''}</p>${c.scan_status==='analysed'?`<div class="scout-web-metrics"><span>Resale <b>${money(c.analysis?.resale_mid)}</b></span><span>Profit <b>${money(c.analysis?.expected_profit)}</b></span><span>ROI <b>${pct(c.analysis?.expected_roi_percent)}</b></span><span>Score <b>${Math.round(Number(c.analysis?.overall_score||0))}/100</b></span></div>`:''}<div class="scout-web-actions"><button data-start="${c.id}">Start flip</button><a href="${esc(c.source_url)}" target="_blank" rel="noopener">Open listing</a></div></div></article>`).join('')}</div></div>`
    document.body.appendChild(overlay)
    document.getElementById('closeScoutWeb').onclick=()=>{const next=new URL(location.href);next.searchParams.delete('scout');location.href=next.toString()}
    overlay.querySelectorAll('[data-start]').forEach(button=>button.onclick=async()=>{button.disabled=true;button.textContent='Creating Deal File…';try{const c=candidates.find(x=>x.id===button.dataset.start);await startFlip(c)}catch(error){button.disabled=false;button.textContent='Start flip';alert(error.message)}})
  }

  async function initScoutWeb() {
    try {
      const sessions = await select('scout_sessions',`select=*&id=eq.${encodeURIComponent(scoutId)}&limit=1`)
      const session = sessions?.[0]
      if (!session) throw new Error('Scout Session not found.')
      const candidates = await select('scout_candidates',`select=*&session_id=eq.${encodeURIComponent(scoutId)}&order=rank_score.desc.nullslast`)
      render(session,candidates||[])
    } catch(error) {
      const el=document.createElement('div');el.className='scout-web-error';el.textContent=error.message;document.body.appendChild(el)
    }
  }
  initScoutWeb()
}
