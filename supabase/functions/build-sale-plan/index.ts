import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommended_platform: { type: 'string' },
    platform_rankings: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      platform: { type: 'string' }, reason: { type: 'string' }, rank: { type: 'integer' }
    }, required: ['platform','reason','rank'] } },
    pricing_plan: { type: 'object', additionalProperties: false, properties: {
      list_price: { type: 'number' }, expected_close_price: { type: 'number' }, minimum_price: { type: 'number' }, quick_sale_price: { type: 'number' }, rationale: { type: 'string' }
    }, required: ['list_price','expected_close_price','minimum_price','quick_sale_price','rationale'] },
    negotiation_ladder: { type: 'object', additionalProperties: false, properties: {
      ideal_accept: { type: 'number' }, comfortable_accept: { type: 'number' }, minimum_accept: { type: 'number' }, counter_strategy: { type: 'string' }
    }, required: ['ideal_accept','comfortable_accept','minimum_accept','counter_strategy'] },
    shipping_plan: { type: 'object', additionalProperties: false, properties: {
      recommended: { type: 'boolean' }, approach: { type: 'string' }, packaging_notes: { type: 'array', items: { type: 'string' } }
    }, required: ['recommended','approach','packaging_notes'] },
    photo_plan: { type: 'array', items: { type: 'string' } },
    preparation_checklist: { type: 'array', items: { type: 'string' } },
    listing_copy: { type: 'object', additionalProperties: false, properties: {
      title: { type: 'string' }, description: { type: 'string' }, condition_note: { type: 'string' }
    }, required: ['title','description','condition_note'] },
    next_action: { type: 'string' }
  },
  required: ['recommended_platform','platform_rankings','pricing_plan','negotiation_ladder','shipping_plan','photo_plan','preparation_checklist','listing_copy','next_action']
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: cors })
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
    const body = await req.json()
    const inventory = body?.inventory || {}
    const analysis = body?.analysis || {}
    const opportunity = body?.opportunity || {}
    const profile = body?.profile || {}

    const prompt = `You are FlippersAI's resale execution engine for Australia. Turn an acquired item into a practical sale plan. The user may be a complete beginner or a high-volume reseller, so be concrete and efficient. Do not invent product specifications or hide defects. Use the supplied acquisition analysis as the valuation anchor.

INVENTORY ITEM: ${JSON.stringify(inventory)}
ACQUISITION ANALYSIS: ${JSON.stringify(analysis)}
ORIGINAL LISTING: ${JSON.stringify(opportunity)}
USER PREFERENCES: ${JSON.stringify(profile)}

Create a resale plan that:
- recommends where to list the item in Australia and ranks sensible platforms;
- sets a list price, realistic expected close, minimum acceptable price and quick-sale price using the existing valuation and actual purchase economics;
- gives a short negotiation ladder;
- decides whether shipping is sensible given the item/category and the user's willingness to ship;
- gives an item-specific preparation checklist and photo shot list;
- writes an honest, high-converting listing title and description without claiming facts that are not supported;
- mentions known flaws clearly;
- ends with exactly what the user should do next.
All money values are AUD.`

    const client = new OpenAI({ apiKey })
    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'sale_plan', strict: true, schema } },
      store: false
    })
    if (!response.output_text) throw new Error('No sale plan returned')
    return new Response(JSON.stringify({ plan: JSON.parse(response.output_text), engine_version: 'flippers-sale-alpha-1' }), { headers: cors })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: cors })
  }
})