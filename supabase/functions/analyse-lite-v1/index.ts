import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const clean=(v:unknown,max=20000)=>String(v??'').trim().slice(0,max)
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
const round=(x:number|null)=>x===null?null:Math.round(x*100)/100

const schema={type:'object',additionalProperties:false,properties:{
  item_name:{type:'string'},brand:{type:'string'},model:{type:'string'},variant:{type:'string'},size:{type:'string'},category:{type:'string'},identity_confidence:{type:'number',minimum:0,maximum:100},
  asking_price:{type:['number','null']},condition_summary:{type:'string'},condition_score:{type:'number',minimum:0,maximum:100},authenticity_status:{type:'string',enum:['not_applicable','likely_genuine','uncertain','high_risk','likely_counterfeit']},authenticity_reasons:{type:'array',items:{type:'string'}},
  comps:{type:'array',items:{type:'object',additionalProperties:false,properties:{source:{type:'string'},url:{type:'string'},price_aud:{type:'number'},sold:{type:'boolean'},match_quality:{type:'string',enum:['exact','strong','approximate']},condition:{type:'string'},notes:{type:'string'}},required:['source','url','price_aud','sold','match_quality','condition','notes']}},
  quick_sale_value:{type:['number','null']},expected_resale_value:{type:['number','null']},resale_high:{type:['number','null']},estimated_selling_costs:{type:'number'},estimated_prep_cost:{type:'number'},sellability_score:{type:'number',minimum:0,maximum:100},sell_time_days:{type:['integer','null']},
  verdict:{type:'string',enum:['buy','negotiate','verify_first','skip']},verdict_reason:{type:'string'},next_action:{type:'string'},seller_message:{type:'string'},risks:{type:'array',items:{type:'string'}},assumptions:{type:'array',items:{type:'string'}}
},required:['item_name','brand','model','variant','size','category','identity_confidence','asking_price','condition_summary','condition_score','authenticity_status','authenticity_reasons','comps','quick_sale_value','expected_resale_value','resale_high','estimated_selling_costs','estimated_prep_cost','sellability_score','sell_time_days','verdict','verdict_reason','next_action','seller_message','risks','assumptions']}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:cors})
  try{
    const key=Deno.env.get('OPENAI_API_KEY')
    if(!key) return new Response(JSON.stringify({error:'AI service is not configured'}),{status:503,headers:cors})
    const body=await req.json()
    const listingUrl=clean(body.listing_url,4000)
    const note=clean(body.note,8000)
    const images=Array.isArray(body.images)?body.images.filter((x:any)=>typeof x==='string'&&/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(x)).slice(0,6):[]
    if(!listingUrl&&!note&&!images.length) return new Response(JSON.stringify({error:'Add at least one screenshot, a listing URL, or a note.'}),{status:400,headers:cors})

    const prompt=`You are FlippersAI Lite, a reselling deal checker for Australia. The user may know nothing about reselling. Your job is to do the work and answer: should they buy this item to resell?

Use the screenshots and notes to identify the exact item, asking price, size/variant and visible condition. Then use web search to research the CURRENT Australian resale market. Prioritise exact/strong sold comps, then strong active comps and retail/resale references. Do not invent URLs or sold listings. Use AUD.

Return conservative, practical values. If exact sold comps are scarce, widen carefully to strong matches and explain assumptions rather than returning an empty analysis. If authenticity is merely uncertain, still provide CONDITIONAL resale economics if genuine, but verdict cannot be buy until verification. Only high-risk/likely-counterfeit should suppress resale economics.

For comps, include only real web sources found in this run. Prefer 3-8 useful comps when available. Estimate selling costs and prep cost conservatively. sellability_score is 0-100. Keep verdict_reason and next_action concise and executable.

LISTING URL: ${listingUrl||'(none)'}
USER NOTE: ${note||'(none)'}
PHOTOS: ${images.length}`

    const content:any[]=[{type:'input_text',text:prompt}]
    for(const img of images) content.push({type:'input_image',image_url:img,detail:'auto'})

    const client=new OpenAI({apiKey:key,maxRetries:1,timeout:90000})
    const r=await client.responses.create({
      model:'gpt-5-mini',
      tools:[{type:'web_search',user_location:{type:'approximate',country:'AU',city:'Melbourne',region:'Victoria',timezone:'Australia/Melbourne'}}],
      input:[{role:'user',content}],
      text:{format:{type:'json_schema',name:'flippers_lite_v1',strict:true,schema}},
      store:false
    },{timeout:90000,maxRetries:1})
    if(!r.output_text) throw new Error('No analysis returned')
    const a=JSON.parse(r.output_text)

    const ask=typeof a.asking_price==='number'?a.asking_price:null
    const costs=Math.max(0,Number(a.estimated_selling_costs||0))+Math.max(0,Number(a.estimated_prep_cost||0))
    let expected=typeof a.expected_resale_value==='number'?a.expected_resale_value:null
    const strongCompPrices=(a.comps||[]).filter((c:any)=>['exact','strong'].includes(c.match_quality)&&Number.isFinite(Number(c.price_aud))).map((c:any)=>Number(c.price_aud))
    if(expected===null && strongCompPrices.length) expected=median(strongCompPrices)
    const profit=ask!==null&&expected!==null?expected-ask-costs:null
    const roi=ask!==null&&ask>0&&profit!==null?(profit/ask)*100:null
    const targetProfit=Math.max(20,expected!==null?expected*0.18:20)
    const maxBuy=expected!==null?Math.max(0,expected-costs-targetProfit):null

    if(a.authenticity_status==='likely_counterfeit'||a.authenticity_status==='high_risk'){
      a.verdict=a.authenticity_status==='likely_counterfeit'?'skip':'verify_first'
    } else if(a.authenticity_status==='uncertain'&&a.verdict==='buy'){
      a.verdict='verify_first'
    }
    if(profit!==null&&profit<0) a.verdict='skip'

    return new Response(JSON.stringify({
      analysis:a,
      economics:{
        asking_price:ask,
        expected_resale_value:round(expected),
        quick_sale_value:typeof a.quick_sale_value==='number'?round(a.quick_sale_value):null,
        resale_high:typeof a.resale_high==='number'?round(a.resale_high):null,
        selling_costs:round(Number(a.estimated_selling_costs||0)),
        prep_cost:round(Number(a.estimated_prep_cost||0)),
        expected_profit:round(profit),
        expected_roi_percent:round(roi),
        max_buy:round(maxBuy)
      },
      engine_version:'flippers-lite-v1'
    }),{headers:cors})
  }catch(err){
    const message=err instanceof Error?err.message:String(err)
    return new Response(JSON.stringify({error:'Could not complete the deal analysis.',detail:message.slice(0,700)}),{status:502,headers:cors})
  }
})