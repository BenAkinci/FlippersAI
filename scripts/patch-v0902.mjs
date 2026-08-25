import fs from 'node:fs'

const controllerPath='extension/scout-controller-v090.js'
let scout=fs.readFileSync(controllerPath,'utf8')

if(!scout.includes('document.body.dataset.v088WorkingIds=JSON.stringify(workingIds)')){
  const before="filtered=ratedRows.filter(c=>!worthwhile(c)),working=rows.filter(c=>c.scan_status==='working').length||state.active.size;const cells=$$('.scout-summary>div');"
  const after="filtered=ratedRows.filter(c=>!worthwhile(c)),working=rows.filter(c=>c.scan_status==='working').length||state.active.size;const workingIds=[...new Set([...rows.filter(c=>c.scan_status==='working').map(c=>String(c.id)),...state.active])];document.body.dataset.v088WorkingIds=JSON.stringify(workingIds);const cells=$$('.scout-summary>div');"
  if(!scout.includes(before))throw new Error('v0.90.2 patch target missing: publish Working IDs to stage buckets')
  scout=scout.replace(before,after)
}

if(!scout.includes("toast('Starting a new Scout…');await handleScan()")){
  const before="async function startNew(){state.runId++;state.status='idle';state.active.clear();state.scout=null;await clearPersisted();location.reload()}"
  const after="async function startNew(){state.runId++;state.status='idle';state.active.clear();state.processing=false;state.scout=null;document.body.dataset.v088WorkingIds='[]';await clearPersisted();toast('Starting a new Scout…');await handleScan()}"
  if(!scout.includes(before))throw new Error('v0.90.2 patch target missing: Start new scan should immediately scan current marketplace page')
  scout=scout.replace(before,after)
}

fs.writeFileSync(controllerPath,scout)

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.90.2'
manifest.description='FlippersAI v0.90.2 with live Working stages, stable marketplace ratings and immediate new scans.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.90.2'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')

console.log('v0.90.2 Scout polish patch applied')
