import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money=v=>v==null||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct=v=>v==null||Number.isNaN(Number(v))?'—':`${Math.round(Number(v))}%`
let active=false,rows=[],filter='all',sort='newest',query='',busy=false

function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
function a(c){return c.analysis||{}}
function potential(c){const x=a(c);return Number(x.opportunity_score??x.overall_score??c.score??0)}
function recommendation(c){return c.recommendation||a(c).recommendation||''}
function auth(c){return a(c).authenticity_status||''}
function worthwhile(c){
  const x=a(c);if(x.shortlist_hidden)return false
  if(!['rated','analysed'].includes(c.scan_status)&&!recommendation(c))return false
  if(['likely_counterfeit'].includes(auth(c)))return false
  if(x.authenticity_evidence_state==='conflicting_evidence'&&['high_risk','likely_counterfeit'].includes(auth(c)))return false
  const r=recommendation(c),p=potential(c),success=Number(x.success_potential||0)
  return ['strong_buy','buy','negotiate'].includes(r)||p>=65||(r==='verify_first'&&Math.max(p,success)>=65)
}
function status(c){return recommendation(c)==='verify_first'||['uncertain','high_risk'].includes(auth(c))?'verify':'ready'}
function date(c){return new Date(c.updated_at||c.created_at||0).getTime()||0}
function dedupe(list){const map=new Map();for(const c of list){const key=c.source_url||c.listing_id||c.id,old=map.get(key);if(!old||date(c)>date(old)||potential(c)>potential(old))map.set(key,c)}return[...map.values()]}
async function load(){const all=await api.select('scout_candidates','select=*&order=updated_at.desc&limit=500').catch(()=>[]);rows=dedupe((all||[]).filter(worthwhile));return rows}

function ensureStyle(){if($('#v083ShortlistStyle'))return;const s=document.createElement('style');s.id='v083ShortlistStyle';s.textContent=`
.v083-scan-tabs{display:flex;align-items:center;gap:5px;margin-left:auto;background:#eef4f7;border-radius:10px;padding:3px}.v083-scan-tabs button{border:0;background:transparent;border-radius:8px;padding:7px 10px;font-weight:800;color:#57707c;cursor:pointer}.v083-scan-tabs button.active{background:#fff;color:#18323e;box-shadow:0 1px 5px rgba(20,40,50,.12)}
.v083-shortlist-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.v083-shortlist-tools input,.v083-shortlist-tools select{border:1px solid #d7e1e6;border-radius:9px;padding:8px;background:#fff;min-width:0}.v083-shortlist-list{display:grid;gap:10px}.v083-short-card{display:grid;grid-template-columns:72px 1fr;gap:10px;border:1px solid #dfe8ec;border-radius:12px;padding:10px;background:#fff}.v083-short-thumb{width:72px;height:72px;border-radius:9px;overflow:hidden;background:#eef3f5}.v083-short-thumb img{width:100%;height:100%;object-fit:cover}.v083-short-title{display:flex;gap:8px;align-items:flex-start}.v083-short-title strong{flex:1}.v083-short-score{font-weight:900;border-radius:999px;padding:4px 7px;background:#e8f5ef;color:#126a4f}.v083-short-score.verify{background:#fff0d5;color:#805300}.v083-short-meta,.v083-short-reason{color:#667982;font-size:12px;margin-top:4px}.v083-short-actions{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}.v083-short-actions button{border:0;border-radius:8px;padding:7px 9px;font-weight:800;cursor:pointer;background:#edf3f6;color:#243f4b}.v083-short-actions .primary{background:#167e5d;color:#fff}.v083-short-actions .danger{background:#fff0ee;color:#a23c35}.v083-short-badge{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.v083-short-empty{padding:30px 10px;text-align:center;color:#6b7d86}
`;document.head.appendChild(s)}

