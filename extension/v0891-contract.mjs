import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),buckets=read('scout-buckets-v088.js'),controls=read('workspace-controls-v0891.js'),css=read('scout-v089.css')
expect(manifest.version==='0.89.1','manifest must package v0.89.1')
for(const html of [side,work])expect(html.includes('workspace-controls-v0891.js'),'v0.89.1 workspace control reliability layer must load')
expect(buckets.includes("lastSignature=''"),'Scout buckets must suppress self-triggered rerenders')
expect(buckets.includes("sig===lastSignature"),'Scout bucket rendering must be signature-stable')
expect(buckets.includes("!n.closest?.('#v088ScoutBuckets')"),'Scout bucket observer must ignore its own DOM')
for(const token of ['data-v0891-act','data-v086-filter','data-v086-sort','data-v086-search','ensureActions(card)','visible.sort'])expect(controls.includes(token),`workspace controls must include ${token}`)
expect(css.includes('#v080Loading{box-sizing:border-box!important;width:calc(100% - 24px)!important'),'Scout loader must be constrained inside the side panel')
expect(css.includes('.v086-card-tools,.v086-actions{pointer-events:auto!important'),'Shortlist actions must remain interactive')
console.log('v0.89.1 user-verification hotfix contract passed')
