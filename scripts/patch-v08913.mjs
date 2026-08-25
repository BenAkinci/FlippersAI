import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.13 Scout handoff applied`)
  } else {
    console.log(`${path}: v0.89.13 already stable`)
  }
}

// Keep the active Scout alive across ordinary side-panel reloads. pagehide also
// fires for reload/navigation, so it must not be treated as a real user close.
update('extension/scout-orchestrator-v080.js', s => {
  s = s.replace(/\nwindow\.addEventListener\('pagehide',[\s\S]*?\n?$/m, '\n')
  s = s.replace("renderLive(rows);queueEnrichment(rr);while(generation===O.generation", "renderLive(rows);while(generation===O.generation")
  s = s.replace("O.generation+=1;O.stopped=false;O.paused=false;O.interrupted=Boolean(stored.interrupted);O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;O.enrichQueue=[];", "O.generation+=1;O.stopped=false;O.paused=false;O.interrupted=false;O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;O.enrichQueue=[];")
  s = s.replace("if(stored[STOP_KEY]){await chrome.storage.local.remove([ACTIVE_KEY,STOP_KEY,USER_PAUSE_KEY]);location.reload();return}O.paused=Boolean(stored[USER_PAUSE_KEY]);O.stopped=false;", "O.stopped=Boolean(stored[STOP_KEY]);O.paused=Boolean(stored[USER_PAUSE_KEY]);")
  return s
})

// A real Stop remains represented by STOP_KEY; an ordinary document lifecycle
// signal is now a no-op so it cannot clear the session before Batch 1 starts.
update('extension/service-worker.js', s => {
  s = s.replace("case'FLIPPERS_SCOUT_PANEL_CLOSED':await chrome.storage.local.set({flippers_scout_stopped_v076:true,flippers_scout_user_paused_v076:false});return{ok:true};", "case'FLIPPERS_SCOUT_PANEL_CLOSED':return{ok:true};")
  return s
})

// The Scout UI owns the visible session. Re-persist that session before the
// orchestrator event fires so Found -> Working cannot lose its session handoff.
update('extension/scout-session-v070.js', s => {
  s = s.replace("bindUi();document.dispatchEvent(new CustomEvent('flippers:scout-rendered'", "bindUi();persistScout().catch(()=>{});document.dispatchEvent(new CustomEvent('flippers:scout-rendered'")
  return s
})

update('extension/manifest.json', s => {
  const m = JSON.parse(s)
  m.version = '0.89.13'
  m.description = 'FlippersAI Scout handoff and lifecycle reliability release.'
  return JSON.stringify(m, null, 2) + '\n'
})

update('package.json', s => {
  const p = JSON.parse(s)
  p.version = '0.89.13'
  return JSON.stringify(p, null, 2) + '\n'
})
