import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),actions=read('workspace-actions-v0892.js'),css=read('scout-v0892.css'),smart=read('scout-smart-overview-v066.js'),sw=read('service-worker.js'),ctrl=read('scout-controller-v090.js')
const parts=String(manifest.version||'').split('.').map(Number),forward=parts[0]>0||parts[1]>89||(parts[1]===89&&parts[2]>=2)
expect(forward,'manifest must preserve v0.89.2+ repair line')
for(const h of [side,work]){expect(h.includes('scout-v0892.css'),'v0.89.2 CSS must load');expect(h.includes('workspace-actions-v0892.js'),'v0.89.2 actions must load')}
expect(ctrl.includes('const economicLoss='),'Shortlist must preserve an economic loss gate')
expect(ctrl.includes("a.overall_score=Math.min(Number(a.overall_score||0),49)")&&ctrl.includes("a.recommendation='skip'"),'negative economics must cap and reject the opportunity')
expect(!ctrl.includes("window.addEventListener('pagehide'"),'ordinary pagehide must not destroy active Scout state')
expect(sw.includes("case'FLIPPERS_SCOUT_PANEL_CLOSED':return{ok:true};"),'legacy panel-close message must remain harmless')
expect(css.includes('#v080Loading{position:relative!important')&&css.includes('clear:both!important'),'loader must remain in document flow')
expect(smart.includes("lastHtml=''"),'Area/category overview must suppress unchanged rerenders')
for(const token of ['analyse_queued:true','openCompare','inlineEdit','startDeal','Saved to Saved Leads','v0892-tag-chips'])expect(actions.includes(token),`workspace action layer must include ${token}`)
console.log('v0.89.2 user-verification protections preserved on v0.90')
