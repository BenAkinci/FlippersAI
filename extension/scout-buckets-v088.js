import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))
const money=v=>v==null||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct=v=>v==null||Number.isNaN(Number(v))?'—':`${Math.round(Number(v))}%`
const openBuckets=new Set(['shortlist'])
let rows=[],sessionId='',refreshing=false,timer=0,lastSignature=''

const analysis=c=>c?.analysis||{}
const recommendation=c=>c?.recommendation||analysis(c).recommendation||''
const score=c=>Math.round(Number(analysis(c).overall_score??c?.score??0))
const rated=c=>['rated','analysed'].includes(c?.scan_status)||Boolean(recommendation(c))
const risky=c=>['likely_counterfeit','high_risk'].includes(analysis(c).authenticity_status)
const worthwhile=c=>rated(c)&&!c.saved&&!analysis(c).shortlist_hidden&&score(c)>=65&&recommendation(c)!=='skip'&&!risky(c)
const filtered=c=>rated(c)&&!worthwhile(c)&&!c.saved&&!analysis(c).shortlist_hidden
const workingIds=()=>{try{return new Set(JSON.parse(document.body.dataset.v088WorkingIds||'[]').map(String))}catch{return new Set()}}
const reason=c=>analysis(c).action_summary||analysis(c).score_reasoning?.[0]||analysis(c).reasons?.[0]||analysis(c).authenticity_reasons?.[0]||(rated(c)?'FlippersAI has completed this rating.':'Waiting for Scout to finish screening this listing.')

