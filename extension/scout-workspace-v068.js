import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))
const money=v=>v==null||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct=v=>v==null||Number.isNaN(Number(v))?'—':`${Math.round(Number(v))}%`
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ACTIVE_SCOUT_KEY='flippers_active_scout_session_v068'
let analyseView=false
let enhancing=false
let timer=null

function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)}
function platform(url=''){let h='';try{h=new URL(url).hostname.toLowerCase()}catch{};return h.includes('facebook.com')?'facebook':h.includes('ebay.com.au')?'ebay':h.includes('gumtree.com.au')?'gumtree':h.includes('depop.com')?'depop':'other'}
const platformLabel=url=>({facebook:'Facebook Marketplace',ebay:'eBay',gumtree:'Gumtree',depop:'Depop',other:'Marketplace'})[platform(url)]
const rated=c=>['rated','analysed'].includes(c?.scan_status)||Boolean(c?.recommendation||c?.analysis?.recommendation)
const deep=c=>c?.scan_status==='analysed'
const recLabel=v=>({strong_buy:'Strong lead',buy:'Strong lead',negotiate:'Promising',verify_first:'Needs verification',skip:'Skip'})[v]||'Rated'
const recClass=v=>['strong_buy','buy'].includes(v)?'good':['negotiate','verify_first'].includes(v)?'warn':v==='skip'?'bad':''
const confidence=c=>{const a=c?.analysis||{};return a.overall_confidence??a.valuation_confidence??a.identification_confidence??null}

function rankScore(a={}){const r=a.recommendation,b=r==='strong_buy'?22:r==='buy'?18:r==='negotiate'?10:r==='verify_first'?3:r==='skip'?-25:0,s=Number(a.overall_score||0),p=Number(a.expected_profit||0),roi=Number(a.expected_roi_percent||0),c=Number(a.overall_confidence??a.valuation_confidence??0);return Math.round((s+b+Math.max(-15,Math.min(20,p/10))+Math.max(-8,Math.min(8,roi/20))+Math.max(0,Math.min(6,c/20)))*10)/10}

async function fetchCandidate(id){const rows=await api.select('scout_candidates',`select=*&id=eq.${encodeURIComponent(id)}&limit=1`);return rows?.[0]||null}
async function savedCandidates(){return await api.select('scout_candidates','select=*&saved=eq.true&order=saved_at.desc.nullslast,updated_at.desc&limit=120').catch(()=>[])}

function ensureAnalyseNav(){
  const nav=$('.ext-nav');if(!nav||nav.querySelector('[data-v068-analyse]'))return
  const btn=document.createElement('button');btn.type='button';btn.dataset.v068Analyse='1';btn.innerHTML='<span class="v068-nav-glyph">✦</span> Analyse'
  const deals=nav.querySelector('[data-view="deals"]');nav.insertBefore(btn,deals||null)
}

function explainDeals(){
  const eyebrow=$('.ext-main .page-head .eyebrow');if(!eyebrow||eyebrow.textContent.trim()!=='DEALS')return
  const p=eyebrow.closest('.page-head')?.querySelector('p');if(p&&!p.dataset.v068Deals){p.dataset.v068Deals='1';p.textContent='Deals are the flips you have chosen to pursue. Saved Scout leads stay in Analyse until you decide they are worth turning into an active Deal File.'}
  const h=eyebrow.closest('.page-head')?.querySelector('h1');if(h)h.textContent='Active deals'
}

function loading(on,title='Analysing listing',detail='Opening the real listing and reading the full page…'){
  let box=$('#v068AnalysisLoader')
  if(!on){box?.remove();return}
  if(!box){box=document.createElement('div');box.id='v068AnalysisLoader';box.className='v068-analysis-loader';document.body.appendChild(box)}
  box.innerHTML=`<span class="v068-spinner"></span><div><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>`
}

