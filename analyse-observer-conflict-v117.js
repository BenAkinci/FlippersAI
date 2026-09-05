(() => {
  const SENTINEL_ID='v079TrustRule'

  function installSentinel(){
    const existing=document.getElementById(SENTINEL_ID)
    if(existing){
      const text=(existing.textContent||'').trim()
      if(text.startsWith('Trust rule')) existing.remove()
      else return
    }

    const sentinel=document.createElement('div')
    sentinel.id=SENTINEL_ID
    sentinel.setAttribute('aria-hidden','true')
    sentinel.hidden=true
    sentinel.dataset.retiredAnalyseTrustRule='true'
    document.body.appendChild(sentinel)
  }

  installSentinel()

  // Re-install only when the app is fully re-rendered and removes the sentinel.
  // This observer never writes inside #app, so it cannot participate in the
  // Analyse MutationObserver feedback loop that caused bottom-page jitter.
  const app=document.getElementById('app')
  if(app){
    new MutationObserver(()=>{
      if(!document.getElementById(SENTINEL_ID)) installSentinel()
    }).observe(app,{childList:true})
  }
})()
