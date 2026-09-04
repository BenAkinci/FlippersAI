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
      :root{--fa-space-1:8px;--fa-space-2:12px;--fa-space-3:16px;--fa-space-4:20px;--fa-space-5:24px;--fa-space-6:32px}

      /* Consistent page rhythm */
      main.content{padding-top:48px;padding-bottom:88px}
      main.content>.page-head{margin-bottom:var(--fa-space-6)}
      main.content .section-block{margin-top:36px}
      main.content .section-heading{margin-bottom:var(--fa-space-3)}
      main.content .button-row,main.content .quick-actions{gap:var(--fa-space-2)}

      /* Analyse form rhythm */
      #newDeal{display:flex!important;flex-direction:column!important;gap:var(--fa-space-5)!important}
      #newDeal>.manual-analyse-intro,#newDeal>.manual-upload,#newDeal>.manual-evidence-tray,#newDeal>.auto-status,#newDeal>.field-section,#newDeal>.button{margin:0!important}
      #newDeal .manual-analyse-intro{padding:18px 20px}
      #newDeal .manual-upload{padding:24px}
      #newDeal .manual-evidence-tray{gap:var(--fa-space-2)}
      #newDeal .field-section{padding:20px!important}
      #newDeal .field-section>h3{margin:0 0 var(--fa-space-3)!important}
      #newDeal .field-section>*+*{margin-top:var(--fa-space-3)}
      #newDeal .field-section>h3+*{margin-top:0}
      #newDeal .form-grid,#newDeal .field-grid-3,#newDeal .field-grid-4,#newDeal .price-row,#newDeal .description-grid{gap:var(--fa-space-3)!important}
      #newDeal label{gap:var(--fa-space-1)}
      #newDeal .inline-unit-field{gap:var(--fa-space-1)!important}
      #newDeal input,#newDeal select,#newDeal textarea{margin:0}
      #newDeal .large-button{margin-top:4px!important}

      /* Informational mentor tip */
      .flipper-tip{margin-top:44px;border-top:1px solid #e5ecef;padding:22px 2px 0;display:flex;align-items:flex-start;gap:12px;color:#536873}
      .flipper-tip-mark{width:30px;height:30px;border-radius:9px;background:#fff7e8;border:1px solid #f0d9aa;display:grid;place-items:center;flex:0 0 auto;font-size:15px}
      .flipper-tip-copy{min-width:0}
      .flipper-tip-label{display:block;font-size:10px;letter-spacing:.12em;font-weight:850;color:#9a671d;margin-bottom:4px}
      .flipper-tip p{margin:0;font-size:13px;line-height:1.55}

      .loading-flipper-tip{margin-top:13px;padding-top:12px;border-top:1px solid #e3edf1;color:#657b87;font-size:12px;line-height:1.5}
      .loading-flipper-tip strong{font-size:10px!important;letter-spacing:.1em;color:#9a671d;text-transform:uppercase;margin-right:6px}

      @media(max-width:800px){
        main.content{padding-top:34px;padding-bottom:100px}
        main.content>.page-head{margin-bottom:24px}
        #newDeal{gap:20px!important}
        #newDeal .field-section{padding:18px!important}
        #newDeal .field-section>*+*{margin-top:14px}
        .flipper-tip{margin-top:34px}
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
      }, 7000)
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
