import fs from 'node:fs'

function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.89.5 syntax hotfix applied`)}else console.log(`${path}: v0.89.5 already clean`)}

update('extension/workspace-card-guard-v088.js',s=>{
  const marker=" if(action==='compare'){compare.has(String(id))?compare.delete(String(id)):compare.size<3?compare.add(String(id)):toast('Compare up to 3 leads');renderCompare();const b=$('[data-v088-guard=\"compare\"]',card);if(b)b.textContent=compare.has(String(id))?'Comparing ✓':'Compare'}\n\ndocument.addEventListener"
  if(s.includes(marker))s=s.replace(marker,marker.replace("\n\ndocument.addEventListener","\n}\n\ndocument.addEventListener"))
  return s
})

update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.89.5';m.description='FlippersAI syntax hotfix for workspace card controls.';return JSON.stringify(m,null,2)+'\n'})
