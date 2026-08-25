import fs from 'node:fs'

const cleanHtml=path=>{
  let s=fs.readFileSync(path,'utf8')
  for(const file of ['scout-session-v070.js','scout-orchestrator-v080.js','scout-metrics-v076.js','scout-workspace-v071.js','scout-start-watchdog-v081.js']){
    s=s.replace(new RegExp(`\\s*<script[^>]+src=["']${file.replaceAll('.','\\.')}["'][^>]*><\\/script>\\s*`,'g'),'\n')
  }
  if(!s.includes('scout-controller-v090.js'))s=s.replace('<script type="module" src="floating-window.js"></script>','<script type="module" src="floating-window.js"></script>\n  <script type="module" src="scout-controller-v090.js"></script>')
  fs.writeFileSync(path,s)
}

cleanHtml('extension/sidepanel.html')
cleanHtml('extension/workspace.html')

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.90.0'
manifest.description='FlippersAI v0.90 with a rebuilt single-owner Scout engine.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.90.0'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')
console.log('v0.90 Scout rebuild finalizer applied')
