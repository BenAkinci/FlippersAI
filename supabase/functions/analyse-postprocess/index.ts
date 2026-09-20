import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}
const num=(v:any)=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null)
const clean=(v:any,max=1200)=>String(v??'').trim().slice(0,max)
const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v))

const actionSchema={type:'object',additionalProperties:false,properties:{required_actions:{type:'array',items:{type:'string'}},action_summary:{type:'string'},decision_explanation:{type:'array',items:{type:'string'}}},required:['required_actions','action_summary','decision_explanation']}

function interpolate(value:number,points:Array<[number,number]>){
 if(!Number.isFinite(value))return 0
 if(value<=points[0][0])return points[0][1]
 for(let i=1;i<points.length;i++){
  const [x1,y1]=points[i-1],[x2,y2]=points[i]
  if(value<=x2){const t=(value-x1)/(x2-x1);return y1+t*(y2-y1)}
 }
 return points[points.length-1][1]
}

function recomputeScore(a:any){
 const profit=num(a.expected_profit),roi=num(a.expected_roi_percent),resale=num(a.resale_mid)
 const confidence=clamp(num(a.valuation_confidence)??0)
 const auth=String(a.authenticity_status||'uncertain')
 const risks=a.risks&&typeof a.risks==='object'?a.risks:{}
 const marketRisk=clamp(num(risks.market)??50),liquidityRisk=clamp(num(risks.liquidity)??50)
 const conditionRisk=clamp(num(risks.condition)??50),sellerRisk=clamp(num(risks.seller_transaction)??50),capitalRisk=clamp(num(risks.capital_exposure)??50)

 if(auth==='likely_counterfeit'){
  a.overall_score=0;a.success_potential=0
  a.score_breakdown={hard_stop:'likely_counterfeit',overall_score:0,success_potential:0,method:'deterministic_opportunity_score_v2'}
  return
 }
 if(profit!==null&&roi!==null&&(profit<=0||roi<=0)){
  a.overall_score=0;a.success_potential=0
  a.score_breakdown={hard_stop:'non_positive_economics',expected_profit:profit,expected_roi_percent:roi,overall_score:0,success_potential:0,method:'deterministic_opportunity_score_v2'}
  return
 }
 if(profit===null||roi===null||resale===null){
  a.score_breakdown={hard_stop:null,insufficient_for_numeric_score:true,overall_score:num(a.overall_score),success_potential:num(a.success_potential),method:'deterministic_opportunity_score_v2'}
  return
 }

 const roiPoints=interpolate(roi,[[0,0],[10,5],[20,10],[30,15],[50,21],[75,24],[100,25]])
 const profitPoints=interpolate(profit,[[0,0],[10,2],[25,5],[50,8],[100,11],[200,12]])
 const marginPct=resale>0?(profit/resale)*100:0
 const marginPoints=interpolate(marginPct,[[0,0],[10,2],[20,4],[30,6],[40,7],[50,8]])
 const evidencePoints=(confidence/100)*20
 const marketPoints=((100-marketRisk)/100)*5
 const liquidityPoints=((100-liquidityRisk)/100)*5
 const authPoints=auth==='likely_genuine'||auth==='not_applicable'?10:auth==='uncertain'?5:auth==='high_risk'?1:4
 const conditionPoints=((100-conditionRisk)/100)*5
 const sellerPoints=((100-sellerRisk)/100)*5
 const capitalPoints=((100-capitalRisk)/100)*5

 let score=Math.round(roiPoints+profitPoints+marginPoints+evidencePoints+marketPoints+liquidityPoints+authPoints+conditionPoints+sellerPoints+capitalPoints)
 score=clamp(score,1,100)
 if(auth==='high_risk')score=Math.min(score,25)
 a.overall_score=score

 const economicStrength=interpolate(roi,[[0,0],[10,8],[20,15],[30,21],[50,27],[75,30]])+interpolate(profit,[[0,0],[10,2],[25,5],[50,8],[100,10]])
 const evidenceStrength=(confidence/100)*20
 const executionStrength=((100-marketRisk)/100)*10+((100-liquidityRisk)/100)*10+((100-conditionRisk)/100)*5+((100-sellerRisk)/100)*5+((100-capitalRisk)/100)*5
 const authStrength=auth==='likely_genuine'||auth==='not_applicable'?5:auth==='uncertain'?2.5:auth==='high_risk'?0.5:2
 let success=Math.round(economicStrength+evidenceStrength+executionStrength+authStrength)
 success=clamp(success,1,100)
 if(auth==='uncertain')success=Math.min(success,70)
 if(auth==='high_risk')success=Math.min(success,20)
 a.success_potential=success

 a.score_breakdown={
  method:'deterministic_opportunity_score_v2',
  note:'This is an explicit analytical scoring policy, not a statistically learned probability. It can be recalibrated from completed-flip outcomes as FlippersAI accumulates data.',
  economics:{weight:45,roi_points:+roiPoints.toFixed(1),profit_points:+profitPoints.toFixed(1),profit_margin_points:+marginPoints.toFixed(1),expected_profit:profit,expected_roi_percent:roi,profit_margin_percent:+marginPct.toFixed(1)},
  evidence:{weight:20,valuation_confidence:confidence,points:+evidencePoints.toFixed(1)},
  market_and_liquidity:{weight:10,market_risk:marketRisk,liquidity_risk:liquidityRisk,market_points:+marketPoints.toFixed(1),liquidity_points:+liquidityPoints.toFixed(1)},
  authenticity:{weight:10,status:auth,points:+authPoints.toFixed(1)},
  condition:{weight:5,risk:conditionRisk,points:+conditionPoints.toFixed(1)},
  seller_transaction:{weight:5,risk:sellerRisk,points:+sellerPoints.toFixed(1)},
  capital_fit:{weight:5,risk:capitalRisk,points:+capitalPoints.toFixed(1)},
  overall_score:score,
  success_potential:success
 }
}