function bucketRows(key){
  if(key==='found')return rows
  if(key==='rated')return rows.filter(rated)
  if(key==='working'){const ids=workingIds();return rows.filter(c=>ids.has(String(c.id)))}
  if(key==='shortlist')return rows.filter(worthwhile)
  if(key==='filtered')return rows.filter(filtered)
  return[]
}
function status(c){if(workingIds().has(String(c.id)))return'Working';if(c.saved)return'Saved';if(worthwhile(c))return'Shortlist';if(filtered(c))return'Filtered out';if(rated(c))return'Rated';return'Found'}
function card(c,key){const a=analysis(c),url=c.source_url||'',title=c.title||a.identified_name||'Untitled listing',canCompare=key==='shortlist'&&rated(c);return `<article class="v088-listing-card" data-v088-id="${esc(c.id)}">
  <div class="v088-card-top"><div><span class="v088-stage">${esc(status(c))}</span>${url?`<a class="v088-listing-title" data-v088-open href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`:`<strong class="v088-listing-title disabled">${esc(title)}</strong>`}<small>${esc(c.location||'Location not detected')} · ${esc(c.condition||'Condition not detected')}${c.seller_name?` · ${esc(c.seller_name)}`:''}</small></div>${rated(c)?`<b class="v088-score">${score(c)}</b>`:''}</div>
  <div class="v088-card-metrics"><span>Ask <b>${money(c.asking_price)}</b></span><span>Resale <b>${money(a.resale_mid??c.resale_mid)}</b></span><span>Profit <b>${money(a.expected_profit??c.expected_profit)}</b></span><span>ROI <b>${pct(a.expected_roi_percent??c.expected_roi_percent)}</b></span></div>
  <p>${esc(reason(c))}</p>
  <div class="v088-card-actions"><button data-v088-act="save" ${c.saved?'disabled':''}>${c.saved?'Saved ✓':'♡ Save'}</button><button class="primary" data-v088-act="analyse">Analyse</button><button data-v088-act="edit">Edit info</button>${canCompare?'<button data-v088-act="compare">Compare</button>':''}${key==='shortlist'?'<button data-v088-act="remove">× Remove</button>':''}</div>
</article>`}
function bucketDef(key,label){const list=bucketRows(key),open=openBuckets.has(key);return {key,label,list,open}}
function defs(){return [bucketDef('found','FOUND'),bucketDef('rated','RATED'),bucketDef('working','WORKING'),bucketDef('shortlist','SHORTLIST'),bucketDef('filtered','FILTERED OUT')]}
function signature(){return JSON.stringify({sessionId,open:[...openBuckets].sort(),working:[...workingIds()].sort(),rows:rows.map(c=>[c.id,c.scan_status,c.saved,analysis(c).shortlist_hidden,score(c),recommendation(c),c.asking_price,analysis(c).resale_mid??c.resale_mid,analysis(c).expected_profit??c.expected_profit,analysis(c).expected_roi_percent??c.expected_roi_percent,c.location,c.condition,c.seller_name])})}
function markup(){
  const list=defs()
  return `<section id="v088ScoutBuckets" class="v088-buckets"><div class="v088-bucket-grid">${list.map(x=>`<button class="v088-bucket-button ${x.key==='shortlist'?'shortlist':''} ${x.open?'open':''}" data-v088-bucket="${x.key}" aria-expanded="${x.open}"><span>${x.label}</span><strong>${x.list.length}</strong><i>${x.open?'⌃':'⌄'}</i></button>`).join('')}</div><div class="v088-open-panels">${list.filter(x=>x.open).map(x=>`<section class="v088-panel" data-v088-panel="${x.key}"><header><div><span>${x.label}</span><strong>${x.list.length} listing${x.list.length===1?'':'s'}</strong></div><button data-v088-close="${x.key}" aria-label="Close ${x.label}">×</button></header>${x.list.length?`<div class="v088-panel-list">${x.list.map(c=>card(c,x.key)).join('')}</div>`:`<div class="v088-empty">No listings are currently in this stage.</div>`}</section>`).join('')}</div></section>`
}
function host(){const summary=$('.scout-summary');if(!summary)return null;let box=$('#v088ScoutBuckets');if(!box){box=document.createElement('div');summary.insertAdjacentElement('afterend',box)}return box}
async function load(){const head=$('.scout-page-head[data-scout-session]');const id=head?.dataset.scoutSession||'';if(!id)return false;sessionId=id;rows=await api.select('scout_candidates',`select=*&session_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=500`).catch(()=>[]);return true}
function bind(box){
  $$('[data-v088-bucket]',box).forEach(b=>b.onclick=()=>{const key=b.dataset.v088Bucket;openBuckets.has(key)?openBuckets.delete(key):openBuckets.add(key);lastSignature='';render()})
  $$('[data-v088-close]',box).forEach(b=>b.onclick=()=>{openBuckets.delete(b.dataset.v088Close);lastSignature='';render()})
  $$('[data-v088-open]',box).forEach(a=>a.onclick=e=>{e.preventDefault();const url=a.getAttribute('href');if(url)chrome.tabs.create({url,active:true})})
  $$('[data-v088-id]',box).forEach(el=>$$('[data-v088-act]',el).forEach(b=>b.onclick=()=>act(el.dataset.v088Id,b.dataset.v088Act).catch(e=>toast(e.message))))
}
function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2400)}
async function act(id,action){const c=rows.find(x=>String(x.id)===String(id));if(!c)return
  if(action==='save'){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id:c.id,action:'save'});if(!r?.ok)throw new Error(r?.error||'Could not save listing.');toast('Moved to Saved Leads')}
  if(action==='analyse'){toast('Running deeper analysis…');const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id:c.id,action:'analyse'});if(!r?.ok)throw new Error(r?.error||'Could not analyse listing.');toast('Analysis ready')}
  if(action==='remove'){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id:c.id,action:'remove_shortlist'});if(!r?.ok)throw new Error(r?.error||'Could not remove listing.');toast('Removed from Shortlist')}
  if(action==='edit'){
    const title=prompt('Listing title',c.title||'');if(title===null)return
    const asking=prompt('Asking price',c.asking_price??'');if(asking===null)return
    const location=prompt('Location',c.location||'');if(location===null)return
    const condition=prompt('Condition',c.condition||'');if(condition===null)return
    const seller=prompt('Seller',c.seller_name||'');if(seller===null)return
    const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id:c.id,action:'edit',fields:{title,asking_price:asking,location,condition,seller_name:seller}});if(!r?.ok)throw new Error(r?.error||'Could not edit listing.');toast('Listing info updated')
  }
  if(action==='compare'){openBuckets.add('shortlist');document.dispatchEvent(new CustomEvent('flippers:v088-compare',{detail:{id:c.id}}));toast('Open Shortlist to compare this lead')}
  await refresh(true)
}
function render(){const summary=$('.scout-summary'),oldList=$('.scout-list');if(!summary)return;summary.classList.add('v088-replaced');oldList?.classList.add('v088-replaced-list');const box=host();if(!box)return;const sig=signature();if(sig===lastSignature&&$('#v088ScoutBuckets'))return;const scrollY=$('.v088-open-panels')?.scrollTop||0;box.outerHTML=markup();lastSignature=sig;const next=$('#v088ScoutBuckets');if(next){bind(next);const panels=$('.v088-open-panels',next);if(panels)panels.scrollTop=scrollY}}
async function refresh(force=false){if(refreshing)return;refreshing=true;try{if(await load()){if(force)lastSignature='';render()}}finally{refreshing=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>refresh().catch(()=>{}),180)}

document.addEventListener('flippers:scout-rendered',schedule)
document.addEventListener('flippers:candidate-updated',schedule)
document.addEventListener('click',e=>{if(e.target.closest?.('.ext-nav [data-view="scan"]'))setTimeout(schedule,100)},true)
new MutationObserver(ms=>{const external=ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.closest?.('#v088ScoutBuckets')&&!n.matches?.('#v088ScoutBuckets')));if(external&&$('.scout-page-head[data-scout-session]'))schedule()}).observe(document.getElementById('app'),{childList:true,subtree:true})
schedule()
