import fs from 'node:fs'

const overlayPath='extension/scout-rating-overlay.js'
let overlay=fs.readFileSync(overlayPath,'utf8')

if(!overlay.includes('const unmatchedSince = new WeakMap()')){
  overlay=overlay.replace(
    "  let timer = null\n",
    "  let timer = null\n  const unmatchedSince = new WeakMap()\n"
  )
}

const newClear=`  function clearUnmatched(matched) {
    const now = Date.now()
    document.querySelectorAll(\`.\${HOST}\`).forEach(root => {
      if (matched.has(root)) {
        unmatchedSince.delete(root)
        return
      }
      if (!root.isConnected) return
      const firstMiss = unmatchedSince.get(root) || now
      if (!unmatchedSince.has(root)) unmatchedSince.set(root, firstMiss)
      if (now - firstMiss < 1400) return
      removeNew(root)
      unmatchedSince.delete(root)
    })
    document.querySelectorAll(\`.\${IMAGE}\`).forEach(img => {
      const root = img.closest(\`.\${HOST}\`)
      if (!root || matched.has(root)) return
      const firstMiss = root ? (unmatchedSince.get(root) || now) : now
      if (now - firstMiss >= 1400) img.classList.remove(IMAGE,'good','warn','bad')
    })
  }

`

if(!overlay.includes('now - firstMiss < 1400')){
  const start=overlay.indexOf('  function clearUnmatched(matched) {')
  const end=overlay.indexOf('  function apply() {',start)
  if(start<0||end<0) throw new Error('v0.90.3 patch target missing: clearUnmatched structure')
  overlay=overlay.slice(0,start)+newClear+overlay.slice(end)
}

overlay=overlay.replace(/  function schedule\(delay = \d+\) \{/,'  function schedule(delay = 24) {')
overlay=overlay.replace(/window\.addEventListener\('resize', \(\) => schedule\(\d+\), \{ passive:true \}\)/,"window.addEventListener('resize', () => schedule(24), { passive:true })")
overlay=overlay.replace(/document\.addEventListener\('load', event => \{ if \(event\.target\?\.tagName === 'IMG'\) schedule\(\d+\) \}, true\)/,"document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') schedule(24) }, true)")

fs.writeFileSync(overlayPath,overlay)

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.90.3'
manifest.description='FlippersAI v0.90.3 with stable marketplace rating overlays during marketplace rerenders.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.90.3'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')

console.log('v0.90.3 marketplace overlay stability patch applied')
