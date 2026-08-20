import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const orch=read('scout-orchestrator-v080.js')
expect(manifest.version==='0.89.10','manifest must package v0.89.10')
expect(orch.includes('async function waitForNewScoutSession'),'Start new scan must wait for a newly persisted Scout session')
expect(orch.includes('const next=await waitForNewScoutSession(previous,10000)'),'Start new scan must explicitly wait for a different session id')
expect(orch.includes('await syncNewSession();\n  ensureUi();'),'new Scout must attach the rating orchestrator before first batch')
const start=orch.match(/async function startNewScan\(\)\{[\s\S]*?\n\}/)?.[0]||''
expect(start.includes('fastScreen().catch'),'Start new scan must directly dispatch the rating engine')
expect(start.includes('Scout could not start its first batch'),'startup timeout must fail visibly instead of spinning forever')
expect(!start.includes('location.reload()'),'Start new scan must remain in-place')
console.log('v0.89.10 Scout startup handoff contract passed')
