(() => {
  if(window.__flippersRatingPanelV083)return
  window.__flippersRatingPanelV083=true
  const BADGE='flippersai-cover-score-v077',PANEL='flippersai-rating-panel-v083'
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const arr=v=>Array.isArray(v)?v.filter(Boolean):[]
  const labelStatus=s=>({likely_genuine:'Strong evidence of genuine',uncertain:'Not enough evidence yet',high_risk:'High counterfeit risk',likely_counterfeit:'Likely counterfeit',not_applicable:'Not applicable'})[s]||'Not assessed'
  const evidenceLabel=s=>({strong_evidence:'Strong authentication evidence visible',partial_evidence:'Some evidence visible, more needed',missing_evidence:'Authentication evidence missing',conflicting_evidence:'Visible evidence contains inconsistencies',not_applicable:'Not applicable'})[s]||'Evidence not yet assessed'

  function style(){if(document.getElementById('flippers-rating-panel-style-v083'))return;const s=document.createElement('style');s.id='flippers-rating-panel-style-v083';s.textContent=`
    .${BADGE}{pointer-events:auto!important;cursor:pointer!important}
    .${PANEL}{position:absolute!important;z-index:2147483647!important;width:min(390px,calc(100vw - 24px))!important;max-height:520px!important;overflow:auto!important;background:#fff!important;color:#17212a!important;border:1px solid #d9e3e8!important;border-radius:14px!important;box-shadow:0 18px 50px rgba(15,35,45,.24)!important;padding:14px!important;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
    .${PANEL} *{box-sizing:border-box!important}. ${PANEL} h3{margin:0 0 4px!important;font-size:15px!important}. ${PANEL} .muted{color:#657783!important}. ${PANEL} .grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;margin:10px 0!important}. ${PANEL} .metric{background:#f5f8fa!important;border-radius:9px!important;padding:8px!important}. ${PANEL} .metric span{display:block!important;color:#6b7b86!important;font-size:10px!important;text-transform:uppercase!important;font-weight:800!important}. ${PANEL} .metric b{display:block!important;margin-top:2px!important}. ${PANEL} .section{border-top:1px solid #e6ecef!important;padding-top:9px!important;margin-top:9px!important}. ${PANEL} ul{margin:5px 0 0 18px!important;padding:0!important}. ${PANEL} .actions{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:10px!important}. ${PANEL} button{border:0!important;border-radius:8px!important;padding:8px 10px!important;font:700 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;cursor:pointer!important;background:#e9f1f5!important;color:#19313d!important}. ${PANEL} button.primary{background:#167e5d!important;color:#fff!important}. ${PANEL} button.warn{background:#fff2d8!important;color:#744b00!important}. ${PANEL} textarea{width:100%!important;min-height:68px!important;border:1px solid #cfdce2!important;border-radius:8px!important;padding:8px!important;font:500 12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;resize:vertical!important}. ${PANEL} .status{margin-top:8px!important;font-weight:700!important;color:#31515e!important}
  `.replace(/\. flippers/g,'.flippers');document.documentElement.appendChild(s)}

  function closeAll(except=null){document.querySelectorAll(`.${PANEL}`).forEach(p=>{if(p!==except)p.remove()})}
  async function action(id,action,extra={}){return chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action,...extra})}

  function list(items,empty='None detected'){const xs=arr(items);return xs.length?`<ul>${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<div class="muted">${esc(empty)}</div>`}
  function score(c){const a=c?.analysis||{};return Math.round(Number(a.overall_score??c?.score??0))}
  function potential(c){const a=c?.analysis||{};return Math.round(Number(a.opportunity_score??a.overall_score??c?.score??0))}
  function confidence(c){const a=c?.analysis||{};const v=a.overall_confidence??a.identification_confidence??a.condition_confidence;return v==null?'—':`${Math.round(Number(v))}%`}

  function render(panel,c){
    const a=c.analysis||{},auth=a.authenticity_status||'uncertain',evidence=a.authenticity_evidence_state||'',request=a.authentication_request||'',reasons=arr(a.reasons).length?a.reasons:(arr(a.score_reasoning).length?a.score_reasoning:a.authenticity_reasons||[])
    panel.innerHTML=`<h3>Why FlippersAI rated this ${score(c)}/100</h3><div class="muted">${esc(a.action_summary||a.resale_basis||'This score is based on the evidence available to Scout so far.')}</div>
      <div class="grid"><div class="metric"><span>Opportunity</span><b>${potential(c)}/100</b></div><div class="metric"><span>Confidence</span><b>${confidence(c)}</b></div><div class="metric"><span>Authenticity</span><b>${esc(labelStatus(auth))}</b></div><div class="metric"><span>Decision</span><b>${esc(String(c.recommendation||a.recommendation||'rated').replaceAll('_',' '))}</b></div></div>
      <div class="section"><b>How the rating was reached</b>${list(reasons,'No detailed reasons were stored for this older rating.')}</div>
      <div class="section"><b>${esc(evidenceLabel(evidence))}</b>${list(a.authenticity_evidence_seen,'No authentication labels/tags were confirmed from the current evidence.')}${arr(a.missing_authenticity_evidence).length?`<div style="margin-top:6px"><b>Still needed</b>${list(a.missing_authenticity_evidence)}</div>`:''}${arr(a.authenticity_reasons).length?`<div style="margin-top:6px"><b>Authenticity reasoning</b>${list(a.authenticity_reasons)}</div>`:''}</div>
      ${request?`<div class="section"><b>Recommended seller request</b><div style="margin-top:5px">${esc(request)}</div><div class="actions"><button data-v083-copy>Copy seller message</button></div></div>`:''}
      <div class="section"><b>Think FlippersAI missed something?</b><div class="muted" style="margin:4px 0 7px">Add evidence or your observation. FlippersAI will rescan it rather than simply accepting the disagreement.</div><textarea data-v083-evidence placeholder="e.g. The product code is visible in photo 4 and matches this colourway; seller says they have the receipt."></textarea><div class="actions"><button class="warn" data-v083-rescan>Add info & rescan</button></div></div>
      <div class="actions"><button class="primary" data-v083-save>${c.saved?'Saved ✓':'Save'}</button><button class="primary" data-v083-analyse>Analyse now</button><button data-v083-queue>Add to Analyse</button><button data-v083-open>Open listing</button></div><div class="status" data-v083-status></div>`
    const status=panel.querySelector('[data-v083-status]'),set=t=>{status.textContent=t||''}
    panel.querySelector('[data-v083-save]').onclick=async e=>{e.preventDefault();e.stopPropagation();set('Saving…');const r=await action(c.id,'save');if(!r?.ok)return set(r?.error||'Could not save.');c=r.data;e.currentTarget.textContent='Saved ✓';set('Saved to your FlippersAI items.')}
    panel.querySelector('[data-v083-queue]').onclick=async e=>{e.preventDefault();e.stopPropagation();set('Adding to Analyse…');const r=await action(c.id,'queue_analyse');set(r?.ok?'Added to Analyse.':r?.error||'Could not add to Analyse.')}
    panel.querySelector('[data-v083-analyse]').onclick=async e=>{e.preventDefault();e.stopPropagation();set('Running deeper analysis… this can take a little while.');const evidence=panel.querySelector('[data-v083-evidence]').value;const r=await action(c.id,'analyse',{userEvidence:evidence});if(!r?.ok)return set(r?.error||'Analysis failed.');c=r.data;render(panel,c)}
    panel.querySelector('[data-v083-rescan]').onclick=async e=>{e.preventDefault();e.stopPropagation();const evidence=panel.querySelector('[data-v083-evidence]').value.trim();if(!evidence)return set('Add the extra information first.');set('Rescanning with the new evidence…');const r=await action(c.id,'rescan',{userEvidence:evidence});if(!r?.ok)return set(r?.error||'Rescan failed.');c=r.data;render(panel,c)}
    panel.querySelector('[data-v083-open]').onclick=e=>{e.preventDefault();e.stopPropagation();if(c.source_url)window.open(c.source_url,'_blank','noopener')}
    panel.querySelector('[data-v083-copy]')?.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();try{await navigator.clipboard.writeText(request);set('Seller message copied.')}catch{set('Could not copy automatically.')}})
  }

  async function openForBadge(badge){
    const id=badge.dataset.flippersCandidate
    if(!id)return
    const root=badge.parentElement;if(!root)return
    const existing=root.querySelector(`:scope > .${PANEL}`);if(existing){existing.remove();return}
    closeAll();const p=document.createElement('div');p.className=PANEL;p.innerHTML='<b>Loading rating explanation…</b>';root.appendChild(p)
    p.style.left=`${Math.max(4,badge.offsetLeft)}px`;p.style.top=`${badge.offsetTop+badge.offsetHeight+7}px`
    const r=await action(id,'detail');if(!r?.ok){p.innerHTML=`<b>Could not load this rating</b><div class="muted">${esc(r?.error||'Unknown error')}</div>`;return}render(p,r.data)
  }

  document.addEventListener('click',e=>{const badge=e.target.closest?.(`.${BADGE}`);if(badge){e.preventDefault();e.stopPropagation();openForBadge(badge).catch(()=>{});return}if(!e.target.closest?.(`.${PANEL}`))closeAll()},true)
  style()
})()
