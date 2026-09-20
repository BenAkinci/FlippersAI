import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
Deno.serve((_req) => {
  const configured = Boolean(Deno.env.get('OPENAI_API_KEY'))
  return Response.json({ ok: true, openai_key_configured: configured, service: 'WhatTheFlip' }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  })
})
