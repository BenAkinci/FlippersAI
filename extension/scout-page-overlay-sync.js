import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const ENABLED_KEY='flippers_marketplace_badges_enabled_v067'
let timer=null,last='',enabledCache=null
const confidence=c=>{const a=c?.analysis||{};return a.overall_confidence??a.valuation_confidence??a.identification_confidence??null}
const rated=c=>['rated','analysed'].includes(c?.scan_status)||Boolean(c?.recommendation||c?.analysis?.recommendation)
const label=v=>({strong_buy:'Strong lead',buy:'Strong lead',negotiate:'Promising',verify_first:'Needs verification',skip:'Skip'})[v]||'Rated'

async function enabledState(){
  if(enabledCache!==null)return enabledCache
  const stored=await chrome.storage.local.get(ENABLED_KEY).catch(()=>({}))
  enabledCache=stored[ENABLED_KEY]!==false
  return enabledCache
}

async function sync(){
  if(!$('.scout-list'))return
  const ids=$$('.scout-candidate[data-candidate]').map(x=>x.dataset.candidate).filter(Boolean);if(!ids.length)return
  const rows=await api.select('scout_candidates',`select=*&id=in.(${ids.join(',')})`).catch(()=>[])
  const usable=(rows||[]).filter(rated)
  const ratings=usable.map(c=>{
    const a=c.analysis||{},rec=c.recommendation||a.recommendation||'',score=Math.round(Number(a.overall_score??c.score??0))
    return{id:String(c.id),listingId:c.listing_id||'',url:c.source_url||'',score,recommendation:rec,label:label(rec),profit:a.expected_profit??c.expected_profit??null,resale:a.resale_mid??c.resale_mid??null,roi:a.expected_roi_percent??c.expected_roi_percent??null,confidence:confidence(c),elite:score>=95&&['strong_buy','buy'].includes(rec),scannedAt:c.updated_at||new Date().toISOString()}
  })
  const enabled=await enabledState()
  const toggle=$('#marketplaceBadgeToggle')
  if(toggle&&toggle.checked!==enabled)toggle.checked=enabled
  const sig=JSON.stringify({enabled,ratings});if(sig===last)return;last=sig
  await chrome.runtime.sendMessage({type:'FLIPPERS_ROUTE_RATING_OVERLAY',enabled,ratings}).catch(()=>{})
}

function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),160)}

document.addEventListener('change',async e=>{
  const toggle=e.target.closest?.('#marketplaceBadgeToggle')
  if(!toggle)return
  enabledCache=Boolean(toggle.checked)
  await chrome.storage.local.set({[ENABLED_KEY]:enabledCache}).catch(()=>{})
  last=''
  schedule()
},true)

document.addEventListener('click',e=>{
  const dismiss=e.target.closest?.('[data-dismiss-candidate]')
  if(dismiss){
    const card=dismiss.closest?.('.scout-candidate'),id=card?.dataset.candidate
    if(id)chrome.runtime.sendMessage({type:'FLIPPERS_ROUTE_RATING_REMOVE',listings:[{id}]}).catch(()=>{})
  }
  const removeSkips=e.target.closest?.('#removeScoutSkips')
  if(removeSkips){
    const listings=$$('.scout-candidate').filter(card=>$('.scout-rec',card)?.textContent?.trim()==='Skip').map(card=>({id:card.dataset.candidate})).filter(x=>x.id)
    if(listings.length)chrome.runtime.sendMessage({type:'FLIPPERS_ROUTE_RATING_REMOVE',listings}).catch(()=>{})
  }
  if(e.target.closest?.('[data-dismiss-candidate],#removeScoutSkips,#scanMoreResults,#deepScanSelected'))setTimeout(schedule,320)
},true)

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local'||!changes[ENABLED_KEY])return
  enabledCache=changes[ENABLED_KEY].newValue!==false
  const toggle=$('#marketplaceBadgeToggle');if(toggle)toggle.checked=enabledCache
  last='';schedule()
})

new MutationObserver(ms=>{if(ms.some(m=>m.target.closest?.('.scout-list,.scout-candidate,.scout-summary,.scout-insight,.scout-curation-controls')))schedule()}).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true})
schedule()
