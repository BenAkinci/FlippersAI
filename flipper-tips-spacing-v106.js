(() => {
  const TIPS = {
    home: [
      'Protect your buying power. A good flip is not only profitable — it should also leave enough cash available for the next opportunity.',
      'Fast inventory turnover can be more valuable than chasing the highest possible margin on every item.',
      'Track what actually sold, not what sellers hoped to get. Real outcomes are better training data for your next decision.',
      'FlippersAI uses your workflow history to keep the next action connected to the deal, rather than treating each step in isolation.'
    ],
    analyse: [
      'Exact model, size and condition can materially change resale value. Small identification errors can produce bad comps.',
      'Sold listings are stronger valuation evidence than active asking prices because they show what buyers actually paid.',
      'A strong seller profile reduces transaction risk, but it does not prove the item itself is authentic.',
      'If a price or size system is ambiguous, confirm it before analysing. A wrong currency or variant can reverse the recommendation.',
      'Photos of labels, tags, serials, soles and visible flaws can improve identification, condition and authenticity confidence.',
      'Profit is not the whole story. Sell-through speed matters because slow stock ties up money that could fund another flip.',
      'You can correct anything FlippersAI extracts from screenshots. Your confirmed value should always override the automated reading.'
    ],
    deals: [
      'Negotiate from your maximum safe buy price, not from the seller’s asking price. Your margin should survive fees and surprises.',
      'Before paying, re-check the exact item, agreed price, included accessories and collection or shipping terms.',
      'A deal is not secured until the purchase conditions are clear. Keep important seller promises documented in the workflow.',
      'Walking away from a marginal deal preserves capital for a better one.'
    ],
    inventory: [
      'Stale inventory has a cost even when it has not lost money on paper — your capital is still locked inside it.',
      'Price reductions should be deliberate. Compare the extra sell-through speed against the margin you are giving up.',
      'Good listing photos reduce buyer uncertainty and can improve both conversion and the quality of buyer enquiries.',
      'Record flaws accurately. A transparent listing lowers dispute risk and helps protect your seller reputation.'
    ],
    learn: [
      'The best resellers build pattern recognition: item, condition, acquisition price, demand, fees and time-to-sale all work together.',
      'When studying a flip, compare your original expectation with the actual outcome. That is where useful judgement gets built.',
      'A high ROI on a tiny sale and a lower ROI on a fast, larger-dollar sale can have very different effects on your bankroll.',
      'Use FlippersAI guidance as a decision aid, then learn which evidence caused the recommendation.'
    ],
    capital: [
      'Available cash and total profit are different things. Keep enough liquidity to act when a genuinely strong opportunity appears.',
      'Concentrating too much money in one item increases the damage from slow sales, hidden faults or a bad valuation.',
      'Judge a flip by net profit after every real cost, not the gap between purchase price and resale price.'
    ],
    default: [
      'Good reselling decisions come from combining evidence, economics and risk — not from any single number.'
    ]
  }

  let loadingTipIndex = 0
  let loadingTimer = null

  function injectStyles() {
    if (document.getElementById('flipperTipsSpacingStyles')) return
    const style = document.createElement('style')
    style.id = 'flipperTipsSpacingStyles'
    style.textContent = `
      :root{
        --fa-space-1:8px;--fa-space-2:12px;--fa-space-3:16px;--fa-space-4:20px;--fa-space-5:24px;--fa-space-6:32px;--fa-space-7:40px;--fa-space-8:48px;
        --fa-type-page:clamp(34px,4vw,42px);--fa-type-section:20px;--fa-type-card:16px;--fa-type-label:13px;--fa-type-body:15px;--fa-type-help:12px;
        --fa-line-tight:1.15;--fa-line-body:1.5;
      }

      main.content{padding-top:var(--fa-space-8);padding-bottom:88px}
      main.content>.page-head{margin-bottom:var(--fa-space-7)!important;align-items:flex-end}
      main.content .page-head h1{font-size:var(--fa-type-page)!important;line-height:var(--fa-line-tight)!important;letter-spacing:-.04em!important;margin:0 0 10px!important}
      main.content .page-head p{font-size:16px!important;line-height:1.55!important;margin:0!important;max-width:720px}
      main.content .eyebrow{font-size:11px!important;line-height:1.2!important;letter-spacing:.11em!important}
      main.content .section-block{margin-top:var(--fa-space-7)!important}
      main.content .section-heading{margin-bottom:var(--fa-space-4)!important;align-items:flex-end}
      main.content .section-heading h2{font-size:24px!important;line-height:1.2!important;margin:0!important;letter-spacing:-.025em!important}
      main.content .section-heading>span{font-size:13px!important;line-height:1.4!important}
      main.content .button-row,main.content .quick-actions{gap:var(--fa-space-2)}

      main.content .card h2,main.content .focused-card h2,main.content .deal-card h2{font-size:22px;line-height:1.25;margin:0 0 var(--fa-space-2)}
      main.content .card h3,main.content .focused-card h3,main.content .deal-card h3,main.content .next-card h3{font-size:var(--fa-type-card);line-height:1.3;margin:0 0 var(--fa-space-1)}
      main.content .card p,main.content .focused-card p,main.content .deal-card p,main.content .next-card p{font-size:var(--fa-type-body);line-height:var(--fa-line-body)}

      main.content label{font-size:var(--fa-type-label)!important;line-height:1.35!important;font-weight:650!important}
      main.content label small,.inline-unit-field .field-help,.inline-unit-field .field-error{font-size:var(--fa-type-help)!important;line-height:1.4!important}
      main.content input,main.content select,main.content textarea{font-size:15px!important;line-height:1.4!important}

      #newDeal{display:flex!important;flex-direction:column!important;gap:var(--fa-space-6)!important}
      #newDeal>.manual-analyse-intro,#newDeal>.manual-upload,#newDeal>.manual-evidence-tray,#newDeal>.auto-status,#newDeal>.field-section,#newDeal>.button{margin:0!important}
      #newDeal .manual-analyse-intro{padding:20px 22px!important}
      #newDeal .manual-analyse-intro strong{font-size:16px;line-height:1.3}
      #newDeal .manual-analyse-intro p{font-size:14px;line-height:1.5;margin-top:6px!important}
      #newDeal .manual-upload{padding:24px!important}
      #newDeal .manual-upload strong{font-size:15px;line-height:1.35}
      #newDeal .manual-upload small{font-size:12px;line-height:1.45}
      #newDeal .manual-evidence-tray{gap:var(--fa-space-2)}
      #newDeal .auto-status{font-size:13px!important;line-height:1.45!important;padding:12px 14px!important}
      #newDeal .field-section{padding:22px!important}
      #newDeal .field-section>h3{font-size:var(--fa-type-section)!important;line-height:1.25!important;letter-spacing:-.015em!important;margin:0 0 var(--fa-space-5)!important}
      #newDeal .field-section>*+*{margin-top:var(--fa-space-4)}
      #newDeal .field-section>h3+*{margin-top:0}
      #newDeal .form-grid,#newDeal .field-grid-3,#newDeal .field-grid-4,#newDeal .price-row,#newDeal .description-grid{gap:var(--fa-space-4)!important;align-items:start}
      #newDeal label{gap:var(--fa-space-1)!important}
      #newDeal .inline-unit-field{gap:var(--fa-space-1)!important}
      #newDeal input,#newDeal select,#newDeal textarea{margin:0}
      #newDeal textarea{min-height:138px}
      #newDeal .large-button{margin-top:2px!important;min-height:52px;font-size:15px}

      #newDeal .field-section + .field-section{margin-top:0!important}
      #newDeal .field-section>h3 + label,#newDeal .field-section>h3 + .form-grid,#newDeal .field-section>h3 + .field-grid-3,#newDeal .field-section>h3 + .field-grid-4,#newDeal .field-section>h3 + .price-row,#newDeal .field-section>h3 + .description-grid{margin-top:0!important}
      #newDeal .field-section label + .form-grid,#newDeal .field-section label + .field-grid-3,#newDeal .field-section label + .field-grid-4{margin-top:var(--fa-space-4)!important}

      .flipper-tip{margin-top:var(--fa-space-8);border-top:1px solid #e5ecef;padding:24px 2px 0;display:flex;align-items:flex-start;gap:12px;color:#536873}
      .flipper-tip-mark{width:30px;height:30px;border-radius:9px;background:#fff7e8;border:1px solid #f0d9aa;display:grid;place-items:center;flex:0 0 auto;font-size:15px}
      .flipper-tip-copy{min-width:0}
      .flipper-tip-label{display:block;font-size:10px;line-height:1.2;letter-spacing:.12em;font-weight:850;color:#9a671d;margin-bottom:6px}
      .flipper-tip p{margin:0;font-size:13px;line-height:1.55}

      .loading-flipper-tip{margin-top:13px;padding-top:12px;border-top:1px solid #e3edf1;color:#657b87;font-size:12px;line-height:1.5}
      .loading-flipper-tip strong{font-size:10px!important;letter-spacing:.1em;color:#9a671d;text-transform:uppercase;margin-right:6px}

      @media(max-width:800px){
        main.content{padding-top:34px;padding-bottom:100px}
        main.content>.page-head{margin-bottom:28px!important}
        main.content .page-head h1{font-size:34px!important}
        main.content .section-block{margin-top:32px!important}
        main.content .section-heading{margin-bottom:14px!important}
        #newDeal{gap:22px!important}
        #newDeal .field-section{padding:18px!important}
        #newDeal .field-section>h3{font-size:18px!important;margin-bottom:18px!important}
        #newDeal .field-section>*+*{margin-top:14px}
        #newDeal .form-grid,#newDeal .field-grid-3,#newDeal .field-grid-4,#newDeal .price-row,#newDeal .description-grid{gap:14px!important}
        .flipper-tip{margin-top:36px}
      }
    `
    document.head.appendChild(style)
  }

  function currentView() {
    const active = document.querySelector('.desktop-nav-item.active[data-nav],.mobile-nav-item.active[data-nav]')
    if (active?.dataset.nav) return active.dataset.nav
    const heading = (document.querySelector('main.content h1')?.textContent || '').toLowerCase()
    if (heading.includes('analyse')) return 'analyse'
    if (heading.includes('inventory')) return 'inventory'
    if (heading.includes('deal')) return 'deals'
    if (heading.includes('learn')) return 'learn'
    if (heading.includes('capital')) return 'capital'
    return 'home'
  }

  function stableTip(view) {
    const list = TIPS[view] || TIPS.default
    const dayKey = Math.floor(Date.now() / 86400000)
    let hash = dayKey
    for (const ch of view) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
    return list[Math.abs(hash) % list.length]
  }

  function mountPageTip() {
    injectStyles()
    const content = document.querySelector('main.content')
    if (!content) return
    const view = currentView()
    let tip = document.getElementById('flipperPageTip')
    if (!tip) {
      tip = document.createElement('aside')
      tip.id = 'flipperPageTip'
      tip.className = 'flipper-tip'
      tip.setAttribute('aria-label', 'Flipper Tip')
      content.appendChild(tip)
    } else if (tip.parentElement !== content) {
      content.appendChild(tip)
    }
    const text = stableTip(view)
    if (tip.dataset.view !== view || tip.dataset.text !== text) {
      tip.dataset.view = view
      tip.dataset.text = text
      tip.innerHTML = `<div class="flipper-tip-mark" aria-hidden="true">✦</div><div class="flipper-tip-copy"><span class="flipper-tip-label">FLIPPER TIP</span><p>${text}</p></div>`
    }
  }

  function loadingTips() {
    return TIPS.analyse.filter(t => !t.startsWith('You can correct'))
  }

  function updateLoadingTip() {
    const loading = document.querySelector('.direct-analysis-loading')
    if (!loading) {
      if (loadingTimer) clearInterval(loadingTimer)
      loadingTimer = null
      return
    }
    const copy = loading.querySelector('div:last-child') || loading
    let tip = loading.querySelector('.loading-flipper-tip')
    if (!tip) {
      tip = document.createElement('div')
      tip.className = 'loading-flipper-tip'
      copy.appendChild(tip)
    }
    const tips = loadingTips()
    tip.innerHTML = `<strong>Flipper Tip</strong>${tips[loadingTipIndex % tips.length]}`
    if (!loadingTimer) {
      loadingTimer = setInterval(() => {
        if (!document.querySelector('.direct-analysis-loading')) {
          clearInterval(loadingTimer)
          loadingTimer = null
          return
        }
        loadingTipIndex += 1
        updateLoadingTip()
      }, 15000)
    }
  }

  let timer
  const app = document.getElementById('app')
  if (app) {
    new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        mountPageTip()
        updateLoadingTip()
      }, 50)
    }).observe(app, { childList: true, subtree: true })
  }

  mountPageTip()
  updateLoadingTip()
})()
