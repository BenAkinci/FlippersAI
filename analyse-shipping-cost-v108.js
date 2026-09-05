(() => {
  function ensureStyles(){
    if(document.getElementById('analyseShippingStyles')) return
    const style=document.createElement('style')
    style.id='analyseShippingStyles'
    style.textContent=`
      #newDeal .shipping-cost-field{display:flex;flex-direction:column;gap:8px;min-width:0}
      #newDeal .shipping-cost-field input{width:100%;box-sizing:border-box}
      #newDeal .shipping-cost-field small{color:#6f8490;font-size:12px;line-height:1.35;font-weight:500}
      #newDeal .shipping-cost-field.invalid input{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.10)!important;background:#fffafa}
      #newDeal .shipping-cost-error{display:none;color:#b42318!important}
      #newDeal .shipping-cost-field.invalid .shipping-cost-error{display:block}
    `
    document.head.appendChild(style)
  }

  function priceSection(form){
    return [...form.querySelectorAll('.field-section')].find(section=>section.querySelector(':scope > h3')?.textContent.trim()==='Price')||null
  }

  function ensureShippingContext(form){
    let context=form.querySelector('input[data-shipping-context="true"]')
    if(!context){
      context=document.createElement('input')
      context.type='hidden'
      context.name='fulfilment'
      context.dataset.shippingContext='true'
      form.appendChild(context)
    }
    return context
  }

  function syncShippingContext(form){
    const input=form.querySelector('[name="shipping_cost"]')
    const context=ensureShippingContext(form)
    const raw=String(input?.value||'').trim()
    if(raw===''){context.value='';return}
    const amount=Number(raw)
    if(!Number.isFinite(amount)||amount<0){context.value='';return}
    const currency=String(form.elements?.currency?.value||'').trim().toUpperCase()||'AUD'
    context.value=`FlippersAI acquisition shipping cost: ${amount.toFixed(2)} ${currency}`
  }

  function mount(){
    ensureStyles()
    const form=document.getElementById('newDeal')
    if(!form) return
    const section=priceSection(form)
    if(!section) return
    ensureShippingContext(form)
    if(form.dataset.shippingCost==='v120'){syncShippingContext(form);return}
    form.dataset.shippingCost='v120'
    const existing=form.querySelector('.shipping-cost-field')
    if(!existing){
      const label=document.createElement('label')
      label.className='shipping-cost-field'
      label.innerHTML='<span>Shipping cost</span><input name="shipping_cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"><small>Same currency as the listing price. Enter 0 for free shipping or pickup.</small><small class="shipping-cost-error">Enter the shipping cost, or 0 for free shipping / pickup.</small>'
      const disclosure=section.querySelector('#discountDisclosure')
      if(disclosure) section.insertBefore(label,disclosure)
      else section.appendChild(label)
    }
    const input=form.querySelector('[name="shipping_cost"]')
    input?.addEventListener('input',()=>{input.closest('.shipping-cost-field')?.classList.remove('invalid');syncShippingContext(form)})
    input?.addEventListener('change',()=>syncShippingContext(form))
    form.elements?.currency?.addEventListener?.('change',()=>syncShippingContext(form))
    syncShippingContext(form)
  }

  function shippingValue(form){
    const input=form.querySelector('[name="shipping_cost"]')
    if(!input) return {ok:false,amount:null}
    const raw=String(input.value||'').trim()
    if(raw==='') return {ok:false,amount:null}
    const amount=Number(raw)
    return {ok:Number.isFinite(amount)&&amount>=0,amount:Number.isFinite(amount)?amount:null}
  }

  document.addEventListener('submit',event=>{
    const form=event.target
    if(!(form instanceof HTMLFormElement)||form.id!=='newDeal') return
    const field=form.querySelector('.shipping-cost-field')
    const parsed=shippingValue(form)
    if(!parsed.ok){
      field?.classList.add('invalid')
      event.preventDefault()
      event.stopImmediatePropagation()
      field?.scrollIntoView({behavior:'smooth',block:'center'})
      return
    }
    field?.classList.remove('invalid')
    syncShippingContext(form)
  },true)

  let timer
  const app=document.getElementById('app')
  if(app){
    new MutationObserver(()=>{
      clearTimeout(timer)
      timer=setTimeout(mount,40)
    }).observe(app,{childList:true,subtree:true})
  }
  mount()
})()
