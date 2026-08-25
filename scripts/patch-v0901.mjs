import fs from 'node:fs'

const path='extension/scout-controller-v090.js'
let s=fs.readFileSync(path,'utf8')

const need=(before,after,label)=>{
  if(s.includes(after)) return
  if(!s.includes(before)) throw new Error(`v0.90.1 patch target missing: ${label}`)
  s=s.replace(before,after)
}

need(
  "<div class=\"scout-sticky-actions\"><button class=\"button secondary scout-action\" id=\"openScoutWebsite\">Open Scout on website</button></div>",
  "<div class=\"scout-sticky-actions\"><button class=\"button primary scout-action\" id=\"v090More\" disabled>Scan more listings</button><button class=\"button secondary scout-action\" id=\"openScoutWebsite\">Open Scout on website</button></div>",
  'Scan more listings button'
)

need(
  "filtered=ratedRows.filter(c=>!worthwhile(c)),working=state.active.size;",
  "filtered=ratedRows.filter(c=>!worthwhile(c)),working=rows.filter(c=>c.scan_status==='working').length||state.active.size;",
  'Working counter'
)

need(
  "loader?.classList.remove('paused','stopped','error');",
  "loader?.classList.remove('paused','stopped','error','completed');",
  'loader completed reset'
)

need(
  "else if(done>=total&&total){loader?.classList.remove('visible');if(ins){",
  "else if(done>=total&&total){loader?.classList.add('visible','completed');if(ls)ls.textContent='Scan complete';if(lc)lc.textContent=`${ratedRows.length}/${total} listings rated. You can scan more listings, restart this scan, or start a new scan.`;if(count)count.textContent='Complete';if(track)track.style.width='100%';if(ins){",
  'scan complete state'
)

need(
  "const pause=$('#v090Pause');if(pause)pause.textContent=state.status==='paused'?'Resume scan':'Pause scan';const stop=$('#v090Stop');if(stop){stop.textContent=state.status==='stopped'?'Scan stopped':'Stop scan';stop.disabled=state.status==='stopped'}document.dispatchEvent(new CustomEvent('flippers:candidate-updated'))}",
  "const complete=done>=total&&total>0;const pause=$('#v090Pause');if(pause){pause.textContent=complete?'Scan complete':state.status==='paused'?'Resume scan':'Pause scan';pause.disabled=Boolean(complete||state.status==='stopped')}const stop=$('#v090Stop');if(stop){stop.textContent=complete?'Scan complete':state.status==='stopped'?'Scan stopped':'Stop scan';stop.disabled=Boolean(complete||state.status==='stopped')}const more=$('#v090More');if(more)more.disabled=!complete;document.dispatchEvent(new CustomEvent('flippers:candidate-updated'))}",
  'completed control state'
)

const scanMore=`async function scanMore(){const s=state.scout;if(!s||state.processing)return;try{const result=await chrome.runtime.sendMessage({type:'FLIPPERS_SCAN_COLLECTION_ACTIVE'});if(!result?.ok)throw new Error(result?.error||'Could not read this marketplace page.');const data=result.data||{};if(data.mode!=='collection'||!(data.candidates||[]).length)throw new Error('No marketplace listings were detected on this page.');const existing=new Set(s.candidates.map(c=>c.source_url).filter(Boolean));const fresh=(data.candidates||[]).filter(c=>c.url&&!existing.has(c.url)).slice(0,MAX_FOUND);if(!fresh.length)throw new Error('No new listings detected. Scroll further down the marketplace page, then press Scan more listings again.');const user=await api.getUser();if(!user?.id)throw new Error('Connect FlippersAI before continuing Scout.');const round=currentRound(s.candidates)+1;const rows=fresh.map((c,i)=>({session_id:s.session.id,user_id:user.id,source_url:c.url,listing_id:c.listingId||null,title:c.title||null,asking_price:c.askingPrice??null,currency:c.currency||'AUD',location:c.location||null,condition:c.condition||null,seller_name:c.sellerName||null,thumbnail_url:c.thumbnailUrl||null,region_code:c.regionCode||null,category_label:c.categoryLabel||'Other',raw_capture:{raw_text:c.rawText||'',order_index:s.candidates.length+i,round_index:round,region_code:c.regionCode||'',category_label:c.categoryLabel||'Other'},scan_status:'quick',selected:false,rank_score:null,saved:false}));const saved=await api.insert('scout_candidates',rows);s.candidates.push(...(saved||[]).map((r,i)=>({...r,order_index:r.raw_capture?.order_index??s.candidates.length+i,analysis:r.analysis||{}})));s.session.candidate_count=s.candidates.length;s.session.metadata={...(s.session.metadata||{}),current_round:round};await api.update('scout_sessions',\`id=eq.\${s.session.id}\`,{status:'running',candidate_count:s.candidates.length,metadata:s.session.metadata,updated_at:new Date().toISOString()}).catch(()=>{});state.runId++;state.status='running';state.active.clear();await persist();renderShell();queueMicrotask(()=>run())}catch(error){toast(error.message||String(error))}}\n`

need(
  "async function restart(){const s=state.scout;",
  scanMore+"async function restart(){const s=state.scout;",
  'scan more handler'
)

need(
  "$('#v090Restart')?.addEventListener('click',restart);$('#v090New')?.addEventListener('click',startNew);",
  "$('#v090Restart')?.addEventListener('click',restart);$('#v090New')?.addEventListener('click',startNew);$('#v090More')?.addEventListener('click',scanMore);",
  'Scan more binding'
)

fs.writeFileSync(path,s)

const cssPath='extension/scout-v080.css'
let css=fs.readFileSync(cssPath,'utf8')
const completionCss=`\n/* v0.90.1: completed Scout is visibly finished, not still loading */\n#v090Loading.completed .scout-loading-spinner{animation:none!important;opacity:.35!important}\n#v090Loading.completed .scout-loading-track i{width:100%!important}\n#v090Controls button:disabled,#v090More:disabled{opacity:.45!important;cursor:not-allowed!important;filter:grayscale(.35)}\n`
if(!css.includes('#v090Loading.completed .scout-loading-spinner'))css+=completionCss
fs.writeFileSync(cssPath,css)

const manifestPath='extension/manifest.json'
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version='0.90.1'
manifest.description='FlippersAI v0.90.1 with reliable Scout working state, scan-more rounds and completed controls.'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')

const pkgPath='package.json'
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version='0.90.1'
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')
console.log('v0.90.1 Scout controls patch applied')
