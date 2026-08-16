const $ = (s, root=document) => root.querySelector(s)
const $$ = (s, root=document) => [...root.querySelectorAll(s)]

const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

function icon(path, size=15){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}
const editIcon = icon('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/>')
const copyIcon = icon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>')
const doneIcon = icon('<path d="m5 12 4 4L19 6"/>')

function keepFirst(selector){
  const nodes = $$(selector)
  nodes.slice(1).forEach(node=>node.remove())
}

function dedupePlatformEnhancements(){
  ;[
    '[id="platformFinanceTools"]',
    '[id="platformDealTools"]',
    '[id="platformInventoryTools"]',
    '[id="platformIntelPersonal"]',
    '[id="platformBell"]',
    '[id="platformSettingsButton"]',
    '.intel-advanced-filters'
  ].forEach(keepFirst)

  $$('.transaction-row').forEach(row=>$$('.transaction-edit',row).slice(1).forEach(x=>x.remove()))
  $$('.opportunity-row,.inventory-row').forEach(row=>$$('.record-actions',row).slice(1).forEach(x=>x.remove()))
}

function cleanSegment(value){
  return String(value||'')
    .replace(/^[,;:\s]+|[,;:\s]+$/g,'')
    .replace(/\s*After (?:you|this|that|the above).*?\bI will\s*$/i,'')
    .replace(/\s*Then I will\s*$/i,'')
    .trim()
}

function structureText(text){
  const clean = String(text||'').replace(/\s+/g,' ').trim()
  if(!clean) return {intro:'', choices:[], steps:[], paragraphs:[]}

  const markers = [...clean.matchAll(/(?:^|\s)\(([A-Z]|\d+)\)\s*/g)]
  if(markers.length >= 2){
    let intro = clean.slice(0, markers[0].index ?? 0).trim().replace(/[,:;\s]+$/,'')
    intro = intro
      .replace(/\bPlease either$/i,'Please provide one of the following')
      .replace(/\bAfter you supply (?:that|this|the above) I will$/i,'Once that is supplied')

    const choices=[]
    const steps=[]
    markers.forEach((m,i)=>{
      const start=(m.index||0)+m[0].length
      const end=i+1<markers.length?(markers[i+1].index||clean.length):clean.length
      const value=cleanSegment(clean.slice(start,end))
      if(!value)return
      if(/^\d+$/.test(m[1])) steps.push(value)
      else choices.push(value)
    })
    return {intro,choices,steps,paragraphs:[]}
  }

  const paragraphs = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean) || []
  if(clean.length>320 && paragraphs.length>=3){
    return {intro:paragraphs.shift(),choices:[],steps:[],paragraphs}
  }
  return {intro:clean,choices:[],steps:[],paragraphs:[]}
}

function structuredMarkup(parts){
  const sections=[]
  if(parts.intro) sections.push(`<p class="decision-intro">${esc(parts.intro)}</p>`)
  if(parts.choices.length) sections.push(`<section class="decision-copy-section"><span class="decision-section-label">What to provide</span><ul>${parts.choices.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`)
  if(parts.steps.length) sections.push(`<section class="decision-copy-section"><span class="decision-section-label">What FlippersAI will do next</span><ul>${parts.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`)
  if(parts.paragraphs.length) sections.push(`<div class="decision-paragraphs">${parts.paragraphs.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`)
  return sections.join('')
}

function hasStructure(parts){
  return parts.choices.length || parts.steps.length || parts.paragraphs.length
}

function formatDecisionCards(){
  $$('.decision-card').forEach(card=>{
    if(card.dataset.structured==='1') return
    const heading=$('.decision-head h3',card)
    if(!heading) return
    const text=heading.textContent.trim()
    const parts=structureText(text)
    if(!hasStructure(parts)) return
    const block=document.createElement('div')
    block.className='decision-summary-structured'
    block.innerHTML=structuredMarkup(parts)
    heading.replaceWith(block)
    card.dataset.structured='1'
  })
}

function questionValue(row){
  return $('.seller-question-editor',row)?.value.trim() || $('.seller-question-text',row)?.textContent.trim() || ''
}

