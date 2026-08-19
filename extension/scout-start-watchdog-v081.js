import { api } from './api.js'

const ACTIVE_KEY='flippers_active_scout_session_v068'
let running=false
let lastKick=0

const rated=c=>['rated','analysed'].includes(c?.scan_status)||Boolean(c?.recommendation||c?.analysis?.recommendation)
const failed=c=>c?.scan_status==='failed'
const pending=c=>!rated(c)&&!failed(c)

async function activeScout(){
  return (await chrome.storage.local.get(ACTIVE_KEY).catch(()=>({})))[ACTIVE_KEY]||null
}

async function rowsFor(sessionId){
  if(!sessionId)return[]
  return await api.select('scout_candidates',`select=*&session_id=eq.${encodeURIComponent(sessionId)}`).catch(()=>[])
}

function forceV080Labels(rows){
  const summary=document.querySelector('.scout-summary')
  if(summary){
    const rr=rows||[]
    const ratedRows=rr.filter(rated)
    const failedRows=rr.filter(failed)
    const pendingRows=rr.filter(pending)
    const working=Math.min(5,Number(document.querySelector('#v080Loading')?.dataset?.working||0))
    const cells=[...summary.children]
    const current=[['FOUND',rr.length],['RATED',ratedRows.length],['WORKING',working],['SHORTLIST',Math.max(0,Number(cells[3]?.querySelector('strong')?.textContent||0))],['FILTERED OUT',Math.max(0,ratedRows.length-Math.max(0,Number(cells[3]?.querySelector('strong')?.textContent||0)))]]
    current.forEach(([label,value],i)=>{if(cells[i]&&cells[i].querySelector('span')?.textContent==='SCREENING'){cells[i].querySelector('span').textContent=label;cells[i].querySelector('strong').textContent=String(value)}})
    if(!pendingRows.length&&failedRows.length===0)return
  }
  const loader=document.querySelector('#v080Loading')
  if(loader){
    const copy=loader.querySelector('.scout-loading-copy span')
    if(copy&&/shared-market batch/i.test(copy.textContent||''))copy.textContent='Preparing the first 5 listings.'
  }
}

async function kick(){
  if(running)return
  running=true
  try{
    const active=await activeScout()
    if(!active?.sessionId)return
    const rows=await rowsFor(active.sessionId)
    forceV080Labels(rows)
    if(!rows.some(pending))return
    const working=Number(document.querySelector('.scout-summary')?.children?.[2]?.querySelector('strong')?.textContent||0)
    if(working>0)return
    const now=Date.now()
    if(now-lastKick<2500)return
    lastKick=now
    document.dispatchEvent(new CustomEvent('flippers:scout-rendered',{detail:{source:'v081-watchdog',sessionId:active.sessionId}}))
  }finally{
    running=false
  }
}

setInterval(()=>kick().catch(()=>{}),1500)
document.addEventListener('flippers:scout-rendered',()=>setTimeout(()=>kick().catch(()=>{}),400))
setTimeout(()=>kick().catch(()=>{}),700)
