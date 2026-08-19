import fs from 'node:fs'
function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after!==before){fs.writeFileSync(path,after);console.log(`${path}: v0.89 patch applied`)}else console.log(`${path}: v0.89 already applied`)}

for(const path of ['extension/sidepanel.html','extension/workspace.html'])update(path,s=>{
  if(!s.includes('scout-v089.css'))s=s.replace('</head>','  <link rel="stylesheet" href="scout-v089.css">\n</head>')
  if(!s.includes('scout-enrichment-state-v089.js'))s=s.replace('</body>','  <script type="module" src="scout-enrichment-state-v089.js"></script>\n</body>')
  return s
})

update('extension/scout-rating-overlay.js',s=>{
  s=s.replace(/function clearUnmatched\(matched\) \{[\s\S]*?\n  \}\n\n  function apply\(\)/,`function clearUnmatched(matched) {\n    // v0.89: marketplace result grids (especially Depop) recycle card DOM aggressively.\n    // Do not delete a correctly painted badge merely because one transient render pass\n    // cannot re-match the card. A replaced DOM node disappears naturally; surviving\n    // cards keep their rating until the next successful match updates them.\n    document.querySelectorAll(\`.\${IMAGE}\`).forEach(img => {\n      if (!img.isConnected) img.classList.remove(IMAGE,'good','warn','bad')\n    })\n  }\n\n  function apply()`)
  s=s.replace('if (meaningful) schedule()','if (meaningful) { apply(); schedule(60); setTimeout(apply,220); setTimeout(apply,700) }')
  if(!s.includes('window.__flippersRatingHeartbeatV089'))s=s.replace("window.addEventListener('resize', () => schedule(40), { passive:true })", "window.addEventListener('resize', () => schedule(40), { passive:true })\n  if (!window.__flippersRatingHeartbeatV089) { window.__flippersRatingHeartbeatV089 = setInterval(() => { if (enabled && ratings.length) apply() }, 1200) }")
  return s
})

update('extension/scout-orchestrator-v080.js',s=>{
  s=s.replace('while(O.enrichWorkers<1&&O.enrichQueue.length)','while(O.enrichWorkers<2&&O.enrichQueue.length)')
  return s
})

update('extension/manifest.json',s=>{const m=JSON.parse(s);m.version='0.89.0';m.description='FlippersAI Scout reliability release with persistent marketplace ratings, visible deep-listing enrichment, completed economics states and consistent Shortlist controls.';return JSON.stringify(m,null,2)+'\n'})
update('package.json',s=>{const p=JSON.parse(s);p.version='0.89.0';return JSON.stringify(p,null,2)+'\n'})
