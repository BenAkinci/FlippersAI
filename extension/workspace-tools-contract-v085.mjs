import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const side=read('sidepanel.html'),work=read('workspace.html'),sw=read('service-worker.js'),tools=read('workspace-tools-v085.js'),manifest=JSON.parse(read('manifest.json'))
const expect=(v,m)=>{if(!v)throw new Error(m)}
expect(manifest.version==='0.85.0','manifest must package v0.85.0')
for(const html of [side,work]){
  expect(html.includes('workspace-tools-v085.js'),'v0.85 workspace controller must load')
  expect(html.includes('workspace-tools-v085.css'),'v0.85 workspace styles must load')
  expect(!html.includes('scout-workspace-v071.js'),'legacy Analyse nav controller must not load')
  expect(!html.includes('shortlist-history-v083.js'),'legacy Shortlist injector must not load')
}
for(const token of ["['shortlist','Shortlist']","['saved','Saved']","['analyse','Analyse']",'Find leads for me','Near-misses','Record outcome','Start deal','Compare'])expect(tools.includes(token),`workspace tools must include ${token}`)
expect(sw.includes("import './marketplace-actions-v083.js'"),'marketplace action handler must be imported')
expect(sw.includes("if(message?.type==='FLIPPERS_V083_ACTION')return false"),'main service worker listener must yield marketplace actions to their handler')
expect(manifest.content_scripts?.[0]?.js?.includes('marketplace-rating-panel-v083.js'),'rating explanation panel must be registered')
console.log('v0.85 workspace integration contract passed')
