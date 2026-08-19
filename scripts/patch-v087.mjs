import fs from 'node:fs'

function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.87 patch applied`)}else console.log(`${path}: v0.87 already applied`)}

for(const path of ['extension/sidepanel.html','extension/workspace.html'])update(path,s=>{
  if(!s.includes('scout-v087.css'))s=s.replace('</head>','  <link rel="stylesheet" href="scout-v087.css">\n</head>')
  if(!s.includes('scout-actions-v087.js'))s=s.replace('</body>','  <script type="module" src="scout-actions-v087.js"></script>\n</body>')
  return s
})

update('extension/scout-orchestrator-v080.js',s=>{
  s=s.replace("const a={...prior,...enrich,scout_enriched:true,scout_scan_depth:'enriched'}","const a={...prior,...enrich,overall_score:Number(enrich.opportunity_score??prior.overall_score??c.score??0),scout_enriched:true,scout_scan_depth:'enriched'}")
  s=s.replace("for(const c of rows.filter(c=>quickWorthwhile(c)&&!c.analysis?.scout_enriched))","for(const c of rows.filter(c=>(quickWorthwhile(c)||rec(c)==='verify_first'||!c.location||!c.condition||!c.seller_name||['missing_evidence','partial_evidence'].includes(c.analysis?.authenticity_evidence_state))&&!c.analysis?.scout_enriched))")
  return s
})

update('extension/marketplace-actions-v083.js',s=>{
  s=s.replace("const a={...prior,...e,user_evidence:clean(userEvidence)||prior.user_evidence||'',scout_enriched:true,scout_scan_depth:'enriched'}","const a={...prior,...e,overall_score:Number(e.opportunity_score??prior.overall_score??c.score??0),user_evidence:clean(userEvidence)||prior.user_evidence||'',scout_enriched:true,scout_scan_depth:'enriched'}")
  s=s.replace("if(message.fields?.location!==undefined)patch.location=clean(message.fields.location)||null\n    const rows=", "if(message.fields?.location!==undefined)patch.location=clean(message.fields.location)||null\n    if(message.fields?.condition!==undefined)patch.condition=clean(message.fields.condition)||null\n    if(message.fields?.seller_name!==undefined)patch.seller_name=clean(message.fields.seller_name)||null\n    const rows=")
  return s
})

update('extension/workspace-tools-v086.js',s=>{
  s=s.replace('<button data-act="queue">Add to Analyse</button>','')
  s=s.replace("if(act==='queue'){await extAction(c,'queue_analyse');toast('Added to Analyse');return}",'')
  if(!s.includes('async function startDealCandidate(c)')){
    const helper=`\nasync function startDealCandidate(c){\n  const user=await api.getUser();if(!user?.id)throw new Error('Connect FlippersAI first.')\n  const x=a(c),capture=c.deep_capture||{},raw={candidate_id:c.id,condition:c.condition||capture.condition||null,deep_capture:capture,analysis:x}\n  const row={user_id:user.id,source_platform:platform(c).toLowerCase(),source_url:c.source_url||capture.pageUrl||null,source_listing_id:c.listing_id||null,listing_title:c.title||capture.title||x.identified_name||null,listing_text:capture.listingText||capture.visibleText||c.raw_capture?.raw_text||'',seller_asking_price:c.asking_price??capture.askingPrice??null,currency:c.currency||'AUD',listing_location:c.location||capture.location||null,seller_name:c.seller_name||capture.sellerName||null,raw_listing:raw,updated_at:new Date().toISOString()}\n  let opp=null;if(c.opportunity_id){const found=await api.select('opportunities',\`select=*&id=eq.\${encodeURIComponent(c.opportunity_id)}&limit=1\`).catch(()=>[]);opp=found?.[0]||null}\n  if(opp){const updated=await api.update('opportunities',\`id=eq.\${opp.id}\`,row);opp=updated?.[0]||{...opp,...row}}else opp=await api.insert('opportunities',{...row,status:'watching'},{single:true})\n  if(!opp?.id)throw new Error('Could not create the Deal File.')\n  if(!c.opportunity_id)await patch(c,{opportunity_id:opp.id})\n  let workflow=null;for(let i=0;i<18;i++){const state=await api.workflowState().catch(()=>null);workflow=state?.workflows?.find(w=>w.opportunity_id===opp.id)||null;if(workflow)break;await new Promise(r=>setTimeout(r,220))}\n  if(workflow){location.href=\`\${location.pathname}?workflow=\${encodeURIComponent(workflow.id)}&opportunity=\${encodeURIComponent(opp.id)}\`;return}\n  toast('Deal created. Open Deals to continue it.')\n}\n`
    s=s.replace('\nfunction nearMisses()',helper+'\nfunction nearMisses()')
  }
  s=s.replace("if(act==='deal'){if(verify(c)&&!confirm('Verification is unresolved. FlippersAI recommends resolving it before buying. Continue anyway?'))return;toast('Open this lead in Deals from the existing Deal workflow.');return}","if(act==='deal'){if(verify(c)&&!confirm('Verification is unresolved. FlippersAI recommends resolving it before buying. Continue anyway?'))return;await startDealCandidate(c);return}")
  return s
})

