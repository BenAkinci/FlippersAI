import fs from 'node:fs'

const path='extension/scout-orchestrator-v080.js'
let source=fs.readFileSync(path,'utf8')

const oldHeader="function renderLive(rows){const rr=roundRows(rows),ratedRows=rr.filter(rated),failedRows=rr.filter(failed),short=rr.filter(worthwhile),filtered=ratedRows.filter(c=>!worthwhile(c)),working=Math.min(MAX_BATCH,O.active.size);O.total=rr.length;O.done=ratedRows.length;O.batchCount=Math.max(1,Math.ceil(rr.length/MAX_BATCH));"
const newHeader="function renderLive(rows){const rr=roundRows(rows),allRows=rows,ratedRows=allRows.filter(rated),failedRows=allRows.filter(failed),short=allRows.filter(worthwhile),filtered=ratedRows.filter(c=>!worthwhile(c)),working=Math.min(MAX_BATCH,O.active.size);O.total=rr.length;O.done=rr.filter(rated).length;O.batchCount=Math.max(1,Math.ceil(rr.length/MAX_BATCH));"
if(source.includes(oldHeader)) source=source.replace(oldHeader,newHeader)

source=source.replace("[['FOUND',rr.length],['RATED',ratedRows.length],['WORKING',working],['SHORTLIST',short.length],['FILTERED OUT',filtered.length]]","[['FOUND',allRows.length],['RATED',ratedRows.length],['WORKING',working],['SHORTLIST',short.length],['FILTERED OUT',filtered.length]]")
source=source.replaceAll('${ratedRows.length}/${rr.length}','${ratedRows.length}/${allRows.length}')
source=source.replace('ratedRows.length+failedRows.length<rr.length||working','ratedRows.length+failedRows.length<allRows.length||working')

const oldRestart="async function restartRound(){const ctx=await sourceContext();if(!ctx.sourceAlive)return toast('The original Scout page is no longer open at the same URL.');O.generation+=1;O.stopped=false;O.paused=false;O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;await cancelBackgroundWork();await chrome.storage.local.set({[STOP_KEY]:false,[USER_PAUSE_KEY]:false});const rows=await loadRows(),rr=roundRows(rows),reset={scan_status:'quick',analysis:{},recommendation:null,score:null,resale_mid:null,expected_profit:null,expected_roi_percent:null,rank_score:null,selected:false,deep_capture:{},updated_at:new Date().toISOString()};await Promise.all(rr.map(c=>api.update('scout_candidates',`id=eq.${c.id}`,reset).catch(()=>null)));renderLive(await loadRows());toast('Current Scout restarted from the first 5');fastScreen().catch(err=>toast(err.message))}"
const newRestart="async function restartRound(){const ctx=await sourceContext();if(!ctx.sourceAlive)return toast('The original Scout page is no longer open at the same URL.');O.generation+=1;O.stopped=false;O.paused=false;O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;await cancelBackgroundWork();await chrome.storage.local.set({[STOP_KEY]:false,[USER_PAUSE_KEY]:false});const rows=await loadRows();await Promise.all(rows.map((c,index)=>api.update('scout_candidates',`id=eq.${c.id}`,{scan_status:'quick',analysis:{},recommendation:null,score:null,resale_mid:null,expected_profit:null,expected_roi_percent:null,rank_score:null,selected:false,deep_capture:{},raw_capture:{...(c.raw_capture||{}),round_index:1,order_index:index},updated_at:new Date().toISOString()}).catch(()=>null)));renderLive(await loadRows());toast('Current Scout restarted from the first 5');fastScreen().catch(err=>toast(err.message))}"
if(source.includes(oldRestart)) source=source.replace(oldRestart,newRestart)

const oldBoot=";(async()=>{const stored=await chrome.storage.local.get([USER_PAUSE_KEY,STOP_KEY]).catch(()=>({}));O.paused=Boolean(stored[USER_PAUSE_KEY]);O.stopped=Boolean(stored[STOP_KEY]);const active=await activeScout();"
const newBoot=";(async()=>{const stored=await chrome.storage.local.get([USER_PAUSE_KEY,STOP_KEY]).catch(()=>({}));if(stored[STOP_KEY]){await chrome.storage.local.remove([ACTIVE_KEY,STOP_KEY,USER_PAUSE_KEY]);location.reload();return}O.paused=Boolean(stored[USER_PAUSE_KEY]);O.stopped=false;const active=await activeScout();"
if(source.includes(oldBoot)) source=source.replace(oldBoot,newBoot)

fs.writeFileSync(path,source)
console.log('Scout cumulative session accounting patch applied')
