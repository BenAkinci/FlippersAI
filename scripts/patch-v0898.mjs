import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) { fs.writeFileSync(path, after); console.log(`${path}: v0.89.8 interaction-state patch applied`) }
  else console.log(`${path}: v0.89.8 interaction-state already applied`)
}

update('extension/scout-orchestrator-v080.js', s => {
  s = s.replace(/async function refreshControlState\(\)\{[\s\S]*?\}\n\nfunction ensureRemoveButton/, `async function refreshControlState(){
  const stop=$('#v080Stop'),pause=$('#v080Pause'),restart=$('#v080Restart'),fresh=$('#v080New');
  if(!stop&&!pause&&!restart&&!fresh)return;
  const ctx=await sourceContext();
  const rows=roundRows(await loadRows().catch(()=>[]));
  const remaining=rows.filter(pending).length;
  if(stop){stop.disabled=O.stopped;stop.title=O.stopped?'This scan has stopped. Restart it or start a new scan.':'Completely stop this Scout.'}
  if(pause){pause.disabled=O.stopped;pause.title=O.paused?'Resume from saved progress.':(!remaining&&!O.busy&&O.active.size===0&&!O.enrichWorkers?'Nothing is currently scanning.':'Temporarily pause this Scout.')}
  if(restart){restart.disabled=false;restart.title=ctx.sourceAlive?'Restart this Scout from the beginning.':'Reopen the original marketplace page if Restart cannot reconnect.'}
  if(fresh){fresh.disabled=false;fresh.title=ctx.canStartNew?'Start a completely new Scout on the active marketplace page.':'Open a marketplace results page, then press Start new scan.'}
}

function ensureRemoveButton`)

  if(!s.includes("el.classList.toggle('stopped',Boolean(O.stopped))")){
    s=s.replace(/const currentBatch=/, "el.classList.toggle('paused',Boolean(O.paused&&!O.stopped));el.classList.toggle('stopped',Boolean(O.stopped));el.classList.toggle('error',false);const currentBatch=")
  }

  s = s.replace(/\$\$\('\.scout-candidate\[data-candidate\]'\)\.forEach\(el=>el\.classList\.remove\('v076-shortlist-visible'\)\);short\.forEach\(c=>\{const el=\$\(`\.scout-candidate\[data-candidate="\$\{CSS\.escape\(String\(c\.id\)\)\}"\]`\);if\(!el\)return;el\.classList\.add\('v076-shortlist-visible'\);/, `const shortIds=new Set(short.map(c=>String(c.id)));$$('.scout-candidate[data-candidate]').forEach(el=>{const should=shortIds.has(String(el.dataset.candidate));if(el.classList.contains('v076-shortlist-visible')!==should)el.classList.toggle('v076-shortlist-visible',should)});short.forEach(c=>{const el=$(\`.scout-candidate[data-candidate="\${CSS.escape(String(c.id))}"]\`);if(!el)return;`)

  s = s.replace("new MutationObserver(ms=>{if(ms.every(m=>m.target.closest?.('#v080RunBar,#v080Loading,.scout-summary,.scout-insight')))return;scheduleStatus()})", "new MutationObserver(ms=>{if(ms.every(m=>m.target.closest?.('#v080RunBar,#v080Loading,.scout-summary,.scout-insight')||(m.type==='attributes'&&m.target.matches?.('.scout-candidate'))))return;scheduleStatus()})")

  if (!s.includes("el.classList.toggle('stopped',Boolean(O.stopped))")) throw new Error('v0.89.8 could not install stopped loader state')
  if (!s.includes("if(el.classList.contains('v076-shortlist-visible')!==should)")) throw new Error('v0.89.8 could not install stable candidate visibility')
  return s
})

update('extension/scout-v080.css', s => {
  if (!s.includes('v0898 stopped loader')) s += `\n/* v0898 stopped loader + click-through stability */\n#v080Loading{pointer-events:none}\n#v080Loading.stopped .scout-loading-spinner{display:none!important;animation:none!important}\n#v080Loading.stopped .scout-loading-track{display:none!important}\n#v080Loading.stopped .scout-loading-count{opacity:.7}\n#v080Loading.paused .scout-loading-spinner{animation-play-state:paused!important}\n#v080Loading.paused .scout-loading-track{display:block!important}\n`
  return s
})

update('extension/manifest.json', s => {const m=JSON.parse(s);m.version='0.89.8';m.description='FlippersAI Scout pause/stop interaction-state reliability hotfix.';return JSON.stringify(m,null,2)+'\n'})
update('package.json', s => {const p=JSON.parse(s);p.version='0.89.8';return JSON.stringify(p,null,2)+'\n'})
