import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const side=read('sidepanel.html'),work=read('workspace.html'),ctrl=read('scout-controller-v090.js')
expect(manifest.version==='0.90.0','manifest must package v0.90.0')
for(const html of [side,work]){
  expect(html.includes('scout-controller-v090.js'),'v0.90 controller must load')
  for(const old of ['scout-session-v070.js','scout-orchestrator-v080.js','scout-metrics-v076.js','scout-workspace-v071.js','scout-start-watchdog-v081.js'])expect(!html.includes(old),`legacy Scout controller must not load: ${old}`)
}
for(const token of ["api.invoke('scout-batch-screen'",'BATCH_SIZE=5',"scan_status:'working'",'state.active.add',"state.status='paused'", "state.status='stopped'",'async function restart()',"ACTIVE_KEY='flippers_active_scout_v090'"])expect(ctrl.includes(token),`v0.90 controller missing ${token}`)
expect(ctrl.indexOf("state.active.add")<ctrl.indexOf("api.invoke('scout-batch-screen'"),'Working state must be visible before rating request starts')
console.log('v0.90 single-owner Scout rebuild contract passed')
