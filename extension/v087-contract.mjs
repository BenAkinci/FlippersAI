import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const side=read('sidepanel.html'),work=read('workspace.html'),orch=read('scout-orchestrator-v080.js'),actions=read('marketplace-actions-v083.js'),tools=read('workspace-tools-v086.js'),app=read('app.js'),manifest=JSON.parse(read('manifest.json'))
expect(Number(manifest.version.split('.')[1])>=87,'manifest must retain v0.87+ behaviour')
for(const html of [side,work]){expect(html.includes('scout-actions-v087.js'),'Scout action layer must load');expect(html.includes('scout-v087.css'),'Scout v0.87 styles must load')}
expect(orch.includes('overall_score:Number(enrich.opportunity_score??prior.overall_score??c.score??0)'),'deep enrichment must become canonical score')
expect(orch.includes("rec(c)==='verify_first'||!c.location||!c.condition||!c.seller_name"),'Verify First and incomplete listings must enrich in background')
expect(actions.includes('overall_score:Number(e.opportunity_score??prior.overall_score??c.score??0)'),'manual rescan must sync canonical score')
expect(actions.includes('message.fields?.condition')&&actions.includes('message.fields?.seller_name'),'Scan edit must support condition and seller')
expect(!tools.includes('Add to Analyse</button>'),'redundant Add to Analyse button must be removed')
expect(tools.includes('async function startDealCandidate(c)'),'Saved leads must create complete Deals')
expect(app.includes('Finishing listing details')&&app.includes('name="condition"')&&app.includes('name="seller"'),'Deal review must prefill condition and seller')
console.log('v0.87 extension compatibility contract passed')
