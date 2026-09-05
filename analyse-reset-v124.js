(() => {
  const RESET_KEY='flippers:reset-analyse-on-load'

  function injectStyles(){
    if(document.getElementById('analyseReset124Styles'))return
    const s=document.createElement('style')
    s.id='analyseReset124Styles'
    s.textContent=`
      .analyse-new-item-actions{display:flex;justify-content:flex-end;align-items:center;margin-top:18px;padding-top:16px;border-top:1px solid #e1ebef}
      .analyse-new-item-btn{appearance:none;border:1px solid #c8dce5;background:#fff;color:#17313e;border-radius:11px;padding:11px 16px;font:inherit;font-weight:750;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}
      .analyse-new-item-btn:hover{background:#f6fafc;border-color:#a9c9d7}
      .analyse-new-item-btn:active{transform:translateY(1px)}
      @media(max-width:700px){.analyse-new-item-actions{justify-content:stretch}.analyse-new-item-btn{width:100%}}
    `
    document.head.appendChild(s)
  }

  function clearForm(form){
    if(!form)return false
    try{form.reset()}catch{}
    form.querySelectorAll('input,textarea,select').forEach(el=>{
      if(el instanceof HTMLInputElement){
        if(el.type==='checkbox'||el.type==='radio')el.checked=false
        else if(el.type==='file')el.value=''
        else el.value=''
      }else if(el instanceof HTMLTextAreaElement)el.value=''
      else if(el instanceof HTMLSelectElement)el.selectedIndex=0
      delete el.dataset.autoValue
      el.classList.remove('auto-filled','is-invalid','invalid','field-missing','field-na')
      el.removeAttribute('aria-invalid')
      el.dispatchEvent(new Event('input',{bubbles:true}))
      el.dispatchEvent(new Event('change',{bubbles:true}))
    })
    document.getElementById('directAnalysisResult')?.remove()
    document.querySelectorAll('.analysis-audit-panel,.decision-audit,.metric-audit-panel').forEach(n=>n.remove())
    window.__flippersLastAuditedAnalysis=null
    return true
  }

  function completeFreshReset(){
    if(sessionStorage.getItem(RESET_KEY)!=='1')return
    const form=document.getElementById('newDeal')
    if(!form)return
    if(clearForm(form)){
      sessionStorage.removeItem(RESET_KEY)
      window.scrollTo({top:0,behavior:'auto'})
    }
  }

  function startNewAnalysis(){
    sessionStorage.setItem(RESET_KEY,'1')
    window.location.reload()
  }

  function enhanceResult(){
    injectStyles()
    const result=document.getElementById('directAnalysisResult')
    if(!result||result.classList.contains('direct-analysis-loading')||result.classList.contains('direct-analysis-error')||result.querySelector('.analyse-new-item-actions'))return
    const wrap=document.createElement('div')
    wrap.className='analyse-new-item-actions'
    wrap.innerHTML='<button type="button" class="analyse-new-item-btn">Analyse another item</button>'
    wrap.querySelector('button')?.addEventListener('click',startNewAnalysis)
    result.appendChild(wrap)
  }

  let timer
  const observer=new MutationObserver(()=>{
    clearTimeout(timer)
    timer=setTimeout(()=>{completeFreshReset();enhanceResult()},40)
  })
  const app=document.getElementById('app')
  if(app)observer.observe(app,{childList:true,subtree:true})
  completeFreshReset()
  enhanceResult()
})()
