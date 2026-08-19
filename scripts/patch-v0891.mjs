import fs from 'node:fs'
function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.89.1 patch applied`)}else console.log(`${path}: v0.89.1 already applied`)}
for(const path of ['extension/sidepanel.html','extension/workspace.html'])update(path,s=>{if(!s.includes('workspace-controls-v0891.js'))s=s.replace('</body>','  <script type="module" src="workspace-controls-v0891.js"></script>\n</body>');return s})
update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.89.1';m.description='FlippersAI v0.89.1 user-verified Scout hotfix with stable stage accordions, working workspace controls, consistent Shortlist actions and corrected progress alignment.';return JSON.stringify(m,null,2)+'\n'})
update('package.json',s=>{const p=JSON.parse(s);p.version='0.89.1';return JSON.stringify(p,null,2)+'\n'})
