(() => {
  if (window.__flippersProductReadinessV079) return
  window.__flippersProductReadinessV079 = true

  const $ = (s, r=document) => r.querySelector(s)
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const money = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
  const pct = v => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`
  const ANALYSIS_KEY='flippers_direct_analysis_v078'
  const ERROR_KEY='flippers_last_analysis_error_v079'

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    try {
      const target = String(args?.[0]?.url || args?.[0] || '')
      if (target.includes('/functions/v1/analyse-listing-v2')) {
        if (response.ok) sessionStorage.removeItem(ERROR_KEY)
        else {
          const payload = await response.clone().json().catch(() => null)
          if (payload) sessionStorage.setItem(ERROR_KEY, JSON.stringify(payload))
        }
      }
    } catch {}
    return response
  }

  function readAnalysis(){
    try { return JSON.parse(sessionStorage.getItem(ANALYSIS_KEY) || 'null') } catch { return null }
  }
  function readError(){
    try { return JSON.parse(sessionStorage.getItem(ERROR_KEY) || 'null') } catch { return null }
  }
  function authLabel(v=''){
    const map={not_applicable:'Not applicable',likely_genuine:'Likely genuine',uncertain:'Uncertain',high_risk:'High counterfeit risk',likely_counterfeit:'Likely counterfeit'}
    return map[v] || String(v || 'Not established').replaceAll('_',' ')
  }
  function evidenceLabel(v=''){
    const map={high:'High evidence',medium:'Medium evidence',low:'Low evidence',insufficient:'Insufficient evidence'}
    return map[v] || 'Evidence not established'
  }
  function list(items=[]){
    if(!Array.isArray(items)||!items.length) return '<p class="v079-muted">No additional steps were required or returned.</p>'
    return `<ul>${items.slice(0,8).map(x=>`<li>${esc(typeof x==='string'?x:(x?.message||x?.finding||JSON.stringify(x)))}</li>`).join('')}</ul>`
  }

  function enhanceHome(){
    const h1=[...document.querySelectorAll('h1')].find(el=>/what do you want to do/i.test(el.textContent||''))
    if(!h1 || $('#v079ProductIdentity')) return
    const section=h1.closest('section') || h1.parentElement
    if(!section) return
    const card=document.createElement('div')
    card.id='v079ProductIdentity'
    card.className='v079-product-identity'
    card.innerHTML='<strong>FlippersAI is an AI-powered reselling software platform.</strong><span>Scan → Verify → Value → Act. It should save you work, surface worthwhile opportunities and refuse to fake certainty when the evidence is weak.</span>'
    section.insertAdjacentElement('afterend',card)
  }

  function enhanceAnalyseForm(){
    const card=$('.analyser-card')
    if(!card || $('#v079TrustRule')) return
    const rule=document.createElement('div')
    rule.id='v079TrustRule'
    rule.className='v079-trust-rule'
    rule.innerHTML='<strong>Trust rule</strong><span>No credible market evidence = no confident resale/profit figure. Counterfeit risk and serious damage override headline profit.</span>'
    card.insertAdjacentElement('afterend',rule)
  }

  function compMarkup(evidence=[]){
    const rows=(Array.isArray(evidence)?evidence:[]).filter(e=>e && e.included).slice(0,8)
    if(!rows.length) return '<p class="v079-muted">No included market evidence was returned. FlippersAI should not treat an unsupported resale number as trustworthy.</p>'
    return `<div class="v079-comp-list">${rows.map(e=>{
      const href=/^https?:\/\//i.test(String(e.source_url||''))?String(e.source_url):''
      return `<div class="v079-comp"><div><strong>${esc(e.source_title||e.marketplace||'Market evidence')}</strong><span>${esc(e.marketplace||'')} · ${e.sold===true?'Sold/completed':e.sold===false?'Active/reference':'Reference'} · ${esc(e.match_quality||'')}</span></div><div class="v079-comp-price">${money(e.price)}</div>${href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">View source</a>`:''}</div>`
    }).join('')}</div>`
  }

  function calculatorMarkup(x,input){
    const ask=Number(x.seller_asking_price ?? input?.askingPrice ?? 0)
    const sale=Number(x.resale_mid ?? 0)
    const prep=Number(x.estimated_prep_cost ?? 0)
    const costs=Number(x.expected_selling_costs ?? 0)
    return `<details class="v079-calc" id="v079ProfitCalculator"><summary>Profit calculator</summary><div class="v079-calc-grid">
      <label>Purchase price<input id="v079CalcBuy" type="number" step="0.01" value="${Number.isFinite(ask)?ask:''}"></label>
      <label>Expected sale price<input id="v079CalcSale" type="number" step="0.01" value="${Number.isFinite(sale)?sale:''}"></label>
      <label>Platform fees<input id="v079CalcFees" type="number" step="0.01" value="${Number.isFinite(costs)?costs:''}"></label>
      <label>Shipping<input id="v079CalcShipping" type="number" step="0.01" value="0"></label>
      <label>Prep / repairs<input id="v079CalcPrep" type="number" step="0.01" value="${Number.isFinite(prep)?prep:''}"></label>
      <label>Other costs<input id="v079CalcOther" type="number" step="0.01" value="0"></label>
    </div><div class="v079-calc-result"><span>Estimated final profit</span><strong id="v079CalcProfit">—</strong><span>ROI <b id="v079CalcRoi">—</b></span></div></details>`
  }

  function bindCalculator(){
    const ids=['v079CalcBuy','v079CalcSale','v079CalcFees','v079CalcShipping','v079CalcPrep','v079CalcOther']
    if(!ids.every(id=>document.getElementById(id))) return
    const update=()=>{
      const val=id=>Number(document.getElementById(id)?.value||0)
      const buy=val('v079CalcBuy'),sale=val('v079CalcSale')
      const expenses=val('v079CalcFees')+val('v079CalcShipping')+val('v079CalcPrep')+val('v079CalcOther')
      const profit=sale-buy-expenses
      $('#v079CalcProfit').textContent=money(profit)
      $('#v079CalcRoi').textContent=buy>0?`${Math.round(profit/buy*100)}%`:'—'
    }
    ids.forEach(id=>document.getElementById(id)?.addEventListener('input',update))
    update()
  }

  function enhanceResult(){
    const result=$('#directAnalysisResult')
    if(!result || result.classList.contains('direct-analysis-loading') || result.classList.contains('direct-analysis-error') || $('#v079DecisionTrust',result)) return
    const payload=readAnalysis(); const x=payload?.analysis||{}; const input=payload?.input||{}
    if(!payload?.analysis) return
    const sold=Number(x.resale_evidence_count||0)
    const trust=document.createElement('section')
    trust.id='v079DecisionTrust'
    trust.className='v079-decision-trust'
    trust.innerHTML=`
      <div class="v079-trust-strip">
        <div><span>MARKET EVIDENCE</span><strong>${esc(evidenceLabel(x.resale_evidence_quality))}</strong><small>${sold} strong sold comp${sold===1?'':'s'} accepted</small></div>
        <div><span>AUTHENTICITY</span><strong>${esc(authLabel(x.authenticity_status))}</strong><small>${x.authenticity_risk==null?'Risk not scored':`${Math.round(Number(x.authenticity_risk))}/100 risk`}</small></div>
        <div><span>CONDITION SOURCE</span><strong>${esc(String(x.condition_source||'unknown').replaceAll('_',' '))}</strong><small>${x.condition_confidence==null?'Confidence not scored':`${Math.round(Number(x.condition_confidence))}/100 confidence`}</small></div>
      </div>
      <section class="v079-resale-path">
        <div class="v079-section-head"><div><span>RESALE PATH</span><h3>Why this item can — or cannot — reach the target resale</h3></div></div>
        <div class="v079-value-grid"><div><span>AS-IS VALUE</span><strong>${money(x.as_is_resale_value)}</strong></div><div><span>TARGET AFTER PREP</span><strong>${money(x.target_resale_value ?? x.resale_mid)}</strong></div><div><span>EST. PREP COST</span><strong>${money(x.estimated_prep_cost)}</strong></div></div>
        ${x.value_add_explanation?`<p>${esc(x.value_add_explanation)}</p>`:''}
        ${x.cannot_reach_target_reason?`<div class="v079-warning"><strong>Value ceiling:</strong> ${esc(x.cannot_reach_target_reason)}</div>`:''}
        <div class="v079-two-col"><div><span>WHAT TO DO</span>${list(x.target_resale_requirements)}</div><div><span>ASSUMPTIONS BEHIND THE TARGET</span>${list(x.target_resale_assumptions)}</div></div>
      </section>
      <details class="v079-evidence"><summary>See the market evidence behind the resale estimate</summary>${compMarkup(x.evidence)}</details>
      <details class="v079-rationale"><summary>Why FlippersAI thinks this could succeed</summary><p>${esc(x.action_summary||x.next_action||'')}</p>${list(x.reasons||x.assumptions||[])}</details>
      ${calculatorMarkup(x,input)}
      <div class="v079-standard"><strong>FlippersAI trust standard</strong><span>Resale value is an estimate, not a guarantee. Weak evidence, unresolved authenticity or serious condition issues must lower confidence or block a buy recommendation entirely.</span></div>`
    result.appendChild(trust)
    bindCalculator()
  }

  function enhanceError(){
    const result=$('#directAnalysisResult.direct-analysis-error')
    if(!result || result.dataset.v079Enhanced==='1') return
    result.dataset.v079Enhanced='1'
    const p=$('p',result), saved=readError()
    const detail=saved?.detail || saved?.error || ''
    if(p && detail) p.textContent=detail
    if(saved?.error_code){const code=document.createElement('small');code.className='v079-error-code';code.textContent=`Error code: ${saved.error_code}`;result.appendChild(code)}
    const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='Retry analysis';button.addEventListener('click',()=>$('#newDeal')?.requestSubmit());result.appendChild(button)
  }

  function enhanceLearn(){
    const active=$('[data-nav="learn"].active')
    const content=$('.content')
    if(!active||!content||$('#v079DecisionStandard')) return
    const section=document.createElement('section')
    section.id='v079DecisionStandard'
    section.className='v079-decision-standard'
    section.innerHTML='<span class="eyebrow">HOW FLIPPERSAI DECIDES</span><h2>Trust before headline profit.</h2><p>Every serious buying decision follows the same order.</p><div class="v079-gates"><b>1 · Identify</b><b>2 · Authenticate</b><b>3 · Assess condition</b><b>4 · Verify resale evidence</b><b>5 · Calculate profit & success potential</b></div><small>If an earlier gate is unresolved, FlippersAI should not pretend a later profit figure is reliable.</small>'
    const first=content.querySelector('section'); first?.insertAdjacentElement('afterend',section)
  }

  function run(){enhanceHome();enhanceAnalyseForm();enhanceResult();enhanceError();enhanceLearn()}
  let timer
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,35)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  run()
})()
