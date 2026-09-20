import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Content-Type':'application/json'
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try{
    const authHeader=req.headers.get('authorization')||''
    const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY')
    if(!url||!anon) throw new Error('Supabase environment is not configured')
    const supabase=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}})
    const {data:userData,error:userError}=await supabase.auth.getUser()
    if(userError||!userData.user) return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:cors})
    const uid=userData.user.id

    const [profileResult,portfolioResult,workflowsResult]=await Promise.all([
      supabase.from('profiles').select('*').eq('id',uid).maybeSingle(),
      supabase.from('portfolio_summary').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('flip_workflows').select('*, opportunities(*), inventory_items(*), sales(*)').eq('user_id',uid).in('status',['active','paused']).order('updated_at',{ascending:false})
    ])
    if(profileResult.error) throw profileResult.error
    if(workflowsResult.error) throw workflowsResult.error
    const profile=profileResult.data,portfolio=portfolioResult.data,workflows=workflowsResult.data||[]

    const stepKeys=[...new Set(workflows.map((w:any)=>w.current_step).filter(Boolean))]
    const workflowIds=workflows.map((w:any)=>w.id).filter(Boolean)
    const opportunityIds=[...new Set(workflows.map((w:any)=>w.opportunity_id).filter(Boolean))]

    const [stepsResult,progressResult,analysesResult]=await Promise.all([
      stepKeys.length?supabase.from('flip_step_catalog').select('*').in('step_key',stepKeys):Promise.resolve({data:[],error:null}),
      workflowIds.length?supabase.from('flip_step_progress').select('*').in('workflow_id',workflowIds).order('step_order'):Promise.resolve({data:[],error:null}),
      opportunityIds.length?supabase.from('analyses').select('*').eq('user_id',uid).in('opportunity_id',opportunityIds).order('analysed_at',{ascending:false}):Promise.resolve({data:[],error:null})
    ])
    if(stepsResult.error) throw stepsResult.error
    if(progressResult.error) throw progressResult.error
    if(analysesResult.error) throw analysesResult.error

    const stepsByKey=new Map((stepsResult.data||[]).map((s:any)=>[s.step_key,s]))
    const progressByWorkflow=new Map<string,any[]>()
    for(const p of progressResult.data||[]){const arr=progressByWorkflow.get(p.workflow_id)||[];arr.push(p);progressByWorkflow.set(p.workflow_id,arr)}
    const latestByOpportunity=new Map<string,any>()
    for(const a of analysesResult.data||[]){if(!latestByOpportunity.has(a.opportunity_id))latestByOpportunity.set(a.opportunity_id,a)}

    const guidance=profile?.guidance_level||'teach'
    const hydrated=workflows.map((workflow:any)=>{
      const step:any=stepsByKey.get(workflow.current_step)||null
      const instruction=step?(guidance==='fast'?step.fast_label:guidance==='assist'?step.assist_instruction:step.teach_instruction):null
      return {...workflow,step:step?{...step,instruction}:null,progress:progressByWorkflow.get(workflow.id)||[],latest_analysis:latestByOpportunity.get(workflow.opportunity_id)||null}
    })

    const onboarding={
      completed:profile?.onboarding_completed===true,
      step:profile?.onboarding_step||1,
      state:profile?.onboarding_state||{},
      steps:[
        {step:1,key:'starting_capital',title:'Set your starting capital',instruction:'Tell FlippersAI how much money you are comfortable using for reselling. This becomes the bankroll used for deal and risk recommendations.'},
        {step:2,key:'reselling_style',title:'Choose how you want to resell',instruction:'Choose whether you prefer mostly-from-home flips, local collection, shipping, or whatever gives the best return.'},
        {step:3,key:'goal_and_guidance',title:'Set your goal and guidance level',instruction:'Choose your monthly profit goal and whether FlippersAI should teach you, assist you, or move fast.'},
        {step:4,key:'start_scouting',title:'Find your first opportunity',instruction:'Open a marketplace and use Scout to find a listing worth investigating. You do not need to know what makes a good flip yet.'}
      ]
    }
    const primary=hydrated[0]||null
    const next_action=!onboarding.completed?onboarding.steps[Math.max(0,Math.min(3,onboarding.step-1))]:primary?.step?{key:primary.current_step,title:primary.step.title,instruction:primary.step.instruction,action_label:primary.step.action_label}:{key:'start_scouting',title:'Find your next opportunity',instruction:'Open Scout and look for another item worth analysing.',action_label:'Start scouting'}
    return new Response(JSON.stringify({profile,portfolio,onboarding,workflows:hydrated,primary_workflow:primary,next_action}),{headers:cors})
  }catch(err){console.error(err);return new Response(JSON.stringify({error:err instanceof Error?err.message:String(err)}),{status:500,headers:cors})}
})