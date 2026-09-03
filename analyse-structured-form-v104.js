import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase=createClient('https://msmpigerejpxepkylkxz.supabase.co','sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $=(s,r=document)=>r.querySelector(s)
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const money=v=>v===null||v===undefined||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
const pct=v=>v===null||v===undefined||v===''||Number.isNaN(Number(v))?'—':`${Math.round(Number(v))}%`
let evidenceFiles=[]
let analysing=false
let extracting=false
let extractTimer=null

const toDataUrl=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)})
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null)
const recLabel=v=>({strong_buy:'Strong buy',buy:'Buy',negotiate:'Negotiate',verify_first:'Verify first',skip:'Skip'})[v]||String(v||'Analysed').replaceAll('_',' ')
const recClass=v=>['strong_buy','buy'].includes(v)?'good':['negotiate','verify_first'].includes(v)?'warn':v==='skip'?'bad':'neutral'

function injectStyles(){
 if($('#structuredAnalyseStyles'))return
 const s=document.createElement('style');s.id='structuredAnalyseStyles';s.textContent=`
 .manual-analyse-intro{padding:14px 16px;border:1px solid #d8e6ec;border-radius:14px;background:#f7fbfd}.manual-analyse-intro p{margin:5px 0 0;color:#607786}.manual-upload{display:flex;gap:14px;align-items:center;padding:22px;border:2px dashed #bdd5df;border-radius:15px;cursor:pointer;background:#fbfdfe}.manual-upload input{display:none}.manual-upload span{display:flex;flex-direction:column;gap:4px;flex:1}.manual-upload small{color:#6f8490}.manual-upload b{font-size:12px;color:#58717e}.manual-evidence-tray{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}.manual-evidence-empty{grid-column:1/-1;padding:12px;color:#78909c;text-align:center;border:1px dashed #d6e2e7;border-radius:12px}.manual-evidence-thumb{position:relative;border:1px solid #d7e3e8;border-radius:12px;overflow:hidden;background:#fff}.manual-evidence-thumb img{width:100%;height:105px;object-fit:cover;display:block}.manual-evidence-thumb button{position:absolute;right:6px;top:6px;width:26px;height:26px;border:0;border-radius:50%;background:rgba(12,27,36,.85);color:#fff;font-size:19px;cursor:pointer}.manual-evidence-thumb small{display:block;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.manual-upload.dragging{border-color:#f59e0b;background:#fff8e8}.field-section{padding:16px;border:1px solid #dce8ed;border-radius:15px;background:#fff}.field-section>h3{margin:0 0 12px;font-size:15px}.field-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field-grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.inline-check{display:flex;align-items:center;gap:9px}.inline-check input{width:auto}.auto-status{padding:11px 13px;border-radius:12px;background:#f6fafb;color:#607786;font-size:13px}.auto-status.good{background:#effaf5;color:#23735b}.auto-status.warn{background:#fff7e8;color:#936000}.auto-filled{box-shadow:inset 0 0 0 1px #b9ded0;background:#fbfffd}.price-row{display:grid;grid-template-columns:1.1fr .7fr 1.1fr;gap:12px}.description-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.description-grid textarea{min-height:150px}@media(max-width:800px){.field-grid-3,.field-grid-4,.price-row,.description-grid{grid-template-columns:1fr}}
 `;document.head.appendChild(s)
}

