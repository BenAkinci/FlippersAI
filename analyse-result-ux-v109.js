(() => {
  function injectStyles(){
    if(document.getElementById('analyseResultUx109Styles')) return
    const s=document.createElement('style')
    s.id='analyseResultUx109Styles'
    s.textContent=`
      .direct-analysis-result[data-ux109="true"]{padding:26px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-result-head{align-items:flex-start;gap:24px}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-result-head h2{margin-bottom:6px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-result-head>div:first-child>p{max-width:720px;margin:0;color:#667d89;font-size:15px;line-height:1.45}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-metrics{margin-top:20px!important;gap:10px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-metrics>div{padding:14px!important;min-height:96px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-metrics strong{font-size:21px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-grid{gap:10px!important;margin-top:16px!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-panel{padding:16px!important;min-height:0!important}
      .direct-analysis-result[data-ux109="true"] .direct-analysis-panel>strong{display:block;font-size:15px;line-height:1.4}
      .result-detail-toggle{margin-top:9px;border:0;background:none;padding:0;color:#4f7284;font-size:12px;font-weight:750;cursor:pointer}
      .result-detail-toggle:hover{text-decoration:underline}
      .result-detail-body{margin-top:9px;padding-top:9px;border-top:1px solid #e5edf1;color:#657d89;font-size:13px;line-height:1.5}
      .result-detail-body p{margin:0!important}
      .result-summary-line{color:#657d89;font-size:13px;line-height:1.45;margin-top:6px}
      .valuation-mode-badge{display:inline-flex;margin-top:8px;padding:4px 8px;border-radius:999px;background:#fff5df;border:1px solid #efd49c;color:#8b5b0b;font-size:10px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
      .valuation-mode-badge.researched{background:#edf9f4;border-color:#c7e8dc;color:#26705a}
      .compact-action-card{margin-top:16px;border:1px solid #d9e6eb;border-radius:14px;padding:16px 18px;background:#fbfdfe}
      .compact-action-card>span{display:block;font-size:10px;letter-spacing:.12em;font-weight:850;color:#708794;margin-bottom:7px}
      .compact-action-card .primary-action{margin:0;font-size:15px;line-height:1.45;font-weight:680;color:#263943}
      .compact-action-card details{margin-top:10px}
      .compact-action-card summary{cursor:pointer;color:#4f7284;font-size:12px;font-weight:750;list-style:none}
      .compact-action-card summary::-webkit-details-marker{display:none}
      .compact-action-card ul{margin:10px 0 0;padding-left:18px;color:#536974;font-size:13px;line-height:1.5}
      .compact-action-card li+li{margin-top:6px}
      .compact-photo-findings{margin-top:10px!important;border:0!important;padding:0!important}
      .compact-photo-findings>span,.compact-photo-findings>ul{display:none!important}
      .compact-photo-findings details{border-top:1px solid #e4ecef;padding-top:12px}
      .compact-photo-findings summary{cursor:pointer;color:#4f7284;font-size:12px;font-weight:750}
      .compact-photo-findings ul{margin:10px 0 0;padding-left:18px;color:#607681;font-size:13px;line-height:1.5}
      @media(max-width:800px){
        .direct-analysis-result[data-ux109="true"]{padding:18px!important}
        .direct-analysis-result[data-ux109="true"] .direct-analysis-result-head{gap:14px}
        .direct-analysis-result[data-ux109="true"] .direct-analysis-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .direct-analysis-result[data-ux109="true"] .direct-analysis-grid{grid-template-columns:1fr!important}
      }
    `
    document.head.appendChild(s)
  }
  const firstSentence=text=>{const t=String(text||'').trim();if(!t)return'';const m=t.match(/^(.{1,150}?[.!?])(?:\s|$)/);return m?m[1]:t.slice(0,150)+(t.length>150?'…':'')}
  function makeExpandable(panel,label='Why?'){
    const p=panel.querySelector(':scope > p');if(!p||!p.textContent.trim())return
    const full=p.textContent.trim();p.remove();const summary=document.createElement('div');summary.className='result-summary-line';summary.textContent=firstSentence(full);panel.appendChild(summary)
    if(full.length>summary.textContent.length+5){const details=document.createElement('details');details.innerHTML=`<summary class="result-detail-toggle">${label}</summary><div class="result-detail-body"><p></p></div>`;details.querySelector('p').textContent=full;panel.appendChild(details)}
  }
  function compactActions(root){
    const sections=[...root.querySelectorAll('.direct-analysis-section')]
    const action=sections.find(s=>(s.querySelector(':scope > span')?.textContent||'').includes('WHAT TO DO NEXT'))
    if(action){const items=[...action.querySelectorAll('li')].map(li=>li.textContent.trim()).filter(Boolean);if(items.length){action.className='compact-action-card';action.innerHTML=`<span>NEXT BEST ACTION</span><p class="primary-action"></p>${items.length>1?'<details><summary>Show full action plan</summary><ul></ul></details>':''}`;action.querySelector('.primary-action').textContent=items[0];const ul=action.querySelector('ul');if(ul)items.slice(1).forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.appendChild(li)})}}
    const photos=sections.find(s=>(s.querySelector(':scope > span')?.textContent||'').includes('PHOTO FINDINGS'))
    if(photos){const items=[...photos.querySelectorAll('li')].map(li=>li.textContent.trim()).filter(Boolean);photos.classList.add('compact-photo-findings');const d=document.createElement('details');d.innerHTML='<summary>Show photo findings</summary><ul></ul>';items.forEach(x=>{const li=document.createElement('li');li.textContent=x;d.querySelector('ul').appendChild(li)});photos.appendChild(d)}
  }
  function enhanceResult(){
    injectStyles();const root=document.getElementById('directAnalysisResult');if(!root||root.classList.contains('direct-analysis-loading')||root.classList.contains('direct-analysis-error')||root.dataset.ux109==='true')return
    root.dataset.ux109='true';const headP=root.querySelector('.direct-analysis-result-head>div:first-child>p');if(headP)headP.textContent=firstSentence(headP.textContent)
    const panels=[...root.querySelectorAll('.direct-analysis-panel')]
    for(const panel of panels){const label=(panel.querySelector(':scope > span')?.textContent||'').toUpperCase();if(label.includes('AUTHENTICITY'))makeExpandable(panel,'Why?');else if(label.includes('VALUATION')){const txt=panel.textContent||'';makeExpandable(panel,'Show valuation basis');const badge=document.createElement('span');const estimated=/estimated|no live sold comps|unavailable/i.test(txt);badge.className=`valuation-mode-badge ${estimated?'':'researched'}`;badge.textContent=estimated?'Estimated valuation':'Market-backed valuation';panel.appendChild(badge)}else if(label.includes('CONDITION')){const strong=panel.querySelector(':scope > strong');if(strong&&strong.textContent.length>115){const full=strong.textContent.trim();strong.textContent=firstSentence(full);const d=document.createElement('details');d.innerHTML='<summary class="result-detail-toggle">More condition detail</summary><div class="result-detail-body"><p></p></div>';d.querySelector('p').textContent=full;panel.appendChild(d)}}}
    compactActions(root)
  }
  let timer;const app=document.getElementById('app');if(app)new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhanceResult,40)}).observe(app,{childList:true,subtree:true});enhanceResult()
})()
