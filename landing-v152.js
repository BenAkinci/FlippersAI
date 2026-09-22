// v0.152: public landing (wraps the signed-out sign-in card) + Terms / Privacy / Disclaimer pages.
// Legal pages open from #terms, #privacy, #disclaimer (signed in or out) and from the footer / account menu.
// Claims on the landing page describe what the product actually does — no invented users, numbers or reviews.
const $ = (s, r = document) => r.querySelector(s)
const UPDATED = '22 September 2026'
// Set before public launch. Until then the pages say contact details are coming.
const CONTACT_EMAIL = ''
const contact = () => CONTACT_EMAIL ? `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>` : 'the contact address we will publish on this page before public launch'

function styles() {
  if ($('#landingV152Styles')) return
  const s = document.createElement('style')
  s.id = 'landingV152Styles'
  s.textContent = `
  .lp{min-height:100vh;display:flex;flex-direction:column;background:var(--bg-soft,#f6f8fa)}
  .lp-top{display:flex;align-items:center;justify-content:space-between;max-width:1120px;width:calc(100% - 32px);margin:0 auto;padding:18px 0}
  .lp-main{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:48px;align-items:start;max-width:1120px;width:calc(100% - 32px);margin:24px auto 0}
  .lp-hero h1{font-size:44px;line-height:1.08;letter-spacing:-.03em;margin:0 0 14px}
  .lp-hero .lead{font-size:18px;color:var(--muted);line-height:1.5;margin:0 0 28px;max-width:560px}
  .lp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 28px}
  .lp-step{background:var(--bg,#fff);border:1px solid var(--line);border-radius:14px;padding:16px}
  .lp-step b{display:block;font-size:15px;margin:6px 0 4px}.lp-step p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.45}
  .lp-step span{display:inline-block;font-size:12px;font-weight:700;color:#e28100;letter-spacing:.04em;text-transform:uppercase}
  .lp-points{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
  .lp-points li{display:flex;gap:10px;font-size:15px;line-height:1.45}.lp-points li:before{content:"✓";color:#1f8a4c;font-weight:700}
  .lp-side .auth-shell{min-height:0!important;padding:0!important;background:none!important;display:block!important}
  .lp-side .auth-card{max-width:none!important;margin:0!important;box-shadow:0 12px 40px rgba(15,20,25,.08)}
  .lp-side .auth-copy{display:none}
  .lp-side .brand-large{display:none}
  .lp-side-head{font-size:18px;font-weight:700;margin:0 0 14px}
  .lp-foot{max-width:1120px;width:calc(100% - 32px);margin:48px auto 0;padding:20px 0 28px;border-top:1px solid var(--line);display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px}
  .lp-foot nav{display:flex;gap:16px}.lp-foot a{color:var(--muted)}
  .legal-backdrop{position:fixed;inset:0;background:rgba(15,20,25,.35);z-index:120}
  .legal{position:fixed;inset:24px;max-width:760px;margin:0 auto;background:var(--bg,#fff);border-radius:16px;z-index:121;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.2)}
  .legal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}
  .legal-head h2{margin:0;font-size:19px}
  .legal-body{overflow:auto;padding:18px 22px 28px;font-size:14.5px;line-height:1.6}
  .legal-body h3{font-size:15.5px;margin:20px 0 6px}.legal-body p,.legal-body li{color:var(--ink)}
  .legal-body small{color:var(--muted)}
  .legal-close{border:1px solid var(--line);background:var(--bg);border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer}
  @media (max-width:860px){.lp-main{grid-template-columns:1fr;gap:28px}.lp-hero h1{font-size:32px}.lp-steps{grid-template-columns:1fr}.legal{inset:0;border-radius:0}}`
  document.head.appendChild(s)
}