function formMarkup(){return `
 <div class="manual-analyse-intro"><strong>Give FlippersAI the listing evidence.</strong><p>Photos and screenshots will be read automatically. FlippersAI will pre-fill anything it can see, and you can edit every field before analysis.</p></div>
 <label class="manual-upload" id="manualDropZone"><input id="manualEvidenceInput" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple><span><strong>Drag & drop or choose listing screenshots/photos</strong><small>Include the listing page, product photos, labels/tags and visible flaws.</small><small id="manualDropStatus"></small></span><b id="manualEvidenceCount">0/10 images</b></label>
 <div id="manualEvidenceTray" class="manual-evidence-tray"></div>
 <div id="autoExtractStatus" class="auto-status">Add screenshots/photos and FlippersAI will automatically fill the form.</div>
 <div class="field-section"><h3>Listing source</h3><div class="form-grid"><label>Marketplace<select name="platform"><option value="">Select marketplace</option><option value="facebook">Facebook Marketplace</option><option value="depop">Depop</option><option value="ebay">eBay</option><option value="gumtree">Gumtree</option><option value="vinted">Vinted</option><option value="other">Other</option></select></label><label>Listing URL <small>optional</small><input name="url" placeholder="Optional reference only"></label></div></div>
 <div class="field-section"><h3>Item details</h3><label>Listing title<input name="title" placeholder="Exact listing title"></label><div class="field-grid-4"><label>Brand<input name="brand"></label><label>Model<input name="model"></label><label>Colour<input name="colour"></label><label>Condition<input name="condition" placeholder="Seller wording"></label></div><div class="form-grid"><label>Size<input name="size"></label><label>Size system<select name="size_system"><option value="">Not applicable / unknown</option><option value="US">US</option><option value="UK">UK</option><option value="EU">EU</option><option value="AU">AU</option><option value="other">Other</option></select></label></div></div>
 <div class="field-section"><h3>Price</h3><div class="price-row"><label>Current price<input name="price" type="number" min="0" step="0.01"></label><label>Currency<select name="currency"><option value="AUD">AUD</option><option value="USD">USD</option><option value="GBP">GBP</option></select></label><label>Original price <small>before discount</small><input name="original_price" type="number" min="0" step="0.01"></label></div><label class="inline-check"><input name="discounted" type="checkbox"><span>This item is on sale / discounted</span></label><label>Discount / sale note <small>optional</small><input name="discount_note" placeholder="e.g. reduced from $180, 30% off, clearance"></label></div>
 <div class="field-section"><h3>Seller & location</h3><div class="field-grid-4"><label>Seller name<input name="seller"></label><label>Seller rating<input name="seller_rating" type="number" min="0" max="5" step="0.1"></label><label>Seller review count<input name="seller_reviews" type="number" min="0" step="1"></label><label>Location<input name="location"></label></div></div>
 <div class="field-section"><h3>Listing text</h3><div class="description-grid"><label>Seller description<textarea name="description" placeholder="Paste the listing description exactly as written"></textarea></label><label>Extra information<textarea name="extra_info" placeholder="Seller bio, pickup/shipping notes, profile details, extra context, anything else you want FlippersAI to consider"></textarea></label></div></div>
 <div class="field-section"><h3>Other details</h3><div class="form-grid"><label>Included items / accessories<input name="included" placeholder="Box, charger, receipt, accessories…"></label><label>Known flaws / damage<input name="flaws" placeholder="Scratches, stains, missing parts…"></label></div><label>Pickup / shipping details<input name="fulfilment" placeholder="Pickup suburb, postage cost, shipping offered…"></label></div>
 <button class="button primary large-button">Analyse this opportunity ›</button>`}

function renderTray(){
 const tray=$('#manualEvidenceTray');if(!tray)return
 tray.innerHTML=evidenceFiles.length?evidenceFiles.map((f,i)=>`<div class="manual-evidence-thumb"><img data-preview="${i}" alt="Evidence ${i+1}"><button type="button" data-remove="${i}">×</button><small>${esc(f.name||`Image ${i+1}`)}</small></div>`).join(''):`<div class="manual-evidence-empty">No images added yet.</div>`
 evidenceFiles.forEach((f,i)=>{const img=tray.querySelector(`[data-preview="${i}"]`);if(!img)return;const u=URL.createObjectURL(f);img.src=u;img.onload=()=>URL.revokeObjectURL(u)})
 tray.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{evidenceFiles.splice(Number(b.dataset.remove),1);syncInput();renderTray()})
 const c=$('#manualEvidenceCount');if(c)c.textContent=`${evidenceFiles.length}/10 images`
}
function syncInput(){const input=$('#manualEvidenceInput');if(!input)return;const dt=new DataTransfer();evidenceFiles.forEach(f=>dt.items.add(f));input.files=dt.files}
function addFiles(files){for(const f of [...files]){if(!f.type?.startsWith('image/'))continue;if(evidenceFiles.length>=10)break;evidenceFiles.push(f)}syncInput();renderTray();scheduleExtraction()}

function setField(name,value){
 const el=$(`[name="${name}"]`);if(!el||value===null||value===undefined||value==='')return
 const previous=el.dataset.autoValue
 const safeToUpdate=!el.value||el.value===previous
 if(!safeToUpdate)return
 if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value)
 el.dataset.autoValue=el.type==='checkbox'?String(Boolean(value)):String(value);el.classList.add('auto-filled')
}

