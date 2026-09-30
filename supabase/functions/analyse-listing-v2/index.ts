import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}
const num=(v:any)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
const clean=(v:any,max=900)=>String(v??'').trim().slice(0,max)
const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v))

// Every analysis spends real money on an API key Ben pays for, so each signed-in user gets a
// generous daily allowance rather than an unlimited one. 25 full analyses a day is far more
// than anyone actually flips; it exists to stop one stranger running thousands overnight.
// Fails OPEN: if the counter itself is unavailable the analysis still runs, because breaking
// the product to protect the budget is the wrong trade for a paying user.
const DAILY_ANALYSES = 25
async function claimUsage(base:string,headers:Record<string,string>,kind:string,limit:number){
  try{
    const r=await fetch(`${base}/rest/v1/rpc/claim_usage`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_kind:kind,p_limit:limit})})
    if(!r.ok)return{allowed:true,unavailable:true}
    const j=await r.json()
    return j&&typeof j==='object'?j:{allowed:true,unavailable:true}
  }catch{return{allowed:true,unavailable:true}}
}

async function invoke(base:string,slug:string,headers:Record<string,string>,body:any,timeoutMs:number){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(`${base}/functions/v1/${slug}`,{method:'POST',headers,body:JSON.stringify(body),signal:c.signal});const raw=await r.text();let p:any={};try{p=raw?JSON.parse(raw):{}}catch{p={error:raw}};return{response:r,payload:p}}finally{clearTimeout(t)}}
async function toAud(amount:number,currency:string){const c=currency.toUpperCase();if(c==='AUD')return{aud:amount,rate:1};if(!['USD','GBP'].includes(c))throw new Error(`Unsupported currency ${c}`);const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),5000);try{const r=await fetch(`https://api.frankfurter.app/latest?from=${c}&to=AUD`,{signal:ctl.signal});if(!r.ok)throw new Error(`FX ${r.status}`);const j=await r.json();const rate=num(j?.rates?.AUD);if(!rate)throw new Error('FX unavailable');return{aud:+(amount*rate).toFixed(2),rate}}finally{clearTimeout(t)}}
function shippingFromText(text:string,currency='AUD'){const s=String(text||'');if(/\bfree\s+(shipping|postage|delivery)\b/i.test(s)||/\b(pickup|pick-up|collection)\s+only\b/i.test(s))return{amount:0,currency};const pats=[/(?:\+\s*)?(A\$|AUD\s*\$?|US\$|USD\s*\$?|£|GBP\s*|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(shipping|postage|delivery)\b/i,/\b(shipping|postage|delivery)\s*(?:cost)?\s*[:\-]?\s*(A\$|AUD\s*\$?|US\$|USD\s*\$?|£|GBP\s*|\$)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i];for(let i=0;i<pats.length;i++){const m=s.match(pats[i]);if(!m)continue;const token=(i===0?m[1]:m[2])||'';const amount=num(i===0?m[2]:m[3]);if(amount===null)continue;let cur=currency;if(/US\$|USD/i.test(token))cur='USD';else if(/£|GBP/i.test(token))cur='GBP';else if(/A\$|AUD/i.test(token))cur='AUD';return{amount,currency:cur}}return null}

// Measure the real eBay AU market before the decision engine runs, so the analysis is
// anchored to counted live listings rather than to whatever a model remembers. Best-effort:
// if eBay is slow, unconfigured or has too few comparable listings, the analysis proceeds
// exactly as before rather than failing.
function compsQuery(p:any){
  const parts=[clean(p.brand,60),clean(p.model,80),clean(p.variant,80)].filter(Boolean)
  const built=parts.join(' ').trim()
  // Brand+model beats a seller's title ("Nike Men's Black Trainers" names no model at all),
  // but a title is better than nothing.
  if(built.length>=6)return built.slice(0,120)
  return clean(p.listing_title,120)
}
async function ebayMarket(base:string,headers:Record<string,string>,p:any,priceHint:number|null){
  const query=compsQuery(p)
  if(!query||query.length<3)return null
  try{
    const {response,payload}=await invoke(base,'ebay-comps',headers,{mode:'comps',query,price_hint:priceHint??undefined},9000)
    if(!response.ok||payload?.ok===false){console.error('ebay_comps_unavailable',{status:response.status,detail:clean(payload?.error,200)});return null}
    return payload
  }catch(e){console.error('ebay_comps_failed',{detail:clean(e instanceof Error?e.message:String(e),200)});return null}
}

const fbSchema={type:'object',additionalProperties:false,properties:{resale_low:{type:'number'},resale_mid:{type:'number'},resale_high:{type:'number'},quick_sale_value:{type:'number'},estimated_selling_costs:{type:'number'},estimated_prep_cost:{type:'number'},valuation_confidence:{type:'number',minimum:10,maximum:60},basis:{type:'string'},evidence_summary:{type:'string'},evidence:{type:'array',items:{type:'object',additionalProperties:false,properties:{source_title:{type:'string'},source_url:{type:'string'},price_aud:{type:['number','null']},sold:{type:['boolean','null']},match_quality:{type:'string'}},required:['source_title','source_url','price_aud','sold','match_quality']}}},required:['resale_low','resale_mid','resale_high','quick_sale_value','estimated_selling_costs','estimated_prep_cost','valuation_confidence','basis','evidence_summary','evidence']}

async function webFallback(body:any,seed:any){const key=Deno.env.get('OPENAI_API_KEY');if(!key)return null;const client=new OpenAI({apiKey:key,maxRetries:0,timeout:30000});const ctx={title:seed.identified_name,brand:seed.brand,model:seed.model,variant:seed.variant,condition:seed.condition_assessment,listing_text:clean(body?.listing_text,12000),platform_fields:body?.platform_fields||{}};const prompt=`Estimate the CURRENT Australian resale value for this exact item. Use web search. Prefer exact/strong SOLD comps, then strong active comps, then retail/specialist references. Return AUD low/mid/high, quick-sale value, realistic selling costs, prep cost, confidence, concise basis, concise evidence summary, and only real sources actually found. Never invent a URL or sold status. If evidence is weak, widen the range and lower confidence. Context: ${JSON.stringify(ctx).slice(0,16000)}`;try{const r=await client.responses.create({model:'gpt-5-mini',tools:[{type:'web_search',user_location:{type:'approximate',country:'AU',city:'Melbourne',region:'Victoria',timezone:'Australia/Melbourne'}}],reasoning:{effort:'minimal'},input:[{role:'user',content:[{type:'input_text',text:prompt}]}],text:{format:{type:'json_schema',name:'fast_market_fallback_v1',strict:true,schema:fbSchema}},store:false},{timeout:25000,maxRetries:0});return r.output_text?JSON.parse(r.output_text):null}catch(e){console.error('fast_fallback_failed',{detail:clean(e instanceof Error?e.message:String(e),400)});return null}}

// When the decision engine returns no valuation, the old fallbacks were a web-search guess
// or, failing that, asking-price x 1.5 at 10% confidence. If a real eBay AU market was
// measured for this item, that is strictly better evidence than either, so use it: a counted
// median with real listings cited, not a multiplier. Still asking prices, so haircut them and
// keep confidence moderate - this is an honest floor, not a substitute for sold comps.
const ASKING_TO_SALE = 0.9
function ebayFallback(ebay:any){
  if(!ebay||ebay.enough_for_a_market_view===false)return null
  const median=num(ebay.median);if(median===null||median<=0)return null
  const listings=Number(ebay.listings||ebay.used_for_stats||0)
  const cut=(v:any,f=ASKING_TO_SALE)=>{const n=num(v);return n===null?null:+(n*f).toFixed(2)}
  const mid=cut(median)!,low=cut(ebay.low)??+(mid*.85).toFixed(2),high=cut(ebay.high)??+(mid*1.15).toFixed(2)
  const confidence=listings>=15?50:listings>=8?42:35
  const samples=Array.isArray(ebay.cheapest)?ebay.cheapest.slice(0,5):[]
  return{
    resale_low:low,resale_mid:mid,resale_high:high,
    quick_sale_value:+(mid*.85).toFixed(2),
    estimated_selling_costs:+Math.max(8,mid*.13).toFixed(2),
    estimated_prep_cost:0,
    valuation_confidence:confidence,
    basis:`Valued from ${listings} comparable eBay Australia listings counted live for "${clean(ebay.query,120)}": median asking A$${median}. Asking prices sit above sale prices, so the range is ${Math.round((1-ASKING_TO_SALE)*100)}% below what sellers are asking. These are active listings, not sold prices.`,
    evidence_summary:`${listings} live eBay AU listings, median ask A$${median}, typical range A$${ebay.low}-A$${ebay.high}. Accessories, bundles, parts and faulty units were excluded.`,
    evidence:samples.map((c:any)=>({source_title:clean(c.title,240),source_url:clean(c.url,1000),price_aud:num(c.price_aud),sold:false,match_quality:'strong'}))
  }
}

function deterministicFallback(seed:any,ask:number,shipping:number|null){const title=String(seed.identified_name||'').toLowerCase();let mult=1.55;if(/shoe|sneaker|yeezy|jordan|nike|adidas|jacket|coat|clothing|fashion/.test(title))mult=1.65;if(/phone|console|laptop|camera|electronic/.test(title))mult=1.5;const landed=ask+(shipping??0);const mid=Math.max(landed+20,ask*mult);return{resale_low:+(mid*.8).toFixed(2),resale_mid:+mid.toFixed(2),resale_high:+(mid*1.2).toFixed(2),quick_sale_value:+(mid*.75).toFixed(2),estimated_selling_costs:+Math.max(8,mid*.13).toFixed(2),estimated_prep_cost:0,valuation_confidence:10,basis:'Emergency low-confidence estimate used because live market research exceeded its time budget. It is not a verified-comp valuation.',evidence_summary:'No verified live comps were available in this run.',evidence:[]}}

function seedAnalysis(body:any){const p=body?.platform_fields||{};const title=clean(p.listing_title||[p.brand,p.model,p.variant].filter(Boolean).join(' ')||'Listing analysis',300);return{identified_name:title,brand:clean(p.brand,120),model:clean(p.model,160),variant:clean(p.variant,220),category:clean(p.category,120),identification_confidence:title?80:40,seller_asking_price:null,genuine_market_low:null,genuine_market_mid:null,genuine_market_high:null,as_is_resale_value:null,target_resale_value:null,resale_low:null,resale_mid:null,resale_high:null,quick_sale_value:null,sell_time_low_days:null,sell_time_mid_days:null,sell_time_high_days:null,expected_selling_costs:null,estimated_prep_cost:null,recommended_offer:null,max_buy:null,break_even_sale_price:null,expected_profit:null,expected_roi_percent:null,quick_sale_profit:null,valuation_confidence:0,resale_evidence_count:0,resale_evidence_quality:'insufficient',resale_basis:'',value_add_explanation:'',target_resale_requirements:[],target_resale_assumptions:[],cannot_reach_target_reason:'',authenticity_status:'uncertain',authenticity_risk:35,authenticity_reasons:[],condition_assessment:clean(p.condition||'Condition based on seller/listing evidence.',500),condition_source:p.condition?'seller':'unknown',condition_confidence:p.condition?70:30,success_potential:0,community_confidence:null,overall_score:0,overall_risk:50,recommendation:'verify_first',next_action:'',action_summary:'',action_steps:[],action_cautions:[],seller_message:'',photo_findings:[],questions_to_ask:[],inspection_checks:[],portfolio_note:'',evidence_quality:'low',risks:{market:60,liquidity:60,condition:40,authenticity:35,seller_transaction:40,valuation_uncertainty:80,capital_exposure:40},evidence_summary:'',evidence:[],assumptions:[]}}

function recomputeOpportunityScores(a:any){
 const profit=num(a.expected_profit),roi=num(a.expected_roi_percent),confidence=clamp(num(a.valuation_confidence)??0),auth=String(a.authenticity_status||'uncertain')
 const risks=a.risks&&typeof a.risks==='object'?a.risks:{}
 const liquidityRisk=clamp(num(risks.liquidity)??50),conditionRisk=clamp(num(risks.condition)??50),marketRisk=clamp(num(risks.market)??50)
 if(auth==='likely_counterfeit'||profit===null||roi===null){if(auth==='likely_counterfeit'){a.overall_score=0;a.success_potential=0}return}
 if(profit<=0||roi<=0){a.overall_score=0;a.success_potential=0;return}
 const profitPoints=clamp((profit/100)*20,0,20)
 const roiPoints=clamp((roi/50)*25,0,25)
 const evidencePoints=(confidence/100)*20
 const authPoints=auth==='likely_genuine'||auth==='not_applicable'?15:auth==='uncertain'?7:auth==='high_risk'?2:5
 const conditionPoints=((100-conditionRisk)/100)*10
 const liquidityPoints=((100-liquidityRisk)/100)*5
 let score=Math.round(profitPoints+roiPoints+evidencePoints+authPoints+conditionPoints+liquidityPoints)
 score=clamp(score,1,100)
 if(auth==='high_risk')score=Math.min(score,25)
 a.overall_score=score
 const economicsStrength=clamp((roi/40)*35,0,35)+clamp((profit/75)*20,0,20)
 const marketStrength=((100-marketRisk)/100)*15
 const liquidityStrength=((100-liquidityRisk)/100)*15
 const evidenceStrength=(confidence/100)*15
 let success=Math.round(economicsStrength+marketStrength+liquidityStrength+evidenceStrength)
 success=clamp(success,1,100)
 if(auth==='uncertain')success=Math.min(success,65)
 if(auth==='high_risk')success=Math.min(success,20)
 a.success_potential=success
 a.score_breakdown={profit_points:+profitPoints.toFixed(1),roi_points:+roiPoints.toFixed(1),evidence_points:+evidencePoints.toFixed(1),authenticity_points:+authPoints.toFixed(1),condition_points:+conditionPoints.toFixed(1),liquidity_points:+liquidityPoints.toFixed(1),overall_score:score,success_potential:success,rule:'Positive-profit opportunities are scored from economics, evidence quality, authenticity, condition and liquidity. Zero is reserved for non-positive economics or likely-counterfeit hard stops.'}
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:cors})
 const diagnosticId=crypto.randomUUID(),started=Date.now()
 try{
  const body=await req.json();const base=Deno.env.get('SUPABASE_URL')||'https://msmpigerejpxepkylkxz.supabase.co';const headers={'Authorization':req.headers.get('authorization')||'','apikey':req.headers.get('apikey')||'','Content-Type':'application/json'}
  const quota=await claimUsage(base,headers,'analyse',DAILY_ANALYSES)
  if(quota&&quota.allowed===false&&quota.reason==='daily_limit')return new Response(JSON.stringify({
    error:`You have used all ${DAILY_ANALYSES} analyses for today. The allowance resets at midnight Melbourne time.`,
    error_code:'DAILY_LIMIT_REACHED',used:quota.used,limit:quota.limit,resets_at:quota.resets_at,retryable:false
  }),{status:429,headers:cors})

  let p=body?.platform_fields&&typeof body.platform_fields==='object'?body.platform_fields:{};const u=body?.user_overrides&&typeof body.user_overrides==='object'?body.user_overrides:{}
  const inputPrice=num(u.asking_price)??num(p.asking_price),inputCurrency=String(u.currency||p.currency||'AUD').toUpperCase(),priceVerified=u.asking_price!==undefined||p.asking_price_verified===true||(num(p.asking_price_confidence)||0)>=.9
  const textShip=shippingFromText(String(body?.listing_text||''),inputCurrency),inputShipping=num(u.shipping_cost)??num(p.acquisition_shipping_cost)??num(p.shipping_cost)??textShip?.amount??null,shippingCurrency=String(u.shipping_currency||p.shipping_currency||textShip?.currency||inputCurrency).toUpperCase()
  let askAud:number|null=null,shipAud:number|null=null,fxRate:number|null=null,shipFx:number|null=null
  if(inputPrice!==null&&priceVerified){const fx=await toAud(inputPrice,inputCurrency);askAud=fx.aud;fxRate=fx.rate}
  if(inputShipping!==null){const fx=await toAud(inputShipping,shippingCurrency);shipAud=fx.aud;shipFx=fx.rate}
  p={...p,asking_price:askAud,currency:'AUD',asking_price_authoritative:askAud!==null,original_listing_price:inputPrice,original_listing_currency:inputCurrency,fx_rate_to_aud:fxRate,acquisition_shipping_cost:shipAud,original_shipping_cost:inputShipping,original_shipping_currency:shippingCurrency,shipping_fx_rate_to_aud:shipFx,landed_acquisition_cost:askAud!==null&&shipAud!==null?+(askAud+shipAud).toFixed(2):null}
  const ebay=await ebayMarket(base,headers,p,askAud)
  const forwarded=structuredClone(body);forwarded.platform_fields=p;forwarded.market_evidence=ebay;forwarded.user_overrides={...u,asking_price:askAud,currency:'AUD',shipping_cost:shipAud,shipping_currency:'AUD'};forwarded.seller_update=[askAud!==null?`ASKING PRICE LOCK: AUD ${askAud.toFixed(2)}.`:'ASKING PRICE NOT VERIFIED.',shipAud!==null?`ACQUISITION SHIPPING LOCK: AUD ${shipAud.toFixed(2)}.`:'ACQUISITION SHIPPING NOT VERIFIED.',String(body?.seller_update||'')].filter(Boolean).join('\n\n')

  let payload:any=null,analysis:any=null,upstreamTimedOut=false
  try{const up=await invoke(base,'analyse-listing',headers,forwarded,80000);if(up.response.ok&&!up.payload?.error){payload=up.payload;analysis=up.payload.analysis||null}else console.error('upstream_non_ok',{status:up.response.status,error:clean(up.payload?.error,300)})}catch(e){upstreamTimedOut=e instanceof DOMException&&e.name==='AbortError';console.error('upstream_timeout_or_error',{timeout:upstreamTimedOut,detail:clean(e instanceof Error?e.message:String(e),300)})}
  if(!analysis)analysis=seedAnalysis(body)
  const risky=['high_risk','likely_counterfeit'].includes(String(analysis.authenticity_status||''));let usedFallback=false
  // A resale valuation does not depend on knowing the asking price - only profit and ROI do.
  // Gating the fallback on a verified ask meant a timed-out analysis with an unparsed price
  // showed "valuation unavailable" even when the eBay market had been measured successfully.
  if(!risky&&num(analysis.resale_mid)===null){usedFallback=true;const fb=ebayFallback(ebay)||(await webFallback(body,analysis))||(askAud!==null?deterministicFallback(analysis,askAud,shipAud):null);
   if(fb){analysis.resale_low=+Number(fb.resale_low).toFixed(2);analysis.resale_mid=+Number(fb.resale_mid).toFixed(2);analysis.resale_high=+Number(fb.resale_high).toFixed(2);analysis.quick_sale_value=+Number(fb.quick_sale_value).toFixed(2);analysis.expected_selling_costs=+Number(fb.estimated_selling_costs).toFixed(2);analysis.estimated_prep_cost=+Number(fb.estimated_prep_cost).toFixed(2);analysis.valuation_confidence=Math.max(10,Math.min(60,Number(fb.valuation_confidence)||20));analysis.resale_evidence_quality=fb.evidence?.length?'low':'insufficient';analysis.evidence_quality='low';analysis.resale_evidence_count=Array.isArray(fb.evidence)?fb.evidence.filter((e:any)=>e.sold===true).length:0;analysis.resale_basis=`Estimated valuation. ${clean(fb.basis,900)}`;analysis.evidence_summary=clean(fb.evidence_summary,900);analysis.evidence=Array.isArray(fb.evidence)?fb.evidence.map((e:any)=>({evidence_type:e.sold===true?'sold_comp':'active_listing',evidence_class:'verified',marketplace:'web',source_title:clean(e.source_title,240),source_url:clean(e.source_url,1000),price:num(e.price_aud),currency:'AUD',sold:e.sold===true?true:e.sold===false?false:null,condition_text:'',similarity_score:e.match_quality==='exact'?95:e.match_quality==='strong'?80:60,match_quality:['exact','strong','approximate','weak'].includes(e.match_quality)?e.match_quality:'approximate',included:true,rejection_reason:''})):[];analysis.assumptions=[`This valuation used the fallback path because the main research engine ${upstreamTimedOut?'exceeded its time budget':'did not return a usable valuation'}.`,...(ebayFallback(ebay)?[`The value came from live eBay Australia listings counted by FlippersAI, discounted ${Math.round((1-ASKING_TO_SALE)*100)}% because they are asking prices rather than sale prices.`]:[]),...(Array.isArray(analysis.assumptions)?analysis.assumptions:[])];if(['strong_buy','buy'].includes(analysis.recommendation))analysis.recommendation='negotiate'}else{usedFallback=false}}

  const selling=num(analysis.expected_selling_costs)||0,prep=num(analysis.estimated_prep_cost)||0,mid=num(analysis.resale_mid),quick=num(analysis.quick_sale_value)
  if(askAud!==null){analysis.seller_asking_price=askAud;analysis.acquisition_shipping_cost=shipAud;analysis.landed_acquisition_cost=shipAud!==null?+(askAud+shipAud).toFixed(2):null;if(mid!==null&&shipAud!==null){analysis.expected_profit=+(mid-selling-prep-askAud-shipAud).toFixed(2);const invested=askAud+shipAud+prep;analysis.expected_roi_percent=invested>0?+((analysis.expected_profit/invested)*100).toFixed(2):null;analysis.break_even_sale_price=+(askAud+shipAud+selling+prep).toFixed(2);const targetNet=Math.max(25,mid*.2);analysis.max_buy=Math.max(0,+(mid-selling-prep-shipAud-targetNet).toFixed(2));analysis.recommended_offer=Math.max(0,+((analysis.max_buy||0)*.9).toFixed(2))}if(quick!==null&&shipAud!==null)analysis.quick_sale_profit=+(quick-selling-prep-askAud-shipAud).toFixed(2)}
  if(shipAud===null){analysis.expected_profit=null;analysis.expected_roi_percent=null;analysis.max_buy=null;analysis.recommended_offer=null;analysis.break_even_sale_price=null}
  // On the fallback path the verdict must follow the economics we actually have. The seed verdict is
  // 'verify_first', and leaking that through told the user to verify something when there was nothing
  // to verify - the failure the contract forbids. A measured, asking-price-only valuation is never
  // strong enough for BUY, so the ceiling here is NEGOTIATE with a concrete offer.
  if(usedFallback&&num(analysis.resale_mid)!==null){
   const profit=num(analysis.expected_profit),maxBuy=num(analysis.max_buy)
   if(profit!==null&&profit<=0)analysis.recommendation='skip'
   else if(profit!==null)analysis.recommendation='negotiate'
   else if(analysis.recommendation==='verify_first')analysis.recommendation='negotiate'
   if(!clean(analysis.next_action,10)){
    if(analysis.recommendation==='skip')analysis.next_action=askAud!==null?`Skip this one. At A$${askAud.toFixed(2)} it does not clear its costs.`:'Skip this one. It does not clear its costs.'
    else if(maxBuy!==null&&askAud!==null&&askAud>maxBuy)analysis.next_action=`Offer A$${Math.max(0,+(maxBuy*.9).toFixed(2))} and do not go above A$${maxBuy.toFixed(2)}. The asking price of A$${askAud.toFixed(2)} is above your maximum.`
    else if(maxBuy!==null)analysis.next_action=`Buy at up to A$${maxBuy.toFixed(2)}. Open at A$${Math.max(0,+(maxBuy*.9).toFixed(2))}.`
    else analysis.next_action='Confirm the asking price and delivery cost, then re-run the analysis for the full economics.'
   }
   if(upstreamTimedOut)analysis.assumptions=['FlippersAI ran out of time on the deep research stage, so this valuation came from the live market it measured rather than from sold comps. It is a system limit, not something the seller can clear up.',...(Array.isArray(analysis.assumptions)?analysis.assumptions:[])]
  }
  // NEGOTIATE is only honest when the gap is closeable. When the evidence says the item is worth
  // far less than the ask, telling a beginner to go and haggle sends them into a negotiation they
  // cannot win and should not want to win. Below the closeable gap, the answer is to walk.
  // A valuation resting only on active asking prices is not strong enough to tell anyone to buy.
  // Today's evidence: sold comps put a used Switch OLED at A$185 while live asks sat at A$348-380.
  // Acting on asks is how a user buys a loss-maker, so BUY needs at least one sold comp behind it.
  if(num(analysis.resale_mid)!==null&&(num(analysis.resale_evidence_count)||0)===0&&['strong_buy','buy'].includes(String(analysis.recommendation||''))){
   analysis.recommendation='negotiate'
   analysis.assumptions=['This valuation rests on what sellers are ASKING, not on completed sales - no sold comps were found for this item. Asking prices run well above sale prices, so treat the resale figure as a ceiling and negotiate against it rather than paying up to it.',...(Array.isArray(analysis.assumptions)?analysis.assumptions:[])]
   if(num(analysis.valuation_confidence)!==null&&num(analysis.valuation_confidence)>50)analysis.valuation_confidence=50
  }
  const CLOSEABLE_GAP = 1.35
  const finalProfit=num(analysis.expected_profit),finalMaxBuy=num(analysis.max_buy)
  if(num(analysis.resale_mid)!==null&&finalProfit!==null&&finalProfit<=0){
   if(finalMaxBuy===null||askAud===null||askAud>finalMaxBuy*CLOSEABLE_GAP){
    analysis.recommendation='skip'
    analysis.next_action=finalMaxBuy!==null&&askAud!==null
     ?`Skip this one. It is worth about A$${finalMaxBuy.toFixed(2)} to you and the seller wants A$${askAud.toFixed(2)} - too far apart to negotiate. FlippersAI will keep looking.`
     :'Skip this one. The evidence does not support the asking price. FlippersAI will keep looking.'
   }else if(['strong_buy','buy'].includes(analysis.recommendation))analysis.recommendation='negotiate'
  }
  recomputeOpportunityScores(analysis)
  const out={...(payload||{}),analysis,engine_version:'flippers-stage2a-v16-ebay-anchored',ebay_market:ebay?{query:ebay.query,listings:ebay.listings,median:ebay.median,low:ebay.low,high:ebay.high,enough:ebay.enough_for_a_market_view!==false}:null,valuation_mode:usedFallback?'estimated':num(analysis.resale_mid)!==null?'researched':'unavailable',research_timeout_fallback:upstreamTimedOut,diagnostic_id:diagnosticId,execution_ms:Date.now()-started,price_integrity:{authoritative_price_aud:askAud,original_price:inputPrice,original_currency:inputCurrency,fx_rate_to_aud:fxRate,acquisition_shipping_aud:shipAud,original_shipping:inputShipping,original_shipping_currency:shippingCurrency,shipping_fx_rate_to_aud:shipFx}}
  return new Response(JSON.stringify(out),{headers:cors})
 }catch(e){const detail=clean(e instanceof Error?e.message:String(e),500);console.error('analyse_v2_failed',{diagnosticId,detail});return new Response(JSON.stringify({error:'FlippersAI could not complete this analysis.',error_code:'ANALYSIS_WRAPPER_FAILED',diagnostic_id:diagnosticId,detail,retryable:true}),{status:503,headers:cors})}
})