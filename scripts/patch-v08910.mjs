import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.10 startup handoff patch applied`)
  } else {
    console.log(`${path}: v0.89.10 startup handoff already applied`)
  }
}

update('extension/scout-orchestrator-v080.js', s => {
  if (!s.includes('async function waitForNewScoutSession')) {
    s = s.replace(
      'async function startNewScan(){',
      `async function waitForNewScoutSession(previousId,timeoutMs=10000){\n  const started=Date.now();\n  while(Date.now()-started<timeoutMs){\n    const next=await activeScout();\n    if(next?.sessionId&&String(next.sessionId)!==String(previousId||''))return next;\n    await sleep(100);\n  }\n  return null;\n}\n\nasync function startNewScan(){`
    )
  }

  s = s.replace(/async function startNewScan\(\)\{[\s\S]*?\n\}\nasync function autoStartNew/, `async function startNewScan(){
  const ctx=await sourceContext();if(!ctx.canStartNew)return toast('Open a marketplace results page first.');
  const previous=(await activeScout())?.sessionId||null;
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
  const next=await waitForNewScoutSession(previous,10000);
  if(!next){
    O.stopped=true;O.busy=false;O.active.clear();
    const rows=await loadRows().catch(()=>[]);renderLive(rows);
    return toast('Scout could not start its first batch. Please try Start new scan again.');
  }
  await syncNewSession();
  ensureUi();
  const rows=await loadRows().catch(()=>[]);
  renderLive(rows);
  if(!rows.length)return toast('Scout started but no listings were available to rate.');
  fastScreen().catch(err=>toast(err.message));
}
async function autoStartNew`)

  if (!s.includes('async function waitForNewScoutSession')) throw new Error('v0.89.10 waitForNewScoutSession helper missing')
  if (!s.includes('const next=await waitForNewScoutSession(previous,10000)')) throw new Error('v0.89.10 explicit new-session handoff missing')
  if (!s.includes('await syncNewSession();\n  ensureUi();')) throw new Error('v0.89.10 orchestrator must attach to the new session before rating')
  if (!s.includes('fastScreen().catch(err=>toast(err.message));')) throw new Error('v0.89.10 must directly dispatch first rating batch')
  return s
})

update('extension/manifest.json', s => {const m=JSON.parse(s);m.version='0.89.10';m.description='FlippersAI Scout first-batch startup handoff hotfix.';return JSON.stringify(m,null,2)+'\n'})
update('package.json', s => {const p=JSON.parse(s);p.version='0.89.10';return JSON.stringify(p,null,2)+'\n'})