async function extractFromImages(){
 if(extracting||!evidenceFiles.length)return
 extracting=true;const status=$('#autoExtractStatus');if(status){status.className='auto-status';status.textContent='Reading screenshots and filling visible listing details…'}
 try{
  const images=[];for(const f of evidenceFiles.slice(0,10))images.push(await toDataUrl(f))
  const platform=String($('[name="platform"]')?.value||'')
  const{data,error}=await supabase.functions.invoke('listing-visual-extraction',{body:{images,platform}})
  if(error||data?.error)throw new Error(error?.message||data?.error||'Could not read screenshots')
  const x=data.extraction||{}
  setField('platform',({Facebook:'facebook','Facebook Marketplace':'facebook',Depop:'depop',eBay:'ebay',Gumtree:'gumtree',Vinted:'vinted'})[x.marketplace]||String(x.marketplace||'').toLowerCase())
  setField('title',x.listing_title);setField('brand',x.brand);setField('model',x.model);setField('colour',x.colour);setField('size',x.size);setField('size_system',x.size_system)
  setField('price',x.asking_price);setField('original_price',x.original_price);setField('currency',x.currency);setField('discounted',x.is_discounted);setField('discount_note',x.discount_text)
  setField('seller',x.seller_name);setField('seller_rating',x.seller_rating);setField('seller_reviews',x.seller_review_count);setField('location',x.listing_location);setField('condition',x.condition);setField('description',x.description);setField('extra_info',x.extra_info)
  const details=Array.isArray(x.visible_item_details)?x.visible_item_details.join('; '):'';if(details){const extra=$('[name="extra_info"]');if(extra&&!extra.value) setField('extra_info',details)}
  if(status){status.className='auto-status good';status.textContent=`Screenshots read. FlippersAI filled the visible fields${x.extraction_confidence!=null?` (${Math.round(Number(x.extraction_confidence)*100)}% extraction confidence)`:''}. Review and edit anything that looks wrong.`}
 }catch(e){if(status){status.className='auto-status warn';status.textContent=`Could not auto-fill these screenshots: ${e.message||e}. You can still enter the details manually.`}}finally{extracting=false}
}
function scheduleExtraction(){clearTimeout(extractTimer);extractTimer=setTimeout(extractFromImages,450)}

function listingText(f){
 const rows=[];const add=(label,name)=>{const v=String(f.get(name)||'').trim();if(v)rows.push(`${label}: ${v}`)}
 add('Seller description','description');add('Extra information','extra_info');add('Brand','brand');add('Model','model');add('Colour','colour');add('Condition','condition');add('Size','size');add('Size system','size_system');add('Original price','original_price');if(f.get('discounted')==='on')rows.push('Discounted/on sale: yes');add('Discount note','discount_note');add('Seller name','seller');add('Seller rating','seller_rating');add('Seller review count','seller_reviews');add('Location','location');add('Included items/accessories','included');add('Known flaws/damage','flaws');add('Pickup/shipping','fulfilment');return rows.join('\n')
}

