(() => {
  if (window.__flippersSingleSourcePolish) return
  window.__flippersSingleSourcePolish = true
  function polish(){
    const scanButton=document.querySelector('#scanCurrent')
    if(scanButton){
      const h=document.querySelector('.page-head h1'),p=document.querySelector('.page-head p')
      if(h&&/scan the listing you can see/i.test(h.textContent||''))h.textContent='Scan what you can see'
      if(p&&/rendered, logged-in marketplace page/i.test(p.textContent||''))p.textContent='Scan a single listing or a marketplace results page. FlippersAI will detect which one you are viewing and use the right workflow.'
      scanButton.childNodes[0].textContent='Scan current page '
    }
    const form=document.querySelector('#scanReview'),source=document.querySelector('.scan-source');if(!form||!source)return
    const marketplace=document.querySelector('.scan-status strong')?.textContent?.replace(/\s+scan$/i,'').trim()||'Marketplace'
    const cells=[...source.children]
    if(cells[0]){const l=cells[0].querySelector('span'),v=cells[0].querySelector('strong');if(l)l.textContent='SOURCE';if(v)v.textContent=marketplace}
    if(cells[1]){const l=cells[1].querySelector('span'),v=cells[1].querySelector('strong');if(l)l.textContent='PAGE TYPE';if(v)v.textContent='Individual listing'}
    if(cells[2]){const l=cells[2].querySelector('span');if(l)l.textContent='VISUALS CAPTURED'}
  }
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(polish,40)}).observe(document.getElementById('app'),{childList:true,subtree:true});polish()
})()