function syncSellerHidden(list){
  let hidden=$('#sellerMsg')
  if(!hidden){
    hidden=document.createElement('textarea')
    hidden.id='sellerMsg'
    hidden.className='seller-message-hidden'
    hidden.setAttribute('aria-hidden','true')
    hidden.tabIndex=-1
    list.insertAdjacentElement('afterend',hidden)
  }
  hidden.value=$$('.seller-question-row',list).map(questionValue).filter(Boolean).join('\n')
}

function enableQuestionEdit(row,list){
  const text=$('.seller-question-text',row)
  if(!text || row.dataset.editing==='1') return
  row.dataset.editing='1'
  const current=text.textContent.trim()
  const input=document.createElement('textarea')
  input.className='seller-question-editor'
  input.value=current
  text.replaceWith(input)
  input.focus()
  input.setSelectionRange(input.value.length,input.value.length)

  const editBtn=$('[data-question-edit]',row)
  if(editBtn) editBtn.innerHTML=doneIcon

  const finish=(restore=false)=>{
    const span=document.createElement('span')
    span.className='seller-question-text'
    span.textContent=restore ? current : (input.value.trim()||current)
    input.replaceWith(span)
    row.dataset.editing='0'
    if(editBtn){
      editBtn.innerHTML=editIcon
      editBtn.title='Edit question'
      editBtn.setAttribute('aria-label','Edit question')
      editBtn.onclick=e=>{e.preventDefault();enableQuestionEdit(row,list)}
    }
    syncSellerHidden(list)
  }

  if(editBtn){
    editBtn.title='Save question'
    editBtn.setAttribute('aria-label','Save question')
    editBtn.onclick=e=>{e.preventDefault();finish(false)}
  }
  input.addEventListener('input',()=>syncSellerHidden(list))
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape') finish(true)
    if((e.metaKey||e.ctrlKey)&&e.key==='Enter') finish(false)
  })
}

function simplifySellerQuestions(){
  const action=$('.step-action')
  const list=action?.querySelector('.check-list')
  if(!list || !$('#sentSeller') || list.dataset.enhanced==='1') return

  list.dataset.enhanced='1'
  list.classList.add('seller-question-list')
  $$('.plain-check',list).forEach((row,i)=>{
    const span=$('span',row)
    if(!span)return
    const value=span.textContent.trim()
    row.classList.add('seller-question-row')
    row.innerHTML=`<span class="seller-question-number">${i+1}</span><span class="seller-question-text">${esc(value)}</span><div class="seller-question-actions"><button type="button" data-question-copy aria-label="Copy question" title="Copy question">${copyIcon}</button><button type="button" data-question-edit aria-label="Edit question" title="Edit question">${editIcon}</button></div>`
    $('[data-question-copy]',row).onclick=async e=>{
      e.preventDefault()
      const value=questionValue(row)
      if(value) await navigator.clipboard.writeText(value)
    }
    $('[data-question-edit]',row).onclick=e=>{e.preventDefault();enableQuestionEdit(row,list)}
  })

  const formStack=list.closest('.form-stack')
  const readyLabel=formStack ? $$('label',formStack).find(l=>/ready-to-send message/i.test(l.textContent||'')) : null
  readyLabel?.remove()

  const copyAll=$('#copySeller')
  if(copyAll){
    copyAll.textContent='Copy all questions'
    copyAll.title='Copy every question'
  }

  const row=$('#sentSeller')?.closest('.button-row')
  if(row) row.classList.add('seller-send-row')
  syncSellerHidden(list)
}

function tidyWorkflowCopy(){
  const p=$('.step-copy p')
  if(!p || p.dataset.tidied==='1') return
  const parts=structureText(p.textContent)
  if(!hasStructure(parts)) return
  const block=document.createElement('div')
  block.className='step-instruction-structured'
  block.innerHTML=structuredMarkup(parts)
  p.replaceWith(block)
  block.dataset.tidied='1'
}

function apply(){
  dedupePlatformEnhancements()
  formatDecisionCards()
  simplifySellerQuestions()
  tidyWorkflowCopy()
}

let timer
new MutationObserver(()=>{
  clearTimeout(timer)
  timer=setTimeout(apply,45)
}).observe(document.getElementById('app'),{childList:true,subtree:true})

apply()
