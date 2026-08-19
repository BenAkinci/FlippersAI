import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),overlay=read('scout-rating-overlay.js'),state=read('scout-enrichment-state-v089.js'),css=read('scout-v089.css')
expect(/^0\.89\./.test(manifest.version)||/^0\.9\d\./.test(manifest.version)||Number(manifest.version.split('.')[0])>=1,'manifest must package v0.89-compatible or newer')
for(const html of [side,work]){expect(html.includes('scout-v089.css'),'v0.89 Scout styles must load');expect(html.includes('scout-enrichment-state-v089.js'),'v0.89 enrichment state layer must load')}
expect(overlay.includes('window.__flippersRatingHeartbeatV089'),'marketplace ratings need a persistence heartbeat')
expect(overlay.includes('setTimeout(apply,220)')&&overlay.includes('setTimeout(apply,700)'),'marketplace ratings must repaint through dynamic DOM rerenders')
for(const token of ['Deep checking listing…','Economics waiting on verification','Checking…','Pending verification'])expect(state.includes(token),`deep enrichment UI must include ${token}`)
expect(css.includes('.scout-sticky-actions{position:static!important'),'Open Scout button must not overlap live progress')
expect(css.includes('.v086-card .v086-card-tools')&&css.includes('.v086-card .v086-actions'),'all Shortlist cards must expose their controls')
console.log('v0.89 Scout reliability compatibility contract passed')