function filtered(){let out=[...rows];if(filter!=='all')out=out.filter(c=>status(c)===filter);if(query){const q=query.toLowerCase();out=out.filter(c=>`${c.title||''} ${c.location||''} ${a(c).category||''}`.toLowerCase().includes(q))}out.sort((x,y)=>sort==='score'?potential(y)-potential(x):sort==='profit'?Number(a(y).expected_profit||0)-Number(a(x).expected_profit||0):date(y)-date(x));return out}
function card(c){const x=a(c),st=status(c),reason=(x.action_summary||x.reasons?.[0]||x.authenticity_reasons?.[0]||'Shortlisted by Scout because it looked worth further attention.');return`<article class="v083-short-card" data-short-id="${esc(c.id)}"><div class="v083-short-thumb">${c.thumbnail_url?`<img src="${esc(c.thumbnail_url)}" alt="">`:''}</div><div><div class="v083-short-title"><strong>${esc(c.title||x.identified_name||'Untitled listing')}</strong><span class="v083-short-score ${st==='verify'?'verify':''}">${Math.round(potential(c))}/100</span></div><div class="v083-short-meta">${money(c.asking_price)} · ${esc(c.location||'Location unknown')} · <span class="v083-short-badge">${st==='verify'?'Verify first':'Ready'}</span>${c.saved?' · Saved ✓':''}</div><div class="v083-short-reason">${esc(reason)}</div>${x.authenticity_evidence_state==='missing_evidence'?`<div class="v083-short-reason"><b>Authentication evidence missing.</b> ${esc(x.authentication_request||'Ask the seller for clear labels/tags or other authentication evidence before buying.')}</div>`:''}</div><div class="v083-short-actions"><button class="primary" data-short-save>${c.saved?'Saved ✓':'Save'}</button><button class="primary" data-short-analyse>Analyse now</button><button data-short-queue>Add to Analyse</button><button data-short-open>Open</button><button data-short-edit>Edit</button><button class="danger" data-short-remove>Remove</button></div></article>`}
function render(){if(!active)return;const main=$('.ext-main');if(!main)return;const list=filtered();main.innerHTML=`<section class="page-head"><div><span class="eyebrow">MARKETPLACE SCOUT</span><h1>Shortlist</h1><p>Your permanent history of worthwhile Scout finds. Starting or restarting a scan does not remove these.</p></div><div class="v083-scan-tabs"><button data-v083-scan>Scan</button><button class="active">Shortlist</button></div></section><div class="v083-shortlist-tools"><input data-short-search placeholder="Search shortlist" value="${esc(query)}"><select data-short-filter><option value="all" ${filter==='all'?'selected':''}>All</option><option value="ready" ${filter==='ready'?'selected':''}>Ready</option><option value="verify" ${filter==='verify'?'selected':''}>Verify first</option></select><select data-short-sort><option value="newest" ${sort==='newest'?'selected':''}>Newest</option><option value="score" ${sort==='score'?'selected':''}>Highest score</option><option value="profit" ${sort==='profit'?'selected':''}>Highest profit</option></select></div>${list.length?`<div class="v083-shortlist-list">${list.map(card).join('')}</div>`:`<div class="v083-short-empty"><strong>No shortlisted listings yet.</strong><br>Worthwhile Scout finds will stay here across scans.</div>`}`;bind()}

async function worker(id,action,extra={}){return chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action,...extra})}
function bind(){
  $('[data-v083-scan]')?.addEventListener('click',()=>{active=false;$('.ext-nav [data-view="scan"]')?.click()})
  $('[data-short-search]')?.addEventListener('input',e=>{query=e.target.value;render()})
  $('[data-short-filter]')?.addEventListener('change',e=>{filter=e.target.value;render()})
  $('[data-short-sort]')?.addEventListener('change',e=>{sort=e.target.value;render()})
  $$('.v083-short-card').forEach(el=>{
    const id=el.dataset.shortId,c=rows.find(x=>String(x.id)===String(id));if(!c)return
    $('[data-short-save]',el).onclick=async()=>{const r=await worker(id,'save');if(r?.ok){Object.assign(c,r.data);toast('Saved to your items');render()}else toast(r?.error||'Could not save')}
    $('[data-short-queue]',el).onclick=async()=>{const r=await worker(id,'queue_analyse');toast(r?.ok?'Added to Analyse':r?.error||'Could not add to Analyse')}
    $('[data-short-analyse]',el).onclick=async()=>{if(busy)return;busy=true;toast('Running deeper analysis…');const r=await worker(id,'analyse');busy=false;if(r?.ok){Object.assign(c,r.data);toast('Deep analysis ready');render()}else toast(r?.error||'Analysis failed')}
    $('[data-short-open]',el).onclick=()=>{if(c.source_url)chrome.tabs.create({url:c.source_url,active:true})}
    $('[data-short-remove]',el).onclick=async()=>{const r=await worker(id,'remove_shortlist');if(r?.ok){rows=rows.filter(x=>String(x.id)!==String(id));render();toast('Removed from Shortlist history')}else toast(r?.error||'Could not remove')}
    $('[data-short-edit]',el).onclick=async()=>{const title=prompt('Listing title',c.title||'');if(title===null)return;const price=prompt('Asking price',c.asking_price??'');if(price===null)return;const location=prompt('Location',c.location||'');if(location===null)return;const r=await worker(id,'edit',{fields:{title,asking_price:price,location}});if(r?.ok){Object.assign(c,r.data);render();toast('Listing updated')}else toast(r?.error||'Could not edit')}
  })
}

function installTabs(){if(active)return;const head=$('.scout-page-head');if(!head||head.querySelector('.v083-scan-tabs'))return;const tabs=document.createElement('div');tabs.className='v083-scan-tabs';tabs.innerHTML='<button class="active" data-v083-live-scan>Scan</button><button data-v083-shortlist>Shortlist</button>';head.appendChild(tabs);tabs.querySelector('[data-v083-shortlist]').onclick=async()=>{active=true;await load();render()}}

ensureStyle();new MutationObserver(()=>{if(!active)installTabs()}).observe(document.getElementById('app'),{childList:true,subtree:true});setTimeout(installTabs,250)
