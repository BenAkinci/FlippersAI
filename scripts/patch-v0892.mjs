import fs from 'node:fs'
function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.89.2 patch applied`)}else console.log(`${path}: v0.89.2 already applied`)}
for(const path of ['extension/sidepanel.html','extension/workspace.html'])update(path,s=>{if(!s.includes('scout-v0892.css'))s=s.replace('</head>','  <link rel="stylesheet" href="scout-v0892.css">\n</head>');if(!s.includes('workspace-actions-v0892.js'))s=s.replace('</body>','  <script type="module" src="workspace-actions-v0892.js"></script>\n</body>');return s})
update('extension/scout-orchestrator-v080.js',s=>{
  s=s.replace("const worthwhile=c=>rated(c)&&!failed(c)&&score(c)>=SHORTLIST_SCORE&&rec(c)!=='skip'&&!risky(c)","const economicLoss=c=>{const a=c?.analysis||{},p=Number(a.expected_profit??c?.expected_profit),r=Number(a.expected_roi_percent??c?.expected_roi_percent),ask=Number(c?.asking_price),resale=Number(a.resale_mid??c?.resale_mid);return(Number.isFinite(p)&&p<=0)||(Number.isFinite(r)&&r<=0)||(Number.isFinite(ask)&&Number.isFinite(resale)&&resale<ask)}\nconst worthwhile=c=>rated(c)&&!failed(c)&&score(c)>=SHORTLIST_SCORE&&rec(c)!=='skip'&&!risky(c)&&!economicLoss(c)")
  s=s.replace("if(a.expected_profit<=0){a.recommendation='skip';a.overall_score=Math.min(Number(a.overall_score||0),45);a.success_potential=Math.min(Number(a.success_potential||0),35)}","if(a.expected_profit<=0||a.expected_roi_percent<=0){a.recommendation='skip';a.overall_score=Math.min(Number(a.overall_score||0),15);a.opportunity_score=Math.min(Number(a.opportunity_score||a.overall_score||0),15);a.success_potential=Math.min(Number(a.success_potential||0),20);a.action_summary=`Skip at the current asking price: expected profit ${a.expected_profit==null?'is not positive':a.expected_profit} AUD and ROI ${a.expected_roi_percent==null?'is not positive':a.expected_roi_percent+'%'}.`}")
  if(!s.includes('FLIPPERS_SCOUT_PANEL_CLOSED'))s += "\nwindow.addEventListener('pagehide',()=>{chrome.runtime.sendMessage({type:'FLIPPERS_SCOUT_PANEL_CLOSED'}).catch(()=>{})},{once:true})\n"
  return s
})
update('extension/service-worker.js',s=>{
  if(!s.includes("case'FLIPPERS_SCOUT_PANEL_CLOSED'"))s=s.replace("case'FLIPPERS_OPEN_WEBSITE_SETTINGS':await chrome.tabs.create({url:CONFIG.websiteUrl});return{ok:true};default:","case'FLIPPERS_OPEN_WEBSITE_SETTINGS':await chrome.tabs.create({url:CONFIG.websiteUrl});return{ok:true};case'FLIPPERS_SCOUT_PANEL_CLOSED':await chrome.storage.local.set({flippers_scout_stopped_v076:true,flippers_scout_user_paused_v076:false});return{ok:true};default:")
  return s
})
update('extension/scout-smart-overview-v066.js',s=>{
  s=s.replace("let regionFilter='ALL',categoryFilter='ALL',timer=null","let regionFilter='ALL',categoryFilter='ALL',timer=null,lastHtml=''")
  const needle="    box.innerHTML=`<div class=\"smart-overview-grid\">"
  if(s.includes(needle))s=s.replace(needle,"    const html=`<div class=\"smart-overview-grid\">")
  s=s.replace("<div class=\"smart-filter-actions\"><span>${visible.length} listing${visible.length===1?'':'s'} shown</span><button type=\"button\" id=\"smartSelectVisible\">Select shown only</button><button type=\"button\" id=\"smartClearFilters\">Clear filters</button></div>`\n  }","<div class=\"smart-filter-actions\"><span>${visible.length} listing${visible.length===1?'':'s'} shown</span><button type=\"button\" id=\"smartSelectVisible\">Select shown only</button><button type=\"button\" id=\"smartClearFilters\">Clear filters</button></div>`\n    if(html!==lastHtml){box.innerHTML=html;lastHtml=html}\n  }")
  return s
})
update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.89.2';m.description='FlippersAI reliability hotfix with economics-led opportunity scoring, stable Scout UI and functional Shortlist/Saved actions.';return JSON.stringify(m,null,2)+'\n'})
update('package.json',s=>{const p=JSON.parse(s);p.version='0.89.2';for(const k of ['check:extension','package:extension'])if(p.scripts[k]&&!p.scripts[k].includes('patch-v0892.mjs'))p.scripts[k]=p.scripts[k].replace('node scripts/patch-v089.mjs','node scripts/patch-v089.mjs && node scripts/patch-v0892.mjs');return JSON.stringify(p,null,2)+'\n'})
