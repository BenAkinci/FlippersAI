import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money=v=>v==null||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const short=(v,n=260)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1).trim()}…`:s}
const value=v=>v?esc(v):'<span class="muted">Not detected yet</span>'
let timer=null

async function sync(){
  const cards=$$('.scout-candidate[data-candidate]');if(!cards.length)return
  const ids=cards.map(c=>c.dataset.candidate).filter(Boolean);const rows=await api.select('scout_candidates',`select=*&id=in.(${ids.join(',')})`).catch(()=>[]);const map=new Map((rows||[]).map(r=>[String(r.id),r]))
  cards.forEach(card=>{const c=map.get(String(card.dataset.candidate));if(!c)return;const raw=c.deep_capture?.description||c.deep_capture?.listingText||c.deep_capture?.visibleText||c.raw_capture?.raw_text||'';const category=c.raw_capture?.category_label||c.analysis?.category||card.dataset.smartCategory||'Other';let details=$('.scout-individual-details',card);if(!details){details=document.createElement('details');details.className='scout-individual-details';$('.scout-candidate-main',card)?.appendChild(details)}details.innerHTML=`<summary>Listing details</summary><div class="scout-detail-grid"><div><span>TITLE</span><strong>${value(c.title)}</strong></div><div><span>PRICE</span><strong>${money(c.asking_price)}</strong></div><div><span>LOCATION</span><strong>${value(c.location)}</strong></div><div><span>CONDITION</span><strong>${value(c.condition)}</strong></div><div><span>SELLER</span><strong>${value(c.seller_name)}</strong></div><div><span>CATEGORY</span><strong>${esc(category)}</strong></div></div>${raw?`<div class="scout-detail-description"><span>DESCRIPTION / CAPTURED DETAILS</span><p>${esc(short(raw))}</p></div>`:''}`})
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),150)}
new MutationObserver(ms=>{if(ms.some(m=>!m.target.closest?.('.scout-individual-details')))schedule()}).observe(document.getElementById('app'),{childList:true,subtree:true})
schedule()
