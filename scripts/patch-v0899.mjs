import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.9 scan-state patch applied`)
  } else {
    console.log(`${path}: v0.89.9 scan-state already applied`)
  }
}

update('extension/scout-orchestrator-v080.js', s => {
  s = s.replace("$('.scout-candidate[data-candidate]').forEach(el=>{const should=shortIds.has(String(el.dataset.candidate));", () => "$$('.scout-candidate[data-candidate]').forEach(el=>{const should=shortIds.has(String(el.dataset.candidate));")

  s = s.replace("el.classList.remove('paused','stopped','error')\n  el.classList.toggle('paused',Boolean(O.paused&&!O.stopped));el.classList.toggle('stopped',Boolean(O.stopped));el.classList.toggle('error',false);", "el.classList.toggle('paused',Boolean(O.paused&&!O.stopped));el.classList.toggle('stopped',Boolean(O.stopped));el.classList.toggle('error',false);")
  s = s.replace("if(copy)copy.textContent=`${ratedRows.length}/${total} rated. No further scanning will run.`", "if(copy)copy.textContent=`${ratedRows.length}/${total} rated. Scan stopped — no further scanning is running.`;if(detail)detail.textContent='Stopped · completed results are saved.'")
  s = s.replace("if(copy)copy.textContent=`${ratedRows.length}/${total} rated. Progress is saved.`", "if(copy)copy.textContent=`${ratedRows.length}/${total} rated. Scan paused — progress is saved.`;if(detail)detail.textContent='Paused · resume when you are ready.'")

  s = s.replace(/async function startNewScan\(\)\{[\s\S]*?\n\}\nasync function autoStartNew/, `async function startNewScan(){
  const ctx=await sourceContext();if(!ctx.canStartNew)return toast('Open a marketplace results page first.');
  O.generation+=1;O.stopped=false;O.paused=false;O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;O.enrichQueue=[];
  await cancelBackgroundWork();
  await chrome.storage.local.set({[STOP_KEY]:false,[USER_PAUSE_KEY]:false});
  await chrome.storage.local.remove([ACTIVE_KEY,AUTO_NEW_KEY]);
  O.sessionId=null;
  document.dispatchEvent(new CustomEvent('flippers:clear-scout-memory'));
  document.dispatchEvent(new CustomEvent('flippers:prepare-new-scout'));
  const button=$('#scanCurrent');
  if(!button)return toast('Could not prepare the new Scout. Open Scan and try again.');
  button.click();
}
async function autoStartNew`)

  const badSingle=/(^|[^$])\$\('\.scout-candidate\[data-candidate\]'\)\.forEach/m.test(s)
  if (badSingle) throw new Error('v0.89.9 still contains single-element candidate forEach')
  if (!s.includes("$$('.scout-candidate[data-candidate]').forEach")) throw new Error('v0.89.9 candidate collection fix missing')
  if (/async function startNewScan\(\)[\s\S]*?location\.reload\(\)/.test(s)) throw new Error('v0.89.9 Start new scan must not reload the extension')
  return s
})

update('extension/scout-session-v070.js', s => {
  if (!s.includes("flippers:clear-scout-memory")) s += `\n// v0.89.9: clear the old in-memory Scout before an in-place Start new scan.\ndocument.addEventListener('flippers:clear-scout-memory',()=>{scout=null})\n`
  return s
})

update('extension/app.js', s => {
  if (!s.includes("flippers:prepare-new-scout")) s += `\n// v0.89.9: return Scan to its clean capture state without reloading the side panel.\ndocument.addEventListener('flippers:prepare-new-scout',()=>{state.view='scan';state.scan=null;state.temp={};render()})\n`
  return s
})

update('extension/scout-v080.css', s => {
  if (!s.includes('v0899 explicit pause state')) s += `\n/* v0899 explicit pause/stop visual state */\n#v080Loading.paused .scout-loading-spinner{animation:none!important;opacity:.55!important}\n#v080Loading.paused .scout-loading-track{opacity:.55!important}\n#v080Loading.stopped .scout-loading-spinner,#v080Loading.stopped .scout-loading-track{display:none!important}\n`
  return s
})

update('extension/manifest.json', s => {const m=JSON.parse(s);m.version='0.89.9';m.description='FlippersAI Scout loader-state and in-place new-scan hotfix.';return JSON.stringify(m,null,2)+'\n'})
update('package.json', s => {const p=JSON.parse(s);p.version='0.89.9';return JSON.stringify(p,null,2)+'\n'})
