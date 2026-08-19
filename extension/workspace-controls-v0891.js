import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)]
let rows=new Map(),busy=false,timer=0
const a=c=>c?.analysis||{}
const score=c=>Number(a(c).opportunity_score??a(c).overall_score??c?.score??0)
const val=(c,key)=>{const x=a(c);if(key==='profit')return x.expected_profit??c.expected_profit;if(key==='roi')return x.expected_roi_percent??c.expected_roi_percent;if(key==='score')return score(c);return null}
const date=c=>new Date(c?.updated_at||c?.saved_at||c?.created_at||0).getTime()||0
const verify=c=>{const x=a(c),r=c?.recommendation||x.recommendation||'';return r==='verify_first'||['uncertain','high_risk'].includes(x.authenticity_status)||x.authenticity_evidence_state==='missing_evidence'}
const toast=m=>{document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.remove(),2200)}

async function loadRows(cards){const ids=[...new Set(cards.map(c=>c.dataset.id).filter(Boolean))];if(!ids.length)return;const out=await api.select('scout_candidates',`select=*&id=in.(${ids.join(',')})`).catch(()=>[]);rows=new Map((out||[]).map(c=>[String(c.id),c]))}
function ensureActions(card){const id=card.dataset.id,c=rows.get(String(id));if(!c)return;const view=($('.v086-head h1')?.textContent||'').toLowerCase();const shortlist=view.includes('shortlist'),saved=view.includes('saved')
  let tools=$('.v086-card-tools',card);if(!tools){tools=document.createElement('div');tools.className='v086-card-tools';card.prepend(tools)}
  if(shortlist&&!$('[data-v0891-act="save"],[data-act="save"]',tools)){const b=document.createElement('button');b.className='v086-icon';b.dataset.v0891Act='save';b.title='Save to Saved Leads';b.textContent='♡';tools.appendChild(b)}
  if(saved&&!tools.querySelector('.static')){const s=document.createElement('span');s.className='v086-icon static';s.textContent='♥';tools.prepend(s)}
  if(!$('[data-v0891-act="remove"],[data-act="remove"]',tools)){const b=document.createElement('button');b.className='v086-icon danger';b.dataset.v0891Act='remove';b.title='Remove';b.textContent='×';tools.appendChild(b)}
  let actions=$('.v086-actions',card);if(!actions){actions=document.createElement('div');actions.className='v086-actions';const notes=$('.v086-note-row',card);notes?card.insertBefore(actions,notes):card.appendChild(actions)}
  if(!$('[data-v0891-act="analyse"],[data-act="analyse"]',actions)){const b=document.createElement('button');b.className='primary';b.dataset.v0891Act='analyse';b.textContent='Analyse now';actions.appendChild(b)}
  if(shortlist&&!$('[data-v0891-act="compare"],[data-act="compare"]',actions)){const b=document.createElement('button');b.dataset.v0891Act='compare';b.textContent='Compare';actions.appendChild(b)}
  const obsolete=$('[data-act="queue"]',actions);if(obsolete)obsolete.remove()
}
async function act(card,action){const id=card.dataset.id,c=rows.get(String(id));if(!c)return
  if(action==='save'){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'save'});if(!r?.ok)throw new Error(r?.error||'Could not save');card.remove();toast('Moved to Saved Leads')}
  if(action==='remove'){const shortlist=($('.v086-head h1')?.textContent||'').toLowerCase().includes('shortlist');if(shortlist){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'remove_shortlist'});if(!r?.ok)throw new Error(r?.error||'Could not remove')}else await api.update('scout_candidates',`id=eq.${id}`,{saved:false,saved_at:null,updated_at:new Date().toISOString()});card.remove();toast('Removed')}
  if(action==='analyse'){toast('Running deeper analysis…');const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'analyse'});if(!r?.ok)throw new Error(r?.error||'Analysis failed');toast('Analysis ready')}
  if(action==='compare'){const existing=$('[data-act="compare"]',card);if(existing)existing.click();else{document.dispatchEvent(new CustomEvent('flippers:v088-compare',{detail:{id}}));toast('Selected for comparison')}}
}
function applyControls(){const main=$('.ext-main'),cards=$$('.v086-card[data-id]',main);if(!main||!cards.length)return
  const search=String($('[data-v086-search]',main)?.value||'').trim().toLowerCase(),filter=$('[data-v086-filter]',main)?.value||'all',sort=$('[data-v086-sort]',main)?.value||'newest'
  const visible=[]
  for(const card of cards){const c=rows.get(String(card.dataset.id));if(!c)continue;ensureActions(card);const text=`${c.title||''} ${c.location||''} ${c.condition||''} ${c.seller_name||''} ${a(c).brand||''} ${a(c).model||''}`.toLowerCase();let show=!search||text.includes(search);if(filter==='ready')show=show&&!verify(c);else if(filter==='verify')show=show&&verify(c);else if(filter==='analysed')show=show&&c.scan_status==='analysed';else if(filter==='queued')show=show&&Boolean(a(c).analyse_queued);card.hidden=!show;if(show)visible.push({card,c})}
  const numeric=(c,key)=>{const n=Number(val(c,key));return Number.isFinite(n)?n:-Infinity}
  visible.sort((x,y)=>sort==='score'?numeric(y.c,'score')-numeric(x.c,'score'):sort==='profit'?numeric(y.c,'profit')-numeric(x.c,'profit'):sort==='roi'?numeric(y.c,'roi')-numeric(x.c,'roi'):sort==='oldest'?date(x.c)-date(y.c):date(y.c)-date(x.c))
  const list=$('.v086-list',main);if(list)visible.forEach(({card})=>list.appendChild(card))
}
async function refresh(){if(busy)return;const cards=$$('.v086-card[data-id]');if(!cards.length)return;busy=true;try{await loadRows(cards);applyControls()}finally{busy=false}}
function schedule(ms=80){clearTimeout(timer);timer=setTimeout(()=>refresh().catch(()=>{}),ms)}
document.addEventListener('input',e=>{if(e.target.matches?.('[data-v086-search]'))schedule(0)},true)
document.addEventListener('change',e=>{if(e.target.matches?.('[data-v086-filter],[data-v086-sort]'))schedule(0)},true)
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v0891-act]');if(!b)return;e.preventDefault();e.stopPropagation();act(b.closest('.v086-card'),b.dataset.v0891Act).catch(err=>toast(err.message))},true)
new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.v086-card,.v086-list')||n.querySelector?.('.v086-card')))))schedule(100)}).observe(document.getElementById('app'),{childList:true,subtree:true})
setInterval(()=>schedule(0),1600)
schedule()
