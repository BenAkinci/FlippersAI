(() => {
  const originalFetch=window.fetch.bind(window)
  const fmt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'Not available':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v))
  const pct=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'Not available':`${Number(v).toFixed(1)}%`
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const getUrl=input=>typeof input==='string'?input:(input instanceof Request?input.url:String(input||''))
  const getMethod=(input,init)=>String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()
  const copyAuthHeaders=(input,init)=>{
    const src=new Headers(input instanceof Request?input.headers:undefined)
    if(init?.headers)new Headers(init.headers).forEach((v,k)=>src.set(k,v))
    const out={'Content-Type':'application/json'}
    for(const k of ['authorization','apikey','x-client-info']){const v=src.get(k);if(v)out[k]=v}
    return out
  }

  window.fetch=async function(input,init){
    const url=getUrl(input),method=getMethod(input,init)
    const response=await originalFetch(input,init)
    if(method!=='POST'||!/\/functions\/v1\/analyse-listing-v2(?:\?|$)/.test(url)||!response.ok)return response
    try{
      const payload=await response.clone().json()
      if(payload?.error)return response
      const base=url.replace(/\/functions\/v1\/analyse-listing-v2(?:\?.*)?$/,'')
      const auditResponse=await originalFetch(`${base}/functions/v1/analyse-postprocess`,{method:'POST',headers:copyAuthHeaders(input,init),body:JSON.stringify({payload})})
      if(!auditResponse.ok)return response
      const audited=await auditResponse.json()
      if(audited?.error)return response
      window.__flippersLastAuditedAnalysis=audited
      document.dispatchEvent(new CustomEvent('flippers:analysis-audited',{detail:audited}))
      return new Response(JSON.stringify(audited),{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)})
    }catch(e){console.warn('Analyse audit pass-through',e);return response}
  }

  function styles(){
    if(document.getElementById('analyseTransparency122Styles'))return
    const s=document.createElement('style');s.id='analyseTransparency122Styles';s.textContent=`
      .metric-audit{margin-top:9px;border-top:1px solid #e4ecef;padding-top:8px}
      .metric-audit summary,.decision-audit summary{cursor:pointer;list-style:none;color:#4f7284;font-size:11px;font-weight:800}
      .metric-audit summary::-webkit-details-marker,.decision-audit summary::-webkit-details-marker{display:none}
      .metric-audit-body{padding-top:8px;color:#5f7581;font-size:11px;line-height:1.5}
      .metric-audit-body p{margin:0 0 5px!important}.metric-audit-body p:last-child{margin-bottom:0!important}
      .audit-formula{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f6fafb;padding:6px 7px;border-radius:7px;display:block;margin:6px 0}
      .decision-audit{margin-top:12px;border:1px solid #dce8ed;border-radius:12px;padding:11px 13px;background:#fbfdfe}
      .decision-audit-body{padding-top:9px;color:#536974;font-size:12px;line-height:1.5}
      .decision-audit-body ul{margin:6px 0 0;padding-left:18px}.decision-audit-body li+li{margin-top:5px}
      .audit-evidence{margin-top:7px;padding-left:17px}.audit-evidence li+li{margin-top:5px}.audit-evidence a{color:#3d6b80;text-decoration:underline}
    `;document.head.appendChild(s)
  }
  function moneyLine(label,value){return `<p><strong>${esc(label)}:</strong> ${esc(fmt(value))}</p>`}
  function addAuditToCard(card,audit,label){
    if(!card||card.querySelector('.metric-audit')||!audit)return
    let html=''
    if(label==='RESALE'){
      html+=`<p><strong>Type:</strong> ${esc(audit.mode==='researched'?'Market-backed valuation':audit.mode==='estimated'?'Estimated valuation':'Unavailable')}</p>`
      html+=`<p><strong>Confidence:</strong> ${esc(audit.confidence==null?'Not available':`${Math.round(Number(audit.confidence))}%`)}</p>`
      html+=moneyLine('Low',audit.low)+moneyLine('Expected',audit.expected)+moneyLine('High',audit.high)
      if(audit.basis)html+=`<p><strong>Basis:</strong> ${esc(audit.basis)}</p>`
      if(Array.isArray(audit.evidence)&&audit.evidence.length){html+=`<p><strong>Evidence used:</strong> ${audit.evidence.length}</p><ul class="audit-evidence">${audit.evidence.map(e=>`<li>${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title||e.marketplace||'Source')}</a>`:esc(e.title||e.marketplace||'Source')} — ${esc(e.sold===true?'sold':e.sold===false?'active':'reference')} · ${esc(e.match||'unknown match')}${e.price!=null?` · ${esc(String(e.currency||'AUD'))} ${esc(String(e.price))}`:''}</li>`).join('')}</ul>`}
    } else if(label==='PROFIT'){
      html+=moneyLine('Expected resale',audit.inputs?.expected_resale)+moneyLine('Purchase price',audit.inputs?.purchase_price)+moneyLine('Purchase shipping',audit.inputs?.acquisition_shipping)+moneyLine('Selling costs',audit.inputs?.selling_costs)+moneyLine('Preparation costs',audit.inputs?.preparation_costs)
      html+=`<span class="audit-formula">${esc(audit.formula||'')}</span>${moneyLine('Expected profit',audit.result)}`
    } else if(label==='ROI'){
      html+=moneyLine('Expected profit',audit.inputs?.expected_profit)+moneyLine('Invested capital',audit.inputs?.invested_capital)
      html+=`<span class="audit-formula">${esc(audit.formula||'')}</span><p><strong>ROI:</strong> ${esc(pct(audit.result_percent))}</p>`
    } else if(label==='MAX BUY'){
      html+=moneyLine('Expected resale',audit.inputs?.expected_resale)+moneyLine('Selling costs',audit.inputs?.selling_costs)+moneyLine('Preparation costs',audit.inputs?.preparation_costs)+moneyLine('Purchase shipping',audit.inputs?.acquisition_shipping)+moneyLine('Required target profit',audit.inputs?.target_profit)
      html+=`<span class="audit-formula">${esc(audit.formula||'')}</span>${moneyLine('Maximum buy price',audit.result)}`
      if(audit.target_rule)html+=`<p>${esc(audit.target_rule)}</p>`
    }
    if(!html)return
    const d=document.createElement('details');d.className='metric-audit';d.innerHTML=`<summary>How was this worked out?</summary><div class="metric-audit-body">${html}</div>`;card.appendChild(d)
  }
  function enhance(){
    styles();const root=document.getElementById('directAnalysisResult'),payload=window.__flippersLastAuditedAnalysis
    if(!root||!payload?.audit||root.classList.contains('direct-analysis-loading')||root.classList.contains('direct-analysis-error'))return
    const cards=[...root.querySelectorAll('.direct-analysis-metrics>div')]
    const byLabel=label=>cards.find(c=>(c.querySelector(':scope>span')?.textContent||'').trim().toUpperCase()===label)
    addAuditToCard(byLabel('RESALE'),payload.audit.valuation,'RESALE')
    addAuditToCard(byLabel('PROFIT'),payload.audit.profit,'PROFIT')
    addAuditToCard(byLabel('ROI'),payload.audit.roi,'ROI')
    addAuditToCard(byLabel('MAX BUY'),payload.audit.max_buy,'MAX BUY')
    if(!root.querySelector('.decision-audit')){
      const v=payload.audit.verdict||{},reasons=Array.isArray(v.decision_explanation)?v.decision_explanation:[]
      const assumptions=Array.isArray(v.assumptions)?v.assumptions:[]
      const d=document.createElement('details');d.className='decision-audit';let body=''
      if(reasons.length)body+=`<strong>Why this verdict</strong><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
      body+=`<p><strong>Overall score:</strong> ${esc(v.overall_score??'Not available')}/100 · <strong>Success potential:</strong> ${esc(v.success_potential??'Not available')}/100</p>`
      body+=`<p><strong>Authenticity:</strong> ${esc(String(v.authenticity_status||'not established').replaceAll('_',' '))} · <strong>Valuation confidence:</strong> ${esc(v.valuation_confidence==null?'Not available':`${Math.round(Number(v.valuation_confidence))}%`)}</p>`
      if(assumptions.length)body+=`<strong>Assumptions</strong><ul>${assumptions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
      d.innerHTML=`<summary>Why did FlippersAI make this decision?</summary><div class="decision-audit-body">${body}</div>`
      const metrics=root.querySelector('.direct-analysis-metrics');metrics?.insertAdjacentElement('afterend',d)
    }
  }
  let t
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(enhance,50)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  document.addEventListener('flippers:analysis-audited',()=>setTimeout(enhance,80))
  enhance()
})()
