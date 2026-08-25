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
  "function clearUnmatched(matched) {\n    document.querySelectorAll(`.${HOST}`).forEach(root => {\n      if (!matched.has(root)) removeNew(root)\n    })\n    document.querySelectorAll(`.${IMAGE}`).forEach(img => {\n      const root = img.closest(`.${HOST}`)\n      if (!root || !matched.has(root)) img.classList.remove(IMAGE,'good','warn','bad')\n    })\n  }",
  "function clearUnmatched(matched, maps) {\n    document.querySelectorAll(`.${HOST}`).forEach(root => {\n      if (matched.has(root) || !root.isConnected) return\n      const anchors = [...root.querySelectorAll('a[href]')]\n      // Marketplace frameworks such as Depop briefly remove/reinsert anchors while\n      // reconciling a card. Keep the existing badge during that transient gap so\n      // a valid rating does not disappear and flash back a moment later.\n      if (!anchors.length) return\n      const stillRated = anchors.some(a => matchRating(abs(a.getAttribute('href') || a.href || ''), maps))\n      if (!stillRated) removeNew(root)\n    })\n    document.querySelectorAll(`.${IMAGE}`).forEach(img => {\n      const root = img.closest(`.${HOST}`)\n      if (!root) img.classList.remove(IMAGE,'good','warn','bad')\n    })\n  }",
  'stable marketplace badge cleanup'
)

overlay=replaceOnce(
  overlay,
  "    clearUnmatched(matched)\n  }",
  "    clearUnmatched(matched, maps)\n  }",
  'pass rating map into stable cleanup'
)

overlay=replaceOnce(
  overlay,
  "  function schedule(delay = 70) {",
  "  function schedule(delay = 120) {",
  'debounce marketplace rerender churn'
)

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
