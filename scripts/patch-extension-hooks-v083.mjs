import fs from 'node:fs'

function write(path,fn){const before=fs.readFileSync(path,'utf8'),after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.83 hooks applied`)}else console.log(`${path}: v0.83 hooks already applied`)}

write('extension/service-worker.js',s=>s.includes("./marketplace-actions-v083.js")?s:s.replace("import { CONFIG } from './config.js'","import { CONFIG } from './config.js'\nimport './marketplace-actions-v083.js'"))

for(const path of ['extension/sidepanel.html','extension/workspace.html'])write(path,s=>{
  if(!s.includes('shortlist-history-v083.js'))s=s.replace('</body>',`  <script type="module" src="shortlist-history-v083.js"></script>\n  <script src="scout-loader-state-v083.js"></script>\n</body>`)
  return s
})

write('extension/manifest.json',s=>{
  const m=JSON.parse(s);m.version='0.83.0';m.description='AI-powered reselling workspace with explainable marketplace ratings, permanent Scout shortlist history, authenticity evidence checks and cumulative live Scout progress.'
  const scripts=m.content_scripts?.[0]?.js||[]
  if(!scripts.includes('marketplace-rating-panel-v083.js'))scripts.push('marketplace-rating-panel-v083.js')
  return JSON.stringify(m,null,2)+'\n'
})
