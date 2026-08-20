import fs from 'node:fs'
function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.89.4 integrity repair applied`)}else console.log(`${path}: v0.89.4 integrity repair already clean`)}

update('extension/scout-smart-overview-v066.js',s=>{
  s=s.replace(/,lastHtml='',lastHtml=''/g,",lastHtml=''")
  return s
})

update('extension/scout-orchestrator-v080.js',s=>{
  const lines=s.split('\n'),seen={economicLoss:false},out=[]
  for(const line of lines){
    if(line.startsWith('const economicLoss=c=>')){if(seen.economicLoss)continue;seen.economicLoss=true}
    out.push(line)
  }
  return out.join('\n')
})

update('extension/workspace-tools-v086.js',s=>{
  s=s.replace(/(?<!\$)\$\('\[data-v088-source-link\]',main\)\.forEach/g,"$$('[data-v088-source-link]',main).forEach")
  const listener="$$('[data-v088-source-link]',main).forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const url=a.getAttribute('href');if(url)chrome.tabs.create({url,active:true})}));"
  const first=s.indexOf(listener)
  if(first>=0){let pos=s.indexOf(listener,first+listener.length);while(pos>=0){s=s.slice(0,pos)+s.slice(pos+listener.length);pos=s.indexOf(listener,first+listener.length)}}
  return s
})

update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.89.4';m.description='FlippersAI build-integrity hotfix: idempotent patching and final packaged-extension syntax validation.';return JSON.stringify(m,null,2)+'\n'})
