import { api } from './api.js'

const RATING_HISTORY='flippers_rating_history_v067'
const clean=v=>String(v??'').trim()
const money=v=>v==null||Number.isNaN(Number(v))?null:Number(v)

async function getCandidate(id){
  if(!id)throw new Error('Listing reference is missing.')
  const rows=await api.select('scout_candidates',`select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
  const c=rows?.[0]
  if(!c)throw new Error('This Scout listing could not be found in your FlippersAI account.')
  return c
}

async function updateRatingHistory(c){
  const stored=await chrome.storage.local.get(RATING_HISTORY)
  const history=stored[RATING_HISTORY]&&typeof stored[RATING_HISTORY]==='object'?{...stored[RATING_HISTORY]}:{}
  const a=c.analysis||{}
  const update={
    id:String(c.id),listingId:c.listing_id||'',url:c.source_url||'',
    score:Math.round(Number(a.overall_score??c.score??0)),
    opportunityScore:Math.round(Number(a.opportunity_score??a.overall_score??c.score??0)),
    confidence:a.overall_confidence??a.identification_confidence??a.condition_confidence??null,
    recommendation:c.recommendation||a.recommendation||'',
    profit:a.expected_profit??c.expected_profit??null,resale:a.resale_mid??c.resale_mid??null,roi:a.expected_roi_percent??c.expected_roi_percent??null,
    successPotential:a.success_potential??null,authenticityStatus:a.authenticity_status||'',
    authenticityEvidenceState:a.authenticity_evidence_state||'',authenticityReasons:a.authenticity_reasons||[],
    authenticityEvidenceSeen:a.authenticity_evidence_seen||[],missingAuthenticityEvidence:a.missing_authenticity_evidence||[],
    authenticationRequest:a.authentication_request||'',reasons:a.reasons||a.score_reasoning||[],
    scannedAt:c.updated_at||new Date().toISOString(),updatedAt:new Date().toISOString()
  }
  let matched=false
  for(const [key,saved] of Object.entries(history)){
    if(String(saved?.id||'')===String(c.id)||String(saved?.listingId||'')===String(c.listing_id||'')||(saved?.url&&c.source_url&&saved.url===c.source_url)){
      history[key]={...saved,...update};matched=true
    }
  }
  if(!matched)history[`candidate:${c.id}`]=update
  await chrome.storage.local.set({[RATING_HISTORY]:history})
}

async function waitTab(id,timeout=18000){
  return new Promise((resolve,reject)=>{
    let done=false
    const finish=e=>{if(done)return;done=true;clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);e?reject(e):resolve()}
    const listener=(tabId,info)=>{if(tabId===id&&info.status==='complete')finish()}
    chrome.tabs.onUpdated.addListener(listener)
    const timer=setTimeout(()=>finish(new Error('Timed out loading the listing.')),timeout)
    chrome.tabs.get(id).then(tab=>{if(tab.status==='complete')finish()}).catch(()=>{})
  })
}

async function scanTab(id){
  let last
  for(let i=0;i<4;i++){
    try{
      const r=await chrome.tabs.sendMessage(id,{type:'FLIPPERS_SCAN_PAGE'})
      if(r?.ok)return r.data
      if(r?.error)last=new Error(r.error)
    }catch(e){
      last=e
      try{await chrome.scripting.executeScript({target:{tabId:id},files:['content-v070.js']})}catch{}
      await new Promise(r=>setTimeout(r,300+i*180))
    }
  }
  throw last||new Error('Could not read the listing page.')
}

function bufferToDataUrl(buffer,mime='image/jpeg'){
  const bytes=new Uint8Array(buffer);let binary=''
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+32768,bytes.length)))
  return`data:${mime};base64,${btoa(binary)}`
}
async function loadImage(url){
  if(!/^https?:/i.test(String(url||'')))return null
  try{
    const r=await fetch(url,{credentials:'include',cache:'force-cache'});if(!r.ok)return null
    const type=r.headers.get('content-type')||'';if(!type.startsWith('image/'))return null
    const b=await r.blob();if(b.size>4_000_000)return null
    return bufferToDataUrl(await b.arrayBuffer(),type)
  }catch{return null}
}

async function captureCandidate(c){
  const tab=await chrome.tabs.create({url:c.source_url,active:false})
  try{
    await waitTab(tab.id);await new Promise(r=>setTimeout(r,550))
    const capture=await scanTab(tab.id),images=[]
    for(const url of(capture.imageUrls||[]).slice(0,6)){const img=await loadImage(url);if(img)images.push(img)}
    return{capture,images}
  }finally{chrome.tabs.remove(tab.id).catch(()=>{})}
}

async function rescanAuthenticity(c,userEvidence=''){
  const {capture,images}=await captureCandidate(c)
  const prior=c.analysis||{}
  const data=await api.invoke('scout-enrich-listing',{capture,prior_analysis:prior,images,user_evidence:clean(userEvidence)})
  if(data?.error)throw new Error(data.error)
  const e=data.result||{}
  const a={...prior,...e,user_evidence:clean(userEvidence)||prior.user_evidence||'',scout_enriched:true,scout_scan_depth:'enriched'}
  const body={
    title:capture.title||c.title||null,asking_price:capture.askingPrice??c.asking_price??null,location:capture.location||c.location||null,
    condition:capture.condition||e.condition_label||c.condition||null,seller_name:capture.sellerName||c.seller_name||null,
    thumbnail_url:capture.imageUrls?.[0]||c.thumbnail_url||null,deep_capture:capture,analysis:a,
    recommendation:a.recommendation||c.recommendation||null,score:a.overall_score??c.score??null,
    resale_mid:a.resale_mid??c.resale_mid??null,expected_profit:a.expected_profit??c.expected_profit??null,
    expected_roi_percent:a.expected_roi_percent??c.expected_roi_percent??null,updated_at:new Date().toISOString()
  }
  const rows=await api.update('scout_candidates',`id=eq.${c.id}`,body)
  const updated=rows?.[0]||{...c,...body}
  await updateRatingHistory(updated)
  return updated
}

async function deepAnalyse(c,userEvidence=''){
  const {capture,images}=await captureCandidate(c)
  const state=await api.workflowState(),profile=state.profile||{},portfolio=state.portfolio||{},price=capture.askingPrice??c.asking_price??null
  const result=await api.invoke('analyse-listing-v2',{
    listing_url:c.source_url,listing_text:capture.listingText||capture.visibleText||'',
    platform_fields:{asking_price:price,currency:c.currency||'AUD',asking_price_verified:price!=null,asking_price_confidence:price!=null?1:0,listing_title:capture.title||c.title||'',listing_location:capture.location||c.location||'',seller_name:capture.sellerName||c.seller_name||''},
    user_overrides:{asking_price:price,currency:c.currency||'AUD'},bankroll:Number(portfolio.available_cash||0),risk_profile:profile.risk_profile||'conservative',
    reserve_percent:Number(profile.capital_reserve_percent??30),max_exposure_percent:Number(profile.max_single_item_exposure_percent??20),portfolio_context:portfolio,images,
    scan_context:{mode:'deep',instruction:`User explicitly requested a deeper analysis from the marketplace rating panel. Inspect the full listing and images. Separate missing authenticity evidence from actual counterfeit evidence. ${clean(userEvidence)?`User-supplied evidence/opinion: ${clean(userEvidence)}`:''}`}
  })
  if(result?.error)throw new Error(result.error)
  const previous=c.analysis||{},a={...previous,...(result.analysis||{}),user_evidence:clean(userEvidence)||previous.user_evidence||'',analyse_queued:false,engine_version:result.engine_version||previous.engine_version,scout_scan_depth:'deep',scout_enriched:true}
  const body={title:capture.title||c.title||null,asking_price:price,location:capture.location||c.location||null,condition:capture.condition||a.condition_assessment||c.condition||null,seller_name:capture.sellerName||c.seller_name||null,thumbnail_url:capture.imageUrls?.[0]||c.thumbnail_url||null,deep_capture:capture,analysis:a,scan_status:'analysed',recommendation:a.recommendation||null,score:a.overall_score??null,resale_mid:a.resale_mid??null,expected_profit:a.expected_profit??null,expected_roi_percent:a.expected_roi_percent??null,last_deep_scanned_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  const rows=await api.update('scout_candidates',`id=eq.${c.id}`,body)
  const updated=rows?.[0]||{...c,...body}
  await updateRatingHistory(updated)
  return updated
}

async function act(message){
  const c=await getCandidate(message.id)
  const a=c.analysis||{}
  if(message.action==='detail')return c
  if(message.action==='save'){
    const rows=await api.update('scout_candidates',`id=eq.${c.id}`,{saved:true,saved_at:c.saved_at||new Date().toISOString(),updated_at:new Date().toISOString()})
    return rows?.[0]||{...c,saved:true}
  }
  if(message.action==='queue_analyse'){
    const analysis={...a,analyse_queued:true}
    const rows=await api.update('scout_candidates',`id=eq.${c.id}`,{analysis,updated_at:new Date().toISOString()})
    return rows?.[0]||{...c,analysis}
  }
  if(message.action==='remove_shortlist'){
    const analysis={...a,shortlist_hidden:true}
    const rows=await api.update('scout_candidates',`id=eq.${c.id}`,{analysis,updated_at:new Date().toISOString()})
    return rows?.[0]||{...c,analysis}
  }
  if(message.action==='edit'){
    const patch={updated_at:new Date().toISOString()}
    if(message.fields?.title!==undefined)patch.title=clean(message.fields.title)||null
    if(message.fields?.asking_price!==undefined)patch.asking_price=money(message.fields.asking_price)
    if(message.fields?.location!==undefined)patch.location=clean(message.fields.location)||null
    const rows=await api.update('scout_candidates',`id=eq.${c.id}`,patch)
    return rows?.[0]||{...c,...patch}
  }
  if(message.action==='rescan')return rescanAuthenticity(c,message.userEvidence||'')
  if(message.action==='analyse')return deepAnalyse(c,message.userEvidence||'')
  throw new Error('Unknown marketplace action.')
}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type!=='FLIPPERS_V083_ACTION')return
  act(message).then(data=>sendResponse({ok:true,data})).catch(error=>sendResponse({ok:false,error:error.message||String(error)}))
  return true
})
