(() => {
  function simplifyOtherDetails(){
    const form=document.getElementById('newDeal')
    if(!form) return
    const section=[...form.querySelectorAll('.field-section')].find(s=>s.querySelector(':scope > h3')?.textContent.trim()==='Other details')
    if(!section||section.dataset.cleanup114==='true') return
    section.dataset.cleanup114='true'
    const fulfilment=section.querySelector('[name="fulfilment"]')?.closest('label')
    fulfilment?.remove()
    const heading=section.querySelector(':scope > h3')
    if(heading) heading.textContent='Item extras'
  }

  function removeRedundantTrustRule(){
    const nodes=[...document.querySelectorAll('div,section,aside,p')]
    for(const node of nodes){
      const text=(node.textContent||'').trim()
      if(text.startsWith('Trust rule')&&text.includes('No credible market evidence')){
        node.remove()
        break
      }
    }
  }

  function run(){simplifyOtherDetails();removeRedundantTrustRule()}
  let timer
  const app=document.getElementById('app')
  if(app)new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,40)}).observe(app,{childList:true,subtree:true})
  run()
})()
