import fs from 'node:fs'

const htmlPaths=['extension/sidepanel.html','extension/workspace.html']
const scanConflicts=[
  'scout-smart-overview-v066.js',
  'scout-card-details.js',
  'scout-loader-state-v083.js',
  'scout-actions-v087.js',
  'scout-enrichment-state-v089.js'
]
for(const path of htmlPaths){
  let html=fs.readFileSync(path,'utf8')
  for(const file of scanConflicts){
    html=html.replace(new RegExp(`\\s*<script[^>]+src=["']${file.replaceAll('.','\\.')}["'][^>]*><\\/script>\\s*`,'g'),'\n')
  }
  if(!html.includes('v091-scan-ui.css'))html=html.replace('</head>','  <link rel="stylesheet" href="v091-scan-ui.css">\n</head>')
  fs.writeFileSync(path,html)
}

const toolsPath='extension/workspace-tools-v086.js'
let tools=fs.readFileSync(toolsPath,'utf8')
if(!tools.includes('/* v091 scan recovery disabled */')){
  tools=tools.replace(
    'async function injectRecovery(){if(active||recoveryBusy)return;',
    'async function injectRecovery(){/* v091 scan recovery disabled */ return; if(active||recoveryBusy)return;'
  )
  fs.writeFileSync(toolsPath,tools)
}

// The consolidated overlay no longer removes unmatched badges during ordinary
// marketplace rerenders. Paint is idempotent and simply updates a recycled card
// when a new rated listing identity is actually detected.
const overlayPath='extension/scout-rating-overlay.js'
let overlay=fs.readFileSync(overlayPath,'utf8')
if(!overlay.includes('flippersRatingIdentity')){
  overlay=overlay.replace(
    'root.classList.add(HOST);let badge=',
    "root.classList.add(HOST);root.dataset.flippersRatingIdentity=listingToken(rating.url||'')||pathKey(rating.url||'');let badge="
  )
}
overlay=overlay.replace(/function schedule\(delay=\d+\)/,'function schedule(delay=80)')
fs.writeFileSync(overlayPath,overlay)

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.91.0'
manifest.description='FlippersAI v0.91 with single-owner Scan UI state and stable marketplace ratings.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.91.0'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')
console.log('v0.91 single-owner Scan finalizer applied')
