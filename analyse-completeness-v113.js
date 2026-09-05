(() => {
  const IMPORTANT = new Set(['brand','model','condition','description'])
  const CLEAR_NON_SIZED = /\b(book|novel|textbook|card|trading card|pokemon card|pokémon card|graphics card|gpu|cpu|processor|camera|headphones?|earbuds?|speaker|console|playstation|xbox|nintendo switch|phone|iphone|ipad|tablet|laptop|macbook|watch)\b/i
  const APPAREL = /\b(jacket|coat|shirt|t[- ]?shirt|tee|hoodie|jumper|sweater|pants|trousers|jeans|shorts|dress|skirt|blazer|vest|clothing|apparel)\b/i
  const FOOTWEAR = /\b(shoe|shoes|sneaker|sneakers|trainer|trainers|boot|boots|loafer|heel|sandal|slides|air max|jordan|yeezy|dunk|samba|gazelle)\b/i

  function ensureStyles(){
    if(document.getElementById('analyseCompletenessStyles')) return
    const style=document.createElement('style')
    style.id='analyseCompletenessStyles'
    style.textContent=`
      #newDeal .seller-grid-adaptive{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:16px}
      #newDeal .field-state{display:block;margin-top:6px;font-size:11px;line-height:1.3;font-weight:600}
      #newDeal .field-state.na{color:#667985}
      #newDeal .field-state.missing{color:#a15c00}
      #newDeal .field-state.not-shown{color:#718591}
      #newDeal label[data-field-state="missing"] input,
      #newDeal label[data-field-state="missing"] textarea{border-color:#e4a11b!important;background:#fffdf7}
      #newDeal label[data-field-state="na"] input,
      #newDeal label[data-field-state="na"] textarea{background:#f7fafb}
    `
    document.head.appendChild(style)
  }

  function fieldLabel(form,name){
    const el=form.elements?.[name]
    return el?.closest?.('label')||null
  }

  function clearState(form,name){
    const label=fieldLabel(form,name)
    if(!label) return
    label.removeAttribute('data-field-state')
    label.querySelector('.field-state')?.remove()
    const el=form.elements?.[name]
    if(el && el.dataset.statePlaceholder==='true'){
      el.removeAttribute('placeholder')
      delete el.dataset.statePlaceholder
    }
  }

  function setState(form,name,type,text){
    const el=form.elements?.[name]
    const label=fieldLabel(form,name)
    if(!el||!label||String(el.value||'').trim()) return
    clearState(form,name)
    label.dataset.fieldState=type
    const note=document.createElement('small')
    note.className=`field-state ${type}`
    note.textContent=text
    label.appendChild(note)
    if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){
      if(!el.placeholder){
        el.placeholder=type==='na'?'N/A — not applicable':type==='missing'?'Missing — needs confirmation':'Not shown in evidence'
        el.dataset.statePlaceholder='true'
      }
    }
  }

  function addItemsSold(form){
    if(form.elements?.seller_items_sold) return
    const seller=form.elements?.seller
    const grid=seller?.closest('.field-grid-4')||seller?.parentElement?.parentElement
    if(!grid) return
    grid.classList.add('seller-grid-adaptive')
    const location=form.elements?.location?.closest('label')
    const label=document.createElement('label')
    label.innerHTML='Items sold<input name="seller_items_sold" type="number" min="0" step="1" placeholder="Not shown">'
    if(location) grid.insertBefore(label,location)
    else grid.appendChild(label)
  }

  function parseItemsSold(form){
    const sold=form.elements?.seller_items_sold
    if(!sold||String(sold.value||'').trim()) return
    const extra=String(form.elements?.extra_info?.value||'')
    const candidates=[
      /\b(\d[\d,]*)\s+(?:items?\s+)?sold\b/i,
      /\bsold\s*[:\-]?\s*(\d[\d,]*)\b/i,
      /\b(\d[\d,]*)\s+sales\b/i
    ]
    for(const re of candidates){
      const m=extra.match(re)
      if(!m) continue
      const n=Number(m[1].replace(/,/g,''))
      if(Number.isFinite(n)){
        sold.value=String(n)
        sold.dataset.autoValue=String(n)
        sold.classList.add('auto-filled')
        clearState(form,'seller_items_sold')
        break
      }
    }
  }

  function textContext(form){
    return ['title','brand','model','description','extra_info'].map(n=>String(form.elements?.[n]?.value||'')).join(' ')
  }

  function applyCompleteness(form){
    const context=textContext(form)
    const isApparel=APPAREL.test(context)
    const isFootwear=FOOTWEAR.test(context)
    const clearlyNonSized=CLEAR_NON_SIZED.test(context)

    const names=['brand','model','colour','condition','description','size','seller_rating','seller_reviews','seller_items_sold','location','included','flaws','fulfilment']
    names.forEach(n=>clearState(form,n))

    if(!String(form.elements?.size?.value||'').trim() && !String(form.elements?.size_entry?.value||'').trim()){
      if(clearlyNonSized && !isApparel && !isFootwear) setState(form,form.elements?.size_entry?'size_entry':'size','na','N/A for this type of item.')
      else if(isApparel||isFootwear) setState(form,form.elements?.size_entry?'size_entry':'size','missing','Size matters for matching the right resale market and still needs confirmation.')
    }

    for(const name of IMPORTANT){
      if(!String(form.elements?.[name]?.value||'').trim()) setState(form,name,'missing',`${name==='description'?'Seller description':name[0].toUpperCase()+name.slice(1)} was not found in the screenshots and still needs confirmation.`)
    }

    if(!String(form.elements?.colour?.value||'').trim() && (isApparel||isFootwear)) setState(form,'colour','missing','Colour/variant was not found and can affect comparable sales.')
    if(!String(form.elements?.seller_rating?.value||'').trim()) setState(form,'seller_rating','not-shown','Seller rating not shown in the supplied evidence.')
    if(!String(form.elements?.seller_reviews?.value||'').trim()) setState(form,'seller_reviews','not-shown','Review count not shown in the supplied evidence.')
    if(!String(form.elements?.seller_items_sold?.value||'').trim()) setState(form,'seller_items_sold','not-shown','Items sold not shown in the supplied evidence.')
    if(!String(form.elements?.location?.value||'').trim()) setState(form,'location','not-shown','Location not shown in the supplied evidence.')

    if(!String(form.elements?.included?.value||'').trim() && clearlyNonSized) setState(form,'included','not-shown','Included accessories/items were not shown.')
    if(!String(form.elements?.flaws?.value||'').trim()) setState(form,'flaws','not-shown','No specific flaws were extracted; confirm against the photos/description.')
  }

  function syncSellerSalesIntoContext(form){
    const sold=String(form.elements?.seller_items_sold?.value||'').trim()
    const extra=form.elements?.extra_info
    if(!sold||!extra) return
    const marker=`Seller items sold: ${sold}`
    if(new RegExp(`seller items sold:\\s*${sold}\\b`,'i').test(extra.value)) return
    if(/\b\d[\d,]*\s+(?:items?\s+)?sold\b/i.test(extra.value)) return
    extra.value=[extra.value.trim(),marker].filter(Boolean).join('\n')
  }

  function bind(form){
    if(!form||form.dataset.completeness==='v113') return
    form.dataset.completeness='v113'
    addItemsSold(form)

    form.elements?.seller_items_sold?.addEventListener('input',()=>{
      clearState(form,'seller_items_sold')
      syncSellerSalesIntoContext(form)
    })

    const status=document.getElementById('autoExtractStatus')
    if(status){
      new MutationObserver(()=>{
        if(!/Screenshots read/i.test(status.textContent||'')) return
        setTimeout(()=>{
          parseItemsSold(form)
          applyCompleteness(form)
          syncSellerSalesIntoContext(form)
        },80)
      }).observe(status,{childList:true,subtree:true,characterData:true})
    }

    form.addEventListener('input',e=>{
      const el=e.target
      if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement)) return
      if(el.name) clearState(form,el.name)
    })
  }

  function enhance(){
    ensureStyles()
    bind(document.getElementById('newDeal'))
  }

  let timer
  const app=document.getElementById('app')
  if(app)new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40)}).observe(app,{childList:true,subtree:true})
  setInterval(()=>{
    const form=document.getElementById('newDeal')
    if(!form) return
    addItemsSold(form)
    parseItemsSold(form)
  },700)
  enhance()
})()