const PAGES = {
  terms: ['Terms of use', `
    <p><small>Last updated ${UPDATED}</small></p>
    <p>These terms apply when you use FlippersAI (the website, app and Chrome extension). By creating an account or using FlippersAI you agree to them.</p>
    <h3>1. What FlippersAI does</h3>
    <p>FlippersAI helps you find, assess, buy and resell second-hand and retail items. It gives estimates — resale values, profit, maximum prices, verdicts and messages — based on the information you provide and research it performs. It does not buy or sell anything for you.</p>
    <h3>2. Estimates are not guarantees</h3>
    <p>Market prices change and research can be incomplete or wrong. Every figure is an estimate. You decide whether to buy or sell, and you are responsible for checking an item (including whether it is genuine and in the condition described) before paying. See the <a href="#disclaimer">Disclaimer</a>.</p>
    <h3>3. Your account</h3>
    <p>You need an account to use FlippersAI. Keep your login details private and tell us if you think someone else has used your account. You must be at least 18, or have a parent or guardian's permission.</p>
    <h3>4. Acceptable use</h3>
    <ul><li>Use FlippersAI only for lawful buying and selling.</li><li>Don't use it to deceive buyers or sellers, resell stolen or counterfeit goods, or break the rules of any marketplace you use.</li><li>Don't try to overload, reverse-engineer or misuse the service, or use it to collect other people's personal information.</li></ul>
    <h3>5. Marketplaces and the Chrome extension</h3>
    <p>The extension reads marketplace pages in your own browser, while you are signed in, to rate listings for you. You are responsible for complying with each marketplace's terms. FlippersAI is not affiliated with Facebook, eBay, Gumtree, Depop, OzBargain, Amazon or any retailer.</p>
    <h3>6. Your content</h3>
    <p>You keep ownership of the screenshots, notes and records you add. You allow us to store and process them to provide FlippersAI to you, as described in the <a href="#privacy">Privacy policy</a>.</p>
    <h3>7. Paid plans</h3>
    <p>If we introduce paid plans, prices and what's included will be shown before you pay, and these terms will be updated. Nothing in these terms limits your rights under the Australian Consumer Law.</p>
    <h3>8. Liability</h3>
    <p>To the extent permitted by law, FlippersAI is provided "as is" and we are not liable for losses from buying or selling decisions, items that turn out to be faulty or counterfeit, marketplace actions against your account, or service interruptions. Where the Australian Consumer Law gives you guarantees that cannot be excluded, those guarantees still apply.</p>
    <h3>9. Changes and ending your account</h3>
    <p>We may update these terms and will show the date of the latest version here. You can stop using FlippersAI at any time and ask us to delete your account.</p>
    <h3>10. Contact</h3>
    <p>Questions: ${contact()}. These terms are governed by the laws of Victoria, Australia.</p>`],
  privacy: ['Privacy policy', `
    <p><small>Last updated ${UPDATED}</small></p>
    <p>This policy explains what FlippersAI collects, why, and your choices. We aim to follow the Australian Privacy Principles.</p>
    <h3>What we collect</h3>
    <ul><li><b>Account:</b> your email address and login details, and profile settings you choose (name, home area, preferences).</li>
    <li><b>What you add:</b> listing screenshots and photos, listing details, notes, seller replies you paste, and your purchase, stock and sale records.</li>
    <li><b>What FlippersAI produces:</b> analyses, valuations, messages and plans.</li>
    <li><b>Extension:</b> when you run a scan (or Auto scan runs a search you saved), the listing titles, prices, locations and links on that results page, and the searches you saved. The extension does not read your messages, passwords or payment details.</li>
    <li><b>Technical:</b> basic logs needed to run and secure the service. Your login is kept in your browser's local storage.</li></ul>
    <h3>How we use it</h3>
    <p>To provide FlippersAI to you — analysing items, keeping your pipeline and stock, and improving accuracy. We don't sell your personal information and we don't use it for advertising.</p>
    <h3>Who processes it</h3>
    <ul><li><b>Supabase</b> — database, login and file storage.</li><li><b>Cloudflare</b> — website hosting.</li><li><b>OpenAI</b> — AI analysis. Screenshots and listing details you submit for analysis are sent to OpenAI's API to produce the result.</li></ul>
    <p>These providers may store or process data outside Australia (for example in the United States). We use them only to run FlippersAI.</p>
    <h3>Other people's information</h3>
    <p>Listings and screenshots can include sellers' names or locations. Only add what you need to assess the item, and don't use FlippersAI to profile people.</p>
    <h3>Your choices</h3>
    <p>You can view and edit your records in the app, delete deals and stock, reset sections under Settings, and ask us for a copy of your information or to delete your account: ${contact()}. If you're unhappy with how we handled your information you can contact the Office of the Australian Information Commissioner (oaic.gov.au).</p>`],
  disclaimer: ['Disclaimer', `
    <p><small>Last updated ${UPDATED}</small></p>
    <p><b>FlippersAI gives estimates, not guarantees.</b> Resale prices, profit, ROI, maximum buy prices, verdicts (Buy, Negotiate, Verify first, Skip) and success scores are based on the information available at the time and can be wrong.</p>
    <ul><li><b>Not financial advice.</b> FlippersAI is a tool to help you make your own decisions. It is not financial, legal or tax advice.</li>
    <li><b>Check before you pay.</b> Always confirm the item exists, matches the listing, works, and is genuine. FlippersAI can't inspect items and can be fooled by misleading listings or photos.</li>
    <li><b>Marketplace rules.</b> You're responsible for following the terms of the marketplaces you buy and sell on.</li>
    <li><b>Tax.</b> Regular buying and selling for profit may be a business for tax purposes. Keep records (FlippersAI's Stock and Capital pages help) and check with the ATO or an accountant.</li>
    <li><b>Safety.</b> Meet in safe places, use payment methods with buyer protection for shipped items, and never pay strangers by bank transfer for items you haven't received.</li></ul>`]
}

