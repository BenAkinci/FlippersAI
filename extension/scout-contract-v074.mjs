import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`./${name}`,import.meta.url),'utf8')
const must=(ok,message)=>{if(!ok)throw new Error(`Scout v0.74 contract failed: ${message}`)}
const side=read('sidepanel.html')
const workspace=read('workspace.html')
const orchestrator=read('scout-orchestrator-v074.js')
const direct=read('analyse-direct-v074.js')
const css=read('scout-v074.css')
const manifest=JSON.parse(read('manifest.json'))

must(manifest.version==='0.74.0','manifest version')
for(const html of [side,workspace]){
  must(html.includes('scout-orchestrator-v074.js'),'v0.74 orchestrator loaded')
  must(html.includes('analyse-direct-v074.js'),'direct Analyse loaded')
  must(html.includes('scout-v074.css'),'v0.74 styles loaded')
  must(!html.includes('scout-orchestrator-v073.js'),'v0.73 orchestrator removed from active page')
}
must(orchestrator.includes('const MAX_BATCH=5'),'exactly five listings per quick-screen batch')
must(!orchestrator.includes('PARALLEL_BATCHES'),'no parallel multi-batch fanout')
must(orchestrator.includes("id=\"v074Pause\"")&&orchestrator.includes("id=\"v074Restart\"")&&orchestrator.includes("id=\"v074New\""),'single control group')
must(orchestrator.includes('restart.disabled=!ctx.same'),'restart gated to current source page')
must(orchestrator.includes('fresh.disabled=!ctx.newCollection'),'new scan gated to different collection page')
must(orchestrator.includes('O.generation+=1')&&orchestrator.includes('flippers:scout-hard-stop'),'stop invalidates in-flight work')
must(orchestrator.includes('AUTO_NEW_KEY')&&orchestrator.includes("button.click()"),'new-page scan restarts automatically after clean reset')
must(css.includes('#scoutRescan,.v071-scan-controls{display:none!important}'),'duplicate legacy scan controls hidden')
must(direct.includes('Analyse a listing directly'),'direct Analyse form')
must(direct.includes("api.invoke('analyse-listing-v2'"),'direct Analyse runs full analysis')
must(direct.includes("source:'direct_analyse'"),'direct Analyse stored separately from Scout')
must(!direct.includes("state.view = 'scan'"),'direct Analyse never routes to Scan')
console.log('Scout v0.74 contract OK')
