(() => {
  if (window.__flippersFastExtractionSyncV118) return
  window.__flippersFastExtractionSyncV118 = true

  let latestExtraction = null

  const priorFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await priorFetch(...args)
    try {
      const target = String(args?.[0]?.url || args?.[0] || '')
      if (target.includes('/functions/v1/listing-visual-extraction')) {
        response.clone().json().then(payload => {
          if (!payload?.extraction) return
          latestExtraction = payload.extraction
          queueMicrotask(() => {
            const form = document.getElementById('newDeal')
            syncVisibleFields(form)
            document.dispatchEvent(new CustomEvent('flippers:listing-extracted', { detail: latestExtraction }))
          })
        }).catch(() => {})
      }
    } catch {}
    return response
  }

  const moneyText=(amount,currency)=>{
    const n=Number(amount)
    if(!Number.isFinite(n)) return ''
    const digits=Number.isInteger(n)?0:2
    const value=n.toLocaleString('en-AU',{minimumFractionDigits:digits,maximumFractionDigits:2})
    if(currency==='AUD') return `A$${value}`
    if(currency==='USD') return `US$${value}`
    if(currency==='GBP') return `£${value} GBP`
    return `$${value}`
  }

  const sizeText=(size,system)=>system?`${system} ${size}`:String(size||'')

  function canAutoUpdate(el){
    if(!el) return false
    const value=String(el.value||'').trim()
    const previous=String(el.dataset.autoValue||'').trim()
    return !value || value===previous
  }

  function markAuto(el,value){
    if(!el || value===null || value===undefined || value==='') return
    if(!canAutoUpdate(el)) return
    el.value=String(value)
    el.dataset.autoValue=String(value)
    el.classList.add('auto-filled')
    el.closest('label')?.querySelector('.field-state')?.remove()
    el.closest('label')?.removeAttribute('data-field-state')
  }

  function joinFacts(items){
    return Array.isArray(items) ? items.map(v=>String(v||'').trim()).filter(Boolean).join('; ') : ''
  }

  function syncExtractionFields(form){
    if(!form || !latestExtraction) return
    const x=latestExtraction

    markAuto(form.elements?.description, x.description)
    markAuto(form.elements?.seller_items_sold, x.seller_items_sold)

    const included=joinFacts(x.included_items)
    if(included) markAuto(form.elements?.included, included)

    const flaws=joinFacts(x.known_flaws_damage)
    if(flaws) markAuto(form.elements?.flaws, flaws)
    else if(x.explicit_no_flaws===true) markAuto(form.elements?.flaws, 'None stated — seller reports no defects or marks.')

    if(x.asking_price!==null && x.asking_price!==undefined) markAuto(form.elements?.price, x.asking_price)
    if(x.currency) markAuto(form.elements?.currency, x.currency)
    if(x.size) markAuto(form.elements?.size, x.size)
    if(x.size_system) markAuto(form.elements?.size_system, x.size_system)
  }

  function syncVisibleFields(form){
    if(!form) return
    syncExtractionFields(form)

    const hiddenPrice=form.elements?.price
    const hiddenCurrency=form.elements?.currency
    const priceEntry=form.querySelector('[name="price_entry"]')
    if(hiddenPrice&&priceEntry&&priceEntry.dataset.userEdited!=='true'&&document.activeElement!==priceEntry){
      const amount=String(hiddenPrice.value||'').trim()
      const extractedCurrency=String(latestExtraction?.currency || (hiddenCurrency?.dataset?.autoValue ? hiddenCurrency.dataset.autoValue : '') || '').toUpperCase()
      if(amount){
        const display=moneyText(amount,extractedCurrency)
        priceEntry.value=display
        priceEntry.dataset.canonicalValue=display
        priceEntry.dataset.autoValue=display
        priceEntry.classList.add('auto-filled')
        const wrapper=priceEntry.closest('.inline-unit-field')
        const error=wrapper?.querySelector('.field-error')
        if(extractedCurrency){
          wrapper?.classList.remove('invalid')
          priceEntry.setAttribute('aria-invalid','false')
        }else{
          wrapper?.classList.add('invalid')
          priceEntry.setAttribute('aria-invalid','true')
          if(error) error.textContent='Price found, but the currency is not clear in the screenshots. Confirm AUD, USD, GBP, etc.'
        }
      }
    }

    const hiddenSize=form.elements?.size
    const hiddenSystem=form.elements?.size_system
    const sizeEntry=form.querySelector('[name="size_entry"]')
    if(hiddenSize&&sizeEntry&&sizeEntry.dataset.userEdited!=='true'&&document.activeElement!==sizeEntry){
      const size=String(hiddenSize.value||'').trim()
      if(size){
        const display=sizeText(size,String(hiddenSystem?.value||'').trim())
        sizeEntry.value=display
        sizeEntry.dataset.canonicalValue=display
        sizeEntry.dataset.autoValue=display
        sizeEntry.classList.add('auto-filled')
      }
    }

    const description=form.elements?.description
    const condition=form.elements?.condition
    if(description&&condition&&!String(description.value||'').trim()){
      const text=String(condition.value||'').trim()
      if(text.length>=8 && /[A-Za-z]/.test(text)) markAuto(description,text)
    }

    const sold=form.elements?.seller_items_sold
    const extra=String(form.elements?.extra_info?.value||'')
    if(sold&&!String(sold.value||'').trim()){
      const m=extra.match(/\b(\d[\d,]*)\s+(?:items?\s+)?sold\b/i)||extra.match(/\bsold\s*[:\-]?\s*(\d[\d,]*)\b/i)||extra.match(/\b(\d[\d,]*)\s+sales\b/i)
      if(m){const n=Number(m[1].replace(/,/g,''));if(Number.isFinite(n)) markAuto(sold,n)}
    }
  }

  function bind(form){
    if(!form||form.dataset.fastExtractionSync==='v119') return
    form.dataset.fastExtractionSync='v119'
    const input=document.getElementById('manualEvidenceInput')
    const status=document.getElementById('autoExtractStatus')

    input?.addEventListener('change',()=>{
      if(status){
        status.className='auto-status'
        status.textContent='Scanning screenshots now and filling visible details…'
      }
    })

    if(status){
      new MutationObserver(()=>{
        if(/Screenshots read|filled the visible fields/i.test(status.textContent||'')) queueMicrotask(()=>syncVisibleFields(form))
      }).observe(status,{childList:true,subtree:true,characterData:true})
    }

    document.addEventListener('flippers:listing-extracted',()=>syncVisibleFields(form))
    syncVisibleFields(form)
  }

  function mount(){bind(document.getElementById('newDeal'))}
  let scheduled=false
  const app=document.getElementById('app')
  if(app)new MutationObserver(()=>{
    if(scheduled)return
    scheduled=true
    requestAnimationFrame(()=>{scheduled=false;mount()})
  }).observe(app,{childList:true,subtree:true})
  mount()
})()