async function waitTab(id,timeout=18000){return new Promise((resolve,reject)=>{let done=false;const finish=e=>{if(done)return;done=true;clearTimeout(t);chrome.tabs.onUpdated.removeListener(listener);e?reject(e):resolve()};const listener=(tabId,info)=>{if(tabId===id&&info.status==='complete')finish()};chrome.tabs.onUpdated.addListener(listener);const t=setTimeout(()=>finish(new Error('Timed out loading the listing.')),timeout);chrome.tabs.get(id).then(tab=>{if(tab.status==='complete')finish()}).catch(()=>{})})}
async function scanTab(id){let last;for(let i=0;i<5;i++){try{const r=await chrome.tabs.sendMessage(id,{type:'FLIPPERS_SCAN_PAGE'});if(r?.ok)return r.data;if(r?.error)last=new Error(r.error)}catch(e){last=e;try{await chrome.scripting.executeScript({target:{tabId:id},files:['content.js']})}catch{};await sleep(300+i*220)}}throw last||new Error('Could not read the listing page.')}
function toDataUrl(buffer,mime='image/jpeg'){const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+32768,bytes.length)));return`data:${mime};base64,${btoa(binary)}`}
async function loadImage(url){if(!/^https?:/i.test(String(url||'')))return null;try{const r=await fetch(url,{credentials:'include',cache:'force-cache'});if(!r.ok)return null;const type=r.headers.get('content-type')||'';if(!type.startsWith('image/'))return null;const b=await r.blob();if(b.size>4_500_000)return null;return toDataUrl(await b.arrayBuffer(),type)}catch{return null}}

async function deepAnalyse(c,{foreground=true}={}){
  const now=new Date().toISOString();await api.update('scout_candidates',`id=eq.${c.id}`,{saved:true,saved_at:c.saved_at||now,updated_at:now}).catch(()=>{})
  loading(true,'Deep analysing listing','Opening the actual listing, reading seller/location/condition/description and checking the available images…')
  let tab=null
  try{
    tab=await chrome.tabs.create({url:c.source_url,active:foreground});await waitTab(tab.id);await sleep(700)
    const capture=await scanTab(tab.id),images=[]
    for(const url of (capture.imageUrls||[]).slice(0,6)){const data=await loadImage(url);if(data)images.push(data)}
    loading(true,'Running full FlippersAI analysis',`Captured ${images.length} usable image${images.length===1?'':'s'} plus the full rendered listing.`)
    const state=await api.workflowState(),profile=state.profile||{},portfolio=state.portfolio||{},price=capture.askingPrice??c.asking_price??null
    const result=await api.invoke('analyse-listing-v2',{listing_url:c.source_url,listing_text:capture.listingText||capture.visibleText||'',platform_fields:{asking_price:price,currency:c.currency||'AUD',asking_price_verified:price!=null,asking_price_confidence:price!=null?1:0,listing_title:capture.title||c.title||'',listing_location:capture.location||c.location||'',seller_name:capture.sellerName||c.seller_name||''},user_overrides:{asking_price:price,currency:c.currency||'AUD'},bankroll:Number(portfolio.available_cash||0),risk_profile:profile.risk_profile||'conservative',reserve_percent:Number(profile.capital_reserve_percent??30),max_exposure_percent:Number(profile.max_single_item_exposure_percent??20),portfolio_context:portfolio,images,scan_context:{mode:'deep',instruction:'User explicitly chose Analyse. Inspect the full authenticated listing page and images. Resolve item identity, exact variant, condition, seller/location information, inclusions, authenticity concerns, resale evidence, costs and risk as far as the evidence supports.'}})
    if(result?.error)throw new Error(result.error)
    const a={...(result.analysis||{}),engine_version:result.engine_version||'flippers-alpha-4-price-lock',scout_scan_depth:'deep'}
    const body={title:capture.title||c.title||null,asking_price:price,location:capture.location||c.location||null,condition:capture.condition||c.condition||null,seller_name:capture.sellerName||c.seller_name||null,thumbnail_url:capture.imageUrls?.[0]||c.thumbnail_url||null,deep_capture:capture,analysis:a,scan_status:'analysed',recommendation:a.recommendation||null,score:a.overall_score??null,resale_mid:a.resale_mid??null,expected_profit:a.expected_profit??null,expected_roi_percent:a.expected_roi_percent??null,rank_score:rankScore(a),saved:true,saved_at:c.saved_at||now,last_deep_scanned_at:now,updated_at:now}
    await api.update('scout_candidates',`id=eq.${c.id}`,body);Object.assign(c,body)
    await chrome.runtime.sendMessage({type:'FLIPPERS_ROUTE_RATING_OVERLAY',enabled:true,ratings:[{id:String(c.id),listingId:c.listing_id||'',url:c.source_url||'',score:Math.round(Number(a.overall_score||0)),recommendation:a.recommendation||'',label:recLabel(a.recommendation),profit:a.expected_profit??null,resale:a.resale_mid??null,roi:a.expected_roi_percent??null,confidence:a.overall_confidence??a.valuation_confidence??null}]}).catch(()=>{})
    document.dispatchEvent(new CustomEvent('flippers:candidate-updated',{detail:{id:c.id}}))
    const head=$('.scout-page-head');if(head){const ping=document.createElement('i');ping.hidden=true;head.appendChild(ping);setTimeout(()=>ping.remove(),0)}
    toast(`Deep analysis ready · ${Math.round(Number(a.overall_score||0))}/100`)
    return c
  }finally{loading(false)}
}