function calculationAudit(payload:any){
 const a=payload?.analysis||{}
 const p=payload?.price_integrity||{}
 const ask=num(a.seller_asking_price)??num(p.authoritative_price_aud)
 const shipping=num(a.acquisition_shipping_cost)??num(p.acquisition_shipping_aud)
 const resale=num(a.resale_mid)
 const selling=num(a.expected_selling_costs)??0
 const prep=num(a.estimated_prep_cost??a.estimated_preparation_cost)??0
 const profit=num(a.expected_profit)
 const roi=num(a.expected_roi_percent)
 const maxBuy=num(a.max_buy)
 const invested=ask!==null&&shipping!==null?ask+shipping+prep:null
 const targetNet=resale!==null?Math.max(25,resale*.20):null
 const evidence=Array.isArray(a.evidence)?a.evidence.filter((e:any)=>e?.included===true).map((e:any)=>({type:e.evidence_type,class:e.evidence_class,marketplace:e.marketplace,title:e.source_title,url:e.source_url,price:e.price,currency:e.currency,sold:e.sold,match:e.match_quality,similarity:e.similarity_score})):[]
 return {
  valuation:{mode:payload?.valuation_mode||'unavailable',confidence:num(a.valuation_confidence),low:num(a.resale_low),expected:resale,high:num(a.resale_high),quick_sale:num(a.quick_sale_value),basis:clean(a.resale_basis||a.evidence_summary,1600),evidence_count:evidence.length,evidence},
  profit:{result:profit,formula:'Expected resale − purchase price − acquisition shipping − selling costs − preparation costs',inputs:{expected_resale:resale,purchase_price:ask,acquisition_shipping:shipping,selling_costs:selling,preparation_costs:prep}},
  roi:{result_percent:roi,formula:'Expected profit ÷ invested capital × 100',inputs:{expected_profit:profit,invested_capital:invested,purchase_price:ask,acquisition_shipping:shipping,preparation_costs:prep}},
  max_buy:{result:maxBuy,formula:'Expected resale − selling costs − preparation costs − acquisition shipping − required target profit',inputs:{expected_resale:resale,selling_costs:selling,preparation_costs:prep,acquisition_shipping:shipping,target_profit:targetNet},target_rule:'Target profit is the greater of AUD 25 or 20% of expected resale value in the current engine.'},
  verdict:{recommendation:a.recommendation,overall_score:num(a.overall_score),success_potential:num(a.success_potential),score_breakdown:a.score_breakdown||null,authenticity_status:a.authenticity_status,valuation_confidence:num(a.valuation_confidence),evidence_quality:a.evidence_quality,assumptions:Array.isArray(a.assumptions)?a.assumptions:[],risks:a.risks||{}}
 }
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:cors})
 try{
  const body=await req.json(),payload=body?.payload||{},analysis=payload?.analysis||{}
  recomputeScore(analysis)
  const key=Deno.env.get('OPENAI_API_KEY')
  let requiredActions=Array.isArray(analysis.action_steps)?analysis.action_steps.filter(Boolean):[]
  let actionSummary=clean(analysis.action_summary||analysis.next_action,500)
  let decisionExplanation:string[]=[]
  if(key){
   const client=new OpenAI({apiKey:key,maxRetries:0,timeout:18000})
   const prompt=`You are FlippersAI's final decision auditor. Real money may rely on this output. Review the completed analysis below.\n\nREQUIRED ACTION RULE:\nOnly return actions that genuinely MUST or materially SHOULD happen as part of procuring THIS specific item before purchase or agreement. Do not create actions merely because a UI section exists. Do not include generic best practices. Do not ask the seller for evidence FlippersAI already has. Do not turn weak/failed FlippersAI market research into a seller task. If no procurement action is actually necessary, return an empty required_actions array and an empty action_summary. If many actions are genuinely necessary, return every material action; there is no arbitrary limit. Negotiation is an action only when the current economics actually call for negotiation. Verification is an action only when a specific unresolved item/seller fact materially affects safety, authenticity, condition or economics and only the seller/user can resolve it.\n\nDECISION EXPLANATION RULE:\nReturn concise but complete reasons for the current recommendation. Account for valuation evidence, profitability, ROI, max buy, authenticity, condition and material risks. The overall score is deterministic; do not invent reasons for it beyond the supplied score_breakdown.\n\nANALYSIS:\n${JSON.stringify(analysis).slice(0,26000)}\n\nVALUATION MODE: ${payload?.valuation_mode||'unknown'}\nPRICE INTEGRITY: ${JSON.stringify(payload?.price_integrity||{})}`
   try{
    const r=await client.responses.create({model:'gpt-5-mini',reasoning:{effort:'minimal'},input:[{role:'user',content:[{type:'input_text',text:prompt}]}],text:{format:{type:'json_schema',name:'flippers_action_audit_v2',strict:true,schema:actionSchema}},store:false},{timeout:16000,maxRetries:0})
    if(r.output_text){const j=JSON.parse(r.output_text);requiredActions=Array.isArray(j.required_actions)?j.required_actions.filter((x:any)=>String(x||'').trim()):[];actionSummary=clean(j.action_summary,500);decisionExplanation=Array.isArray(j.decision_explanation)?j.decision_explanation.filter((x:any)=>String(x||'').trim()):[]}
   }catch(e){console.error('action_audit_failed',clean(e instanceof Error?e.message:String(e),500))}
  }
  analysis.action_steps=requiredActions
  analysis.next_action=requiredActions[0]||''
  analysis.action_summary=actionSummary||requiredActions[0]||''
  if(!requiredActions.length){analysis.questions_to_ask=[];analysis.seller_message=''}
  const audit=calculationAudit({...payload,analysis})
  audit.verdict.decision_explanation=decisionExplanation
  return new Response(JSON.stringify({...payload,analysis,audit,postprocess_version:'flippers-audit-v2-deterministic-score'}),{headers:cors})
 }catch(e){return new Response(JSON.stringify({error:'Audit failed',detail:clean(e instanceof Error?e.message:String(e),500)}),{status:500,headers:cors})}
})