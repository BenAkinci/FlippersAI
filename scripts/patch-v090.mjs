import fs from 'node:fs'

const cleanHtml=path=>{
  let s=fs.readFileSync(path,'utf8')
  for(const file of ['scout-session-v070.js','scout-orchestrator-v080.js','scout-metrics-v076.js','scout-workspace-v071.js','scout-start-watchdog-v081.js']){
    s=s.replace(new RegExp(`\\s*<script[^>]+src=["']${file.replaceAll('.','\\.')}["'][^>]*><\\/script>\\s*`,'g'),'\n')
  }
  if(!s.includes('scout-controller-v090.js'))s=s.replace('<script type="module" src="floating-window.js"></script>','<script type="module" src="floating-window.js"></script>\n  <script type="module" src="scout-controller-v090.js"></script>')
  fs.writeFileSync(path,s)
}

cleanHtml('extension/sidepanel.html')
cleanHtml('extension/workspace.html')

const ctrlPath='extension/scout-controller-v090.js'
let ctrl=fs.readFileSync(ctrlPath,'utf8')
if(!ctrl.includes('const economicLoss=')){
  ctrl=ctrl.replace("const risky=c=>['likely_counterfeit','high_risk'].includes(c?.analysis?.authenticity_status)\nconst worthwhile=c=>rated(c)&&score(c)>=SHORTLIST_SCORE&&rec(c)!=='skip'&&!risky(c)","const risky=c=>['likely_counterfeit','high_risk'].includes(c?.analysis?.authenticity_status)\nconst economicLoss=c=>{const a=c?.analysis||{},p=Number(a.expected_profit??c?.expected_profit),r=Number(a.expected_roi_percent??c?.expected_roi_percent),ask=Number(c?.asking_price),resale=Number(a.resale_mid??c?.resale_mid);return(Number.isFinite(p)&&p<=0)||(Number.isFinite(r)&&r<=0)||(Number.isFinite(ask)&&Number.isFinite(resale)&&resale<ask)}\nconst worthwhile=c=>rated(c)&&score(c)>=SHORTLIST_SCORE&&rec(c)!=='skip'&&!risky(c)&&!economicLoss(c)")
  ctrl=ctrl.replace("async function saveResult(c,r,engine){const a={...r,engine_version:engine||'flippers-scout-batch-v090',scout_scan_depth:'search_page',scout_enriched:false};", "async function saveResult(c,r,engine){const a={...r,engine_version:engine||'flippers-scout-batch-v090',scout_scan_depth:'search_page',scout_enriched:false};const ask=Number(c?.asking_price),profit=Number(a.expected_profit),roi=Number(a.expected_roi_percent),resale=Number(a.resale_mid);if((Number.isFinite(profit)&&profit<=0)||(Number.isFinite(roi)&&roi<=0)||(Number.isFinite(ask)&&Number.isFinite(resale)&&resale<ask)){a.overall_score=Math.min(Number(a.overall_score||0),49);a.success_potential=Math.min(Number(a.success_potential||0),45);a.recommendation='skip';}")
  fs.writeFileSync(ctrlPath,ctrl)
}

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.90.0'
manifest.description='FlippersAI v0.90 with a rebuilt single-owner Scout engine.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.90.0'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')
console.log('v0.90 Scout rebuild finalizer applied')
