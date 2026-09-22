import fs from 'node:fs'
const must = (ok, message) => { if (!ok) throw new Error(message) }
const read = f => fs.readFileSync(f, 'utf8')

const index = read('index.html')
const radar = read('deal-radar-v144.js')
const prefill = read('analyse-prefill-v144.js')
const hq = read('website-hq-v086.js')
const fn = read('supabase/functions/deal-radar/index.ts')
const sql = read('supabase/migrations/20260920120000_deal_radar_v1.sql')

must(index.includes('deal-radar-v144.js?v=0.145.1'), 'Deal Radar is not loaded by index.html')
must(index.includes('analyse-prefill-v144.js?v=0.144.0'), 'Analyse prefill is not loaded by index.html')
must(index.indexOf('analyse-fast-extraction-sync-v118.js') < index.indexOf('analyse-prefill-v144.js'), 'Prefill must load after the Analyse form layers')

// One hand-off key shared by every sender and the receiver.
const KEY = "'flippers:analyse-prefill'"
must(prefill.includes(KEY) && radar.includes(KEY) && hq.includes(KEY), 'Analyse prefill key must match across Radar, Shortlist and Analyse')
must(/if \(String\(el\.value \|\| ''\)\.trim\(\)\) return/.test(prefill), 'Prefill must never overwrite a value the user already entered')

// Radar UI reads only; writes are service-role in the Edge Function.
must(!/from\('radar_deals'\)\.(insert|update|upsert|delete)/.test(radar), 'The browser must never write radar_deals')
must(/radar_deals_read_qualified[\s\S]*status = 'qualified'/.test(sql), 'Only qualified radar deals may be readable')
must(/enable row level security/.test(sql) && /revoke all on public\.radar_deals from anon/.test(sql), 'radar tables must have RLS and no anon access')

// Economics and honesty rules stay aligned with analyse-listing-v2.
must(fn.includes('Math.max(25, mid * 0.2)'), 'Radar target profit must match Analyse: max(25, 20% of resale)')
must(fn.includes('Math.max(8, mid * 0.13)'), 'Radar selling-cost fallback must match Analyse')
must(/\['sold', 'active'\]\.includes\(x\.resale_basis\)/.test(fn), 'Estimates alone must never qualify a deal')
must(/urls\.length < 2/.test(fn), 'A qualified deal needs at least two resale evidence sources')
must(fn.includes('MIN_RUN_GAP_MINUTES'), 'Radar runs must be rate-limited server-side')

must(/const SCHEDULE_ENABLED = (true|false)/.test(radar) && /SCHEDULE_ENABLED \? /.test(radar), 'Radar must only mention a next scheduled check when a schedule is enabled')

console.log('Deal Radar contract v144 passed')
