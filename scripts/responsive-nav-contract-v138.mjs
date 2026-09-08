import fs from 'node:fs'

const css = fs.readFileSync('responsive-nav-v138.css','utf8')
const js = fs.readFileSync('responsive-nav-v138.js','utf8')
const html = fs.readFileSync('index.html','utf8')

const assert = (ok, message) => { if (!ok) throw new Error(message) }

assert(css.includes('top:70px!important'), 'mobile nav must sit below the top bar')
assert(css.includes('flex-wrap:nowrap!important'), 'mobile nav must stay on one row')
assert(css.includes('overflow-x:auto'), 'mobile nav must horizontally scroll when needed')
assert(css.includes('min-height:48px'), 'mobile nav controls must keep a usable touch target')
assert(css.includes('.mobile-nav-item.active'), 'active nav state styling must exist')
assert(js.includes("topbar.insertAdjacentElement('afterend', nav)"), 'mobile nav must be moved beneath the top bar')
assert(js.includes("shortlist:"), 'Shortlist icon must be supplied')
assert(js.includes("saved:"), 'Saved icon must be supplied')
assert(html.includes('responsive-nav-v138.css?v=0.138.0'), 'responsive nav stylesheet must be loaded')
assert(html.includes('responsive-nav-v138.js?v=0.138.0'), 'responsive nav script must be loaded')

console.log('responsive nav v138 contract passed')