async function setSaved(c,on){const now=new Date().toISOString();const body={saved:on,saved_at:on?(c.saved_at||now):null,updated_at:now};await api.update('scout_candidates',`id=eq.${c.id}`,body);Object.assign(c,body);updateSaveButtons(c.id,on);document.dispatchEvent(new CustomEvent('flippers:candidate-updated',{detail:{id:c.id}}));toast(on?'Saved to Analyse':'Removed from saved leads')}
function updateSaveButtons(id,on){$$(`[data-candidate="${CSS.escape(String(id))}"] [data-save-candidate]`).forEach(b=>{b.textContent=on?'Saved ✓':'Save';b.classList.toggle('saved',on)})}

async function waitWorkflow(opportunityId){for(let i=0;i<15;i++){const rows=await api.select('flip_workflows',`select=*&opportunity_id=eq.${encodeURIComponent(opportunityId)}&limit=1`);if(rows?.[0])return rows[0];await sleep(180)}throw new Error('Deal File saved, but its workflow did not initialise.')}
async function saveAnalysis(opportunityId,c,userId){const x=c.analysis||{};return api.insert('analyses',{opportunity_id:opportunityId,user_id:userId,engine_version:x.engine_version||'flippers-alpha-4-price-lock',identified_name:x.identified_name||c.title||'',brand:x.brand||'',model:x.model||'',variant:x.variant||'',category:x.category||'',identification_confidence:x.identification_confidence??0,resale_low:x.resale_low,resale_mid:x.resale_mid,resale_high:x.resale_high,quick_sale_value:x.quick_sale_value,sell_time_low_days:x.sell_time_low_days,sell_time_mid_days:x.sell_time_mid_days,sell_time_high_days:x.sell_time_high_days,valuation_confidence:x.valuation_confidence??0,overall_score:x.overall_score??0,overall_risk:x.overall_risk??0,recommendation:x.recommendation,recommended_offer:x.recommended_offer,max_buy:x.max_buy,break_even_sale_price:x.break_even_sale_price,expected_selling_costs:x.expected_selling_costs,expected_profit:x.expected_profit,expected_roi_percent:x.expected_roi_percent,quick_sale_profit:x.quick_sale_profit,next_action:x.next_action,questions_to_ask:x.questions_to_ask||[],inspection_checks:x.inspection_checks||[],risks:x.risks||{},assumptions:x.assumptions||[],evidence_summary:x.evidence_summary||'',raw_model_output:x,action_summary:x.action_summary||'',action_steps:x.action_steps||[],action_cautions:x.action_cautions||[],seller_message:x.seller_message||'',photo_findings:x.photo_findings||[],photo_count:(c.deep_capture?.imageUrls||[]).length,user_overrides:{asking_price:c.asking_price},seller_confidence:x.seller_confidence??null,seller_confidence_label:x.seller_confidence_label??null,seller_confidence_reason:x.seller_confidence_reason??null,seller_signals:x.seller_signals||{},overall_confidence:x.overall_confidence??null},{single:true})}

