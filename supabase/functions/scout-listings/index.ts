import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    index: { type: 'integer', minimum: 0 },
    identified_name: { type: 'string' },
    asking_price: { type: ['number','null'] },
    currency: { type: 'string' },
    resale_low: { type: ['number','null'] },
    resale_high: { type: ['number','null'] },
    potential_profit_low: { type: ['number','null'] },
    potential_profit_high: { type: ['number','null'] },
    lead_score: { type: 'number', minimum: 0, maximum: 100 },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    recommendation: { type: 'string', enum: ['investigate','maybe','ignore'] },
    reason: { type: 'string' },
    key_uncertainty: { type: 'string' }
  },
  required: ['index','identified_name','asking_price','currency','resale_low','resale_high','potential_profit_low','potential_profit_high','lead_score','confidence','recommendation','reason','key_uncertainty']
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: { type: 'array', items: itemSchema },
    summary: { type: 'string' }
  },
  required: ['results','summary']
}

const clean = (v: unknown, max = 12000) => String(v ?? '').trim().slice(0,max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'POST required'}), { status: 405, headers: cors })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({error:'OPENAI_API_KEY is not configured on the server'}), { status: 503, headers: cors })

    const body = await req.json()
    const listings = Array.isArray(body.listings) ? body.listings.slice(0,12) : []
    const bankroll = Number(body.bankroll || 0)
    const riskProfile = clean(body.risk_profile || 'conservative', 80)

    if (!listings.length) return new Response(JSON.stringify({error:'No visible listings supplied'}), { status: 400, headers: cors })

    const compact = listings.map((x:any, i:number) => ({
      index: i,
      title: clean(x?.title, 280),
      price: Number.isFinite(Number(x?.price)) ? Number(x.price) : null,
      currency: clean(x?.currency || 'AUD', 8),
      location: clean(x?.location, 160),
      text: clean(x?.text, 800),
      url: clean(x?.url, 1800)
    }))

    const client = new OpenAI({ apiKey })
    const prompt = `You are FlippersAI Scout Mode. Triage a batch of marketplace cards for an Australian reseller. This is a FAST FIRST PASS, not a final buy recommendation. Preserve quality: do not fabricate product identity, sold comps, or resale values. If a card is too vague, return low confidence and MAYBE/IGNORE rather than inventing certainty.\n\nMARKET: Australia, AUD. USER CAPITAL: ${bankroll.toFixed(2)} AUD. Risk profile: ${riskProfile}.\n\nVISIBLE LISTING CARDS:\n${JSON.stringify(compact)}\n\nFor each card:\n1. Use the exact supplied asking price/currency when present. Do NOT convert an AUD price to USD or vice versa.\n2. Identify the product only as far as the card supports.\n3. Use web search selectively to estimate a plausible current Australian resale range, prioritising exact/similar sold/completed evidence where available. This is triage, so do not over-research obvious weak leads.\n4. Estimate gross potential profit range as resale minus asking price. Do not subtract speculative fees unless clearly needed; this is only an opportunity screen.\n5. lead_score should reward likely margin, liquidity, identifiability and evidence strength; penalise vague titles, weak evidence, suspicious pricing, poor liquidity or likely non-comparable variants.\n6. INVESTIGATE means worth opening for a full FlippersAI analysis. MAYBE means possible but uncertain. IGNORE means not worth the user's attention on current evidence.\n7. Confidence measures confidence in the triage, not certainty of profit.\n8. Keep reasons concise and practical.\n9. Maintain the input index exactly so the browser can map results back to the visible cards.`

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'AU', city: 'Melbourne', region: 'Victoria', timezone: 'Australia/Melbourne' } }],
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'scout_results', strict: true, schema } },
      store: false
    })

    if (!response.output_text) throw new Error('No Scout Mode result returned')
    const parsed = JSON.parse(response.output_text)
    return new Response(JSON.stringify({ ...parsed, engine_version: 'flippers-scout-alpha-1', scanned: compact.length }), { headers: cors })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({error: err instanceof Error ? err.message : String(err)}), { status: 500, headers: cors })
  }
})
