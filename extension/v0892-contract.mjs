import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),orch=read('scout-orchestrator-v080.js'),actions=read('workspace-actions-v0892.js'),css=read('scout-v0892.css'),smart=read('scout-smart-overview-v066.js'),sw=read('service-worker.js')
expect(/^0\.89\.[2-9]$/.test(manifest.version),'manifest must preserve v0.89.2+ repair line')
for(const h of [side,work]){expect(h.includes('scout-v0892.css'),'v0.89.2 CSS must load');expect(h.includes('workspace-actions-v0892.js'),'v0.89.2 actions must load')}
expect(orch.includes('economicLoss=c=>'),'Shortlist must have an economic loss gate')
expect(orch.includes('a.opportunity_score=Math.min')&&orch.includes('expected_roi_percent<=0'),'negative economics must cap opportunity score')
expect(orch.includes('FLIPPERS_SCOUT_PANEL_CLOSED'),'panel close must stop Scout state')
expect(sw.includes("case'FLIPPERS_SCOUT_PANEL_CLOSED'"),'service worker must persist panel close stop')
expect(css.includes('#v080Loading{position:relative!important')&&css.includes('clear:both!important'),'loader must remain in document flow')
expect(smart.includes("lastHtml=''"),'Area/category overview must suppress unchanged rerenders')
for(const token of ['analyse_queued:true','openCompare','inlineEdit','startDeal','Saved to Saved Leads','v0892-tag-chips'])expect(actions.includes(token),`workspace action layer must include ${token}`)
console.log('v0.89.2 user-verification repair contract passed')