async function startDeal(c){
  if(c.opportunity_id){const rows=await api.select('flip_workflows',`select=*&opportunity_id=eq.${encodeURIComponent(c.opportunity_id)}&limit=1`);if(rows?.[0])return openWorkflow(rows[0].id,c.opportunity_id)}
  if(!deep(c))return toast('Analyse this listing first so the Deal File starts with full evidence.')
  const user=await api.getUser(),capture=c.deep_capture||{},now=new Date().toISOString()
  const opportunity=await api.insert('opportunities',{user_id:user.id,source_platform:platform(c.source_url),source_url:c.source_url,listing_title:c.title||null,listing_text:capture.listingText||capture.visibleText||c.raw_capture?.raw_text||'',seller_asking_price:c.asking_price??null,listing_location:c.location||null,seller_name:c.seller_name||null,currency:c.currency||'AUD',status:c.recommendation==='skip'?'skipped':'watching',raw_listing:{browser_scan:true,source:'saved_scout_lead',scout_session_id:c.session_id,scout_candidate_id:c.id,listing_id:c.listing_id||null,condition:c.condition||null,scout_scan_depth:'deep',captured_at:now,canonical_url:c.source_url},updated_at:now},{single:true})
  if(!opportunity?.id)throw new Error('Could not create Deal File.')
  let workflow=await waitWorkflow(opportunity.id)
  if(workflow.current_step==='capture_listing'){await api.rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'capture_listing',p_step_data:{captured:true,source:'saved_scout_lead',scout_candidate_id:c.id}});workflow=await waitWorkflow(opportunity.id)}
  workflow=(await api.select('flip_workflows',`select=*&id=eq.${workflow.id}&limit=1`))?.[0]||workflow
  if(workflow.current_step==='verify_listing'&&c.title&&c.asking_price!=null){await api.update('opportunities',`id=eq.${opportunity.id}`,{user_overrides:{asking_price:c.asking_price},updated_at:now});await api.rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'verify_listing',p_step_data:{asking_price:c.asking_price,verified:true,source:'saved_scout_lead'}})}
  await saveAnalysis(opportunity.id,c,user.id)
  workflow=(await api.select('flip_workflows',`select=*&id=eq.${workflow.id}&limit=1`))?.[0]||workflow
  if(workflow.current_step==='analyse_deal'&&c.recommendation!=='skip')await api.rpc('advance_flip_step',{p_workflow_id:workflow.id,p_step_key:'analyse_deal',p_step_data:{analysed:true,source:'saved_scout_lead',scout_candidate_id:c.id}})
  await api.update('opportunities',`id=eq.${opportunity.id}`,{status:c.recommendation==='skip'?'skipped':c.recommendation==='verify_first'?'verify':c.recommendation==='negotiate'?'negotiating':'ready',updated_at:now})
  await api.update('scout_candidates',`id=eq.${c.id}`,{opportunity_id:opportunity.id,saved:true,saved_at:c.saved_at||now,updated_at:now})
  openWorkflow(workflow.id,opportunity.id)
}
function openWorkflow(workflowId,opportunityId){const u=new URL(location.href);u.searchParams.set('workflow',workflowId);u.searchParams.set('opportunity',opportunityId);location.href=u.toString()}

function savedCard(c){const a=c.analysis||{},rec=c.recommendation||a.recommendation||'',score=Math.round(Number(a.overall_score??c.score??0)),category=c.category_label||c.raw_capture?.category_label||a.category||'Other';return `<article class="v068-saved-card" data-saved-candidate="${esc(c.id)}"><div class="v068-saved-main"><div class="v068-saved-title"><strong>${esc(c.title||a.identified_name||'Untitled listing')}</strong>${rated(c)?`<span class="v068-score ${recClass(rec)}">${score}/100</span>`:''}</div><div class="v068-saved-meta">${esc(platformLabel(c.source_url))} · ${money(c.asking_price)}${c.location?` · ${esc(c.location)}`:''} · ${esc(category)}</div>${rated(c)?`<div class="v068-saved-metrics"><span>${esc(recLabel(rec))}</span><span>Resale <b>${money(a.resale_mid??c.resale_mid)}</b></span><span>Profit <b>${money(a.expected_profit??c.expected_profit)}</b></span><span>ROI <b>${pct(a.expected_roi_percent??c.expected_roi_percent)}</b></span><span>Confidence <b>${pct(confidence(c))}</b></span></div>`:`<div class="v068-saved-metrics"><span>Saved for deeper analysis</span></div>`}</div><div class="v068-saved-actions"><button class="button primary small" data-analyse-candidate="${esc(c.id)}">${deep(c)?'Reanalyse':'Analyse'}</button>${deep(c)?`<button class="button secondary small" data-start-deal="${esc(c.id)}">${c.opportunity_id?'Open deal':'Start deal'}</button>`:''}<button class="button soft small" data-open-saved="${esc(c.id)}">Open</button><button class="button soft small" data-unsave-candidate="${esc(c.id)}">Remove</button></div></article>`}

