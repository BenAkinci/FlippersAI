import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)]
const compare=new Set()
let timer=0
function view(){const h=$('.v086-head h1')?.textContent?.toLowerCase()||'';return h.includes('shortlist')?'shortlist':h.includes('saved')?'saved':h.includes('analyse')?'analyse':''}
async function row(id){const rows=await api.select('scout_candidates',`select=*&id=eq.${encodeURIComponent(id)}&limit=1`).catch(()=>[]);return rows?.[0]||null}
function toast(message){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}
function ensure(){const current=view();if(!current)return;for(const card of $$('.v086-card[data-id]')){
  const id=card.dataset.id
  let tools=$('.v086-card-tools',card)
  if(!tools){tools=document.createElement('div');tools.className='v086-card-tools';tools.innerHTML=current==='shortlist'?`<button class="v086-icon" data-v088-guard="save" title="Save to Saved Leads">♡</button><button class="v086-icon danger" data-v088-guard="remove" title="Remove">×</button>`:`<span class="v086-icon static">♥</span><button class="v086-icon danger" data-v088-guard="remove" title="Remove">×</button>`;card.prepend(tools)}
  let actions=$('.v086-actions',card)
  if(!actions){actions=document.createElement('div');actions.className='v086-actions';actions.innerHTML=`<button class="primary" data-v088-guard="analyse">Analyse now</button>${current==='shortlist'?'<button data-v088-guard="compare">Compare</button>':''}`;const notes=$('.v086-note-row',card);notes?card.insertBefore(actions,notes):card.appendChild(actions)}
  const title=$('.v086-title',card);if(title&&title.tagName!=='A')row(id).then(c=>{if(!c?.source_url||!title.isConnected)return;const a=document.createElement('a');a.className=title.className;a.textContent=title.textContent;a.href=c.source_url;a.target='_blank';a.rel='noopener';a.dataset.v088Guard='open';title.replaceWith(a)}).catch(()=>{})
 }
 renderCompare()
}
function renderCompare(){let tray=$('#v088WorkspaceCompare');if(compare.size<2){tray?.remove();return}const main=$('.ext-main');if(!main)return;if(!tray){tray=document.createElement('div');tray.id='v088WorkspaceCompare';tray.className='v086-compare';const toolbar=$('.v086-toolbar',main);toolbar?.insertAdjacentElement('afterend',tray)}Promise.all([...compare].slice(0,3).map(row)).then(items=>{tray=$('#v088WorkspaceCompare');if(!tray)return;tray.innerHTML=`<strong>Compare ${items.filter(Boolean).length} leads</strong>${items.filter(Boolean).map(c=>`<span>${String(c.title||'Listing').slice(0,28)}: ${Math.round(Number(c.analysis?.overall_score??c.score??0))}/100 · ${c.analysis?.expected_profit==null?'—':`$${Math.round(Number(c.analysis.expected_profit))}`} profit</span>`).join('')}<button data-v088-guard="clear-compare">Clear</button>`}).catch(()=>{})}
async function act(card,action){const id=card?.dataset.id;if(action==='clear-compare'){compare.clear();renderCompare();return}if(!id)return;const c=await row(id);if(!c)return
 if(action==='open'){if(c.source_url)chrome.tabs.create({url:c.source_url,active:true});return}
 if(action==='save'){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'save'});if(!r?.ok)throw new Error(r?.error||'Could not save');card.remove();toast('Moved to Saved Leads');return}
 if(action==='analyse'){toast('Running deeper analysis…');const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'analyse'});if(!r?.ok)throw new Error(r?.error||'Analysis failed');toast('Analysis ready');return}
 if(action==='remove'){if(view()==='shortlist'){const r=await chrome.runtime.sendMessage({type:'FLIPPERS_V083_ACTION',id,action:'remove_shortlist'});if(!r?.ok)throw new Error(r?.error||'Could not remove')}else await api.update('scout_candidates',`id=eq.${id}`,{saved:false,saved_at:null,updated_at:new Date().toISOString()});card.remove();toast('Removed');return}
 if(action==='compare'){compare.has(String(id))?compare.delete(String(id)):compare.size<3?compare.add(String(id)):toast('Compare up to 3 leads');renderCompare();const b=$('[data-v088-guard="compare"]',card);if(b)b.textContent=compare.has(String(id))?'Comparing ✓':'Compare'}

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v088-guard]');if(!b)return;const action=b.dataset.v088Guard;if(action==='open'){e.preventDefault()}act(b.closest('.v086-card'),action).catch(err=>toast(err.message))},true)
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ensure,70)}).observe(document.getElementById('app'),{childList:true,subtree:true})
setTimeout(ensure,180)
