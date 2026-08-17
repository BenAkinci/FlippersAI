import { api } from './api.js'

const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
let timer=null,last=''
const confidence=c=>{const a=c?.analysis||{};return a.overall_confidence??a.valuation_confidence??a.identification_confidence??null}
const rated=c=>['rated','analysed'].includes(c?.scan_status)||Boolean(c?.recommendation||c?.analysis?.recommendation)
const label=v=>({strong_buy:'Strong lead',buy:'Strong lead',negotiate:'Promising',verify_first:'Needs verification',skip:'Skip'})[v]||'Rated'

async function sync(){
  if(!$('.scout-list'))return
  const ids=$$('.scout-candidate[data-candidate]').map(x=>x.dataset.candidate).filter(Boolean);if(!ids.length)return
  const rows=await api.select('scout_candidates',`select=*&id=in.(${ids.join(',')})`).catch(()=>[])
  const usable=(rows||[]).filter(rated)
  const ranked=[...usable].filter(c=>(c.recommendation||c.analysis?.recommendation)!=='skip').sort((a,b)=>Number(b.rank_score??-999)-Number(a.rank_score??-999))
  const top=new Set(ranked.slice(0,2).map(c=>String(c.id)))
  const ratings=usable.map(c=>{const a=c.analysis||{},rec=c.recommendation||a.recommendation||'';return{id:String(c.id),listingId:c.listing_id||'',url:c.source_url||'',score:Math.round(Number(a.overall_score??c.score??0)),recommendation:rec,label:label(rec),profit:a.expected_profit??c.expected_profit??null,resale:a.resale_mid??c.resale_mid??null,roi:a.expected_roi_percent??c.expected_roi_percent??null,confidence:confidence(c),topPick:top.has(String(c.id))}})
  const enabled=$('#marketplaceBadgeToggle')?.checked!==false
  const sig=JSON.stringify({enabled,ratings});if(sig===last)return;last=sig
  await chrome.runtime.sendMessage({type:'FLIPPERS_ROUTE_RATING_OVERLAY',enabled,ratings}).catch(()=>{})
}

function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),180)}
document.addEventListener('change',e=>{if(e.target.closest?.('#marketplaceBadgeToggle'))schedule()},true)
document.addEventListener('click',e=>{if(e.target.closest?.('[data-dismiss-candidate],#removeScoutSkips,#scanMoreResults,#deepScanSelected'))setTimeout(schedule,350)},true)
new MutationObserver(ms=>{if(ms.some(m=>m.target.closest?.('.scout-list,.scout-candidate,.scout-summary,.scout-insight')))schedule()}).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true})
schedule()