function resultMarkup(payload){
 const x=payload.analysis||{},i=payload.input||{},rec=x.recommendation||'',success=x.success_potential??null,auth=x.authenticity_status||'',condition=x.condition_assessment||''
 const askOriginal=i.askingPrice!=null?`${i.currency} ${Number(i.askingPrice).toFixed(2)}`:'—'
 const converted=x.seller_asking_price!=null?money(x.seller_asking_price):'—'
 return `<section class="direct-analysis-result" id="directAnalysisResult"><div class="direct-analysis-result-head"><div><span class="eyebrow">ANALYSIS RESULT</span><h2>${esc(x.identified_name||i.title||'Listing analysis')}</h2><p>${esc(x.action_summary||x.next_action||'FlippersAI has analysed this opportunity.')}</p></div><div class="direct-analysis-score ${recClass(rec)}"><strong>${Math.round(Number(x.overall_score||0))}</strong><span>/100</span><small>${esc(recLabel(rec))}</small></div></div><div class="direct-analysis-metrics"><div><span>LISTED ASK</span><strong>${esc(askOriginal)}</strong><small>${i.currency==='AUD'?'':`≈ ${converted} used for AU economics`}</small></div><div><span>RESALE</span><strong>${money(x.resale_mid)}</strong><small>${money(x.resale_low)} – ${money(x.resale_high)}</small></div><div><span>PROFIT</span><strong>${money(x.expected_profit)}</strong></div><div><span>ROI</span><strong>${pct(x.expected_roi_percent)}</strong></div><div><span>SUCCESS POTENTIAL</span><strong>${success==null?'—':`${Math.round(Number(success))}/100`}</strong></div><div><span>MAX BUY</span><strong>${money(x.max_buy)}</strong></div></div><div class="direct-analysis-grid"><section class="direct-analysis-panel"><span>AUTHENTICITY</span><strong>${esc(String(auth||'Not established').replaceAll('_',' '))}</strong><p>${esc((x.authenticity_reasons||[]).join(' · '))}</p></section><section class="direct-analysis-panel"><span>CONDITION</span><strong>${esc(condition||'Not established')}</strong></section><section class="direct-analysis-panel"><span>VALUATION EVIDENCE</span><strong>${pct(x.valuation_confidence)} confidence</strong><p>${esc(x.evidence_summary||'')}</p></section></div>${Array.isArray(x.action_steps)&&x.action_steps.length?`<section class="direct-analysis-section"><span>WHAT TO DO NEXT</span><ul>${x.action_steps.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>`:''}${Array.isArray(x.photo_findings)&&x.photo_findings.length?`<section class="direct-analysis-section"><span>PHOTO FINDINGS</span><ul>${x.photo_findings.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>`:''}</section>`
}

async function runAnalysis(form){
 if(analysing)return
 const f=new FormData(form),askingPrice=finite(f.get('price')),currency=String(f.get('currency')||'AUD'),title=String(f.get('title')||'').trim(),text=listingText(f)
 if(!title&&!text&&!evidenceFiles.length)return alert('Add screenshots/photos or enter enough listing details for FlippersAI to identify the item.')
 analysing=true;const btn=form.querySelector('button[type="submit"],button:not([type])'),old=btn?.innerHTML;if(btn){btn.disabled=true;btn.textContent='Analysing…'}
 const card=$('.analyser-card');$('#directAnalysisResult')?.remove();card?.insertAdjacentHTML('afterend','<section class="direct-analysis-result direct-analysis-loading" id="directAnalysisResult"><div class="direct-analysis-spinner"></div><div><strong>Analysing this opportunity…</strong><p>Researching current resale evidence and calculating the economics.</p></div></section>')
 try{
  const images=[];for(const file of evidenceFiles.slice(0,10))images.push(await toDataUrl(file))
  const context=await (async()=>{try{const{data}=await supabase.functions.invoke('workflow-state',{method:'GET'});return data||{}}catch{return{}}})(),profile=context.profile||{},portfolio=context.portfolio||{}
  const variant=[f.get('model'),f.get('colour'),f.get('size')&&`${f.get('size_system')||''} ${f.get('size')}`].filter(Boolean).join(' · ')
  const body={listing_url:String(f.get('url')||''),listing_text:text,platform_fields:{asking_price:askingPrice,currency,asking_price_verified:askingPrice!=null,asking_price_confidence:askingPrice!=null?1:0,listing_title:title,brand:String(f.get('brand')||''),model:String(f.get('model')||''),variant,colour:String(f.get('colour')||''),size:String(f.get('size')||''),size_system:String(f.get('size_system')||''),listing_location:String(f.get('location')||''),seller_name:String(f.get('seller')||''),seller_rating:finite(f.get('seller_rating')),seller_review_count:finite(f.get('seller_reviews')),source_platform:String(f.get('platform')||''),condition:String(f.get('condition')||''),original_price:finite(f.get('original_price')),discounted:f.get('discounted')==='on',discount_note:String(f.get('discount_note')||'')},user_overrides:{asking_price:askingPrice,currency},seller_update:'',prior_analysis_summary:'',bankroll:Number(portfolio.available_cash||0),risk_profile:profile.risk_profile||'conservative',reserve_percent:Number(profile.capital_reserve_percent??30),max_exposure_percent:Number(profile.max_single_item_exposure_percent??20),portfolio_context:portfolio,images}
  const{data,error}=await supabase.functions.invoke('analyse-listing-v2',{body});if(error||data?.error)throw new Error(error?.message||data?.error||'Analysis failed')
  $('#directAnalysisResult')?.remove();card?.insertAdjacentHTML('afterend',resultMarkup({analysis:data.analysis||{},input:{title,askingPrice,currency}}))
 }catch(e){$('#directAnalysisResult')?.remove();card?.insertAdjacentHTML('afterend',`<section class="direct-analysis-result direct-analysis-error" id="directAnalysisResult"><strong>Analysis could not be completed</strong><p>${esc(e.message||e)}</p></section>`)}finally{analysing=false;if(btn){btn.disabled=false;btn.innerHTML=old||'Analyse this opportunity'}}
}

function enhance(){
 const form=$('#newDeal');if(!form||form.dataset.structured==='v104')return
 injectStyles();form.dataset.structured='v104';form.innerHTML=formMarkup();evidenceFiles=[];renderTray()
 const input=$('#manualEvidenceInput');input?.addEventListener('change',e=>addFiles(e.target.files))
 form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();runAnalysis(form)},true)
 form.addEventListener('input',e=>{const el=e.target;if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement){if(el.dataset.autoValue!==undefined&&el.value!==el.dataset.autoValue){delete el.dataset.autoValue;el.classList.remove('auto-filled')}}})
 const page=$('.page-head');if(page){const h=$('h1',page),p=$('p',page);if(h)h.textContent='Analyse a reselling opportunity';if(p)p.textContent='Add the listing evidence. FlippersAI will fill what it can see, then research the market and tell you whether the item is worth buying.'}
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,30)}).observe(document.getElementById('app'),{childList:true,subtree:true});enhance()
