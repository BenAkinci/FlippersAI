import fs from 'node:fs'

function replaceOnce(text,before,after,label){
  if(text.includes(after)) return text
  if(!text.includes(before)) throw new Error(`v0.90.2 patch target missing: ${label}`)
  return text.replace(before,after)
}

const controllerPath='extension/scout-controller-v090.js'
let scout=fs.readFileSync(controllerPath,'utf8')

scout=replaceOnce(
  scout,
  "filtered=ratedRows.filter(c=>!worthwhile(c)),working=rows.filter(c=>c.scan_status==='working').length||state.active.size;const cells=$$('.scout-summary>div');",
  "filtered=ratedRows.filter(c=>!worthwhile(c)),working=rows.filter(c=>c.scan_status==='working').length||state.active.size;const workingIds=[...new Set([...rows.filter(c=>c.scan_status==='working').map(c=>String(c.id)),...state.active])];document.body.dataset.v088WorkingIds=JSON.stringify(workingIds);const cells=$$('.scout-summary>div');",
  'publish Working IDs to stage buckets'
)

scout=replaceOnce(
  scout,
  "async function startNew(){state.runId++;state.status='idle';state.active.clear();state.scout=null;await clearPersisted();location.reload()}",
  "async function startNew(){state.runId++;state.status='idle';state.active.clear();state.processing=false;state.scout=null;document.body.dataset.v088WorkingIds='[]';await clearPersisted();toast('Starting a new Scout…');await handleScan()}",
  'Start new scan should immediately scan current marketplace page'
)

fs.writeFileSync(controllerPath,scout)

const overlayPath='extension/scout-rating-overlay.js'
let overlay=fs.readFileSync(overlayPath,'utf8')

overlay=replaceOnce(
  overlay,
  "    badge.className = `${BADGE} ${t}${elite(rating) ? ' elite' : ''}`\n    badge.innerHTML = `<span class=\"flippersai-mark-v077\">FlippersAI</span><b>${scoreOf(rating)}/100</b>`\n    badge.title = `${clean(rating.recommendation || 'Rated').replaceAll('_',' ')} · FlippersAI score ${scoreOf(rating)}/100`\n\n    root.querySelectorAll(`.${IMAGE}`).forEach(img => img.classList.remove(IMAGE,'good','warn','bad'))\n    if (image) {",
  "    const badgeClass = `${BADGE} ${t}${elite(rating) ? ' elite' : ''}`\n    const badgeHtml = `<span class=\"flippersai-mark-v077\">FlippersAI</span><b>${scoreOf(rating)}/100</b>`\n    const badgeTitle = `${clean(rating.recommendation || 'Rated').replaceAll('_',' ')} · FlippersAI score ${scoreOf(rating)}/100`\n    if (badge.className !== badgeClass) badge.className = badgeClass\n    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml\n    if (badge.title !== badgeTitle) badge.title = badgeTitle\n\n    root.querySelectorAll(`.${IMAGE}`).forEach(img => { if (!image || img !== image.img) img.classList.remove(IMAGE,'good','warn','bad') })\n    if (image) {",
  'idempotent marketplace rating paint'
)

// v0.89.6 already throttles marketplace repaint work to 220ms. Keep that stable
// throttling and eliminate self-triggered DOM mutations instead of adding another timer.

fs.writeFileSync(overlayPath,overlay)

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
