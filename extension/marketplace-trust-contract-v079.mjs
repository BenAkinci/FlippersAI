import fs from 'node:fs'
const overlay=fs.readFileSync(new URL('./marketplace-trust-overlay-v079.js',import.meta.url),'utf8')
const manifest=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url),'utf8'))
const expect=(v,m)=>{if(!v)throw new Error(m)}
const [major,minor]=String(manifest.version||'0.0.0').split('.').map(Number)
expect(major>0||minor>=79,'manifest must be v0.79.0 or newer')
expect(manifest.content_scripts?.some(g=>g.js?.includes('marketplace-trust-overlay-v079.js')),'trust overlay must be injected on marketplaces')
expect(overlay.includes('LIKELY COUNTERFEIT'),'likely counterfeit marketplace warning missing')
expect(overlay.includes('HIGH FAKE RISK'),'high-risk marketplace warning missing')
expect(overlay.includes('VERIFY AUTHENTICITY'),'uncertain authenticity warning missing')
expect(overlay.includes('flippers_rating_history_v067'),'trust overlay must use persistent Scout rating history')
expect(overlay.includes('flippersai-rating-host-v077'),'trust label must attach to the actual marketplace rating host')
console.log('Marketplace trust overlay compatibility contract passed')
