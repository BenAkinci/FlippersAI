import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),buckets=read('scout-buckets-v088.js'),orch=read('scout-orchestrator-v080.js'),tools=read('workspace-tools-v086.js')
expect(manifest.version==='0.88.0','manifest must package v0.88.0')
for(const html of [side,work]){expect(html.includes('scout-buckets-v088.js'),'v0.88 Scout bucket controller must load');expect(html.includes('scout-buckets-v088.css'),'v0.88 Scout bucket styles must load')}
for(const token of ["new Set(['shortlist'])","bucketDef('found','FOUND')","bucketDef('rated','RATED')","bucketDef('working','WORKING')","bucketDef('shortlist','SHORTLIST')","bucketDef('filtered','FILTERED OUT')","data-v088-open","data-v088-act=\"save\"","data-v088-act=\"analyse\"","data-v088-act=\"edit\""])expect(buckets.includes(token),`Scout buckets must include ${token}`)
expect(buckets.includes("openBuckets.has(key)?openBuckets.delete(key):openBuckets.add(key)"),'Scout buckets must open independently')
expect(orch.includes('document.body.dataset.v088WorkingIds'),'Working bucket must receive actual active listing ids')
expect(tools.includes('data-v088-source-link'),'Shortlist/Saved/Analyse titles must be marketplace links')
expect(tools.includes("chrome.tabs.create({url,active:true})"),'listing title clicks must open the marketplace tab')
console.log('v0.88 focused Scout integration contract passed')
