import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient(
  'https://msmpigerejpxepkylkxz.supabase.co',
  'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
)

const $ = (s, root=document) => root.querySelector(s)
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
const money = v => v===null||v===undefined||v===''||Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct = v => v===null||v===undefined||v===''||Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`
const SESSION_KEY = 'flippers_direct_analysis_v078'
let analysing = false

function platformFromUrl(url=''){
  const u=String(url).toLowerCase()
  if(u.includes('facebook'))return'facebook'
  if(u.includes('ebay'))return'ebay'
  if(u.includes('gumtree'))return'gumtree'
  if(u.includes('depop'))return'depop'
  return'other'
}

function recommendationLabel(value=''){
  const map={strong_buy:'Strong buy',buy:'Buy',negotiate:'Negotiate',verify_first:'Verify first',skip:'Skip',watch:'Watch'}
  return map[value]||String(value||'Analysed').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())
}

function recommendationClass(value=''){
  if(['strong_buy','buy'].includes(value))return'good'
  if(['negotiate','watch','verify_first'].includes(value))return'warn'
  if(value==='skip')return'bad'
  return'neutral'
}

function authenticityLabel(value=''){
  const map={verified:'Verified',likely_genuine:'Likely genuine',uncertain:'Uncertain',verify_first:'Verify first',high_risk:'High risk',likely_counterfeit:'Likely counterfeit'}
  return map[value]||String(value||'Not established').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())
}

function toDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(reader.result)
    reader.onerror=()=>reject(reader.error||new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

async function loadContext(){
  try{
    const {data,error}=await supabase.functions.invoke('workflow-state',{method:'GET'})
    if(error||data?.error)return{}
    return data||{}
  }catch{return{}}
}

function saveSession(payload){
  try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(payload))}catch{}
}
function loadSession(){
  try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}
}
function clearSession(){
  try{sessionStorage.removeItem(SESSION_KEY)}catch{}
}

function arrayMarkup(title,values=[]){
  if(!Array.isArray(values)||!values.length)return''
  const rows=values.slice(0,8).map(v=>`<li>${esc(typeof v==='string'?v:(v?.message||v?.finding||v?.label||JSON.stringify(v)))}</li>`).join('')
  return `<section class="direct-analysis-section"><span>${esc(title)}</span><ul>${rows}</ul></section>`
}

function objectRiskMarkup(risks){
  if(!risks||typeof risks!=='object'||Array.isArray(risks))return''
  const rows=Object.entries(risks).filter(([,v])=>v!==null&&v!==''&&v!==false).slice(0,8)
  if(!rows.length)return''
  return `<section class="direct-analysis-section"><span>RISKS</span><ul>${rows.map(([k,v])=>`<li><strong>${esc(k.replaceAll('_',' '))}:</strong> ${esc(typeof v==='string'?v:JSON.stringify(v))}</li>`).join('')}</ul></section>`
}

function resultMarkup(payload){
  const x=payload.analysis||{}
  const input=payload.input||{}
  const rec=x.recommendation||''
  const ask=x.seller_asking_price??input.askingPrice
  const success=x.success_potential??x.success_potential_score??null
  const auth=x.authenticity_status||x.authenticity_assessment?.status||''
  const authReason=x.authenticity_reason||x.authenticity_assessment?.reason||''
  const condition=x.condition_assessment||x.condition||x.inferred_condition||''
  const title=x.identified_name||input.title||'Listing analysis'
  const resaleRange=(x.resale_low!=null||x.resale_high!=null)?`${money(x.resale_low)} – ${money(x.resale_high)}`:money(x.resale_mid)
  return `<section class="direct-analysis-result" id="directAnalysisResult">
    <div class="direct-analysis-result-head">
      <div><span class="eyebrow">ANALYSIS RESULT</span><h2>${esc(title)}</h2><p>${esc(x.action_summary||x.next_action||'FlippersAI has analysed this listing.')}</p></div>
      <div class="direct-analysis-score ${recommendationClass(rec)}"><strong>${Math.round(Number(x.overall_score||0))}</strong><span>/100</span><small>${esc(recommendationLabel(rec))}</small></div>
    </div>
    <div class="direct-analysis-metrics">
      <div><span>ASK</span><strong>${money(ask)}</strong></div>
      <div><span>RESALE</span><strong>${money(x.resale_mid)}</strong><small>${resaleRange}</small></div>
      <div><span>PROFIT</span><strong>${money(x.expected_profit)}</strong></div>
      <div><span>ROI</span><strong>${pct(x.expected_roi_percent)}</strong></div>
      <div><span>SUCCESS POTENTIAL</span><strong>${success==null?'—':`${Math.round(Number(success))}/100`}</strong></div>
      <div><span>MAX BUY</span><strong>${money(x.max_buy)}</strong></div>
    </div>
    <div class="direct-analysis-grid">
      <section class="direct-analysis-panel"><span>AUTHENTICITY</span><strong>${esc(authenticityLabel(auth))}</strong>${authReason?`<p>${esc(authReason)}</p>`:''}</section>
      <section class="direct-analysis-panel"><span>CONDITION</span><strong>${esc(typeof condition==='string'&&condition?condition:'Not established')}</strong>${x.condition_reason?`<p>${esc(x.condition_reason)}</p>`:''}</section>
      <section class="direct-analysis-panel"><span>VALUATION EVIDENCE</span><strong>${pct(x.valuation_confidence)} confidence</strong><p>${esc(x.evidence_summary||'FlippersAI did not return a detailed evidence summary for this analysis.')}</p></section>
    </div>
    ${arrayMarkup('WHAT TO DO NEXT',x.action_steps)}
    ${arrayMarkup('QUESTIONS TO ASK',x.questions_to_ask)}
    ${arrayMarkup('PHOTO FINDINGS',x.photo_findings)}
    ${objectRiskMarkup(x.risks)}
    <div class="direct-analysis-actions"><button type="button" class="button secondary" id="directAnalyseAnother">Analyse another listing</button></div>
  </section>`
}

function mountResult(payload){
  const card=$('.analyser-card')
  if(!card)return
  $('#directAnalysisResult')?.remove()
  card.insertAdjacentHTML('afterend',resultMarkup(payload))
  $('#directAnalyseAnother')?.addEventListener('click',()=>{
    clearSession()
    $('#directAnalysisResult')?.remove()
    const form=$('#newDeal')
    form?.reset()
    form?.elements?.url?.focus()
  })
}

function mountLoading(){
  const card=$('.analyser-card')
  if(!card)return
  $('#directAnalysisResult')?.remove()
  card.insertAdjacentHTML('afterend',`<section class="direct-analysis-result direct-analysis-loading" id="directAnalysisResult" role="status" aria-live="polite"><div class="direct-analysis-spinner"></div><div><strong>Analysing this listing…</strong><p>Checking identity, authenticity risk, realistic resale value, profit, ROI and what would make the item worth the target resale price.</p></div></section>`)
}

function mountError(message){
  const card=$('.analyser-card')
  if(!card)return
  $('#directAnalysisResult')?.remove()
  card.insertAdjacentHTML('afterend',`<section class="direct-analysis-result direct-analysis-error" id="directAnalysisResult"><strong>Analysis could not be completed</strong><p>${esc(message)}</p></section>`)
}

async function runDirectAnalysis(form){
  if(analysing)return
  const f=new FormData(form)
  const url=String(f.get('url')||'').trim()
  const text=String(f.get('text')||'').trim()
  const title=String(f.get('title')||'').trim()
  const askingPrice=f.get('price')!==''&&f.get('price')!==null?Number(f.get('price')):null
  const files=[...(form.elements.images?.files||[])].slice(0,6)
  if(!url&&!text&&!title&&!files.length){mountError('Add a listing link, title, description, or at least one screenshot.');return}

  analysing=true
  const button=$('button[type="submit"],button:not([type])',form)
  const old=button?.innerHTML
  if(button){button.disabled=true;button.textContent='Analysing…'}
  mountLoading()
  try{
    const images=[]
    for(const file of files)images.push(await toDataUrl(file))
    const context=await loadContext()
    const profile=context.profile||{}
    const portfolio=context.portfolio||{}
    const body={
      listing_url:url,
      listing_text:text,
      platform_fields:{
        asking_price:Number.isFinite(askingPrice)?askingPrice:null,
        currency:'AUD',
        asking_price_verified:Number.isFinite(askingPrice),
        asking_price_confidence:Number.isFinite(askingPrice)?1:0,
        listing_title:title||'',
        listing_location:'',
        seller_name:'',
        source_platform:platformFromUrl(url)
      },
      user_overrides:{asking_price:Number.isFinite(askingPrice)?askingPrice:null,currency:'AUD'},
      seller_update:'',
      prior_analysis_summary:'',
      bankroll:Number(portfolio.available_cash||0),
      risk_profile:profile.risk_profile||'conservative',
      reserve_percent:Number(profile.capital_reserve_percent??30),
      max_exposure_percent:Number(profile.max_single_item_exposure_percent??20),
      portfolio_context:portfolio,
      images
    }
    const {data,error}=await supabase.functions.invoke('analyse-listing-v2',{body})
    if(error||data?.error)throw new Error(error?.message||data?.error||'Analysis failed')
    const payload={analysis:data.analysis||{},engineVersion:data.engine_version||'',input:{url,text,title,askingPrice,platform:platformFromUrl(url)},analysedAt:new Date().toISOString()}
    saveSession(payload)
    mountResult(payload)
  }catch(error){mountError(error?.message||String(error))}
  finally{
    analysing=false
    if(button){button.disabled=false;button.innerHTML=old||'Analyse listing'}
  }
}

function enhanceAnalysePage(){
  const form=$('#newDeal')
  if(!form)return
  const page=$('.page-head')
  const intro=$('p',page)
  if(intro)intro.textContent='Paste what you have. FlippersAI will analyse this one listing here and give you the decision before anything becomes a Deal.'
  const button=$('button[type="submit"],button:not([type])',form)
  if(button&&!analysing)button.innerHTML='Analyse listing <span aria-hidden="true">›</span>'
  form.dataset.directAnalyse='v078'
  if(!$('#directAnalysisResult')){
    const saved=loadSession()
    if(saved?.analysis)mountResult(saved)
  }
}

document.addEventListener('submit',event=>{
  const form=event.target
  if(!(form instanceof HTMLFormElement)||form.id!=='newDeal')return
  event.preventDefault()
  event.stopImmediatePropagation()
  runDirectAnalysis(form)
},true)

let timer
new MutationObserver(()=>{
  clearTimeout(timer)
  timer=setTimeout(enhanceAnalysePage,30)
}).observe(document.getElementById('app'),{childList:true,subtree:true})

enhanceAnalysePage()
