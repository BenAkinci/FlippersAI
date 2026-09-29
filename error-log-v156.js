// v0.156: the app records its own failures.
//
// Until now a broken FlippersAI was only discovered if someone happened to mention it. This
// reports uncaught errors and failed promises to error_events so they can be read back.
//
// What it deliberately does NOT send: anything the user typed, listing text, seller details,
// photos, prices, or page content. A crash report needs the message, the view it happened in
// and a trimmed stack - nothing about the item being analysed. Messages are truncated and the
// session is capped, so a failure loop cannot flood the table or the user's connection.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const APP_VERSION = '0.156.0'
const MAX_PER_SESSION = 12
const trim = (v, n) => String(v ?? '').slice(0, n)

let sent = 0
const seen = new Set()

async function report(source, message, detail) {
  const text = trim(message, 400)
  if (!text || sent >= MAX_PER_SESSION) return
  // The same error firing in a loop is one fact, not fifty.
  const key = `${source}:${text}`
  if (seen.has(key)) return
  seen.add(key)
  sent++
  try {
    const { data } = await supabase.auth.getSession()
    const uid = data?.session?.user?.id
    if (!uid) return // Anonymous crashes cannot be attributed, and RLS would reject the row.
    await supabase.from('error_events').insert({
      user_id: uid,
      source: trim(source, 60),
      message: text,
      view: trim(window.flippersApp?.view || '', 40),
      detail: trim(detail, 1500),
      app_version: APP_VERSION,
      user_agent: trim(navigator.userAgent, 300)
    })
  } catch {
    // Reporting a failure must never itself become a failure the user sees.
  }
}

window.addEventListener('error', e => {
  if (!e?.message) return
  report('window.error', e.message, `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}\n${trim(e.error?.stack, 1200)}`)
})

window.addEventListener('unhandledrejection', e => {
  const r = e?.reason
  report('unhandled.rejection', r?.message || String(r || 'Unknown rejection'), trim(r?.stack, 1200))
})

// For code that catches its own errors but still wants them recorded.
window.flippersLog = { error: report }
