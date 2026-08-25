import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const overlay=read('scout-rating-overlay.js')
expect(manifest.version==='0.90.3','manifest must package v0.90.3')
expect(overlay.includes('const unmatchedSince = new WeakMap()'),'overlay must track transient unmatched cards')
expect(overlay.includes('now - firstMiss < 1400'),'overlay must preserve badges through transient marketplace rerenders')
expect(overlay.includes('if (!root.isConnected) return'),'detached cards must not trigger badge cleanup churn')
expect(overlay.includes('function schedule(delay = 24)'),'overlay must repaint new marketplace cards promptly')
expect(overlay.includes('if (badge.className !== badgeClass)'),'idempotent badge painting must remain protected')
expect(overlay.includes('if (badge.innerHTML !== badgeHtml)'),'badge contents must not be rewritten unnecessarily')
console.log('v0.90.3 marketplace overlay stability contract passed')
