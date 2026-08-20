import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.6 patch applied`)
  } else console.log(`${path}: v0.89.6 already applied`)
}

update('extension/scout-rating-overlay.js', s => {
  s = s.replace(
    /function schedule\(delay = \d+\) \{\n    clearTimeout\(timer\)\n    timer = setTimeout\(apply, delay\)\n  \}/,
    `function schedule(delay = 220) {\n    // v0.89.6: throttle marketplace repaint work. Dynamic grids such as Depop\n    // can emit hundreds of DOM mutations while scrolling; never run more than\n    // one overlay pass per throttle window.\n    if (timer) return\n    timer = setTimeout(() => { timer = null; apply() }, Math.max(180, delay))\n  }`
  )
  s = s.replace(
    'if (meaningful) { apply(); schedule(60); setTimeout(apply,220); setTimeout(apply,700) }',
    'if (meaningful) schedule(220)'
  )
  s = s.replace(/\n  if \(!window\.__flippersRatingHeartbeatV089\) \{[^\n]*\}/, '')
  s = s.replace(
    "document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') schedule(30) }, true)",
    "document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') schedule(220) }, true)"
  )
  return s
})

update('extension/marketplace-trust-overlay-v079.js', s => {
  const old = "new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,80)}).observe(document.documentElement,{childList:true,subtree:true})"
  const replacement = `const ownNode=node=>node?.nodeType===1&&(String(node.className||'').includes('flippersai-')||String(node.id||'').startsWith('flippers'))\n  new MutationObserver(mutations=>{\n    const meaningful=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>node.nodeType===1&&!ownNode(node)))\n    if(!meaningful)return\n    clearTimeout(timer);timer=setTimeout(apply,300)\n  }).observe(document.documentElement,{childList:true,subtree:true})`
  if (s.includes(old)) s = s.replace(old, replacement)
  return s
})

update('extension/workspace-actions-v0892.js', s => {
  const start = s.indexOf('async function startDeal(c){')
  const end = s.indexOf('\nfunction compareCard', start)
  if (start >= 0 && end > start && !s.includes('async function primeDealWorkflow(')) {
    const replacement = `const sleep=ms=>new Promise(r=>setTimeout(r,ms))\nasync function dealWorkflow(opportunityId){\n  for(let i=0;i<12;i++){const b=await api.workflowState().catch(()=>null),w=(b?.workflows||[]).find(x=>String(x.opportunity_id)===String(opportunityId));if(w)return w;await sleep(180)}\n  return null\n}\nasync function primeDealWorkflow(opportunity,c){\n  let w=await dealWorkflow(opportunity.id);if(!w)return null\n  const a=c.analysis||{},base={source:'scout_candidate',scout_candidate_id:c.id}\n  for(let i=0;i<4&&['capture_listing','verify_listing','analyse_deal'].includes(w.current_step);i++){\n    const data=w.current_step==='capture_listing'?{...base,captured:true,already_scanned:true}:w.current_step==='verify_listing'?{...base,verified:true,asking_price:c.asking_price??opportunity.seller_asking_price??null,details_carried_forward:true}:{...base,analysed:true,prior_analysis:true,recommendation:a.recommendation||c.recommendation||null}\n    await api.rpc('advance_flip_step',{p_workflow_id:w.id,p_step_key:w.current_step,p_step_data:data})\n    w=await dealWorkflow(opportunity.id)||w\n  }\n  return w\n}\nasync function startDeal(c){\n  let existing=(await api.select('opportunities',\`select=*&source_url=eq.\${encodeURIComponent(c.source_url||'')}&limit=1\`).catch(()=>[]))?.[0]\n  const wasExisting=Boolean(existing),a=c.analysis||{}\n  if(!existing){existing=await api.insert('opportunities',{user_id:c.user_id,source_platform:(()=>{try{return new URL(c.source_url).hostname.includes('depop')?'depop':new URL(c.source_url).hostname.includes('ebay')?'ebay':new URL(c.source_url).hostname.includes('facebook')?'facebook':'other'}catch{return'other'}})(),source_url:c.source_url||null,listing_title:c.title||a.identified_name||null,listing_text:c.deep_capture?.listingText||c.raw_capture?.raw_text||'',seller_asking_price:c.asking_price??null,listing_location:c.location||null,seller_name:c.seller_name||null,currency:c.currency||'AUD',raw_listing:{scout_candidate_id:c.id,analysis:a,condition:c.condition||null,thumbnail_url:c.thumbnail_url||null,already_scanned:true,already_analysed:true},status:(a.recommendation||c.recommendation)==='verify_first'?'verify':'negotiating',updated_at:new Date().toISOString()},{single:true})}\n  if(!existing?.id)throw new Error('Could not create Deal File')\n  const w=await primeDealWorkflow(existing,c)\n  await chrome.runtime.sendMessage({type:'FLIPPERS_OPEN_WORKSPACE',opportunityId:existing.id,workflowId:w?.id||null})\n  toast(wasExisting?'Deal opened':'Deal started')\n}`
    s = s.slice(0, start) + replacement + s.slice(end)
  }
  return s
})

