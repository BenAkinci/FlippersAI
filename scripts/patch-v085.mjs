import fs from 'node:fs'

function write(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.85 integration applied`)}else console.log(`${path}: v0.85 already integrated`)}

for(const path of ['extension/sidepanel.html','extension/workspace.html'])write(path,s=>{
  s=s.replace(/\s*<script type="module" src="scout-workspace-v071\.js"><\/script>/g,'')
  s=s.replace(/\s*<script type="module" src="shortlist-history-v083\.js"><\/script>/g,'')
  if(!s.includes('workspace-tools-v085.css'))s=s.replace('</head>','  <link rel="stylesheet" href="workspace-tools-v085.css">\n</head>')
  if(!s.includes('workspace-tools-v085.js'))s=s.replace('</body>','  <script type="module" src="workspace-tools-v085.js"></script>\n</body>')
  return s
})

write('extension/service-worker.js',s=>{
  if(!s.includes("import './marketplace-actions-v083.js'"))s="import './marketplace-actions-v083.js'\n"+s
  const marker="chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{"
  if(s.includes(marker)&&!s.includes("if(message?.type==='FLIPPERS_V083_ACTION')return false"))s=s.replace(marker,marker+"if(message?.type==='FLIPPERS_V083_ACTION')return false;")
  return s
})

write('extension/manifest.json',s=>{
  const m=JSON.parse(s);m.version='0.85.0';m.description='AI-powered reseller workspace with stable Shortlist, Saved Leads, Analyse, explainable marketplace ratings and Lead Finder foundations.'
  const scripts=m.content_scripts?.[0]?.js||[]
  if(!scripts.includes('marketplace-rating-panel-v083.js'))scripts.push('marketplace-rating-panel-v083.js')
  return JSON.stringify(m,null,2)+'\n'
})

write('package.json',s=>{const p=JSON.parse(s);p.version='0.85.0';return JSON.stringify(p,null,2)+'\n'})
