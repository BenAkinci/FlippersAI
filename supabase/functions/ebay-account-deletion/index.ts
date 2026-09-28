// FlippersAI — eBay marketplace account deletion / closure notifications
//
// eBay disables a Production keyset until the developer gives them an endpoint they can
// notify when an eBay user deletes their account. This is that endpoint. It must be
// PUBLIC (no JWT), because eBay calls it unauthenticated.
//
// Two things happen here:
//   GET  ?challenge_code=...   eBay's ownership check. The answer is
//                              sha256(challenge_code + verification_token + endpoint_url),
//                              hashed in exactly that order, returned as hex.
//   POST                       an actual deletion notice. We acknowledge with 200.
//
// What we do with a deletion notice: nothing to erase, and that is the honest answer, not
// a shortcut. FlippersAI stores public listing data (prices, titles, links) fetched from
// the Browse API. It holds no eBay user accounts, no buyer or seller identities, no tokens
// belonging to an eBay user. If that ever changes, the erasure must be implemented here.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const ENGINE = 'ebay-account-deletion-v1'

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

Deno.serve(async req => {
  const url = new URL(req.url)
  // The endpoint URL must be hashed exactly as it is registered with eBay, so it is
  // configurable rather than guessed from the request.
  const endpoint = (Deno.env.get('EBAY_DELETION_ENDPOINT') || `${url.origin}${url.pathname}`).trim()
  const verificationToken = Deno.env.get('EBAY_VERIFICATION_TOKEN')?.trim()

  if (req.method === 'GET') {
    const challenge = url.searchParams.get('challenge_code')
    if (!challenge) return new Response(JSON.stringify({ ok: true, engine: ENGINE, note: 'Endpoint is live. eBay calls it with ?challenge_code=... to verify ownership.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (!verificationToken) return new Response(JSON.stringify({ error: 'Verification token is not configured on the server.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(challenge + verificationToken + endpoint))
    return new Response(JSON.stringify({ challengeResponse: hex(digest) }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (req.method === 'POST') {
    // Read and discard: acknowledging is what eBay requires, and there is nothing of
    // theirs to delete. Never log the payload - it names a real person.
    await req.text().catch(() => '')
    return new Response(null, { status: 200 })
  }

  return new Response(null, { status: 405 })
})
