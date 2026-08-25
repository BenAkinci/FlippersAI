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

// Workspace tools remain responsible for Shortlist/Saved/Analyse, but may not
// inject a second, independently-computed Scout summary into the Scan view.
const toolsPath='extension/workspace-tools-v086.js'
let tools=fs.readFileSync(toolsPath,'utf8')
if(!tools.includes('/* v091 scan recovery disabled */')){
  tools=tools.replace(
    'async function injectRecovery(){if(active||recoveryBusy)return;',
    'async function injectRecovery(){/* v091 scan recovery disabled */ return; if(active||recoveryBusy)return;'
  )
  fs.writeFileSync(toolsPath,tools)
}

// Preserve a rating badge while Depop temporarily rerenders a card and removes
// its link. Only clear it once the same connected card demonstrably represents
// a different listing. This avoids remove/recreate flicker.
const overlayPath='extension/scout-rating-overlay.js'
let overlay=fs.readFileSync(overlayPath,'utf8')
if(!overlay.includes('flippersRatingIdentity')){
  overlay=overlay.replace(
    '    root.classList.add(HOST)\n',
    "    root.classList.add(HOST)\n    root.dataset.flippersRatingIdentity = listingToken(rating.url || '') || pathKey(rating.url || '')\n"
  )
  const start=overlay.indexOf('  function clearUnmatched(matched) {')
  const end=overlay.indexOf('  function apply() {',start)
  if(start<0||end<0)throw new Error('v0.91 overlay clearUnmatched structure missing')
  const stableClear=`  function clearUnmatched(matched) {\n    document.querySelectorAll(\`.\${HOST}\`).forEach(root => {\n      if (matched.has(root)) return\n      if (!root.isConnected) return\n      const previous = root.dataset.flippersRatingIdentity || ''\n      let current = ''\n      for (const a of root.querySelectorAll?.('a[href]') || []) {\n        const href = abs(a.getAttribute('href') || a.href || '')\n        const candidate = listingToken(href) || pathKey(href)\n        if (candidate) { current = candidate; break }\n      }\n      // No current identity usually means a transient React rerender. Keep the\n      // badge in place. If the card is clearly recycled to a different listing,\n      // remove the old rating immediately.\n      if (!current || current === previous) return\n      removeNew(root)\n      root.removeAttribute('data-flippers-rating-identity')\n    })\n    document.querySelectorAll(\`.\${IMAGE}\`).forEach(img => {\n      const root = img.closest(\`.\${HOST}\`)\n      if (!root) img.classList.remove(IMAGE,'good','warn','bad')\n    })\n  }\n\n`
  overlay=overlay.slice(0,start)+stableClear+overlay.slice(end)
}
overlay=overlay.replace(/function schedule\(delay = \d+\)/,'function schedule(delay = 80)')
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
