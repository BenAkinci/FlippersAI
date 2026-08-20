import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json')),side=read('sidepanel.html'),work=read('workspace.html'),js=read('shortlist-controls-v0893.js')
expect(Number(manifest.version.split('.').slice(0,2).join('.'))>0.89||Number(manifest.version.split('.')[2]||0)>=3,'manifest must package v0.89.3 or newer')
for(const html of [side,work]){expect(html.includes('shortlist-controls-v0893.js'),'v0.89.3 shortlist controls must load');expect(html.includes('shortlist-controls-v0893.css'),'v0.89.3 shortlist controls styles must load')}
for(const token of ['cards.forEach(ensure)','data-v0893-save','data-v0893-remove','data-v0893-analyse','data-v0893-compare','.scout-candidate[data-candidate]','.v086-card[data-id]','.v088-listing-card[data-v088-id]','.v083-short-card[data-short-id]'])expect(js.includes(token),`per-card shortlist controls must include ${token}`)
expect(!js.includes('querySelectorAll(s)[0]'),'controls must never target only the first card')
console.log('v0.89.3 per-card shortlist controls contract passed')
