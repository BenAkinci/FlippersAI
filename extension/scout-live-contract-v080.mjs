import fs from 'node:fs'

const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const js=read('scout-orchestrator-v080.js')
const side=read('sidepanel.html')
const workspace=read('workspace.html')
const manifest=JSON.parse(read('manifest.json'))
const expect=(value,message)=>{if(!value)throw new Error(message)}

const [major,minor]=String(manifest.version||'0.0.0').split('.').map(Number)
expect(major>0||(major===0&&minor>=80),'manifest must be v0.80.0 or newer')
expect(js.includes('const MAX_BATCH=5'),'Scout must remain capped at five active quick ratings')
expect(js.includes("api.invoke('scout-quick-rate'"),'Scout must use independent per-listing quick ratings')
expect(!js.includes("api.invoke('scout-batch-screen'"),'v0.80 quick Scout must not depend on the failing batch endpoint')
expect(js.includes('O.active.set'),'working state must track active listings individually')
expect(js.includes('O.active.delete'),'working state must decrement as individual listings finish')
for(const label of ['FOUND','RATED','WORKING','SHORTLIST','FILTERED OUT'])expect(js.includes(`['${label}',`),`live counters must include ${label}`)
expect(js.includes("['FOUND',allRows.length]")||js.includes("['FOUND',rr.length]"),'FOUND must be sourced from Scout rows')
expect(js.includes("['RATED',ratedRows.length]"),'RATED must count completed ratings')
expect(js.includes("Promise.allSettled(chunk.map(c=>rateOne(c,generation)))"),'each group of five must run independently and wait before starting the next group')
expect(js.includes('O.durations.push'),'Scout must record completion timing for ETA')
expect(js.includes('Estimated ${fmtTime(estimate)} remaining'),'Scout must show an estimated remaining time after completions')
expect(js.includes('Taking longer than expected'),'Scout must surface a visible slow/stalled state')
expect(js.includes('Scout finished with scan errors'),'Scout must not silently hide backend failures')
expect(js.includes('const REQUEST_TIMEOUT=40000'),'Scout must allow normal AI ratings longer than the old 15 second cutoff')
expect(js.includes('for(let attempt=1;attempt<=3;attempt++)'),'each quick rating must automatically retry twice before failing')
expect(js.includes('async function retryFailedOnly()'),'failed-only retry must exist without resetting successful ratings')
for(const html of [side,workspace]){
  expect(html.includes('scout-orchestrator-v080.js'),'v0.80 orchestrator must load')
  expect(!html.includes('scout-orchestrator-v076.js'),'old orchestrator must not load alongside v0.80')
  expect(html.includes('scout-v080.css'),'v0.80 live progress styles must load')
}
console.log('Scout live progress contract v0.80+ passed')
