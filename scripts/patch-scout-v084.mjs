import fs from 'node:fs'

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.84 reliability patch applied`)
  } else {
    console.log(`${path}: v0.84 reliability patch already present or source changed`)
  }
}

patch('extension/scout-orchestrator-v080.js', source => {
  source = source.replace('const REQUEST_TIMEOUT=15000', 'const REQUEST_TIMEOUT=40000')
  source = source.replace('for(let attempt=1;attempt<=2;attempt++)', 'for(let attempt=1;attempt<=3;attempt++)')
  source = source.replace('await sleep(650)}}', 'await sleep(650*attempt)}}')

  if (!source.includes('async function retryFailedOnly()')) {
    const marker = "async function markFailed(c,error,generation){if(generation!==O.generation||O.paused||O.stopped)return;await api.update('scout_candidates',`id=eq.${c.id}`,{scan_status:'failed',analysis:{error:String(error||'Scout screening failed'),scout_scan_depth:'search_page'},updated_at:new Date().toISOString()}).catch(()=>{})}"
    const addition = `${marker}\nasync function retryFailedOnly(){if(O.busy||O.paused||O.stopped)return;const rows=await loadRows(),failedRows=rows.filter(failed);if(!failedRows.length)return toast('No failed listings to retry.');O.generation+=1;O.busy=false;O.active.clear();const now=new Date().toISOString();await Promise.all(failedRows.map(c=>api.update('scout_candidates',\`id=eq.\${c.id}\`,{scan_status:'quick',analysis:{retry_requested_at:now},recommendation:null,score:null,resale_mid:null,expected_profit:null,expected_roi_percent:null,rank_score:null,updated_at:now}).catch(()=>null)));toast(\`Retrying \${failedRows.length} failed listing\${failedRows.length===1?'':'s'} only\`);renderLive(await loadRows());fastScreen().catch(err=>toast(err.message))}\ndocument.addEventListener('flippers:retry-failed',()=>retryFailedOnly().catch(err=>toast(err.message)))`
    if (source.includes(marker)) source = source.replace(marker, addition)
  }

  source = source.replace('Restart current scan to retry them.', 'Use Retry failed listings to retry only those listings.')
  source = source.replace('Restart current scan to retry the page.', 'Retry only the failed listings without resetting completed ratings.')
  return source
})

patch('extension/manifest.json', source => {
  const manifest = JSON.parse(source)
  manifest.version = '0.84.0'
  manifest.description = 'AI-powered reselling workspace with reliable cumulative Scout ratings, permanent Shortlist history, explainable marketplace scoring and authenticity evidence checks.'
  return JSON.stringify(manifest, null, 2) + '\n'
})
