import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase=createClient('https://msmpigerejpxepkylkxz.supabase.co','sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const app=document.querySelector('#app')
let files=[]

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money=v=>v===null||v===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct=v=>v===null||v===undefined?'—':`${Math.round(Number(v))}%`
const fileKey=f=>`${f.name}|${f.size}|${f.lastModified}`

function addFiles(list){
  const seen=new Set(files.map(fileKey))
  for(const f of [...list]) if(/^image\//i.test(f.type)&&!seen.has(fileKey(f))&&files.length<6){files.push(f);seen.add(fileKey(f))}
  renderThumbs()
}
function removeFile(i){files.splice(i,1);renderThumbs()}
function renderThumbs(){
  const wrap=document.querySelector('#thumbs'); if(!wrap)return
  wrap.innerHTML=files.map((f,i)=>`<div class="thumb"><img alt="Listing screenshot ${i+1}" src="${URL.createObjectURL(f)}"><button type="button" data-remove="${i}" aria-label="Remove screenshot ${i+1}">×</button></div>`).join('')
  wrap.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeFile(Number(b.dataset.remove)))
  const s=document.querySelector('#fileStatus'); if(s)s.textContent=files.length?`${files.length} screenshot${files.length===1?'':'s'} ready`:'Paste, drag or choose up to 6 screenshots'
}
const toDataUrl=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})

async function boot(){
  const {data}=await supabase.auth.getSession()
  if(!data.session) return renderAuth()
  renderTool(data.session)
}

function renderAuth(message=''){
  app.innerHTML=`<main class="shell"><section class="card auth"><div class="brand">🔥 FlippersAI Lite</div><h1>Sign in</h1><p>Prototype: one tool, one job — decide whether a listing is worth flipping.</p>${message?`<div class="error">${esc(message)}</div>`:''}<form id="auth"><label class="field"><span>Email</span><input name="email" type="email" required></label><label class="field"><span>Password</span><input name="password" type="password" required></label><button class="primary">Sign in</button></form></section></main>`
  document.querySelector('#auth').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});if(error)return renderAuth(error.message);boot()}
}

function renderTool(session){
  app.innerHTML=`<main class="shell"><header class="top"><div class="brand">🔥 FlippersAI</div><div><span class="badge">Lite prototype</span> <button id="signout" type="button">Sign out</button></div></header><section class="hero"><h1>Should I buy this to resell?</h1><p>Give FlippersAI the listing. It identifies the item, researches the market and tells you what to do.</p></section><section class="card"><form id="dealForm"><div class="grid"><label class="field"><span>Listing URL <em>(optional)</em></span><input name="url" type="url" placeholder="Paste marketplace link"></label><label class="field"><span>Anything else you know <em>(optional)</em></span><input name="note" placeholder="e.g. seller wants $95, size 13"></label></div><div class="field" style="margin-top:14px"><span>Screenshots</span><label class="drop" id="drop"><strong>Paste with Cmd/Ctrl+V, drag & drop, or click to choose</strong><small id="fileStatus">Paste, drag or choose up to 6 screenshots</small><input id="images" type="file" accept="image/*" multiple hidden></label><div class="thumbs" id="thumbs"></div></div><div class="actions"><button class="primary" id="analyse">Analyse deal</button><span class="status" id="status">No reselling knowledge required.</span></div></form><div id="error"></div></section><section id="result"></section></main>`
  document.querySelector('#signout').onclick=async()=>{await supabase.auth.signOut();files=[];renderAuth()}
  const input=document.querySelector('#images'),drop=document.querySelector('#drop')
  drop.onclick=()=>input.click();input.onchange=()=>addFiles(input.files)
  ;['dragover','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();if(t==='drop')addFiles(e.dataTransfer.files)}))
  document.addEventListener('paste',e=>{const imgs=[...(e.clipboardData?.items||[])].filter(x=>x.kind==='file'&&/^image\//i.test(x.type)).map(x=>x.getAsFile()).filter(Boolean);if(imgs.length){e.preventDefault();addFiles(imgs)}})
  renderThumbs()
  document.querySelector('#dealForm').onsubmit=e=>submitDeal(e,session)
}

async function submitDeal(e,session){
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),url=String(fd.get('url')||'').trim(),note=String(fd.get('note')||'').trim()
  if(!url&&!note&&!files.length)return showError('Add at least one screenshot, URL or note.')
  const button=document.querySelector('#analyse'),status=document.querySelector('#status');button.disabled=true;status.textContent='Identifying item and researching current market…';showError('')
  try{
    const images=[];for(const f of files)images.push(await toDataUrl(f))
    const {data,error}=await supabase.functions.invoke('analyse-lite-v1',{body:{listing_url:url,note,images}})
    if(error||data?.error)throw new Error(data?.detail||data?.error||error?.message||'Analysis failed')
    renderResult(data);status.textContent='Analysis complete.'
  }catch(err){showError(err.message||String(err));status.textContent='Could not complete analysis.'}
  finally{button.disabled=false}
}

function showError(msg){const el=document.querySelector('#error');if(el)el.innerHTML=msg?`<div class="error">${esc(msg)}</div>`:''}
function renderResult(data){
  const a=data.analysis||{},e=data.economics||{},comps=Array.isArray(a.comps)?a.comps:[]
  document.querySelector('#result').innerHTML=`<section class="card result"><h2>${esc(a.item_name||'Item')}</h2><span class="verdict">${esc((a.verdict||'').replace('_',' '))}</span><div class="metrics"><div class="metric"><small>Ask</small><strong>${money(e.asking_price)}</strong></div><div class="metric"><small>Expected resale</small><strong>${money(e.expected_resale_value)}</strong></div><div class="metric"><small>Profit</small><strong>${money(e.expected_profit)}</strong></div><div class="metric"><small>ROI</small><strong>${pct(e.expected_roi_percent)}</strong></div><div class="metric"><small>Max buy</small><strong>${money(e.max_buy)}</strong></div></div><div class="two"><div class="section"><h3>Why</h3><p>${esc(a.verdict_reason||'')}</p></div><div class="section"><h3>Next action</h3><p>${esc(a.next_action||'')}</p></div><div class="section"><h3>Condition</h3><p>${esc(a.condition_summary||'')} · ${Math.round(Number(a.condition_score||0))}/100</p></div><div class="section"><h3>Authenticity</h3><p>${esc((a.authenticity_status||'').replaceAll('_',' '))}${a.authenticity_reasons?.length?` — ${esc(a.authenticity_reasons.join('; '))}`:''}</p></div><div class="section"><h3>Sellability</h3><p>${Math.round(Number(a.sellability_score||0))}/100${a.sell_time_days?` · about ${a.sell_time_days} days`:''}</p></div><div class="section"><h3>Quick-sale value</h3><p>${money(e.quick_sale_value)}</p></div></div><div class="section"><h3>Market evidence</h3>${comps.length?comps.map(c=>`<div class="comp"><strong>${esc(c.source)} · ${money(c.price_aud)}</strong> · ${c.sold?'sold':'active'} · ${esc(c.match_quality)}<br><small>${esc(c.notes||c.condition||'')}</small>${c.url?`<br><a href="${esc(c.url)}" target="_blank" rel="noopener">Open source</a>`:''}</div>`).join(''):'<p>No strong market evidence was returned.</p>'}</div>${a.seller_message?`<div class="section"><h3>Message seller</h3><p>${esc(a.seller_message)}</p></div>`:''}</section>`
  document.querySelector('#result').scrollIntoView({behavior:'smooth',block:'start'})
}

boot()
