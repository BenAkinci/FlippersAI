import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.7 scan-controls patch applied`)
  } else {
    console.log(`${path}: v0.89.7 scan-controls already applied`)
  }
}

update('extension/scout-orchestrator-v080.js', s => {
  // A new Scout may be started on ANY active supported collection page, including
  // the same search URL. Starting new is an explicit reset action from the user.
  s = s.replace(
    /const activeNew=Boolean\(activeTab\?\.id&&isSupported\(activeTab\.url\)&&!isSingle\(activeTab\.url\)&&normaliseUrl\(activeTab\.url\)!==normaliseUrl\(stored\?\.pageUrl\|\|''\)\);return\{stored,sourceTab,sourceAlive:Boolean\(sourceTab\),activeTab,newCollection:activeNew\}/,
    "const activeCollection=Boolean(activeTab?.id&&isSupported(activeTab.url)&&!isSingle(activeTab.url));const activeNew=Boolean(activeCollection&&normaliseUrl(activeTab.url)!==normaliseUrl(stored?.pageUrl||''));return{stored,sourceTab,sourceAlive:Boolean(sourceTab),activeTab,newCollection:activeNew,canStartNew:activeCollection}"
  )

  s = s.replace(
    "if(fresh){fresh.disabled=!ctx.newCollection;fresh.title=ctx.newCollection?'Start Scout on the new marketplace results page.':'Open a different marketplace results page to start a new Scout.'}",
    "if(fresh){fresh.disabled=!ctx.canStartNew;fresh.title=ctx.canStartNew?'Start a completely new Scout on the active marketplace results page.':'Open a marketplace results page to start a new Scout.'}"
  )

  // Restart means restart the WHOLE current Scout, not merely the most recent
  // Find-next-listings round. Preserve the rows/listing identity, reset their
  // scan state and place them back into round 1 so every found listing reruns.
  s = s.replace(
    /async function restartRound\(\)\{[\s\S]*?fastScreen\(\)\.catch\(err=>toast\(err\.message\)\)\}/,
    `async function restartRound(){
  const ctx=await sourceContext();if(!ctx.sourceAlive)return toast('The original Scout page is no longer open. Reopen it or use Start new scan.');
  O.generation+=1;O.stopped=false;O.paused=false;O.busy=false;O.active.clear();O.durations=[];O.batchNo=0;O.enrichQueue=[];
  await cancelBackgroundWork();
  await chrome.storage.local.set({[STOP_KEY]:false,[USER_PAUSE_KEY]:false});
  const rows=await loadRows();
  await Promise.all(rows.map((c,i)=>api.update('scout_candidates',\`id=eq.\${c.id}\`,{
    scan_status:'quick',analysis:{},recommendation:null,score:null,resale_mid:null,expected_profit:null,expected_roi_percent:null,rank_score:null,selected:false,deep_capture:{},
    raw_capture:{...(c.raw_capture||{}),round_index:1,order_index:i},updated_at:new Date().toISOString()
  }).catch(()=>null)));
  const stored=await activeScout();if(stored?.sessionId)await api.update('scout_sessions',\`id=eq.\${stored.sessionId}\`,{candidate_count:rows.length,selected_count:0,updated_at:new Date().toISOString()}).catch(()=>{});
  renderLive(await loadRows());refreshControlState();toast('Current Scout restarted from the beginning');fastScreen().catch(err=>toast(err.message))}`
  )

  s = s.replace(
    /async function startNewScan\(\)\{[\s\S]*?location\.reload\(\)\}/,
    `async function startNewScan(){
  const ctx=await sourceContext();if(!ctx.canStartNew)return toast('Open a marketplace results page first.');
  O.generation+=1;O.stopped=false;O.paused=false;O.busy=false;O.active.clear();O.enrichQueue=[];
  await cancelBackgroundWork();
  await chrome.storage.local.set({[STOP_KEY]:false,[USER_PAUSE_KEY]:false,[AUTO_NEW_KEY]:{requestedAt:Date.now(),target:normaliseUrl(ctx.activeTab.url)}});
  await chrome.storage.local.remove(ACTIVE_KEY);
  location.reload()
}`
  )

  // Make stop/pause immediately synchronise button state and UI, rather than
  // waiting for a later observer/status tick.
  s = s.replace(
    /async function pauseScan\(\)\{if\(O\.paused\|\|O\.stopped\)return;([\s\S]*?)toast\('Scout paused\. Resume when you are ready\.'\)\}/,
    "async function pauseScan(){if(O.paused||O.stopped)return;$1syncControlLabels();await refreshControlState();toast('Scout paused. Resume when you are ready.')}"
  )
  s = s.replace(
    /async function resumeScan\(\)\{if\(O\.stopped\)return toast\('This Scout was stopped\. Restart the current scan or start a new one\.'\);([\s\S]*?)toast\('Scout resumed'\);fastScreen\(\)\.catch\(err=>toast\(err\.message\)\)\}/,
    "async function resumeScan(){if(O.stopped)return toast('This Scout was stopped. Restart the current scan or start a new one.');$1syncControlLabels();await refreshControlState();toast('Scout resumed');fastScreen().catch(err=>toast(err.message))}"
  )
  s = s.replace(
    /async function stopScan\(\)\{if\(O\.stopped\)return;([\s\S]*?)toast\('Scout stopped completely\. Completed results are saved\.'\)\}/,
    "async function stopScan(){if(O.stopped)return;$1syncControlLabels();await refreshControlState();toast('Scout stopped completely. Completed results are saved.')}"
  )

  return s
})

update('extension/scout-session-v070.js', s => {
  // Find next listings must resolve the persisted source tab each time. The
  // in-memory tab id can be missing after rerenders/restores even while the
  // Scout session itself is valid.
  s = s.replace(
    /async function scanMoreResults\(\)\{[\s\S]*?\}\nasync function handleScan/,
    `async function scanMoreResults(){
  try{
    const stored=(await chrome.storage.local.get(ACTIVE_SCOUT_KEY).catch(()=>({})))[ACTIVE_SCOUT_KEY];
    const tabId=scout?.tabId||stored?.tabId||null;
    if(!tabId)return toast('The marketplace results tab is no longer connected to this Scout.');
    try{await chrome.tabs.get(tabId)}catch{return toast('The marketplace results tab has been closed. Reopen it to continue this Scout.')}
    const result=await chrome.runtime.sendMessage({type:'FLIPPERS_SCROLL_COLLECTION',tabId});
    if(!result?.ok)throw new Error(result?.error||'Could not scan more results.');
    const added=await mergeNew(result.data);
    toast(added?\`\${added} new listings added to this Scout\`:'No new listings detected yet. Scroll further and try again.')
  }catch(error){toast(error.message)}
}
async function handleScan`
  )
  return s
})

update('extension/manifest.json', s => {
  const m=JSON.parse(s);m.version='0.89.7';m.description='FlippersAI Scout control reliability hotfix.';return JSON.stringify(m,null,2)+'\n'
})
update('package.json', s => {const p=JSON.parse(s);p.version='0.89.7';return JSON.stringify(p,null,2)+'\n'})