update('extension/app.js', s => {
  s = s.replaceAll(
    'w.latest_analysis || latestAnalysis(w.opportunity_id) || {}',
    'w.latest_analysis || latestAnalysis(w.opportunity_id) || w.opportunities?.raw_listing?.analysis || {}'
  )
  s = s.replaceAll(
    'w.latest_analysis || latestAnalysis(w.opportunity_id), o = w.opportunities || {}',
    'w.latest_analysis || latestAnalysis(w.opportunity_id) || w.opportunities?.raw_listing?.analysis || {}, o = w.opportunities || {}'
  )
  if (!s.includes('async function normaliseImportedDeal(')) {
    const marker = 'function workPage() {'
    const helper = `function importedDealAnalysis(w){return w?.latest_analysis||latestAnalysis(w?.opportunity_id)||w?.opportunities?.raw_listing?.analysis||null}\nasync function normaliseImportedDeal(w){\n  if(!w?.id||!['capture_listing','verify_listing','analyse_deal'].includes(w.current_step)||!importedDealAnalysis(w))return\n  const key=\`deal-normalise-\${w.id}\`;if(state.temp[key])return;state.temp[key]=true\n  try{\n    let current=w\n    for(let i=0;i<4&&['capture_listing','verify_listing','analyse_deal'].includes(current.current_step);i++){\n      const a=importedDealAnalysis(current)||{},o=current.opportunities||{}\n      const data=current.current_step==='capture_listing'?{captured:true,already_scanned:true,source:'saved_analysed_lead'}:current.current_step==='verify_listing'?{verified:true,asking_price:o.seller_asking_price??null,details_carried_forward:true,source:'saved_analysed_lead'}:{analysed:true,prior_analysis:true,recommendation:a.recommendation||null,source:'saved_analysed_lead'}\n      await api.rpc('advance_flip_step',{p_workflow_id:current.id,p_step_key:current.current_step,p_step_data:data})\n      const bundle=await api.workflowState();state.bundle=bundle;current=arr(bundle.workflows).find(x=>x.id===w.id)||current\n    }\n    render()\n  }catch(error){toast(error.message||'Could not prepare this deal')}finally{delete state.temp[key]}\n}\n\n`
    s = s.replace(marker, helper + marker)
  }
  s = s.replace(
    "state.focusWorkflowId = w.id\n  state.focusOpportunityId = w.opportunity_id",
    "state.focusWorkflowId = w.id\n  state.focusOpportunityId = w.opportunity_id\n  if (['capture_listing','verify_listing','analyse_deal'].includes(w.current_step) && importedDealAnalysis(w)) setTimeout(() => normaliseImportedDeal(w), 0)"
  )
  s = s.replace(
    "if (k === 'capture_listing') return `<div class=\"form-stack\"><div class=\"notice\">Scan the current marketplace tab to replace this step with a full browser capture.</div><button class=\"button primary full\" id=\"workflowScan\">Scan current listing ${icon('scan',14)}</button></div>`",
    "if (k === 'capture_listing') { if (a.recommendation) return `<div class=\"form-stack\"><div class=\"notice\"><strong>Already scanned and analysed.</strong><br>FlippersAI is carrying this lead into the seller / negotiation stage. You do not need to scan it again.</div></div>`; return `<div class=\"form-stack\"><div class=\"notice\">Scan the current marketplace tab to replace this step with a full browser capture.</div><button class=\"button primary full\" id=\"workflowScan\">Scan current listing ${icon('scan',14)}</button></div>` }"
  )
  s = s.replaceAll('Skip this deal', 'Deal fell through')
  s = s.replace("if (!confirm('Skip this deal?')) return", "if (!confirm('Close this deal as fell through?')) return")
  s = s.replace("p_reason:'Skipped from Chrome extension'", "p_reason:'Deal fell through from Chrome extension'")
  return s
})

update('extension/manifest.json', s => {
  const m = JSON.parse(s)
  m.version = '0.89.6'
  m.description = 'FlippersAI marketplace performance and active-deal workflow hotfix.'
  return JSON.stringify(m, null, 2) + '\n'
})

update('package.json', s => {
  const p = JSON.parse(s)
  p.version = '0.89.6'
  return JSON.stringify(p, null, 2) + '\n'
})