async function renderAnalyse(){
  analyseView=true;ensureAnalyseNav();$$('.ext-nav button').forEach(b=>b.classList.remove('active'));$('[data-v068-analyse]')?.classList.add('active')
  const main=$('.ext-main');if(!main)return
  main.innerHTML='<section class="page-head"><div><span class="eyebrow">ANALYSE</span><h1>Saved leads</h1><p>These are listings you liked during Scout. Analyse opens the actual listing and performs the deeper scan before you decide whether it deserves a Deal File.</p></div></section><div class="v068-analyse-loading"><span class="v068-spinner"></span> Loading saved leads…</div>'
  const rows=await savedCandidates();if(!analyseView||!$('.ext-main'))return
  main.innerHTML=`<section class="page-head"><div><span class="eyebrow">ANALYSE</span><h1>Saved leads</h1><p>Scout finds them. Analyse reads the full listing. Deals are only created when you choose Start deal.</p></div></section><section class="v068-analyse-stats"><div><span>SAVED</span><strong>${rows.length}</strong></div><div><span>DEEP ANALYSED</span><strong>${rows.filter(deep).length}</strong></div><div><span>READY TO PURSUE</span><strong>${rows.filter(c=>deep(c)&&['strong_buy','buy','negotiate'].includes(c.recommendation||c.analysis?.recommendation)).length}</strong></div></section>${rows.length?`<div class="v068-saved-list">${rows.map(savedCard).join('')}</div>`:'<div class="empty"><strong>No saved leads yet</strong>Save interesting listings from Scout and they will stay here for deeper analysis.</div>'}`
}

async function hydrateScoutButtons(){
  const cards=$$('.scout-candidate[data-candidate]');if(!cards.length)return
  const ids=cards.map(c=>c.dataset.candidate).filter(Boolean);const rows=await api.select('scout_candidates',`select=id,saved,saved_at,scan_status,opportunity_id&id=in.(${ids.join(',')})`).catch(()=>[]),map=new Map((rows||[]).map(r=>[String(r.id),r]))
  cards.forEach(card=>{const r=map.get(String(card.dataset.candidate));if(!r)return;const actions=$('.scout-candidate-actions',card);if(!actions)return;let save=$('[data-save-candidate]',actions);if(!save){save=document.createElement('button');save.type='button';save.className='button soft small scout-action';save.dataset.saveCandidate=card.dataset.candidate;actions.prepend(save)}save.dataset.saveCandidate=card.dataset.candidate;save.textContent=r.saved?'Saved ✓':'Save';save.classList.toggle('saved',Boolean(r.saved));let analyse=$('[data-analyse-candidate]',actions);if(!analyse){analyse=document.createElement('button');analyse.type='button';analyse.className='button primary small scout-action';analyse.dataset.analyseCandidate=card.dataset.candidate;actions.insertBefore(analyse,actions.querySelector('[data-open-candidate]'))}analyse.dataset.analyseCandidate=card.dataset.candidate;analyse.textContent=r.scan_status==='analysed'?'Reanalyse':'Analyse'})
}

