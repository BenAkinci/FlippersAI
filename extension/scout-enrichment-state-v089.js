import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)]
let busy=false,timer=0
const a=c=>c?.analysis||{}
const complete=c=>Boolean(a(c).scout_enriched)&&a(c).resale_mid!=null&&a(c).expected_profit!=null&&a(c).expected_roi_percent!=null
const blocked=c=>Boolean(a(c).scout_enriched)&&(['uncertain','high_risk','likely_counterfeit'].includes(a(c).authenticity_status)||a(c).recommendation==='verify_first')&&(a(c).resale_mid==null||a(c).expected_profit==null)
function valueText(c,key){if(complete(c))return null;if(blocked(c))return key==='resale'?'Pending verification':'Pending verification';return 'Checking…'}
function decorateCard(card,c){
  const metrics=$$('.v088-card-metrics span,.v086-metrics span',card)
  const keys=['score','ask','resale','profit','roi']
  metrics.forEach((cell,i)=>{const key=keys[i];if(!['resale','profit','roi'].includes(key))return;const pending=valueText(c,key);if(!pending)return;const b=$('b',cell);if(!b)return;b.textContent=pending;b.classList.toggle('v089-metric-blocked',blocked(c));b.classList.toggle('v089-metric-pending',!blocked(c))})
  let state=$('.v089-deep-state',card)
  if(complete(c)){state?.remove();return}
  if(!state){state=document.createElement('div');state.className='v089-deep-state';const actions=$('.v088-card-actions,.v086-actions',card);(actions||card).insertAdjacentElement('beforebegin',state)}
  if(blocked(c))state.innerHTML='<strong>Economics waiting on verification</strong>FlippersAI has read the listing, but will not present resale/profit/ROI as final while an important authenticity or evidence issue remains.'
  else state.innerHTML='<strong>Deep checking listing…</strong>Reading the individual listing, seller, condition, description and photos, then completing resale, profit and ROI.'
}
async function refresh(){if(busy)return;const cards=$$('.v088-listing-card[data-v088-id],.v086-card[data-id]');if(!cards.length)return;busy=true;try{const ids=[...new Set(cards.map(c=>c.dataset.v088Id||c.dataset.id).filter(Boolean))];const rows=await api.select('scout_candidates',`select=*&id=in.(${ids.join(',')})`).catch(()=>[]);const map=new Map((rows||[]).map(c=>[String(c.id),c]));cards.forEach(card=>{const c=map.get(String(card.dataset.v088Id||card.dataset.id));if(c)decorateCard(card,c)})}finally{busy=false}}
function schedule(ms=80){clearTimeout(timer);timer=setTimeout(()=>refresh().catch(()=>{}),ms)}
document.addEventListener('flippers:candidate-updated',()=>schedule(30))
new MutationObserver(ms=>{if(ms.some(m=>m.addedNodes.length))schedule()}).observe(document.getElementById('app'),{childList:true,subtree:true})
setInterval(()=>schedule(0),1800)
schedule()