function openLegal(key) {
  const page = PAGES[key]
  if (!page) return
  styles()
  closeLegal()
  const back = document.createElement('div'); back.className = 'legal-backdrop'
  const el = document.createElement('div'); el.className = 'legal'; el.setAttribute('role', 'dialog')
  el.innerHTML = `<div class="legal-head"><h2>${page[0]}</h2><button class="legal-close" aria-label="Close">×</button></div><div class="legal-body">${page[1]}</div>`
  back.onclick = closeLegal; $('.legal-close', el).onclick = closeLegal
  document.body.append(back, el)
}
function closeLegal() {
  $('.legal')?.remove(); $('.legal-backdrop')?.remove()
  if (/^#(terms|privacy|disclaimer)$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search)
}
const fromHash = () => { const k = location.hash.slice(1); if (PAGES[k]) openLegal(k) }
window.addEventListener('hashchange', fromHash)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.legal')) closeLegal() })

const footer = () => `<footer class="lp-foot"><span>© ${new Date().getFullYear()} FlippersAI · Made in Melbourne</span><nav><a href="#terms">Terms</a><a href="#privacy">Privacy</a><a href="#disclaimer">Disclaimer</a></nav></footer>`

// Wrap the signed-out sign-in card in a landing page.
function enhanceAuth() {
  const shell = $('#app > .auth-shell')
  if (!shell || shell.dataset.lp) return
  shell.dataset.lp = '1'
  styles()
  const lp = document.createElement('div')
  lp.className = 'lp'
  lp.innerHTML = `
    <div class="lp-top"><div class="brand brand-large"><span>FlippersAI</span></div></div>
    <div class="lp-main">
      <section class="lp-hero">
        <h1>Know if it's worth buying — before you buy it.</h1>
        <p class="lead">FlippersAI finds items worth reselling, checks the real resale market, and tells you exactly what to pay, what to ask the seller and how to sell it for a profit. Built for Australian resellers, from first flip to full-time.</p>
        <div class="lp-steps">
          <div class="lp-step"><span>1 · Find</span><b>Deals worth flipping</b><p>Retail price errors and clearance checked against resale prices, plus your saved Marketplace, eBay, Gumtree and Depop searches.</p></div>
          <div class="lp-step"><span>2 · Analyse</span><b>Drop in screenshots</b><p>Resale value, profit, ROI and the maximum you should pay — with the evidence behind it.</p></div>
          <div class="lp-step"><span>3 · Buy & sell</span><b>Step by step</b><p>Seller questions, offers and counters, a pickup checklist, then a listing and price plan once it's yours.</p></div>
        </div>
        <ul class="lp-points">
          <li>Every estimate shows where it came from. No sold prices? It tells you.</li>
          <li>Flags counterfeit risk and tells you exactly what to check before you pay.</li>
          <li>Tracks your money: what's tied up in stock and what you've actually made.</li>
        </ul>
      </section>
      <aside class="lp-side"><div class="lp-side-head">Sign in or create an account</div></aside>
    </div>${footer()}`
  shell.replaceWith(lp)
  $('.lp-side', lp).appendChild(shell)
}

// Signed in: add legal links to the account menu once.
function enhanceAccountMenu() {
  const pop = $('#accountPopover')
  if (!pop || $('[data-legal-links]', pop)) return
  const div = document.createElement('div')
  div.dataset.legalLinks = '1'
  div.style.cssText = 'display:flex;gap:12px;padding:10px 12px 4px;font-size:12px;border-top:1px solid var(--line);margin-top:6px'
  div.innerHTML = '<a href="#terms" style="color:var(--muted)">Terms</a><a href="#privacy" style="color:var(--muted)">Privacy</a><a href="#disclaimer" style="color:var(--muted)">Disclaimer</a>'
  pop.appendChild(div)
}

const appEl = document.getElementById('app')
let t
if (appEl) new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { enhanceAuth(); enhanceAccountMenu() }, 30) }).observe(appEl, { childList: true, subtree: true })
enhanceAuth(); enhanceAccountMenu(); fromHash()