function updateBatchSummary(){
  const cards=$$('.scout-candidate[data-candidate]');if(!cards.length)return
  const total=cards.length,scanning=cards.filter(c=>c.classList.contains('curation-active')).length,ratedCount=cards.filter(c=>c.classList.contains('curation-rated')).length,failed=cards.filter(c=>c.classList.contains('curation-failed')&&!c.classList.contains('curation-rated')).length,left=Math.max(0,total-ratedCount-failed-cards.filter(c=>c.classList.contains('curation-active')&&!c.classList.contains('curation-rated')).length),strong=cards.filter(c=>$('.scout-rec.good',c)).length
  const box=$('.scout-summary');if(box){while(box.children.length<5){const d=document.createElement('div');box.appendChild(d)}const cells=[...box.children];cells[0].innerHTML=`<span>FOUND</span><strong>${total}</strong>`;cells[1].innerHTML=`<span>RATED</span><strong>${ratedCount}</strong>`;cells[2].innerHTML=`<span>SCANNING</span><strong>${scanning}</strong>`;cells[3].innerHTML=`<span>LEFT</span><strong>${left}</strong>`;cells[4].innerHTML=`<span>STRONG</span><strong>${strong}</strong>`;cells[4].classList.add('scout-summary-good')}
  const source=$('.scout-capture-source');if(source?.children?.[2])source.children[2].innerHTML=`<span>LISTINGS FOUND</span><strong>${total}</strong>`
  const more=$('#scanMoreResults');if(more&&!scanning&&left===0)more.textContent='Find next listings ↓'
}

async function enhance(){if(enhancing)return;enhancing=true;try{ensureAnalyseNav();explainDeals();if(analyseView&&!$('.v068-saved-list')&&!$('.v068-analyse-loading'))renderAnalyse().catch(()=>{});if($('.scout-list')){await hydrateScoutButtons();updateBatchSummary()}}finally{enhancing=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>enhance().catch(()=>{}),90)}

document.addEventListener('click',async event=>{
  const analyseNav=event.target.closest?.('[data-v068-analyse]');if(analyseNav){event.preventDefault();event.stopImmediatePropagation();renderAnalyse().catch(e=>toast(e.message));return}
  const normalNav=event.target.closest?.('.ext-nav [data-view]');if(normalNav){analyseView=false;return}
  const save=event.target.closest?.('[data-save-candidate]');if(save){event.preventDefault();event.stopImmediatePropagation();try{const id=save.dataset.saveCandidate||save.closest('[data-candidate]')?.dataset.candidate,c=await fetchCandidate(id);if(c)await setSaved(c,!c.saved)}catch(e){toast(e.message)}return}
  const unsave=event.target.closest?.('[data-unsave-candidate]');if(unsave){event.preventDefault();try{const c=await fetchCandidate(unsave.dataset.unsaveCandidate);if(c){await setSaved(c,false);await renderAnalyse()}}catch(e){toast(e.message)}return}
  const analyse=event.target.closest?.('[data-analyse-candidate]');if(analyse){event.preventDefault();event.stopImmediatePropagation();analyse.disabled=true;try{const id=analyse.dataset.analyseCandidate||analyse.closest('[data-candidate]')?.dataset.candidate,c=await fetchCandidate(id);if(!c)throw new Error('Saved listing could not be found.');await deepAnalyse(c,{foreground:true});if(analyseView)await renderAnalyse()}catch(e){toast(e.message)}finally{analyse.disabled=false}return}
  const open=event.target.closest?.('[data-open-saved]');if(open){event.preventDefault();const c=await fetchCandidate(open.dataset.openSaved);if(c?.source_url)chrome.tabs.create({url:c.source_url,active:true});return}
  const start=event.target.closest?.('[data-start-deal]');if(start){event.preventDefault();start.disabled=true;try{const c=await fetchCandidate(start.dataset.startDeal);if(c)await startDeal(c)}catch(e){start.disabled=false;toast(e.message)}return}
  const newScan=event.target.closest?.('#dealScan');if(newScan){await chrome.storage.local.remove(ACTIVE_SCOUT_KEY)}
},true)

document.addEventListener('flippers:candidate-updated',()=>{if(analyseView)renderAnalyse().catch(()=>{});else schedule()})
new MutationObserver(()=>schedule()).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
schedule()
