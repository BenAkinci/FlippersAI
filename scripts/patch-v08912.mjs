import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.12 Scout stability applied`)
  } else {
    console.log(`${path}: v0.89.12 already stable`)
  }
}

// Shared Scout reads: collapse semantically equivalent full-row reads, not only
// byte-for-byte-identical URLs. Candidate writes still invalidate immediately.
update('extension/api.js', s => {
  s = s.replace('const SCOUT_CACHE_TTL_MS = 1500', 'const SCOUT_CACHE_TTL_MS = 5000')
  s = s.replace(/function scoutCacheKey\(table, query = ''\) \{[\s\S]*?\n\}/, `function scoutCacheKey(table, query = '') {
  if (table !== 'scout_candidates') return null
  const params = new URLSearchParams(query)
  const select = params.get('select') || '*'
  // Only canonicalise complete candidate rows. Field-specific reads keep their
  // exact key so a narrow response can never poison a later full-row read.
  if (select !== '*') return table + '?' + query
  const session = params.get('session_id')
  if (session) return table + '?select=*&session_id=' + session
  const id = params.get('id') || ''
  if (id.startsWith('in.(') && id.endsWith(')')) {
    const ids = id.slice(4, -1).split(',').map(x => x.trim()).filter(Boolean).sort()
    return table + '?select=*&id=in.(' + ids.join(',') + ')'
  }
  return table + '?' + query
}`)
  return s
})

// The old watchdog was a second Scout owner: every 1.5s it downloaded the
// session and re-fired scout-rendered when Working was zero. That is exactly
// what resurrected abandoned Scouts and generated runaway egress.
for (const path of ['extension/sidepanel.html', 'extension/workspace.html']) {
  update(path, s => {
    s = s.replace(/^\s*<script type="module" src="scout-start-watchdog-v081\.js"><\/script>\s*$/gm, '')
    const loader = '  <script src="scout-loader-state-v083.js"></script>'
    const first = s.indexOf(loader)
    if (first >= 0) {
      let next = s.indexOf(loader, first + loader.length)
      while (next >= 0) {
        s = s.slice(0, next) + s.slice(next + loader.length)
        next = s.indexOf(loader, first + loader.length)
      }
    }
    return s
  })
}

update('extension/scout-enrichment-state-v089.js', s => {
  s = s.replace(/^setInterval\(\(\)=>schedule\(0\),1800\)\s*$/m, '')
  return s
})

update('extension/scout-card-details.js', s => {
  s = s.replace(/new MutationObserver\([\s\S]*?\.observe\(document\.getElementById\('app'\),\{childList:true,subtree:true\}\)\n/, "document.addEventListener('flippers:scout-rendered',schedule)\ndocument.addEventListener('flippers:candidate-updated',schedule)\n")
  return s
})

update('extension/scout-actions-v087.js', s => {
  s = s.replace(/new MutationObserver\([\s\S]*?\.observe\(document\.getElementById\('app'\),\{childList:true,subtree:true\}\)\n/, "document.addEventListener('flippers:scout-rendered',()=>{clearTimeout(timer);timer=setTimeout(refresh,60)})\n")
  return s
})

update('extension/scout-buckets-v088.js', s => {
  s = s.replace(/new MutationObserver\([\s\S]*?\.observe\(document\.getElementById\('app'\),\{childList:true,subtree:true\}\)\n/, '')
  return s
})

// Persisted Scout state is not the same thing as a live processing session.
// Anything restored after five minutes without a live panel is Interrupted.
update('extension/scout-session-v070.js', s => {
  if (!s.includes('const STALE_SCOUT_MS=')) s = s.replace('const MAX_FOUND_PER_ROUND=25', 'const MAX_FOUND_PER_ROUND=25\nconst STALE_SCOUT_MS=5*60*1000')
  s = s.replace("savedAt:Date.now()}})", "savedAt:Date.now(),lastLiveAt:Date.now(),interrupted:false}})")
  const old = "scout={session,candidates:(candidates||[]).map((r,i)=>({...r,order_index:r.raw_capture?.order_index??i,analysis:r.analysis||{}})),tabId:saved.tabId||null,platform:saved.platform||session.platform,query:saved.query||session.query_text||'',pageUrl:saved.pageUrl||session.source_url||''};if(scanViewActive())renderScout()"
  const replacement = "const sessionAt=Date.parse(session.updated_at||session.created_at||'')||0,lastLive=Math.max(Number(saved.lastLiveAt||saved.savedAt||0),sessionAt),interrupted=Boolean(saved.interrupted)||(Date.now()-lastLive>STALE_SCOUT_MS);scout={session,candidates:(candidates||[]).map((r,i)=>({...r,order_index:r.raw_capture?.order_index??i,analysis:r.analysis||{}})),tabId:saved.tabId||null,platform:saved.platform||session.platform,query:saved.query||session.query_text||'',pageUrl:saved.pageUrl||session.source_url||'',interrupted};if(interrupted)await chrome.storage.local.set({[ACTIVE_SCOUT_KEY]:{...saved,interrupted:true}});if(scanViewActive())renderScout()"
  if (s.includes(old)) s = s.replace(old, replacement)
  s = s.replace("<section class=\"scout-insight scanning\"><strong>Starting Scout…</strong><span>Preparing the first shared-market batch.</span></section>", "<section class=\"scout-insight ${scout.interrupted?'':'scanning'}\"><strong>${scout.interrupted?'Previous Scout interrupted':'Starting Scout…'}</strong><span>${scout.interrupted?`${scout.candidates.filter(c=>['rated','analysed'].includes(c.scan_status)).length}/${scout.candidates.length} rated · resume, restart or discard this Scout.`:'Preparing the first shared-market batch.'}</span></section>")
  return s
})

update('extension/scout-orchestrator-v080.js', s => {
  s = s.replace("const O={generation:1,paused:false,stopped:false,busy:false", "const O={generation:1,paused:false,stopped:false,interrupted:false,busy:false")
  s = s.replace("function syncControlLabels(){const pause=$('#v080Pause');if(pause)pause.textContent=O.paused?'Resume scan':'Pause scan';const stop=$('#v080Stop');if(stop)stop.textContent=O.stopped?'Scan stopped':'Stop scan'}", "function syncControlLabels(){const pause=$('#v080Pause');if(pause)pause.textContent=O.interrupted?'Resume Scout':(O.paused?'Resume scan':'Pause scan');const stop=$('#v080Stop');if(stop)stop.textContent=O.interrupted?'Discard Scout':(O.stopped?'Scan stopped':'Stop scan')}")
  s = s.replace("async function fastScreen(){if(O.busy||O.paused||O.stopped)return;", "async function fastScreen(){if(O.busy||O.paused||O.stopped||O.interrupted)return;")
  s = s.replace("if(O.stopped){el.classList.add('visible','stopped');", "if(O.interrupted){el.classList.add('visible','interrupted');if(strong)strong.textContent='Previous Scout interrupted';if(copy)copy.textContent=`${ratedRows.length}/${total} rated. No work is currently running.`;if(detail)detail.textContent='Resume, restart or discard this Scout.'}else if(O.stopped){el.classList.add('visible','stopped');")
  s = s.replace("el.classList.remove('paused','stopped','error')", "el.classList.remove('paused','stopped','interrupted','error')")
  s = s.replace("async function resumeScan(){if(O.stopped)return toast('This Scout was stopped. Restart the current scan or start a new one.');", "async function resumeScan(){if(O.interrupted){const stored=await activeScout();if(stored)await chrome.storage.local.set({[ACTIVE_KEY]:{...stored,interrupted:false,lastLiveAt:Date.now(),savedAt:Date.now()}});O.interrupted=false;O.stopped=false;O.paused=false;O.generation+=1;syncControlLabels();const rows=await loadRows();renderLive(rows);await refreshControlState();toast('Scout resumed');fastScreen().catch(err=>toast(err.message));return}if(O.stopped)return toast('This Scout was stopped. Restart the current scan or start a new one.');")
  s = s.replace("async function stopScan(){if(O.stopped)return;", "async function stopScan(){if(O.interrupted){O.interrupted=false;O.stopped=true;O.paused=false;O.generation+=1;await cancelBackgroundWork();await chrome.storage.local.remove([ACTIVE_KEY,STOP_KEY,USER_PAUSE_KEY]);document.dispatchEvent(new CustomEvent('flippers:clear-scout-memory'));document.dispatchEvent(new CustomEvent('flippers:prepare-new-scout'));toast('Interrupted Scout discarded. Its completed ratings remain in history.');return}if(O.stopped)return;")
  s = s.replace("async function syncNewSession(){const stored=await activeScout();if(!stored?.sessionId)return false;", "async function syncNewSession(){const stored=await activeScout();if(!stored?.sessionId)return false;O.interrupted=Boolean(stored.interrupted);")
  s = s.replace("O.stopped=false;O.paused=false;O.busy=false;", "O.stopped=false;O.paused=false;O.interrupted=Boolean(stored.interrupted);O.busy=false;")
  s = s.replace("if(!O.paused&&!O.stopped)fastScreen().catch(err=>toast(err.message))", "if(!O.paused&&!O.stopped&&!O.interrupted)fastScreen().catch(err=>toast(err.message))")
  s = s.replace("O.paused=Boolean(stored[USER_PAUSE_KEY]);O.stopped=false;const active=await activeScout();O.sessionId=active?.sessionId||null;", "O.paused=Boolean(stored[USER_PAUSE_KEY]);O.stopped=false;const active=await activeScout();O.interrupted=Boolean(active?.interrupted);O.sessionId=active?.sessionId||null;")
  // Guard every enrichment handoff structurally. Earlier versions used several
  // different surrounding statements, so matching one exact call site was too fragile.
  s = s.replace(/(?<!O\.interrupted\))queueEnrichment\(roundRows\(rows\)\);/g, "if(!O.interrupted)queueEnrichment(roundRows(rows));")
  s = s.replace("if(stop){stop.disabled=O.stopped;", "if(stop){stop.disabled=O.stopped&&!O.interrupted;")
  s = s.replace("if(pause){pause.disabled=O.stopped;", "if(pause){pause.disabled=O.stopped&&!O.interrupted;")
  return s
})

update('extension/scout-v080.css', s => {
  if (!s.includes('#v080Loading.interrupted')) s += `\n/* v08912 persisted-but-not-live Scout state */\n#v080Loading.interrupted .scout-loading-spinner,#v080Loading.interrupted .scout-loading-track{display:none!important}\n#v080Loading.interrupted{pointer-events:none}\n`
  return s
})

update('extension/manifest.json', s => {
  const m = JSON.parse(s)
  m.version = '0.89.12'
  m.description = 'FlippersAI Scout lifecycle, stale-session and Supabase egress stability release.'
  return JSON.stringify(m, null, 2) + '\n'
})

update('package.json', s => {
  const p = JSON.parse(s)
  p.version = '0.89.12'
  return JSON.stringify(p, null, 2) + '\n'
})
