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
      .metric-audit-trigger{display:block;width:100%;margin-top:9px;padding:9px 0 0;border:0;border-top:1px solid #dce7eb;background:transparent;text-align:left;color:#4f7284;font:inherit;font-size:11px;font-weight:800;line-height:1.35;cursor:pointer}
      .metric-audit-trigger:hover{color:#244f63}.metric-audit-trigger[aria-expanded="true"]{color:#9a5b00}
      .metric-audit-trigger:focus-visible{outline:2px solid #f59e0b;outline-offset:3px;border-radius:4px}
      .metric-audit-panel{grid-column:1/-1;margin-top:2px;border:1px solid #d6e5eb;border-radius:16px;background:#fbfdfe;padding:18px 20px;box-shadow:0 8px 24px rgba(38,77,96,.06)}
      .metric-audit-panel[hidden]{display:none!important}
      .metric-audit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:15px}
      .metric-audit-head span{display:block;color:#738997;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:4px}
      .metric-audit-head strong{font-size:17px;color:#1e2d35}
      .metric-audit-close{border:0;background:#eef5f7;color:#4f6b79;border-radius:9px;width:32px;height:32px;cursor:pointer;font-size:18px;line-height:1}
      .metric-audit-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.85fr);gap:20px;align-items:start}
      .metric-audit-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 18px}
      .metric-audit-fact{padding:10px 12px;border:1px solid #e1ebef;border-radius:10px;background:#fff}
      .metric-audit-fact span{display:block;color:#748995;font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
      .metric-audit-fact strong{font-size:13px;color:#273941}
      .metric-audit-explain{color:#536b77;font-size:12px;line-height:1.55}.metric-audit-explain p{margin:0 0 9px!important}.metric-audit-explain p:last-child{margin-bottom:0!important}
      .audit-formula{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#eef5f7;color:#345563;padding:10px 12px;border-radius:10px;display:block;margin:0 0 10px;line-height:1.45;white-space:normal;word-break:normal}
      .audit-result{padding:11px 12px;border-radius:10px;background:#fff7e8;border:1px solid #f4d29b}.audit-result span{display:block;color:#8b611d;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.audit-result strong{font-size:18px;color:#5e4218}
      .audit-evidence-wrap{grid-column:1/-1;margin-top:4px}.audit-evidence-wrap>p{margin:0 0 7px!important;color:#536b77;font-size:12px}.audit-evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0;padding:0;list-style:none}.audit-evidence li{padding:9px 11px;border:1px solid #e1ebef;border-radius:9px;background:#fff;color:#5f7581;font-size:11px;line-height:1.4}.audit-evidence a{color:#3d6b80;text-decoration:underline}
      .decision-audit{margin-top:12px;border:1px solid #dce8ed;border-radius:12px;padding:11px 13px;background:#fbfdfe}.decision-audit summary{cursor:pointer;list-style:none;color:#4f7284;font-size:11px;font-weight:800}.decision-audit summary::-webkit-details-marker{display:none}.decision-audit-body{padding-top:9px;color:#536974;font-size:12px;line-height:1.5}.decision-audit-body ul{margin:6px 0 0;padding-left:18px}.decision-audit-body li+li{margin-top:5px}
      @media(max-width:850px){.metric-audit-layout{grid-template-columns:1fr}.metric-audit-facts,.audit-evidence{grid-template-columns:1fr}.metric-audit-panel{padding:15px}}
    `;document.head.appendChild(s)
  }

  function fact(label,value){return `<div class="metric-audit-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
  function moneyFact(label,value){return fact(label,fmt(value))}
  function auditContent(audit,label){
    let facts='',explain='',evidence=''
    if(label==='RESALE'){
      facts+=fact('Valuation type',audit.mode==='researched'?'Market-backed':audit.mode==='estimated'?'Estimated':'Unavailable')
      facts+=fact('Confidence',audit.confidence==null?'Not available':`${Math.round(Number(audit.confidence))}%`)
      facts+=moneyFact('Low estimate',audit.low)+moneyFact('Expected resale',audit.expected)+moneyFact('High estimate',audit.high)
      if(audit.basis)explain+=`<p><strong>How the valuation was formed:</strong> ${esc(audit.basis)}</p>`
      if(Array.isArray(audit.evidence)&&audit.evidence.length)evidence=`<div class="audit-evidence-wrap"><p><strong>Evidence used (${audit.evidence.length})</strong></p><ul class="audit-evidence">${audit.evidence.map(e=>`<li>${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title||e.marketplace||'Source')}</a>`:esc(e.title||e.marketplace||'Source')}<br>${esc(e.sold===true?'Sold comp':e.sold===false?'Active listing':'Reference')} · ${esc(e.match||'Unknown match')}${e.price!=null?` · ${esc(String(e.currency||'AUD'))} ${esc(String(e.price))}`:''}</li>`).join('')}</ul></div>`
    } else if(label==='PROFIT'){
      facts+=moneyFact('Expected resale',audit.inputs?.expected_resale)+moneyFact('Purchase price',audit.inputs?.purchase_price)+moneyFact('Purchase shipping',audit.inputs?.acquisition_shipping)+moneyFact('Selling costs',audit.inputs?.selling_costs)+moneyFact('Preparation costs',audit.inputs?.preparation_costs)
      explain+=`<span class="audit-formula">${esc(audit.formula||'')}</span><div class="audit-result"><span>Expected profit</span><strong>${esc(fmt(audit.result))}</strong></div>`
    } else if(label==='ROI'){
      facts+=moneyFact('Expected profit',audit.inputs?.expected_profit)+moneyFact('Invested capital',audit.inputs?.invested_capital)
      explain+=`<span class="audit-formula">${esc(audit.formula||'')}</span><div class="audit-result"><span>Expected ROI</span><strong>${esc(pct(audit.result_percent))}</strong></div>`
    } else if(label==='MAX BUY'){
      facts+=moneyFact('Expected resale',audit.inputs?.expected_resale)+moneyFact('Selling costs',audit.inputs?.selling_costs)+moneyFact('Preparation costs',audit.inputs?.preparation_costs)+moneyFact('Purchase shipping',audit.inputs?.acquisition_shipping)+moneyFact('Required target profit',audit.inputs?.target_profit)
      explain+=`<span class="audit-formula">${esc(audit.formula||'')}</span><div class="audit-result"><span>Maximum buy price</span><strong>${esc(fmt(audit.result))}</strong></div>${audit.target_rule?`<p style="margin-top:9px!important">${esc(audit.target_rule)}</p>`:''}`
    }
    return `<div class="metric-audit-layout"><div class="metric-audit-facts">${facts}</div><div class="metric-audit-explain">${explain}</div>${evidence}</div>`
  }

  function ensurePanel(metrics){
    let panel=document.getElementById('metricAuditSharedPanel')
    if(panel)return panel
    panel=document.createElement('section');panel.id='metricAuditSharedPanel';panel.className='metric-audit-panel';panel.hidden=true
    panel.innerHTML='<div class="metric-audit-head"><div><span>Calculation breakdown</span><strong id="metricAuditTitle"></strong></div><button class="metric-audit-close" type="button" aria-label="Close calculation breakdown">×</button></div><div id="metricAuditBody"></div>'
    metrics.appendChild(panel)
    panel.querySelector('.metric-audit-close')?.addEventListener('click',()=>closePanel(metrics,panel))
    return panel
  }
  function closePanel(metrics,panel){
    panel.hidden=true;panel.dataset.metric=''
    metrics.querySelectorAll('.metric-audit-trigger[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'))
  }
  function openPanel(metrics,panel,label,audit,button){
    const same=!panel.hidden&&panel.dataset.metric===label
    if(same){closePanel(metrics,panel);return}
    metrics.querySelectorAll('.metric-audit-trigger').forEach(b=>b.setAttribute('aria-expanded','false'))
    button.setAttribute('aria-expanded','true');panel.dataset.metric=label;panel.hidden=false
    const title=panel.querySelector('#metricAuditTitle'),body=panel.querySelector('#metricAuditBody')
    if(title)title.textContent=label==='RESALE'?'Resale valuation':label==='PROFIT'?'Expected profit':label==='ROI'?'Return on investment':'Maximum buy price'
    if(body)body.innerHTML=auditContent(audit,label)
  }
  function addAuditTrigger(card,audit,label,metrics,panel){
    if(!card||!audit||card.querySelector('.metric-audit-trigger'))return
    const b=document.createElement('button');b.type='button';b.className='metric-audit-trigger';b.setAttribute('aria-expanded','false');b.textContent='How was this worked out?'
    b.addEventListener('click',()=>openPanel(metrics,panel,label,audit,b));card.appendChild(b)
  }

  function enhance(){
    styles();const root=document.getElementById('directAnalysisResult'),payload=window.__flippersLastAuditedAnalysis
    if(!root||!payload?.audit||root.classList.contains('direct-analysis-loading')||root.classList.contains('direct-analysis-error'))return
    const metrics=root.querySelector('.direct-analysis-metrics');if(!metrics)return
    const cards=[...metrics.querySelectorAll(':scope>div')]
    const byLabel=label=>cards.find(c=>(c.querySelector(':scope>span')?.textContent||'').trim().toUpperCase()===label)
    const panel=ensurePanel(metrics)
    addAuditTrigger(byLabel('RESALE'),payload.audit.valuation,'RESALE',metrics,panel)
    addAuditTrigger(byLabel('PROFIT'),payload.audit.profit,'PROFIT',metrics,panel)
    addAuditTrigger(byLabel('ROI'),payload.audit.roi,'ROI',metrics,panel)
    addAuditTrigger(byLabel('MAX BUY'),payload.audit.max_buy,'MAX BUY',metrics,panel)
    if(!root.querySelector('.decision-audit')){
      const v=payload.audit.verdict||{},reasons=Array.isArray(v.decision_explanation)?v.decision_explanation:[],assumptions=Array.isArray(v.assumptions)?v.assumptions:[]
      const d=document.createElement('details');d.className='decision-audit';let body=''
      if(reasons.length)body+=`<strong>Why this verdict</strong><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
      body+=`<p><strong>Overall score:</strong> ${esc(v.overall_score??'Not available')}/100 · <strong>Success potential:</strong> ${esc(v.success_potential??'Not available')}/100</p>`
      body+=`<p><strong>Authenticity:</strong> ${esc(String(v.authenticity_status||'not established').replaceAll('_',' '))} · <strong>Valuation confidence:</strong> ${esc(v.valuation_confidence==null?'Not available':`${Math.round(Number(v.valuation_confidence))}%`)}</p>`
      if(assumptions.length)body+=`<strong>Assumptions</strong><ul>${assumptions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
      d.innerHTML=`<summary>Why did FlippersAI make this decision?</summary><div class="decision-audit-body">${body}</div>`;metrics.insertAdjacentElement('afterend',d)
    }
  }
  let t
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(enhance,50)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  document.addEventListener('flippers:analysis-audited',()=>setTimeout(enhance,80))
  enhance()
})()
