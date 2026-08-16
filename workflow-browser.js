import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase=createClient('https://msmpigerejpxepkylkxz.supabase.co','sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const $=(s,r=document)=>r.querySelector(s)
const $$=(s,r=document)=>[...r.querySelectorAll(s)]
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const arr=v=>Array.isArray(v)?v:[]
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{}
const money=v=>v===null||v===undefined||v===''||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))

const stepNames={
  capture_listing:'Capture listing',verify_listing:'Verify details',analyse_deal:'Analyse deal',ask_seller:'Ask seller',review_seller_reply:'Review reply',negotiate:'Negotiate',arrange_transaction:'Arrange purchase',inspect_before_buy:'Inspect before buying',record_purchase:'Record purchase',prepare_item:'Prepare item',create_listing:'Create listing',publish_listing:'Publish listing',manage_offers:'Manage offers',complete_sale:'Agree sale',fulfil_order:'Fulfil order',confirm_delivery:'Confirm delivery',confirm_funds:'Receive funds',feedback_and_close:'Close flip'
}
const icon={
  left:'<path d="m15 18-6-6 6-6"/>',right:'<path d="m9 18 6-6-6-6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',refresh:'<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6 8a7 7 0 0 1 12-2l2 6M18 16a7 7 0 0 1-12 2l-2-6"/>'
}
const svg=(n,s=16)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[n]||''}</svg>`

const cache={bundle:null,catalog:null,loadedAt:0}
let applying=false,timer=null
function toast(message){$('.workflow-browser-toast')?.remove();const el=document.createElement('div');el.className='workflow-browser-toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2400)}

async function sessionUser(){const {data}=await supabase.auth.getSession();return data.session?.user||null}
async function load(force=false){
  const user=await sessionUser();if(!user)return null
  if(!force&&cache.bundle&&Date.now()-cache.loadedAt<5000)return cache
  const [{data:bundle,error},{data:catalog}]=await Promise.all([
    supabase.functions.invoke('workflow-state',{method:'GET'}),
    cache.catalog?Promise.resolve({data:cache.catalog}):supabase.from('flip_step_catalog').select('*').order('step_order')
  ])
  if(error||bundle?.error)return null
  cache.bundle=bundle;cache.catalog=catalog||cache.catalog||[];cache.loadedAt=Date.now();return cache
}

function cardTitle(card){
  const section=card.closest('.section-block')
  return $('.section-heading h2',section)?.textContent?.trim()||$('.page-head h1')?.textContent?.trim()||''
}
function cardOrder(card){return Number($('.stage-pill',card)?.textContent?.match(/Step\s+(\d+)/i)?.[1]||0)}
function matchWorkflow(card,bundle){
  const order=cardOrder(card),title=cardTitle(card).toLowerCase()
  const requested=new URLSearchParams(location.search).get('workflow')
  if(requested){const exact=arr(bundle.workflows).find(w=>w.id===requested);if(exact)return exact}
  const candidates=arr(bundle.workflows).filter(w=>Number(w.current_step_order)===order)
  return candidates.find(w=>String(w.opportunities?.listing_title||w.latest_analysis?.identified_name||'').trim().toLowerCase()===title)||candidates[0]||bundle.primary_workflow||null
}
function catalogStep(key){return arr(cache.catalog).find(x=>x.step_key===key)||{}}
function instructionFor(step,profile){
  const g=profile?.guidance_level||'teach'
  return g==='fast'?(step.fast_label||step.assist_instruction||step.teach_instruction):g==='assist'?(step.assist_instruction||step.teach_instruction):(step.teach_instruction||step.assist_instruction||step.fast_label)||''
}
function field(label,value,full=false){if(value===null||value===undefined||String(value).trim()==='')return'';return `<div class="workflow-saved-field ${full?'full':''}"><span>${esc(label)}</span>${String(value).length>120||String(value).includes('\n')?`<p>${esc(value)}</p>`:`<strong>${esc(value)}</strong>`}</div>`}
function savedShell(fields){return `<div class="workflow-saved"><div class="workflow-saved-title">Saved information</div><div class="workflow-saved-grid">${fields.filter(Boolean).join('')}</div></div>`}

async function messageFor(w,direction){const {data}=await supabase.from('deal_messages').select('*').eq('workflow_id',w.id).eq('direction',direction).order('created_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function salePlanFor(w){const id=w.inventory_item_id||w.inventory_items?.id;if(!id)return null;const {data}=await supabase.from('sale_plans').select('*').eq('inventory_item_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function saleListingFor(w){const id=w.inventory_item_id||w.inventory_items?.id;if(!id)return null;const {data}=await supabase.from('sale_listings').select('*').eq('inventory_item_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function fulfilmentFor(w){const {data}=await supabase.from('fulfilments').select('*').eq('workflow_id',w.id).order('created_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function feedbackFor(w){const {data}=await supabase.from('feedback_records').select('*').eq('workflow_id',w.id).order('created_at',{ascending:false}).limit(1).maybeSingle();return data||null}

async function summaryFor(p,w){
  const k=p.step_key,d=obj(p.step_data),o=w.opportunities||{},a=w.latest_analysis||{},i=w.inventory_items||{},s=w.sales||{}
  if(k==='capture_listing')return savedShell([field('Marketplace',o.source_platform),field('Listing URL',o.source_url,true),field('Captured listing details',o.listing_text,true)])
  if(k==='verify_listing')return savedShell([field('Item title',o.listing_title),field('Asking price',money(o.seller_asking_price)),field('Location',o.listing_location)])
  if(k==='analyse_deal')return savedShell([field('Recommendation',String(a.recommendation||'').replaceAll('_',' ')),field('Score',a.overall_score!=null?`${Math.round(Number(a.overall_score))}/100`:''),field('Resale estimate',money(a.resale_mid)),field('Expected profit',money(a.expected_profit)),field('Max buy',money(a.max_buy)),field('Analysis summary',a.action_summary||a.next_action,true)])
  if(k==='ask_seller'){const m=await messageFor(w,'outbound');return savedShell([field('Message sent',m?.body||arr(a.questions_to_ask).join('\n'),true)])}
  if(k==='review_seller_reply'){const m=await messageFor(w,'inbound');return savedShell([field('Seller reply',m?.body||d.seller_reply,true)])}
  if(k==='negotiate')return savedShell([field('Opening offer',money(a.recommended_offer)),field('Hard maximum',money(a.max_buy)),field('Negotiation notes',d.notes,true),field('Agreed price',d.agreed_price?money(d.agreed_price):'')])
  if(k==='arrange_transaction')return savedShell([field('Method',d.method),field('Arrangement details',d.details,true)])
  if(k==='inspect_before_buy')return savedShell([field('Inspection',d.inspection_passed?'Passed':'Completed'),field('Notes',d.notes,true)])
  if(k==='record_purchase')return savedShell([field('Item',i.title),field('Purchase price',money(i.purchase_price)),field('Acquisition costs',money(i.acquisition_costs)),field('Category',i.category)])
  if(k==='prepare_item'||k==='create_listing'){const plan=await salePlanFor(w);const copy=obj(plan?.listing_copy);return savedShell([field('Recommended platform',plan?.recommended_platform),field('Listing title',copy.title,true),field('Listing description',copy.description,true),field('Preparation checklist',arr(plan?.preparation_checklist).join('\n'),true)])}
  if(k==='publish_listing'){const l=await saleListingFor(w);return savedShell([field('Platform',l?.platform),field('Listed price',money(l?.listing_price)),field('Minimum',money(l?.minimum_price)),field('Listing URL',l?.listing_url,true)])}
  if(k==='manage_offers'){const id=w.inventory_item_id||i.id;const {count}=await supabase.from('offer_events').select('*',{count:'exact',head:true}).eq('inventory_item_id',id);return savedShell([field('Offers recorded',count??0),field('Outcome',d.offer_process_complete?'Completed':'Reviewed')])}
  if(k==='complete_sale')return savedShell([field('Platform',s.platform),field('Sale price',money(s.sale_price)),field('Selling fees',money(s.selling_fees)),field('Shipping',money(s.shipping_cost)),field('Other costs',money(s.other_costs))])
  if(k==='fulfil_order'||k==='confirm_delivery'){const f=await fulfilmentFor(w);return savedShell([field('Method',f?.method),field('Status',f?.status),field('Carrier',f?.carrier),field('Tracking',f?.tracking_number),field('Notes',f?.notes,true)])}
  if(k==='confirm_funds')return savedShell([field('Payout received',money(s.payout_amount)),field('Payment status',s.payment_status),field('Received at',s.funds_received_at?new Date(s.funds_received_at).toLocaleString('en-AU'):'')])
  if(k==='feedback_and_close'){const f=await feedbackFor(w);return savedShell([field('Rating',f?.rating),field('Review / notes',f?.review_text,true)])}
  return savedShell(Object.entries(d).map(([key,value])=>field(key.replaceAll('_',' '),typeof value==='object'?JSON.stringify(value):value,true)))
}

function canEdit(key){return ['capture_listing','verify_listing','ask_seller','review_seller_reply','negotiate','arrange_transaction','inspect_before_buy','prepare_item','create_listing','publish_listing','fulfil_order','confirm_delivery','feedback_and_close'].includes(key)}
function financialSource(key){return ['record_purchase','complete_sale','confirm_funds'].includes(key)}

async function renderPreview(card,w,order){
  const p=arr(w.progress).find(x=>Number(x.step_order)===order);if(!p)return
  card.dataset.browserOrder=String(order)
  const current=Number(w.current_step_order)
  const controls=$('.workflow-browser-controls',card)
  if(controls){$('.workflow-browser-position',controls).textContent=`${order} / 18`;$('.prev-step',controls).disabled=order<=1;$('.next-step',controls).disabled=order>=18}
  $('.workflow-step-preview',card)?.remove()
  if(order===current){card.classList.remove('browser-browsing');return}
  card.classList.add('browser-browsing')
  const catalog=catalogStep(p.step_key),future=order>current
  const preview=document.createElement('section');preview.className='workflow-step-preview'
  const instruction=instructionFor(catalog,cache.bundle?.profile)
  preview.innerHTML=`<div class="workflow-preview-head"><div><div class="workflow-preview-kicker"><span class="eyebrow">STEP ${order} OF 18</span><span class="workflow-preview-state ${future?'future':'completed'}">${future?'Upcoming':'Completed'}</span></div><h3>${esc(catalog.title||stepNames[p.step_key]||p.step_key)}</h3><p>${esc(instruction)}</p></div></div>${future?`<div class="workflow-preview-locked">${svg('lock',19)}<div><strong>Preview only</strong><p>You can look ahead now, but this step stays locked until the preceding steps are completed.</p></div></div>`:await summaryFor(p,w)}${future?'':`<div class="workflow-preview-actions">${canEdit(p.step_key)?`<button class="button secondary" data-edit-step="${esc(p.step_key)}">${svg('edit',14)} Edit saved step</button>`:''}${financialSource(p.step_key)?`<button class="button secondary" data-financial-source="${esc(p.step_key)}">Open source record</button><span class="workflow-edit-note">Financial steps are edited at their source so your ledger stays consistent.</span>`:''}</div>`}`
  $('.progress-track',card)?.insertAdjacentElement('afterend',preview)
  $('[data-edit-step]',preview)?.addEventListener('click',()=>openEditor(w,p,card))
  $('[data-financial-source]',preview)?.addEventListener('click',e=>{const key=e.currentTarget.dataset.financialSource;const nav=key==='confirm_funds'?'capital':'inventory';$(`[data-nav="${nav}"]`)?.click()})
}

async function updateProgress(p,data){await supabase.from('flip_step_progress').update({step_data:{...obj(p.step_data),...data},updated_at:new Date().toISOString()}).eq('id',p.id)}
function modalShell(title,copy,body){
  $('.workflow-review-modal')?.remove();const wrap=document.createElement('div');wrap.className='workflow-review-modal';wrap.innerHTML=`<div class="workflow-review-backdrop"></div><div class="workflow-review-card"><button class="workflow-review-close" aria-label="Close">×</button><span class="eyebrow">EDIT COMPLETED STEP</span><h2>${esc(title)}</h2><p>${esc(copy)}</p>${body}</div>`;document.body.appendChild(wrap);$('.workflow-review-backdrop',wrap).onclick=()=>wrap.remove();$('.workflow-review-close',wrap).onclick=()=>wrap.remove();return wrap
}
async function loadImageData(opportunityId){const {data:media}=await supabase.from('opportunity_media').select('storage_path,media_type,created_at').eq('opportunity_id',opportunityId).order('created_at',{ascending:false}).limit(12);const sorted=arr(media).sort((a,b)=>(a.media_type==='seller_reply_image'?0:1)-(b.media_type==='seller_reply_image'?0:1)).slice(0,6),out=[];for(const m of sorted){const {data}=await supabase.storage.from('listing-media').download(m.storage_path);if(!data)continue;out.push(await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(data)}))}return out}
async function reanalyse(w){
  const o=w.opportunities||{},profile=cache.bundle?.profile||{},portfolio=cache.bundle?.portfolio||{},images=await loadImageData(w.opportunity_id)
  const body={listing_url:o.source_url||'',listing_text:o.listing_text||'',platform_fields:{asking_price:o.seller_asking_price,currency:o.currency||'AUD',asking_price_verified:o.seller_asking_price!=null,asking_price_confidence:o.seller_asking_price!=null?1:0,listing_title:o.listing_title,listing_location:o.listing_location,seller_name:o.seller_name,seller_rating:o.seller_rating,seller_review_count:o.seller_review_count},user_overrides:{asking_price:o.seller_asking_price,currency:o.currency||'AUD'},prior_analysis_summary:w.latest_analysis?.id?JSON.stringify({identified_name:w.latest_analysis.identified_name,recommendation:w.latest_analysis.recommendation,resale_mid:w.latest_analysis.resale_mid,max_buy:w.latest_analysis.max_buy,risks:w.latest_analysis.risks}):'',bankroll:Number(portfolio.available_cash||0),risk_profile:profile.risk_profile||'conservative',reserve_percent:Number(profile.capital_reserve_percent??30),max_exposure_percent:Number(profile.max_single_item_exposure_percent??20),portfolio_context:portfolio,images}
  const {data,error}=await supabase.functions.invoke('analyse-listing-v2',{body});if(error||data?.error)throw new Error(error?.message||data?.error||'Reanalysis failed')
  const x=data.analysis||{},user=(await sessionUser())
  const rec={opportunity_id:w.opportunity_id,user_id:user.id,engine_version:data.engine_version||'flippers-alpha-4-price-lock',identified_name:x.identified_name||'',brand:x.brand||'',model:x.model||'',variant:x.variant||'',category:x.category||'',identification_confidence:x.identification_confidence??0,resale_low:x.resale_low,resale_mid:x.resale_mid,resale_high:x.resale_high,quick_sale_value:x.quick_sale_value,sell_time_low_days:x.sell_time_low_days,sell_time_mid_days:x.sell_time_mid_days,sell_time_high_days:x.sell_time_high_days,valuation_confidence:x.valuation_confidence??0,overall_score:x.overall_score??0,overall_risk:x.overall_risk??0,recommendation:x.recommendation,recommended_offer:x.recommended_offer,max_buy:x.max_buy,break_even_sale_price:x.break_even_sale_price,expected_selling_costs:x.expected_selling_costs,expected_profit:x.expected_profit,expected_roi_percent:x.expected_roi_percent,quick_sale_profit:x.quick_sale_profit,next_action:x.next_action,questions_to_ask:x.questions_to_ask||[],inspection_checks:x.inspection_checks||[],risks:x.risks||{},assumptions:x.assumptions||[],evidence_summary:x.evidence_summary||'',raw_model_output:x,action_summary:x.action_summary||'',action_steps:x.action_steps||[],action_cautions:x.action_cautions||[],seller_message:x.seller_message||'',photo_findings:x.photo_findings||[],photo_count:images.length,user_overrides:{asking_price:o.seller_asking_price},seller_confidence:x.seller_confidence??null,seller_confidence_label:x.seller_confidence_label??null,seller_confidence_reason:x.seller_confidence_reason??null,seller_signals:x.seller_signals||{},overall_confidence:x.overall_confidence??null}
  const {data:saved,error:saveError}=await supabase.from('analyses').insert(rec).select('id').single();if(saveError)throw saveError
  if(arr(x.evidence).length)await supabase.from('evidence').insert(arr(x.evidence).map(e=>({analysis_id:saved.id,user_id:user.id,evidence_type:e.evidence_type,evidence_class:e.evidence_class||'estimated',marketplace:e.marketplace||null,source_title:e.source_title||null,source_url:e.source_url||null,price:e.price??null,currency:e.currency||'AUD',sold:e.sold??null,condition_text:e.condition_text||null,similarity_score:e.similarity_score??null,match_quality:e.match_quality||null,included:e.included!==false,rejection_reason:e.rejection_reason||null,metadata:{}})))
  const status=x.recommendation==='skip'?'skipped':x.recommendation==='verify_first'?'verify':x.recommendation==='negotiate'?'negotiating':'ready';await supabase.from('opportunities').update({status,updated_at:new Date().toISOString()}).eq('id',w.opportunity_id)
}

async function openEditor(w,p,card){
  const k=p.step_key,o=w.opportunities||{},d=obj(p.step_data),title=stepNames[k]||k
  let body='',bind=null
  if(k==='capture_listing'){
    body=`<form id="reviewEdit" class="form-stack"><label>Marketplace URL<input name="url" value="${esc(o.source_url||'')}"></label><label>Listing text / captured details<textarea class="tall-text" name="text">${esc(o.listing_text||'')}</textarea></label><div class="review-warning">Changing the listing evidence can change the deal recommendation. FlippersAI will refresh the analysis automatically if this deal has already been analysed.</div><button class="button primary">Save changes</button></form>`
    bind=async f=>{await supabase.from('opportunities').update({source_url:f.get('url')||null,listing_text:f.get('text')||null,updated_at:new Date().toISOString()}).eq('id',w.opportunity_id);await updateProgress(p,{revised:true,revised_at:new Date().toISOString()});if(w.latest_analysis)await reanalyse({...w,opportunities:{...o,source_url:f.get('url')||null,listing_text:f.get('text')||null}})}
  }else if(k==='verify_listing'){
    body=`<form id="reviewEdit" class="form-stack"><div class="form-grid"><label>Item title<input name="title" value="${esc(o.listing_title||'')}"></label><label>Asking price (AUD)<input name="price" type="number" min="0" step="0.01" value="${o.seller_asking_price??''}" required></label></div><label>Location<input name="location" value="${esc(o.listing_location||'')}"></label><div class="review-warning">Because price and identity affect the economics, FlippersAI will refresh the analysis after saving.</div><button class="button primary">Save & refresh analysis</button></form>`
    bind=async f=>{const price=Number(f.get('price')),next={...o,listing_title:f.get('title')||null,seller_asking_price:price,listing_location:f.get('location')||null,user_overrides:{asking_price:price}};await supabase.from('opportunities').update({listing_title:next.listing_title,seller_asking_price:price,listing_location:next.listing_location,user_overrides:{asking_price:price},updated_at:new Date().toISOString()}).eq('id',w.opportunity_id);await updateProgress(p,{asking_price:price,verified:true,revised:true,revised_at:new Date().toISOString()});if(w.latest_analysis)await reanalyse({...w,opportunities:next})}
  }else if(k==='ask_seller'||k==='review_seller_reply'){
    const direction=k==='ask_seller'?'outbound':'inbound',m=await messageFor(w,direction),fallback=k==='ask_seller'?arr(w.latest_analysis?.questions_to_ask).join('\n'):d.seller_reply||''
    body=`<form id="reviewEdit" class="form-stack"><label>${k==='ask_seller'?'Seller message':'Seller reply'}<textarea class="tall-text" name="body">${esc(m?.body||fallback)}</textarea></label><div class="review-info">This updates the saved conversation record without moving your workflow backwards.</div><button class="button primary">Save message</button></form>`
    bind=async f=>{const value=String(f.get('body')||'').trim();if(m?.id)await supabase.from('deal_messages').update({body:value}).eq('id',m.id);else{const user=await sessionUser();await supabase.from('deal_messages').insert({user_id:user.id,workflow_id:w.id,direction,counterparty_role:'seller',phase:'pre_purchase',body:value,source:'revised_history'})}await updateProgress(p,{revised:true,revised_at:new Date().toISOString()})}
  }else if(k==='negotiate'){
    body=`<form id="reviewEdit" class="form-stack"><label>Agreed / latest price<input name="price" type="number" min="0" step="0.01" value="${d.agreed_price??''}"></label><label>Negotiation notes<textarea name="notes">${esc(d.notes||'')}</textarea></label><button class="button primary">Save notes</button></form>`;bind=async f=>updateProgress(p,{agreed_price:f.get('price')?Number(f.get('price')):null,notes:f.get('notes')||'',revised:true})
  }else if(k==='arrange_transaction'){
    body=`<form id="reviewEdit" class="form-stack"><label>Method<select name="method"><option value="pickup" ${d.method==='pickup'?'selected':''}>Local pickup</option><option value="shipping" ${d.method==='shipping'?'selected':''}>Shipping</option></select></label><label>Arrangement details<textarea name="details">${esc(d.details||'')}</textarea></label><button class="button primary">Save arrangement</button></form>`;bind=async f=>updateProgress(p,{method:f.get('method'),details:f.get('details')||'',revised:true})
  }else if(k==='inspect_before_buy'){
    body=`<form id="reviewEdit" class="form-stack"><label class="checkbox-row"><input name="passed" type="checkbox" ${d.inspection_passed!==false?'checked':''}><span>Inspection passed</span></label><label>Inspection notes<textarea name="notes">${esc(d.notes||'')}</textarea></label><button class="button primary">Save inspection</button></form>`;bind=async f=>updateProgress(p,{inspection_passed:f.get('passed')==='on',notes:f.get('notes')||'',revised:true})
  }else if(k==='prepare_item'||k==='create_listing'){
    const plan=await salePlanFor(w),copy=obj(plan?.listing_copy)
    if(!plan)return toast('No saved sale plan found.')
    body=k==='prepare_item'?`<form id="reviewEdit" class="form-stack"><label>Preparation checklist <small>one item per line</small><textarea class="tall-text" name="checklist">${esc(arr(plan.preparation_checklist).join('\n'))}</textarea></label><button class="button primary">Save checklist</button></form>`:`<form id="reviewEdit" class="form-stack"><label>Listing title<textarea name="title">${esc(copy.title||'')}</textarea></label><label>Listing description<textarea class="tall-text" name="description">${esc(copy.description||'')}</textarea></label><button class="button primary">Save listing copy</button></form>`
    bind=async f=>{if(k==='prepare_item')await supabase.from('sale_plans').update({preparation_checklist:String(f.get('checklist')||'').split('\n').map(x=>x.trim()).filter(Boolean)}).eq('id',plan.id);else await supabase.from('sale_plans').update({listing_copy:{...copy,title:f.get('title')||'',description:f.get('description')||''}}).eq('id',plan.id);await updateProgress(p,{revised:true})}
  }else if(k==='publish_listing'){
    const l=await saleListingFor(w);if(!l)return toast('No saved listing record found.')
    body=`<form id="reviewEdit" class="form-stack"><div class="form-grid"><label>Platform<input name="platform" value="${esc(l.platform||'')}"></label><label>Listed price<input name="price" type="number" min="0" step="0.01" value="${l.listing_price??''}"></label></div><label>Minimum acceptable<input name="minimum" type="number" min="0" step="0.01" value="${l.minimum_price??''}"></label><label>Listing URL<input name="url" value="${esc(l.listing_url||'')}"></label><button class="button primary">Save listing record</button></form>`;bind=async f=>{await supabase.from('sale_listings').update({platform:f.get('platform')||l.platform,listing_price:f.get('price')?Number(f.get('price')):l.listing_price,minimum_price:f.get('minimum')?Number(f.get('minimum')):null,listing_url:f.get('url')||null,updated_at:new Date().toISOString()}).eq('id',l.id);await updateProgress(p,{revised:true})}
  }else if(k==='fulfil_order'||k==='confirm_delivery'){
    const f0=await fulfilmentFor(w);if(!f0)return toast('No fulfilment record found.')
    body=`<form id="reviewEdit" class="form-stack"><div class="form-grid"><label>Carrier<input name="carrier" value="${esc(f0.carrier||'')}"></label><label>Tracking number<input name="tracking" value="${esc(f0.tracking_number||'')}"></label></div><label>Notes<textarea name="notes">${esc(f0.notes||'')}</textarea></label><button class="button primary">Save fulfilment details</button></form>`;bind=async f=>{await supabase.from('fulfilments').update({carrier:f.get('carrier')||null,tracking_number:f.get('tracking')||null,notes:f.get('notes')||null,updated_at:new Date().toISOString()}).eq('id',f0.id);await updateProgress(p,{revised:true})}
  }else if(k==='feedback_and_close'){
    const f0=await feedbackFor(w),user=await sessionUser();body=`<form id="reviewEdit" class="form-stack"><label>Rating<input name="rating" type="number" min="1" max="5" step="0.1" value="${f0?.rating??''}"></label><label>Review / notes<textarea name="review">${esc(f0?.review_text||'')}</textarea></label><button class="button primary">Save feedback</button></form>`;bind=async f=>{const row={rating:f.get('rating')?Number(f.get('rating')):null,review_text:f.get('review')||null,updated_at:new Date().toISOString()};if(f0?.id)await supabase.from('feedback_records').update(row).eq('id',f0.id);else await supabase.from('feedback_records').insert({user_id:user.id,workflow_id:w.id,sale_id:w.sale_id,direction:'received',status:'completed',...row});await updateProgress(p,{revised:true})}
  }
  if(!body||!bind)return
  const wrap=modalShell(title,'Review and correct the information saved at this stage. The workflow itself stays at your current step.',body)
  $('#reviewEdit',wrap).onsubmit=async e=>{e.preventDefault();const button=$('button[type="submit"],button.button.primary',e.currentTarget);button.disabled=true;try{await bind(new FormData(e.currentTarget));wrap.remove();cache.bundle=null;await load(true);const refreshed=matchWorkflow(card,cache.bundle);await renderPreview(card,refreshed,Number(card.dataset.browserOrder||p.step_order));toast('Saved')}catch(err){toast(err.message||String(err));button.disabled=false}}
}

async function inject(card){
  if(card.dataset.browserEnhanced==='1')return
  const loaded=await load();if(!loaded)return
  const w=matchWorkflow(card,loaded.bundle);if(!w)return
  card.dataset.browserEnhanced='1';card.dataset.workflowId=w.id;card.dataset.browserOrder=String(w.current_step_order)
  const controls=document.createElement('div');controls.className='workflow-browser-controls';controls.innerHTML=`<button class="workflow-browser-arrow prev-step" aria-label="View previous step" title="Previous step">${svg('left')}</button><span class="workflow-browser-position">${w.current_step_order} / 18</span><button class="workflow-browser-arrow next-step" aria-label="View following step" title="Following step">${svg('right')}</button>`;card.appendChild(controls)
  const move=async delta=>{const latest=(await load())?.bundle;const wf=matchWorkflow(card,latest)||w;const current=Number(card.dataset.browserOrder||wf.current_step_order),next=Math.max(1,Math.min(18,current+delta));await renderPreview(card,wf,next)}
  $('.prev-step',controls).onclick=()=>move(-1);$('.next-step',controls).onclick=()=>move(1)
  await renderPreview(card,w,Number(w.current_step_order))
}

async function apply(){if(applying)return;applying=true;try{for(const card of $$('.workflow-card'))await inject(card)}finally{applying=false}}
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,80)}).observe(document.getElementById('app'),{childList:true,subtree:true})
apply()
