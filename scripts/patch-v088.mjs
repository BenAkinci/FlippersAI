import fs from 'node:fs'

function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.88 patch applied`)}else console.log(`${path}: v0.88 already applied`)}

for(const path of ['extension/sidepanel.html','extension/workspace.html'])update(path,s=>{
  if(!s.includes('scout-buckets-v088.css'))s=s.replace('</head>','  <link rel="stylesheet" href="scout-buckets-v088.css">\n</head>')
  if(!s.includes('scout-buckets-v088.js'))s=s.replace('</body>','  <script type="module" src="scout-buckets-v088.js"></script>\n</body>')
  return s
})

update('extension/scout-orchestrator-v080.js',s=>{
  const needle='working=Math.min(MAX_BATCH,O.active.size);O.total=rr.length;'
  const replacement='working=Math.min(MAX_BATCH,O.active.size);document.body.dataset.v088WorkingIds=JSON.stringify([...O.active.keys()]);O.total=rr.length;'
  if(s.includes(needle))s=s.replace(needle,replacement)
  return s
})

update('extension/scout-session-v070.js',s=>{
  s=s.replace('<div class="scout-candidate-title-row"><strong>${esc(c.title||\'Untitled listing\')}</strong><span class="scout-rec">Queued</span></div>','<div class="scout-candidate-title-row">${c.source_url?`<a class="v088-source-title" href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.title||\'Untitled listing\')}</a>`:`<strong>${esc(c.title||\'Untitled listing\')}</strong>`}<span class="scout-rec">Queued</span></div>')
  return s
})

update('extension/workspace-tools-v086.js',s=>{
  s=s.replace('<button class="v086-title" data-act="open">${esc(c.title||x.identified_name||\'Untitled listing\')}</button>','${c.source_url?`<a class="v086-title" data-v088-source-link href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.title||x.identified_name||\'Untitled listing\')}</a>`:`<strong class="v086-title">${esc(c.title||x.identified_name||\'Untitled listing\')}</strong>`}')
  if(!s.includes("data-v088-source-link"))return s
  const marker="function bindView(){const main=$('.ext-main');"
  if(s.includes(marker)&&!s.includes("$$('[data-v088-source-link]'"))s=s.replace(marker,"function bindView(){const main=$('.ext-main');$$('[data-v088-source-link]',main).forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const url=a.getAttribute('href');if(url)chrome.tabs.create({url,active:true})}));")
  return s
})

update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.88.0';m.description='AI reseller workspace with expandable Scout stages, consistent listing actions and marketplace links directly from every listing title.';return JSON.stringify(m,null,2)+'\n'})
update('package.json',s=>{const p=JSON.parse(s);p.version='0.88.0';return JSON.stringify(p,null,2)+'\n'})
