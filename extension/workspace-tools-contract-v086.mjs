import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const side=read('sidepanel.html'),work=read('workspace.html'),tools=read('workspace-tools-v086.js'),manifest=JSON.parse(read('manifest.json'))
const expect=(v,m)=>{if(!v)throw new Error(m)}
expect(manifest.version==='0.86.0','manifest must package v0.86.0')
for(const html of [side,work]){
  expect(html.includes('workspace-tools-v086.js'),'v0.86 workspace controller must load')
  expect(html.includes('workspace-tools-v086.css'),'v0.86 workspace styles must load')
  expect(html.includes('nav-v086.css'),'v0.86 responsive nav styles must load')
  expect(!html.includes('workspace-tools-v085.js'),'v0.85 workspace controller must not load')
}
for(const token of ["['shortlist','Shortlist']","['saved','Saved']","['analyse','Analyse']",'c.saved||x.shortlist_hidden','Moved to Saved Leads','data-act="open"','data-act="save"','data-act="remove"','data-notes','data-tags','recoveryBusy','v086Recovery'])expect(tools.includes(token),`workspace tools must include ${token}`)
expect(!tools.includes('MutationObserver(()=>{ensureNav();if(!activeView)setTimeout(()=>injectRecovery'), 'legacy v0.85 recovery observer must be gone')
console.log('v0.86 workspace integration contract passed')
