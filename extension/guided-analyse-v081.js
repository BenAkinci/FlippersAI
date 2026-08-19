(() => {
  if (window.__flippersExtGuidedAnalyseV081) return
  window.__flippersExtGuidedAnalyseV081 = true

  const $ = (s,r=document)=>r.querySelector(s)
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)]
  const esc = (v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim()

  function guidance(text=''){
    const t=text.toLowerCase()
    if(/auth|genuine|serial|model|logo|label|receipt|proof/.test(t)) return ['Confirms the exact item is safe to value and buy.','Identifiers and seller evidence are consistent.','Details are missing, inconsistent or suspicious.']
    if(/condition|damage|scratch|crack|stain|wear|fault|repair|working|test/.test(t)) return ['Condition changes resale value and repair cost.','Condition matches the listing with no serious hidden issue.','New damage, faults or repair needs appear.']
    if(/sold|comp|resale|market|price|value/.test(t)) return ['The profit estimate depends on real buyer demand.','Close sold examples support the target resale.','Only weak matches or lower sold prices are found.']
    if(/seller|message|ask|question|history/.test(t)) return ['The seller can confirm facts FlippersAI cannot see.','The seller answers clearly and supplies evidence.','The seller avoids, contradicts or cannot prove the claim.']
    return ['This unresolved point can change the recommendation.','The check confirms FlippersAI’s assumption.','The check fails or remains unresolved.']
  }

  function enhanceDecision(card){
    if(card.dataset.v081==='1')return
    const label=$('.decision-label',card)?.textContent?.trim().toLowerCase()||''
    if(label!=='verify first')return
    card.dataset.v081='1'
    const structured=$('.decision-structured',card)
    if(!structured)return
    const intro=$(':scope > p',structured)?.textContent?.trim()||''
    const li=$$('li',structured).map(x=>clean(x.textContent)).filter(Boolean)
    const checks=[...new Set(li)].slice(0,6)
    if(!checks.length && intro)checks.push(intro)
    if(!checks.length)checks.push('Confirm the unresolved listing details before buying.')
    structured.innerHTML=`<div class="v081-ext-verify-head"><strong>Do these checks before you act</strong><span>${checks.length} check${checks.length===1?'':'s'}</span></div><p class="v081-ext-intro">A bad result can change this from a potential buy to negotiate or skip.</p><div class="v081-ext-checks">${checks.map((text,i)=>{const g=guidance(text);return `<article class="v081-ext-check"><b>${i+1}</b><div><strong>${esc(text)}</strong><dl><div><dt>WHY</dt><dd>${esc(g[0])}</dd></div><div><dt>GOOD</dt><dd>${esc(g[1])}</dd></div><div><dt>BAD</dt><dd>${esc(g[2])}</dd></div></dl></div></article>`}).join('')}</div>`
  }

  function cleanDuplicateActions(){
    const root=$('.ext-main')
    if(!root)return
    const seen=new Map()
    $$('button',root).forEach(btn=>{
      const text=clean(btn.textContent).toLowerCase()
      if(!text||text.length>60)return
      const key=`${text}|${btn.id||''}`
      if(!seen.has(key)){seen.set(key,btn);return}
      const first=seen.get(key)
      if(first && first!==btn && !btn.closest('.question-actions')) btn.classList.add('v081-duplicate-action')
    })
  }

  function run(){
    $$('.decision').forEach(enhanceDecision)
    cleanDuplicateActions()
  }
  let timer
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,45)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  run()
})()
