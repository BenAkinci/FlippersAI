(() => {
  if(window.__flippersScoutLoaderStateV083)return
  window.__flippersScoutLoaderStateV083=true
  let lastEta=''
  function style(){if(document.getElementById('v083ScoutLoaderStyle'))return;const s=document.createElement('style');s.id='v083ScoutLoaderStyle';s.textContent=`
    #v080Loading.stopped .scout-loading-spinner{display:none!important;animation:none!important}
    #v080Loading.stopped .scout-loading-track{display:none!important}
    #v080Loading.paused .scout-loading-spinner{display:block!important;animation-play-state:paused!important;opacity:.62!important}
    #v080Loading.paused .scout-loading-track{display:block!important}
  `;document.head.appendChild(s)}
  function sync(){const el=document.getElementById('v080Loading');if(!el)return;const detail=el.querySelector('.v080-live-detail');if(!detail)return
    if(!el.classList.contains('paused')&&!el.classList.contains('stopped')&&detail.textContent&&/remaining/i.test(detail.textContent))lastEta=detail.textContent.replace(/^Estimated\s*/i,'').trim()
    if(el.classList.contains('stopped')){detail.textContent='Stopped · no further scanning is running.';return}
    if(el.classList.contains('paused')){const eta=lastEta||detail.textContent.replace(/^Paused\s*·\s*/i,'').trim();detail.textContent=eta?`Paused · ${eta.replace(/^Estimated\s*/i,'')} when resumed`:'Paused · progress is saved and the estimate will recalculate when resumed.'}
  }
  style();new MutationObserver(sync).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});setInterval(sync,800);sync()
})()

;(() => {
  if(window.__flippersRetryFailedV084)return
  window.__flippersRetryFailedV084=true
  function syncRetry(){
    const loader=document.getElementById('v080Loading')
    if(!loader)return
    let button=document.getElementById('v084RetryFailed')
    const shouldShow=loader.classList.contains('error')&&!loader.classList.contains('stopped')
    if(!shouldShow){button?.remove();return}
    if(button)return
    button=document.createElement('button')
    button.id='v084RetryFailed'
    button.type='button'
    button.className='button secondary small'
    button.textContent='Retry failed listings'
    button.style.marginTop='8px'
    button.addEventListener('click',()=>{button.disabled=true;button.textContent='Retrying failed listings…';document.dispatchEvent(new CustomEvent('flippers:retry-failed'))})
    const copy=loader.querySelector('.scout-loading-copy')
    ;(copy||loader).appendChild(button)
  }
  const app=document.getElementById('app')
  if(app)new MutationObserver(syncRetry).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
  setInterval(syncRetry,700)
  syncRetry()
})()
