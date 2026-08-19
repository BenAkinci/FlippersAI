(() => {
  if (window.__flippersGuidedAnalyseV081) return
  window.__flippersGuidedAnalyseV081 = true

  const $ = (s, r=document) => r.querySelector(s)
  const $$ = (s, r=document) => [...r.querySelectorAll(s)]
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const KEY='flippers_direct_analysis_v078'

  function payload(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null}}
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function items(...groups){return groups.flatMap(g=>Array.isArray(g)?g:[]).map(x=>clean(typeof x==='string'?x:(x?.message||x?.finding||x?.label||''))).filter(Boolean)}
  function checkGuide(text=''){
    const t=text.toLowerCase()
    if(/auth|genuine|serial|model|logo|label|receipt|proof/.test(t)) return {why:'This can change the buy decision completely if the item is not genuine or is a different model.',good:'Identifiers, details and seller evidence are consistent.',bad:'Missing, inconsistent or suspicious identifiers/evidence.'}
    if(/condition|damage|scratch|crack|stain|wear|fault|repair|working|test/.test(t)) return {why:'Condition directly affects resale value, repair cost and buyer demand.',good:'Condition matches the listing and no serious hidden faults are found.',bad:'Extra damage, faults or repair needs appear.'}
    if(/sold|comp|resale|market|price|value/.test(t)) return {why:'The profit estimate only works if comparable items really sell near the assumed value.',good:'Several close sold examples support the target value.',bad:'Only active listings, weak matches or much lower sold prices are found.'}
    if(/seller|message|ask|question|history/.test(t)) return {why:'The seller response can confirm missing facts before you commit money.',good:'The seller answers clearly and provides the requested evidence.',bad:'The seller avoids the question, contradicts the listing or cannot provide evidence.'}
    return {why:'This unresolved point affects whether the current recommendation is safe to act on.',good:'The check confirms the assumption used by FlippersAI.',bad:'The check contradicts the assumption or stays unresolved.'}
  }

  function enhance(){
    const root=$('#directAnalysisResult')
    const p=payload(), a=p?.analysis||{}
    if(!root || root.classList.contains('direct-analysis-loading') || root.classList.contains('direct-analysis-error') || !p?.analysis) return
    if(root.dataset.v081Enhanced==='1') return
    root.dataset.v081Enhanced='1'

    const rec=String(a.recommendation||'')
    const needsVerify=rec==='verify_first' || /verify|confirm|check|need/i.test(clean(a.action_summary||a.next_action)) || items(a.action_steps,a.questions_to_ask,a.action_cautions).length>0
    const head=$('.direct-analysis-result-head',root)
    const oldSummary=$('p',head)
    if(oldSummary){oldSummary.textContent=clean(a.action_summary||a.next_action||'FlippersAI has analysed this listing.')}

    if(needsVerify && !$('#v081VerifyFirst',root)){
      const raw=items(a.action_steps,a.questions_to_ask,a.action_cautions)
      const dedup=[...new Set(raw.map(x=>x.toLowerCase()))].map(k=>raw.find(x=>x.toLowerCase()===k)).slice(0,6)
      const fallback=[]
      if(!dedup.length && String(a.authenticity_status||'').match(/uncertain|risk|verify/)) fallback.push('Confirm authenticity and the exact model before buying.')
      if(!dedup.length && Number(a.resale_evidence_count||0)<2) fallback.push('Confirm the resale estimate with close sold comparables.')
      if(!dedup.length) fallback.push('Confirm the unresolved listing details before committing to the purchase.')
      const checks=(dedup.length?dedup:fallback).map((text,i)=>{
        const g=checkGuide(text)
        return `<article class="v081-check"><div class="v081-check-num">${i+1}</div><div class="v081-check-main"><h4>${esc(text)}</h4><div class="v081-check-grid"><div><span>WHY</span><p>${esc(g.why)}</p></div><div><span>GOOD RESULT</span><p>${esc(g.good)}</p></div><div><span>BAD RESULT</span><p>${esc(g.bad)}</p></div></div></div></article>`
      }).join('')
      const box=document.createElement('section')
      box.id='v081VerifyFirst'
      box.className='v081-verify'
      box.innerHTML=`<div class="v081-verify-head"><div><span class="eyebrow">VERIFY FIRST</span><h3>Do these checks before you act</h3><p>Complete them in order. A bad result can change this from a potential buy to negotiate or skip.</p></div><strong>${checks?`${(dedup.length?dedup:fallback).length} check${(dedup.length?dedup:fallback).length===1?'':'s'}`:'Check required'}</strong></div><div class="v081-check-list">${checks}</div>`
      const metrics=$('.direct-analysis-metrics',root)
      metrics?.insertAdjacentElement('afterend',box)
    }

    $$('.direct-analysis-section',root).forEach(section=>{
      const label=$(':scope > span',section)?.textContent?.trim().toUpperCase()||''
      if(['WHAT TO DO NEXT','QUESTIONS TO ASK'].includes(label)) section.classList.add('v081-replaced')
      else section.classList.add('v081-secondary')
    })

    const trust=$('#v079DecisionTrust',root)
    if(trust) trust.classList.add('v081-secondary-detail')
    const actions=$('.direct-analysis-actions',root)
    if(actions && !actions.dataset.v081){actions.dataset.v081='1'; const b=$('#directAnalyseAnother',actions); if(b)b.textContent='Analyse another listing'}
  }

  let timer
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  enhance()
})()
