const $ = (s, root=document) => root.querySelector(s)
const $$ = (s, root=document) => [...root.querySelectorAll(s)]

const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

function icon(path, size=15){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}
const editIcon = icon('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/>')
const copyIcon = icon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>')
const doneIcon = icon('<path d="m5 12 4 4L19 6"/>')

function dedupeFinanceActions(){
  const blocks = $$('#platformFinanceTools')
  blocks.slice(1).forEach(x=>x.remove())
}

function splitStructuredText(text){
  const clean = String(text||'').replace(/\s+/g,' ').trim()
  if(!clean) return {intro:'', bullets:[]}
  const numbered = [...clean.matchAll(/(?:^|\s)\((\d+)\)\s*/g)]
  if(numbered.length >= 2){
    const first = numbered[0].index ?? 0
    const intro = clean.slice(0, first).trim().replace(/[,:;\s]+$/,'')
    const bullets = numbered.map((m,i)=>{
      const start=(m.index||0)+m[0].length
      const end=i+1<numbered.length?(numbered[i+1].index||clean.length):clean.length
      return clean.slice(start,end).trim().replace(/^[,;:\s]+|[,;:\s]+$/g,'')
    }).filter(Boolean)
    return {intro,bullets}
  }
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean) || []
  if(clean.length>260 && sentences.length>=3) return {intro:sentences.shift(),bullets:sentences}
  return {intro:clean,bullets:[]}
}

function formatDecisionCards(){
  $$('.decision-card').forEach(card=>{
    if(card.dataset.structured==='1') return
    const heading=$('.decision-head h3',card)
    if(!heading) return
    const text=heading.textContent.trim()
    if(text.length<220 && !/\(1\).*\(2\)/s.test(text)) return
    const {intro,bullets}=splitStructuredText(text)
    if(!bullets.length) return
    heading.classList.add('decision-summary-structured')
    heading.innerHTML=`${intro?`<span class="decision-intro">${esc(intro)}</span>`:''}<ul>${bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
    card.dataset.structured='1'
  })
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
  hidden.value=$$('.seller-question-text',list).map(x=>x.textContent.trim()).filter(Boolean).join('\n')
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
  input.focus(); input.setSelectionRange(input.value.length,input.value.length)
  const editBtn=$('[data-question-edit]',row)
  if(editBtn) editBtn.innerHTML=doneIcon
  const finish=()=>{
    const span=document.createElement('span')
    span.className='seller-question-text'
    span.textContent=input.value.trim()||current
    input.replaceWith(span)
    row.dataset.editing='0'
    if(editBtn) editBtn.innerHTML=editIcon
    syncSellerHidden(list)
  }
  editBtn.onclick=e=>{e.preventDefault();finish()}
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value=current;finish()}if((e.metaKey||e.ctrlKey)&&e.key==='Enter')finish()})
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
    span.classList.add('seller-question-text')
    row.classList.add('seller-question-row')
    row.innerHTML=`<span class="seller-question-number">${i+1}</span><span class="seller-question-text">${esc(span.textContent.trim())}</span><div class="seller-question-actions"><button type="button" data-question-copy aria-label="Copy question" title="Copy question">${copyIcon}</button><button type="button" data-question-edit aria-label="Edit question" title="Edit question">${editIcon}</button></div>`
    $('[data-question-copy]',row).onclick=async e=>{e.preventDefault();const value=$('.seller-question-text',row)?.textContent.trim()||$('.seller-question-editor',row)?.value.trim()||'';if(value)await navigator.clipboard.writeText(value)}
    $('[data-question-edit]',row).onclick=e=>{e.preventDefault();enableQuestionEdit(row,list)}
  })

  const formStack=list.closest('.form-stack')
  const readyLabel=formStack ? $$('label',formStack).find(l=>/ready-to-send message/i.test(l.textContent||'')) : null
  readyLabel?.remove()
  $('#copySeller')?.remove()
  const row=$('#sentSeller')?.closest('.button-row')
  if(row) row.classList.add('seller-send-row')
  syncSellerHidden(list)
}

function tidyWorkflowCopy(){
  const p=$('.step-copy p')
  if(p && p.textContent.length>240 && !p.dataset.tidied){
    const {intro,bullets}=splitStructuredText(p.textContent)
    if(bullets.length){p.innerHTML=`${intro?`<span>${esc(intro)}</span>`:''}<ul>${bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;p.dataset.tidied='1'}
  }
}

function apply(){
  dedupeFinanceActions()
  formatDecisionCards()
  simplifySellerQuestions()
  tidyWorkflowCopy()
}

let timer
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,35)}).observe(document.getElementById('app'),{childList:true,subtree:true})
apply()
