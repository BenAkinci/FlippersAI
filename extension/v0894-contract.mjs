import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const smart=read('scout-smart-overview-v066.js')
const orch=read('scout-orchestrator-v080.js')
const work=read('workspace-tools-v086.js')
expect(manifest.version==='0.89.4','manifest must package v0.89.4')
expect(!smart.includes("lastHtml='',lastHtml=''"),'lastHtml must never be declared twice')
expect((orch.match(/const economicLoss=c=>/g)||[]).length<=1,'economicLoss must be declared at most once')
expect(!work.includes("$('[data-v088-source-link]',main).forEach"),'source-link iteration must use $$, not $')
const listener="$$('[data-v088-source-link]',main).forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const url=a.getAttribute('href');if(url)chrome.tabs.create({url,active:true})}));"
expect((work.split(listener).length-1)<=1,'source-link listener must not be duplicated')
console.log('v0.89.4 packaged-extension integrity contract passed')
