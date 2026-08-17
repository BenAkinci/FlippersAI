import { api } from './api.js'
import { CONFIG, MARKETPLACE_LABELS } from './config.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money=v=>v==null||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))

let scout=null
let handlingScan=false

function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
const label=p=>MARKETPLACE_LABELS[p]||p||'Marketplace'
const isSingleUrl=url=>/\/marketplace\/item\/\d+|\/itm\/(?:[^/]+\/)?\d+|\/s-ad\/[^/]+\/[^/]+\/\d+|\/products\/[^/?#]+/i.test(String(url||''))
const genericQuery=q=>!q||/^(today'?s picks|marketplace|browse|home|for you|recommended|facebook marketplace)$/i.test(String(q).trim())
const titleForScout=s=>genericQuery(s.query)?`${label(s.platform)} Scout`:`${s.query}`
const short=(v,n=220)=>{const x=String(v||'').replace(/\s+/g,' ').trim();return x.length>n?`${x.slice(0,n-1).trim()}…`:x}

function detailValue(v){return v?esc(v):'<span class="muted">Not detected yet</span>'}
function candidateMarkup(c,index){
  const raw=c.deep_capture?.description||c.deep_capture?.listingText||c.raw_capture?.raw_text||''
  const region=c.raw_capture?.region_code||''
  const category=c.raw_capture?.category_label||c.analysis?.category||'Other'
  return `<article class="scout-candidate" data-candidate="${esc(c.id)}" data-smart-region="${esc(region)}" data-smart-category="${esc(category)}">
    <label class="scout-select"><input type="checkbox" data-select-candidate ${c.selected?'checked':''}><span>${index+1}</span></label>
    <div class="scout-thumb">${c.thumbnail_url?`<img src="${esc(c.thumbnail_url)}" alt="">`:`<div class="scout-thumb-placeholder">${index+1}</div>`}</div>
    <div class="scout-candidate-main">
      <div class="scout-candidate-title-row"><strong>${esc(c.title||'Untitled listing')}</strong><span class="scout-rec">Queued</span></div>
      <div class="scout-meta">${money(c.asking_price)}${c.location?` · ${esc(c.location)}`:''}</div>
      <div class="scout-quick-note">Captured from the marketplace results page and waiting for its Scout rating.</div>
      <details class="scout-individual-details"><summary>Listing details</summary><div class="scout-detail-grid">
        <div><span>TITLE</span><strong>${detailValue(c.title)}</strong></div><div><span>PRICE</span><strong>${money(c.asking_price)}</strong></div>
        <div><span>LOCATION</span><strong>${detailValue(c.location)}</strong></div><div><span>CONDITION</span><strong>${detailValue(c.condition)}</strong></div>
        <div><span>SELLER</span><strong>${detailValue(c.seller_name)}</strong></div><div><span>CATEGORY</span><strong>${esc(category)}</strong></div>
      </div>${raw?`<p>${esc(short(raw))}</p>`:''}</details>
    </div>
    <div class="scout-candidate-actions"><button class="button secondary small scout-action" data-open-candidate>Open</button></div>
  </article>`
}

function renderScout(){
  if(!scout)return
  const main=$('.ext-main');if(!main)return
  const selected=scout.candidates.filter(c=>c.selected).length
  main.innerHTML=`<section class="page-head scout-page-head"><div><span class="eyebrow">MARKETPLACE SCOUT</span><h1>${esc(titleForScout(scout))}</h1><p>Scan a few listings, compare them, remove the weak ones and keep going until something is worth pursuing.</p></div><button class="button soft small scout-action" id="scoutRescan">Start over</button></section>
    <section class="scout-capture-source"><div><span>SOURCE</span><strong>${esc(label(scout.platform))}</strong></div><div><span>PAGE TYPE</span><strong>Marketplace results</strong></div><div><span>LISTINGS SCANNED</span><strong>${scout.candidates.length}</strong></div></section>
    <section class="scout-summary"><div><span>FOUND</span><strong>${scout.candidates.length}</strong></div><div><span>RATED</span><strong>0</strong></div><div><span>QUEUED</span><strong>${scout.candidates.length}</strong></div><div class="scout-summary-good"><span>STRONG</span><strong>0</strong></div></section>
    <section class="scout-insight"><strong>Building your shortlist</strong><span>FlippersAI rates a small batch together, then waits for you before scanning more.</span></section>
    <div class="scout-toolbar"><label class="scout-select-all"><input type="checkbox" id="scoutSelectAll"><span>Select rated</span></label><span class="top-spacer"></span><button class="button secondary small scout-action" id="scanMoreResults">Scan more results ↓</button></div>
    <div class="scout-list">${scout.candidates.map(candidateMarkup).join('')}</div>
    <div class="scout-sticky-actions"><button class="button primary scout-action" id="deepScanSelected" disabled>Deep scan 0 selected</button><button class="button secondary scout-action" id="openScoutWebsite">Open Scout on website</button></div>
    <div class="scout-footnote">Only listings you choose become permanent Deal Files.</div>`
  bindUi()
}

function findCandidate(el){const id=el.closest('[data-candidate]')?.dataset.candidate;return scout?.candidates.find(c=>String(c.id)===String(id))||null}
async function updateCounts(){if(!scout?.session?.id)return;const selected=scout.candidates.filter(c=>c.selected).length;await api.update('scout_sessions',`id=eq.${scout.session.id}`,{candidate_count:scout.candidates.length,selected_count:selected,updated_at:new Date().toISOString()}).catch(()=>{})}
async function persistOne(c){if(c?.id)await api.update('scout_candidates',`id=eq.${c.id}`,{selected:Boolean(c.selected),updated_at:new Date().toISOString()}).catch(()=>{})}

function bindUi(){
  $('#scoutRescan')?.addEventListener('click',()=>location.reload())
  $$('[data-select-candidate]').forEach(input=>input.addEventListener('change',async e=>{const c=findCandidate(e.target);if(!c)return;c.selected=e.target.checked;await persistOne(c);await updateCounts()}))
  $$('[data-open-candidate]').forEach(button=>button.addEventListener('click',async e=>{const c=findCandidate(e.target);if(c?.source_url)await chrome.tabs.create({url:c.source_url,active:true})}))
  $('#scanMoreResults')?.addEventListener('click',scanMoreResults)
  $('#openScoutWebsite')?.addEventListener('click',()=>{if(scout?.session?.id)chrome.tabs.create({url:`${CONFIG.websiteUrl}?scout=${encodeURIComponent(scout.session.id)}`})})
}

async function createSession(collection){
  const user=await api.getUser();if(!user?.id)throw new Error('Connect FlippersAI before starting a Scout Session.')
  const session=await api.insert('scout_sessions',{user_id:user.id,platform:collection.platform||'other',source_url:collection.pageUrl||'',query_text:genericQuery(collection.query)?'':(collection.query||''),status:'draft',candidate_count:collection.candidates.length,selected_count:0,metadata:{source:'chrome_extension',collection_scan:true,captured_at:collection.capturedAt||new Date().toISOString()}},{single:true})
  if(!session?.id)throw new Error('Could not create the Scout Session.')
  const rows=collection.candidates.map((c,i)=>({session_id:session.id,user_id:user.id,source_url:c.url,listing_id:c.listingId||null,title:c.title||null,asking_price:c.askingPrice??null,currency:c.currency||'AUD',location:c.location||null,condition:c.condition||null,seller_name:c.sellerName||null,thumbnail_url:c.thumbnailUrl||null,raw_capture:{raw_text:c.rawText||'',quick_scan:true,order_index:i,region_code:c.regionCode||'',category_label:c.categoryLabel||'Other'},scan_status:'quick',selected:false,rank_score:null}))
  const saved=rows.length?await api.insert('scout_candidates',rows):[]
  return {session,candidates:(saved||[]).map((row,i)=>({...row,order_index:i,analysis:row.analysis||{}}))}
}

async function startCollection(collection){
  const created=await createSession(collection)
  scout={session:created.session,candidates:created.candidates,tabId:collection.tabId,platform:collection.platform,query:collection.query||'',pageUrl:collection.pageUrl||''}
  renderScout()
}

async function mergeNew(collection){
  const known=new Set(scout.candidates.map(c=>c.source_url));const fresh=(collection.candidates||[]).filter(c=>c.url&&!known.has(c.url));if(!fresh.length)return 0
  const user=await api.getUser();const start=scout.candidates.length
  const rows=fresh.map((c,i)=>({session_id:scout.session.id,user_id:user.id,source_url:c.url,listing_id:c.listingId||null,title:c.title||null,asking_price:c.askingPrice??null,currency:c.currency||'AUD',location:c.location||null,condition:c.condition||null,seller_name:c.sellerName||null,thumbnail_url:c.thumbnailUrl||null,raw_capture:{raw_text:c.rawText||'',quick_scan:true,order_index:start+i,region_code:c.regionCode||'',category_label:c.categoryLabel||'Other'},scan_status:'quick',selected:false,rank_score:null}))
  const saved=await api.insert('scout_candidates',rows);scout.candidates.push(...(saved||[]).map((r,i)=>({...r,order_index:start+i,analysis:r.analysis||{}})));await updateCounts();renderScout();return fresh.length
}

async function scanMoreResults(){
  if(!scout?.tabId)return toast('Return to the marketplace results page first.')
  try{const result=await chrome.runtime.sendMessage({type:'FLIPPERS_SCROLL_COLLECTION',tabId:scout.tabId});if(!result?.ok)throw new Error(result?.error||'Could not scan more results.');const added=await mergeNew(result.data);toast(added?`${added} more listing${added===1?'':'s'} captured`:'No new listings detected yet. Scroll a little further and try again.')}catch(error){toast(error.message)}
}

async function handleScan(button){
  if(handlingScan)return
  handlingScan=true
  const original=button.onclick
  try{
    const result=await chrome.runtime.sendMessage({type:'FLIPPERS_SCAN_COLLECTION_ACTIVE'})
    if(!result?.ok)throw new Error(result?.error||'Could not read this marketplace page.')
    const data=result.data||{}
    if(isSingleUrl(data.pageUrl)){await original?.call(button);return}
    if(data.mode==='collection'){
      if(!(data.candidates||[]).length){toast('This looks like a marketplace results page, but no listing cards are visible yet. Scroll slightly and scan again.');return}
      await startCollection(data);return
    }
    await original?.call(button)
  }catch(error){toast(error.message)}finally{handlingScan=false}
}

document.addEventListener('click',event=>{const button=event.target.closest?.('#scanCurrent');if(!button)return;event.preventDefault();event.stopImmediatePropagation();handleScan(button)},true)
