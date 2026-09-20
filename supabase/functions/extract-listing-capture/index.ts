import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    display_title: { type: 'string' },
    raw_title: { type: 'string' },
    title_confidence: { type: 'number', minimum: 0, maximum: 100 },
    asking_price_candidate: { type: ['number','null'] },
    currency: { type: 'string' },
    price_confidence: { type: 'number', minimum: 0, maximum: 100 },
    location: { type: 'string' },
    condition: { type: 'string' },
    listed_text: { type: 'string' },
    seller_name: { type: 'string' },
    description: { type: 'string' },
    observations: { type: 'array', items: { type: 'string' } },
    missing_fields: { type: 'array', items: { type: 'string' } }
  },
  required: ['display_title','raw_title','title_confidence','asking_price_candidate','currency','price_confidence','location','condition','listed_text','seller_name','description','observations','missing_fields']
}

const clean = (v: unknown, max = 30000) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'POST required'}), {status:405,headers:cors})

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({error:'OPENAI_API_KEY is not configured'}), {status:503,headers:cors})
    const body = await req.json()
    const listingUrl = clean(body.listing_url, 4000)
    const suppliedText = clean(body.listing_text, 30000)
    const images = Array.isArray(body.images)
      ? body.images.filter((x: unknown) => typeof x === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(x as string)).slice(0, 8)
      : []

    if (!listingUrl && !suppliedText && images.length === 0) {
      return new Response(JSON.stringify({error:'Provide a listing link, pasted listing text, or at least one screenshot/photo.'}), {status:400,headers:cors})
    }

    const client = new OpenAI({apiKey})
    const prompt = `You are the capture/extraction layer for FlippersAI. Extract FACTS from a resale listing capture. Do not value the item and do not infer facts that are not actually visible or supplied.

LISTING URL: ${listingUrl || '(none)'}
PASTED TEXT: ${suppliedText || '(none)'}
IMAGES/SCREENSHOTS: ${images.length}

Rules:
- The user may have screenshots from Facebook Marketplace, eBay, Gumtree, Depop, etc.
- raw_title is the actual listing title only when visible. Never use navigation/UI labels such as Chats, Marketplace, Home, Free, Notifications, Seller information, or random buttons as a title.
- display_title is a CLEAN, compact 2-7 word product label suitable for a dashboard. Prefer Brand + Model + useful variant/spec. Remove emojis, excessive punctuation, promotional wording, location, condition adjectives, price text and seller chatter. Example: raw title '🔥CHEAP!! Apple iphone 14 pro max 256gb unlocked!!!' -> display_title 'Apple iPhone 14 Pro Max 256GB'.
- If the product cannot be identified, use a neutral compact label such as 'Marketplace listing' rather than a UI heading.
- asking_price_candidate must be the seller's current asking price ONLY if it is clearly visible. Do not use recommended prices, crossed-out prices, retail prices, shipping, deposits or other listings. If uncertain return null or low confidence.
- Australian marketplace context: '$' on a clearly Australian listing is AUD. Do not convert currency.
- 'Free' can represent a zero asking price only when clearly shown as the LISTING PRICE; it must never become display_title.
- description should contain the seller's listing description only, condensed lightly but without adding facts.
- location, condition, listed_text and seller_name should be empty strings if not visible.
- observations should contain short useful capture notes only.
- missing_fields should list important facts that are not visible/clear.
- Never invent ratings, reviews, seller history, model, price, or URLs.`

    const content: any[] = [{type:'input_text', text:prompt}]
    for (const image of images) content.push({type:'input_image', image_url:image, detail:'auto'})

    const response = await client.responses.create({
      model:'gpt-5-mini',
      input:[{role:'user',content}],
      text:{format:{type:'json_schema',name:'listing_capture',strict:true,schema}},
      store:false
    })
    if (!response.output_text) throw new Error('No structured capture returned')
    const capture = JSON.parse(response.output_text)

    const bad = new Set(['chats','free','marketplace','facebook marketplace','home','notifications','seller information','seller details'])
    const normalized = String(capture.display_title || '').trim().toLowerCase()
    if (!normalized || bad.has(normalized)) {
      capture.display_title = 'Marketplace listing'
      capture.title_confidence = Math.min(Number(capture.title_confidence || 0), 35)
    }
    if (capture.asking_price_candidate !== null) {
      const p = Number(capture.asking_price_candidate)
      capture.asking_price_candidate = Number.isFinite(p) && p >= 0 ? p : null
    }
    capture.currency = capture.currency || 'AUD'

    return new Response(JSON.stringify({capture,engine_version:'capture-alpha-1'}), {headers:cors})
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({error: err instanceof Error ? err.message : String(err)}), {status:500,headers:cors})
  }
})