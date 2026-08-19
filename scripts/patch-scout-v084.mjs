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

patch('extension/shortlist-history-v083.js', source => {
  const oldInstall = "function installTabs(){if(active)return;const head=$('.scout-page-head');if(!head||head.querySelector('.v083-scan-tabs'))return;const tabs=document.createElement('div');tabs.className='v083-scan-tabs';tabs.innerHTML='<button class=\"active\" data-v083-live-scan>Scan</button><button data-v083-shortlist>Shortlist</button>';head.appendChild(tabs);tabs.querySelector('[data-v083-shortlist]').onclick=async()=>{active=true;await load();render()}}"
  const newInstall = "function scanHead(){const direct=$('.scout-page-head');if(direct)return direct;const main=$('.ext-main');if(!main)return null;return $$('.page-head',main).find(head=>{const title=String($('h1',head)?.textContent||'').trim().toLowerCase();const text=String(head.textContent||'').toLowerCase();return title.includes('scan')||text.includes('marketplace scout')})||null}\nfunction installTabs(){if(active)return;const head=scanHead();if(!head||head.querySelector('.v083-scan-tabs'))return;const tabs=document.createElement('div');tabs.className='v083-scan-tabs';tabs.innerHTML='<button class=\"active\" data-v083-live-scan>Scan</button><button data-v083-shortlist>Shortlist</button>';head.appendChild(tabs);tabs.querySelector('[data-v083-shortlist]').onclick=async()=>{active=true;await load();render()}}"
  if (source.includes(oldInstall)) source = source.replace(oldInstall, newInstall)
  return source
})

patch('extension/scout-loader-state-v083.js', source => {
  if (source.includes('__flippersRetryFailedV084')) return source
  return source + `\n;(() => {\n  if(window.__flippersRetryFailedV084)return\n  window.__flippersRetryFailedV084=true\n  function syncRetry(){\n    const loader=document.getElementById('v080Loading')\n    if(!loader)return\n    let button=document.getElementById('v084RetryFailed')\n    const shouldShow=loader.classList.contains('error')&&!loader.classList.contains('stopped')\n    if(!shouldShow){button?.remove();return}\n    if(button)return\n    button=document.createElement('button')\n    button.id='v084RetryFailed'\n    button.type='button'\n    button.className='button secondary small'\n    button.textContent='Retry failed listings'\n    button.style.marginTop='8px'\n    button.addEventListener('click',()=>{button.disabled=true;button.textContent='Retrying failed listings…';document.dispatchEvent(new CustomEvent('flippers:retry-failed'))})\n    const copy=loader.querySelector('.scout-loading-copy')\n    ;(copy||loader).appendChild(button)\n  }\n  const app=document.getElementById('app')\n  if(app)new MutationObserver(syncRetry).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})\n  setInterval(syncRetry,700)\n  syncRetry()\n})()\n`
})

patch('extension/manifest.json', source => {
  const manifest = JSON.parse(source)
  manifest.version = '0.84.0'
  manifest.description = 'AI-powered reselling workspace with reliable cumulative Scout ratings, permanent Shortlist history, explainable marketplace scoring and authenticity evidence checks.'
  return JSON.stringify(manifest, null, 2) + '\n'
})
