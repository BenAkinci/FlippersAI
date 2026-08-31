import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const clean=(v:unknown,max=12000)=>String(v??'').trim().slice(0,max)

const schema={type:'object',additionalProperties:false,properties:{
  listing_title:{type:'string'},asking_price:{type:['number','null']},currency:{type:'string'},asking_price_confidence:{type:'number',minimum:0,maximum:1},seller_name:{type:'string'},listing_location:{type:'string'},condition:{type:'string'},size:{type:'string'},description:{type:'string'},marketplace:{type:'string'},visible_item_details:{type:'array',items:{type:'string'}},authenticity_markers_visible:{type:'array',items:{type:'string'}},extraction_confidence:{type:'number',minimum:0,maximum:1},warnings:{type:'array',items:{type:'string'}}
},required:['listing_title','asking_price','currency','asking_price_confidence','seller_name','listing_location','condition','size','description','marketplace','visible_item_details','authenticity_markers_visible','extraction_confidence','warnings']}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers:cors})
  const diagnosticId=crypto.randomUUID()
  try{
    const key=Deno.env.get('OPENAI_API_KEY')
    if(!key)return new Response(JSON.stringify({error:'AI service is not configured'}),{status:503,headers:cors})
    const b=await req.json()
    const images=Array.isArray(b.images)?b.images.filter((x:any)=>typeof x==='string'&&/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(x)).slice(0,6):[]
    if(!images.length)return new Response(JSON.stringify({error:'At least one screenshot or photo is required'}),{status:400,headers:cors})
    const listingUrl=clean(b.listing_url,4000),platform=clean(b.platform,80)
    const prompt=`You are FlippersAI's listing screenshot extractor. Read ONLY facts visibly present in the supplied marketplace screenshots/photos. Do not research the web and do not infer missing seller facts. Extract the exact listing title, asking price, currency, seller name, location, seller-stated condition, size and description when visibly shown. If multiple prices appear, choose asking_price only when the listing's own sale price is unambiguous; otherwise null. asking_price_confidence must be >=0.90 only when the exact listing price is clearly visible and contextually obvious. Preserve seller wording for condition. visible_item_details should capture useful listing/product facts. authenticity_markers_visible should only list labels/SKUs/serials/packaging details actually visible; do not declare authenticity here. Missing fields must be empty strings/null. Marketplace hint: ${platform||'(unknown)'}. URL hint: ${listingUrl||'(none)'}.`
    const content:any[]=[{type:'input_text',text:prompt}]
    for(const img of images)content.push({type:'input_image',image_url:img,detail:'high'})
    const client=new OpenAI({apiKey:key,maxRetries:0,timeout:50000})
    const r=await client.responses.create({model:'gpt-5-mini',input:[{role:'user',content}],text:{format:{type:'json_schema',name:'listing_visual_extraction_v1',strict:true,schema}},store:false},{timeout:50000,maxRetries:0})
    if(!r.output_text)throw new Error('No extraction returned')
    return new Response(JSON.stringify({ok:true,extraction:JSON.parse(r.output_text),diagnostic_id:diagnosticId,engine_version:'listing-visual-extraction-v1'}),{headers:cors})
  }catch(error){
    const detail=error instanceof Error?error.message:String(error)
    console.error('listing-visual-extraction',{diagnosticId,detail})
    return new Response(JSON.stringify({error:'Could not read the listing screenshots',diagnostic_id:diagnosticId,detail:clean(detail,700)}),{status:500,headers:cors})
  }
})
