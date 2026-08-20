import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.8 interaction-state patch applied`)
  } else {
    console.log(`${path}: v0.89.8 interaction-state already applied`)
  }
}

update('extension/scout-orchestrator-v080.js', s => {
  // Do not disable the whole control path after Pause/Stop. Resume must always
  // remain available while paused; Restart/New remain clickable so their own
  // handlers can explain any missing marketplace context rather than looking dead.
  s = s.replace(
    /async function refreshControlState\(\)\{[\s\S]*?\}\n\nfunction ensureRemoveButton/,
    `async function refreshControlState(){
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

function ensureRemoveButton`
  )

  // Avoid transient loader states. Previously every render removed paused/stopped
  // classes before re-adding them, allowing other observers to briefly see the
  // loader as active again. Keep the desired state continuously instead.
  s = s.replace(
    "el.classList.remove('paused','stopped','error');const currentBatch=",
    "el.classList.toggle('paused',Boolean(O.paused&&!O.stopped));el.classList.toggle('stopped',Boolean(O.stopped));el.classList.remove('error');const currentBatch="
  )
  s = s.replace("el.classList.add('visible','stopped');if(strong)", "el.classList.add('visible');if(strong)")
  s = s.replace("el.classList.add('visible','paused');if(strong)", "el.classList.add('visible');if(strong)")

  // The previous render path removed v076-shortlist-visible from every card then
  // immediately added it back to shortlisted cards. Because class mutations are
  // observed, that created a self-triggering render loop. Toggle only when the
  // actual shortlist membership changes.
  s = s.replace(
    /\$\$\('\.scout-candidate\[data-candidate\]'\)\.forEach\(el=>el\.classList\.remove\('v076-shortlist-visible'\)\);short\.forEach\(c=>\{const el=\$\(`\.scout-candidate\[data-candidate="\$\{CSS\.escape\(String\(c\.id\)\)\}"\]`\);if\(!el\)return;el\.classList\.add\('v076-shortlist-visible'\);/,
    `const shortIds=new Set(short.map(c=>String(c.id)));$$('.scout-candidate[data-candidate]').forEach(el=>{const should=shortIds.has(String(el.dataset.candidate));if(el.classList.contains('v076-shortlist-visible')!==should)el.classList.toggle('v076-shortlist-visible',should)});short.forEach(c=>{const el=$(\`.scout-candidate[data-candidate="\${CSS.escape(String(c.id))}"]\`);if(!el)return;`
  )

  // Ignore Scout's own shortlist-visibility class mutations. They are output,
  // not a reason to immediately schedule another full status render.
  s = s.replace(
    "new MutationObserver(ms=>{if(ms.every(m=>m.target.closest?.('#v080RunBar,#v080Loading,.scout-summary,.scout-insight')))return;scheduleStatus()})",
    "new MutationObserver(ms=>{if(ms.every(m=>m.target.closest?.('#v080RunBar,#v080Loading,.scout-summary,.scout-insight')||(m.type==='attributes'&&m.target.matches?.('.scout-candidate'))))return;scheduleStatus()})"
  )

  return s
})

update('extension/scout-v080.css', s => {
  if (!s.includes('v0898 stopped loader')) s += `\n/* v0898 stopped loader + click-through stability */\n#v080Loading{pointer-events:none}\n#v080Loading.stopped .scout-loading-spinner{display:none!important;animation:none!important}\n#v080Loading.stopped .scout-loading-track{display:none!important}\n#v080Loading.stopped .scout-loading-count{opacity:.7}\n#v080Loading.paused .scout-loading-spinner{animation-play-state:paused!important}\n#v080Loading.paused .scout-loading-track{display:block!important}\n`
  return s
})

update('extension/manifest.json', s => {const m=JSON.parse(s);m.version='0.89.8';m.description='FlippersAI Scout pause/stop interaction-state reliability hotfix.';return JSON.stringify(m,null,2)+'\n'})
update('package.json', s => {const p=JSON.parse(s);p.version='0.89.8';return JSON.stringify(p,null,2)+'\n'})
