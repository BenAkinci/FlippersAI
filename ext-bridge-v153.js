// v0.153: bridge between the website and the FlippersAI Chrome extension's side panel.
// The side panel shows this website in an iframe (?ext=1) so both are always the same app. Messages:
//   panel → site  FLIPPERS_EXT_HELLO        (panel says hi; site learns the panel's origin)
//   panel → site  FLIPPERS_EXT_ANALYSE      {url, platform, images[dataUrl], ...}  open Analyse with the listing
//   panel → site  FLIPPERS_EXT_GOTO         {view, tab?}  navigate (e.g. Find → Marketplace finds after a scan)
//   site → panel  FLIPPERS_SITE_READY       {signedIn}
// Logins are NOT shared: sharing one refresh token between two clients makes Supabase revoke the session
// when both refresh it. The embedded site and the extension each sign in once and keep their own session.
// Only accepted when this page is framed by a chrome-extension:// page and the message comes from that parent.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabase = createClient('https://msmpigerejpxepkylkxz.supabase.co', 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ')
const framed = window.self !== window.top
const extFlag = new URLSearchParams(location.search).get('ext') === '1'
let parentOrigin = null
try { if (extFlag) sessionStorage.setItem('flippers:ext', '1') } catch {}
const inExt = framed && (extFlag || (() => { try { return sessionStorage.getItem('flippers:ext') === '1' } catch { return false } })())

function post(msg) { if (parentOrigin) window.parent.postMessage(msg, parentOrigin) }

async function sendReady() {
  const { data } = await supabase.auth.getSession()
  post({ type: 'FLIPPERS_SITE_READY', signedIn: !!data?.session, email: data?.session?.user?.email || null })
}

function dataUrlToFile(d, i) {
  const [head, b64] = String(d).split(',')
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null
  const bin = atob(b64 || '')
  const bytes = new Uint8Array(bin.length)
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k)
  return new File([bytes], `listing-${i + 1}.${mime.split('/')[1].replace('jpeg', 'jpg')}`, { type: mime })
}

// Open Analyse, pre-fill the link/platform, and attach the listing screenshots so the normal
// screenshot autofill reads the listing — the same path as dragging screenshots in by hand.
async function analyse(p) {
  const PLATFORMS = ['facebook', 'depop', 'ebay', 'gumtree']
  try { sessionStorage.setItem('flippers:analyse-prefill', JSON.stringify({ url: p.url || '', platform: PLATFORMS.includes(p.platform) ? p.platform : '', source_label: 'the FlippersAI extension' })) } catch {}
  window.flippersApp?.route('analyse')
  window.dispatchEvent(new CustomEvent('flippers:analyse-prefill'))
  const files = (p.images || []).slice(0, 6).map(dataUrlToFile).filter(Boolean)
  if (!files.length) return
  for (let i = 0; i < 40; i++) {
    const input = document.getElementById('manualEvidenceInput')
    const form = document.getElementById('newDeal')
    if (input && form?.dataset.structured === 'v104') {
      const dt = new DataTransfer()
      files.forEach(f => dt.items.add(f))
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    await new Promise(r => setTimeout(r, 150))
  }
}

window.addEventListener('message', async e => {
  if (!inExt || e.source !== window.parent || !String(e.origin).startsWith('chrome-extension://')) return
  const m = e.data || {}
  if (!parentOrigin) parentOrigin = e.origin
  if (e.origin !== parentOrigin) return
  if (m.type === 'FLIPPERS_EXT_HELLO') return sendReady()
  if (m.type === 'FLIPPERS_EXT_ANALYSE') return analyse(m.payload || {})
  if (m.type === 'FLIPPERS_EXT_GOTO') {
    if (m.view === 'find' && m.tab && window.flippersShell?.openFind) return window.flippersShell.openFind(m.tab)
    return window.flippersApp?.route(m.view || 'today')
  }
})

if (inExt) {
  document.documentElement.classList.add('in-ext')
  const st = document.createElement('style')
  st.textContent = `
  html.in-ext .lp-hero .lp-steps,html.in-ext .lp-hero .lp-points{display:none}
  html.in-ext .lp-hero h1{font-size:24px!important}
  html.in-ext .lp-top{padding:10px 0}
  html.in-ext .lp-foot{margin-top:24px}
  html.in-ext .content{padding-top:18px!important}`
  document.head.appendChild(st)
  supabase.auth.onAuthStateChange(evt => { if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') sendReady() })
}
