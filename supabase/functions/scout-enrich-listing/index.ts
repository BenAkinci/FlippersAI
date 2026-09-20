import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}
const actionSchema={type:'object',additionalProperties:false,properties:{action:{type:'string'},why:{type:'string'},estimated_cost:{type:['number','null']},estimated_value_add:{type:['number','null']},priority:{type:'string',enum:['essential','recommended','optional']},practical:{type:'boolean'}},required:['action','why','estimated_cost','estimated_value_add','priority','practical']}
const checkSchema={type:'object',additionalProperties:false,properties:{check:{type:'string'},status:{type:'string',enum:['pass','unknown','fail','not_applicable']},detail:{type:'string'}},required:['check','status','detail']}
const schema={type:'object',additionalProperties:false,properties:{condition_label:{type:'string'},condition_source:{type:'string',enum:['seller','ai_visual','mixed','unknown']},condition_confidence:{type:'number',minimum:0,maximum:100},condition_reason:{type:'string'},damage_flags:{type:'array',items:{type:'string'}},material_damage:{type:'boolean'},authenticity_status:{type:'string',enum:['not_applicable','likely_genuine','uncertain','high_risk','likely_counterfeit']},authenticity_risk:{type:'number',minimum:0,maximum:100},authenticity_reasons:{type:'array',items:{type:'string'}},authenticity_evidence_state:{type:'string',enum:['not_applicable','strong_evidence','partial_evidence','missing_evidence','conflicting_evidence']},authenticity_evidence_seen:{type:'array',items:{type:'string'}},missing_authenticity_evidence:{type:'array',items:{type:'string'}},authenticity_checks:{type:'array',items:checkSchema},authentication_request:{type:'string'},identity_note:{type:'string'},photo_findings:{type:'array',items:{type:'string'}},gate:{type:'string',enum:['pass','verify','skip']},opportunity_score:{type:'number',minimum:0,maximum:100},as_is_resale_mid:{type:['number','null']},target_resale_mid:{type:['number','null']},estimated_prep_cost:{type:['number','null']},resale_explanation:{type:'string'},value_actions:{type:'array',items:actionSchema},success_reasoning:{type:'array',items:{type:'string'}},score_reasoning:{type:'array',items:{type:'string'}}},required:['condition_label','condition_source','condition_confidence','condition_reason','damage_flags','material_damage','authenticity_status','authenticity_risk','authenticity_reasons','authenticity_evidence_state','authenticity_evidence_seen','missing_authenticity_evidence','authenticity_checks','authentication_request','identity_note','photo_findings','gate','opportunity_score','as_is_resale_mid','target_resale_mid','estimated_prep_cost','resale_explanation','value_actions','success_reasoning','score_reasoning']}
const clean=(v:unknown,n=20000)=>String(v??'').trim().slice(0,n)
const num=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:null

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:cors})
 try{
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return new Response(JSON.stringify({error:'OPENAI_API_KEY is not configured'}),{status:503,headers:cors})
  const body=await req.json(),capture=body?.capture&&typeof body.capture==='object'?body.capture:{},prior=body?.prior_analysis&&typeof body.prior_analysis==='object'?body.prior_analysis:{},sellerName=clean(capture.sellerName,120),sellerCondition=clean(capture.condition,120),title=clean(capture.title||prior.identified_name,300),text=clean(capture.listingText||capture.visibleText,30000),userEvidence=clean(body?.user_evidence,1800),images=Array.isArray(body?.images)?body.images.filter((x:unknown)=>typeof x==='string'&&/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(x as string)).slice(0,6):[]
  const priorMarket=num(prior.genuine_market_mid)??num(prior.resale_mid),priorLow=num(prior.genuine_market_low)??num(prior.resale_low),priorHigh=num(prior.genuine_market_high)??num(prior.resale_high),priorOpportunity=num(prior.opportunity_score)??num(prior.overall_score)??0
  const client=new OpenAI({apiKey:key,maxRetries:0,timeout:30000})
  const prompt=`You are FlippersAI's deep evidence stage for ONE resale listing. Inspect the full listing text and supplied photos. Resolve condition, identity and authenticity uncertainty using evidence already present before asking the seller for anything.

TITLE: ${title}\nSELLER: ${sellerName||'(not captured)'}\nSELLER CONDITION: ${sellerCondition||'(not stated)'}\nFULL PAGE TEXT: ${text||'(none)'}\nPRIOR ANALYSIS: ${JSON.stringify(prior).slice(0,14000)}\nPRIOR OPPORTUNITY SCORE: ${priorOpportunity}\nPRIOR MARKET: low ${priorLow??'unknown'}, mid ${priorMarket??'unknown'}, high ${priorHigh??'unknown'} AUD\nIMAGES: ${images.length}\nUSER EVIDENCE: ${userEvidence||'(none)'}

Rules:
1. Missing evidence is NOT fake evidence. First inspect every supplied image/text for tongue/size labels, SKU/style codes, serials, box labels, receipts, logos, stitching, materials, shape, outsole/insole and other category-appropriate markers.
2. If a tongue/size label or SKU/style code is visible, explicitly record it in authenticity_evidence_seen and authenticity_checks. Cross-check internal consistency: seller description vs label/model/size/colourway and visible construction. Never ask for a photo that is already supplied and readable.
3. A matching style/SKU code alone does NOT prove authenticity; counterfeit goods can copy valid codes. strong_evidence requires multiple mutually consistent signals. Use likely_genuine + low risk when evidence is strong, but never claim photographic 100% certainty.
4. high_risk/likely_counterfeit require positive inconsistencies such as mismatched model/SKU/colourway, clearly wrong label formatting, impossible construction/branding, replica language or concrete contradictory evidence. Price alone never proves fake.
5. Build authenticity_checks as a checklist. Typical checks: model identified, style/SKU visible, seller text matches label, size label internally consistent, colourway/construction consistent, box/receipt/provenance where relevant. Mark unknown rather than fail when evidence is absent.
6. authentication_request must request ONLY unresolved evidence. If the tongue label is already visible, do not ask for it again. If no further evidence is needed to reach likely_genuine/high confidence, return an empty request.
7. opportunity_score is attractiveness IF any remaining verification passes. Missing authentication evidence should not automatically destroy the opportunity score. Concrete fake evidence, severe damage or weak economics should lower it.
8. Condition is THIS item's condition. Preserve explicit seller condition when appropriate and cross-check photos.
9. as_is_resale_mid/target_resale_mid must reflect this item's condition and prior market baseline. Do not use pristine values for damaged goods.
10. gate=pass when current evidence supports proceeding; verify when a specific answerable blocker remains; skip for likely counterfeit/severe inconsistency or destroyed economics.`
  const content:any[]=[{type:'input_text',text:prompt}];for(const img of images)content.push({type:'input_image',image_url:img,detail:'auto'})
  const response=await client.responses.create({model:'gpt-5-mini',input:[{role:'user',content}],text:{format:{type:'json_schema',name:'listing_enrichment_v4',strict:true,schema}},store:false})
  if(!response.output_text)throw new Error('No enrichment returned')
  const result=JSON.parse(response.output_text)
  if(sellerCondition){result.condition_label=sellerCondition;if(result.condition_source==='ai_visual'||result.condition_source==='unknown')result.condition_source=images.length?'mixed':'seller'}
  if(result.as_is_resale_mid!=null&&priorHigh!=null)result.as_is_resale_mid=Math.min(Number(result.as_is_resale_mid),Math.max(priorHigh,priorMarket??priorHigh))
  if(result.target_resale_mid!=null&&priorHigh!=null)result.target_resale_mid=Math.min(Number(result.target_resale_mid),priorHigh)
  if(result.material_damage&&result.target_resale_mid!=null&&result.as_is_resale_mid!=null&&result.value_actions.every((a:any)=>!a.practical))result.target_resale_mid=result.as_is_resale_mid
  const missing=['missing_evidence','partial_evidence'].includes(result.authenticity_evidence_state)
  if(missing&&result.authenticity_status==='uncertain'){result.gate='verify';result.opportunity_score=Math.max(Number(result.opportunity_score||0),Math.min(100,priorOpportunity))}
  if(result.authenticity_evidence_state==='strong_evidence'&&result.authenticity_status==='likely_genuine'&&result.authenticity_risk<=25)result.gate='pass'
  if(result.authenticity_evidence_state==='conflicting_evidence'&&result.authenticity_status==='uncertain')result.authenticity_status='high_risk'
  return new Response(JSON.stringify({result,engine_version:'flippers-enrich-4-evidence-checklist'}),{headers:cors})
 }catch(err){console.error(err);return new Response(JSON.stringify({error:err instanceof Error?err.message:String(err)}),{status:500,headers:cors})}
})