update('extension/app.js',s=>{
  const old=`if (k === 'verify_listing') return \`<form id="verifyStep" class="form-stack"><div class="form-grid"><label>Item title<input name="title" value="\${esc(o.listing_title || a.identified_name || '')}" required></label><label>Exact asking price<input name="price" type="number" min="0" step="0.01" value="\${o.seller_asking_price ?? ''}" required></label></div><label>Location<input name="location" value="\${esc(o.listing_location || '')}"></label><button class="button primary">Confirm details \${icon('arrow',13)}</button></form>\``
  const next=`if (k === 'verify_listing') { const raw=o.raw_listing||{}, pending=!o.listing_title||o.seller_asking_price==null||!o.listing_location||!o.seller_name||!raw.condition; return \`<form id="verifyStep" class="form-stack">\${pending?'<div class="notice warn"><strong>Finishing listing details…</strong> FlippersAI has filled everything it has found so far. Missing fields mean the seller did not provide them yet or background enrichment is still finishing.</div>':'<div class="notice good">FlippersAI filled these details from the marketplace listing. Correct only anything that looks wrong.</div>'}<div class="form-grid"><label>Item title<input name="title" value="\${esc(o.listing_title||a.identified_name||'')}" placeholder="Not provided by seller"></label><label>Exact asking price<input name="price" type="number" min="0" step="0.01" value="\${o.seller_asking_price??''}" placeholder="Not provided"></label></div><div class="form-grid"><label>Location<input name="location" value="\${esc(o.listing_location||'')}" placeholder="Not provided by seller"></label><label>Condition<input name="condition" value="\${esc(raw.condition||'')}" placeholder="Not provided by seller"></label></div><label>Seller<input name="seller" value="\${esc(o.seller_name||'')}" placeholder="Not provided by seller"></label><button class="button primary">Confirm details \${icon('arrow',13)}</button></form>\` }`
  s=s.replace(old,next)
  s=s.replace("{ listing_title:f.get('title') || null, seller_asking_price:price, listing_location:f.get('location') || null, user_overrides:{ asking_price:price }, updated_at:new Date().toISOString() }","{ listing_title:f.get('title') || null, seller_asking_price:Number.isFinite(price)?price:null, listing_location:f.get('location') || null, seller_name:f.get('seller') || null, raw_listing:{...(w.opportunities?.raw_listing||{}),condition:f.get('condition')||null}, user_overrides:{ asking_price:Number.isFinite(price)?price:null }, updated_at:new Date().toISOString() }")
  return s
})

update('app.js',s=>{
  const rx=/if \(k === 'verify_listing'\) return `\n    <form id="verify" class="form-stack">[\s\S]*?<\/form>`/
  const replacement=`if (k === 'verify_listing') { const raw=o.raw_listing||{}, pending=!o.listing_title||o.seller_asking_price==null||!o.listing_location||!o.seller_name||!raw.condition; return \`\n    <form id="verify" class="form-stack">\n      \${pending?'<div class="notice warning"><strong>Finishing listing details…</strong> FlippersAI has filled everything it has found so far. Missing fields mean the seller did not provide them or enrichment is still finishing.</div>':'<div class="notice success">FlippersAI filled these details from the marketplace listing. Correct only anything that looks wrong.</div>'}\n      <div class="form-grid"><label>Item title<input name="title" value="\${esc(o.listing_title||a.identified_name||'')}" placeholder="Not provided by seller"></label><label>Exact asking price (AUD)<input name="price" type="number" min="0" step="0.01" value="\${o.seller_asking_price??''}" placeholder="Not provided"></label></div>\n      <div class="form-grid"><label>Location<input name="location" value="\${esc(o.listing_location||'')}" placeholder="Not provided by seller"></label><label>Condition<input name="condition" value="\${esc(raw.condition||'')}" placeholder="Not provided by seller"></label></div>\n      <label>Seller<input name="seller" value="\${esc(o.seller_name||'')}" placeholder="Not provided by seller"></label>\n      <button class="button primary">Confirm details \${icon('chevron',16)}</button>\n    </form>\` }`
  s=s.replace(rx,replacement)
  s=s.replace("{ listing_title:f.get('title') || null, seller_asking_price:price, listing_location:f.get('location') || null, user_overrides:{ asking_price:price }, updated_at:new Date().toISOString() }","{ listing_title:f.get('title') || null, seller_asking_price:Number.isFinite(price)?price:null, listing_location:f.get('location') || null, seller_name:f.get('seller') || null, raw_listing:{...(w.opportunities?.raw_listing||{}),condition:f.get('condition')||null}, user_overrides:{ asking_price:Number.isFinite(price)?price:null }, updated_at:new Date().toISOString() }")
  s=s.replace(/<h3>\$\{esc\(o\.listing_title \|\| a\.identified_name \|\| 'Untitled deal'\)\}<\/h3>/g,`<h3>\${o.source_url?\`<a class="deal-title-link" href="\${esc(o.source_url)}" target="_blank" rel="noopener">\${esc(o.listing_title||a.identified_name||'Listing')}</a>\`:esc(o.listing_title||a.identified_name||'Listing')}</h3>`)
  return s
})

update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.87.0';m.description='AI reseller workspace with evidence-aware Scout enrichment, actionable scan cards, Community Intel interactions and complete Deal data handoff.';return JSON.stringify(m,null,2)+'\n'})
update('package.json',s=>{const p=JSON.parse(s);p.version='0.87.0';return JSON.stringify(p,null,2)+'\n'})
