(() => {
  const TIPS={
    home:['Protect your buying power. A good flip is not only profitable — it should also leave enough cash available for the next opportunity.','Fast inventory turnover can be more valuable than chasing the highest possible margin on every item.','Track what actually sold, not what sellers hoped to get. Real outcomes are better training data for your next decision.'],
    analyse:['Exact model, size and condition can materially change resale value. Small identification errors can produce bad comps.','Sold listings are stronger valuation evidence than active asking prices because they show what buyers actually paid.','A strong seller profile reduces transaction risk, but it does not prove the item itself is authentic.','Photos of labels, tags, serials, soles and visible flaws can improve identification, condition and authenticity confidence.','Profit is not the whole story. Sell-through speed matters because slow stock ties up money that could fund another flip.'],
    deals:['Negotiate from your maximum safe buy price, not from the seller’s asking price. Your margin should survive fees and surprises.','Walking away from a marginal deal preserves capital for a better one.'],
    inventory:['Stale inventory has a cost even when it has not lost money on paper — your capital is still locked inside it.','Good listing photos reduce buyer uncertainty and can improve conversion.'],
    learn:['The best resellers build pattern recognition: item, condition, acquisition price, demand, fees and time-to-sale all work together.'],
    capital:['Available cash and total profit are different things. Keep enough liquidity to act when a genuinely strong opportunity appears.'],
    default:['Good reselling decisions come from combining evidence, economics and risk — not from any single number.']
  }
  let loadingTipIndex=0,loadingTimer=null,scheduled=false

  function injectStyles(){
    if(document.getElementById('flipperTipsSpacingStyles'))return
    const s=document.createElement('style');s.id='flipperTipsSpacingStyles';s.textContent=`
      :root{--fa-space-1:8px;--fa-space-2:12px;--fa-space-3:16px;--fa-space-4:20px;--fa-space-5:24px;--fa-space-6:32px;--fa-space-7:40px;--fa-space-8:48px;--fa-type-page:clamp(34px,4vw,42px);--fa-type-section:20px;--fa-type-card:16px;--fa-type-label:13px;--fa-type-body:15px;--fa-type-help:12px;--fa-line-tight:1.15;--fa-line-body:1.5}
      main.content{padding-top:var(--fa-space-8);padding-bottom:88px}
      main.content>.page-head{margin-bottom:var(--fa-space-7)!important;align-items:flex-end}
      main.content .page-head h1{font-size:var(--fa-type-page)!important;line-height:var(--fa-line-tight)!important;letter-spacing:-.04em!important;margin:0 0 10px!important}
      main.content .page-head p{font-size:16px!important;line-height:1.55!important;margin:0!important;max-width:720px}
      main.content .eyebrow{font-size:11px!important;line-height:1.2!important;letter-spacing:.11em!important}
      main.content .section-block{margin-top:var(--fa-space-7)!important}
      main.content .section-heading{margin-bottom:var(--fa-space-4)!important;align-items:flex-end}
      main.content .section-heading h2{font-size:24px!important;line-height:1.2!important;margin:0!important;letter-spacing:-.025em!important}
      main.content .card h2,main.content .focused-card h2,main.content .deal-card h2{font-size:22px;line-height:1.25;margin:0 0 var(--fa-space-2)}
      main.content .card h3,main.content .focused-card h3,main.content .deal-card h3,main.content .next-card h3{font-size:var(--fa-type-card);line-height:1.3;margin:0 0 var(--fa-space-1)}
      main.content .card p,main.content .focused-card p,main.content .deal-card p,main.content .next-card p{font-size:var(--fa-type-body);line-height:var(--fa-line-body)}
      main.content label{font-size:var(--fa-type-label)!important;line-height:1.35!important;font-weight:650!important}
      main.content label small,.inline-unit-field .field-help,.inline-unit-field .field-error{font-size:var(--fa-type-help)!important;line-height:1.4!important}
      main.content input,main.content select,main.content textarea{font-size:15px!important;line-height:1.4!important}
      #newDeal{display:flex!important;flex-direction:column!important;gap:var(--fa-space-6)!important}
      #newDeal>.manual-analyse-intro,#newDeal>.manual-upload,#newDeal>.manual-evidence-tray,#newDeal>.auto-status,#newDeal>.field-section,#newDeal>.button{margin:0!important}
      #newDeal .manual-analyse-intro{padding:20px 22px!important}#newDeal .manual-analyse-intro strong{font-size:16px;line-height:1.3}#newDeal .manual-analyse-intro p{font-size:14px;line-height:1.5;margin-top:6px!important}
      #newDeal .manual-upload{padding:24px!important}#newDeal .manual-upload strong{font-size:15px;line-height:1.35}#newDeal .manual-upload small{font-size:12px;line-height:1.45}
      #newDeal .manual-evidence-tray{gap:var(--fa-space-2)}#newDeal .auto-status{font-size:13px!important;line-height:1.45!important;padding:12px 14px!important}
      #newDeal .field-section{padding:22px!important}#newDeal .field-section>h3{font-size:var(--fa-type-section)!important;line-height:1.25!important;letter-spacing:-.015em!important;margin:0 0 var(--fa-space-5)!important}
      #newDeal .field-section>*+*{margin-top:var(--fa-space-4)}#newDeal .field-section>h3+*{margin-top:0}
      #newDeal .form-grid,#newDeal .field-grid-3,#newDeal .field-grid-4,#newDeal .price-row,#newDeal .description-grid{gap:var(--fa-space-4)!important;align-items:start}
      #newDeal label,#newDeal .inline-unit-field{gap:var(--fa-space-1)!important}#newDeal input,#newDeal select,#newDeal textarea{margin:0}#newDeal textarea{min-height:138px}#newDeal .large-button{margin-top:2px!important;min-height:52px;font-size:15px}
      .flipper-tip{margin-top:var(--fa-space-8);border-top:1px solid #e5ecef;padding:24px 2px 0;display:flex;align-items:flex-start;gap:12px;color:#536873;contain:layout paint}
      .flipper-tip-mark{width:30px;height:30px;border-radius:9px;background:#fff7e8;border:1px solid #f0d9aa;display:grid;place-items:center;flex:0 0 auto;font-size:15px}.flipper-tip-copy{min-width:0}.flipper-tip-label{display:block;font-size:10px;line-height:1.2;letter-spacing:.12em;font-weight:850;color:#9a671d;margin-bottom:6px}.flipper-tip p{margin:0;font-size:13px;line-height:1.55}
      .loading-flipper-tip{margin-top:13px;padding-top:12px;border-top:1px solid #e3edf1;color:#657b87;font-size:12px;line-height:1.5;min-height:34px}.loading-flipper-tip strong{font-size:10px!important;letter-spacing:.1em;color:#9a671d;text-transform:uppercase;margin-right:6px}
      @media(max-width:800px){main.content{padding-top:34px;padding-bottom:100px}main.content>.page-head{margin-bottom:28px!important}main.content .page-head h1{font-size:34px!important}main.content .section-block{margin-top:32px!important}#newDeal{gap:22px!important}#newDeal .field-section{padding:18px!important}#newDeal .field-section>h3{font-size:18px!important;margin-bottom:18px!important}.flipper-tip{margin-top:36px}}
    `;document.head.appendChild(s)
  }

  function currentView(){
    const active=document.querySelector('.desktop-nav-item.active[data-nav],.mobile-nav-item.active[data-nav]');if(active?.dataset.nav)return active.dataset.nav
    const h=(document.querySelector('main.content h1')?.textContent||'').toLowerCase();if(h.includes('analyse'))return'analyse';if(h.includes('inventory'))return'inventory';if(h.includes('deal'))return'deals';if(h.includes('learn'))return'learn';if(h.includes('capital'))return'capital';return'home'
  }
  function stableTip(view){const list=TIPS[view]||TIPS.default;const day=Math.floor(Date.now()/86400000);let hash=day;for(const ch of view)hash=((hash<<5)-hash+ch.charCodeAt(0))|0;return list[Math.abs(hash)%list.length]}

  function mountPageTip(){
    injectStyles();const content=document.querySelector('main.content');if(!content)return
    const view=currentView(),text=stableTip(view);let tip=document.getElementById('flipperPageTip')
    if(!tip){tip=document.createElement('aside');tip.id='flipperPageTip';tip.className='flipper-tip';tip.setAttribute('aria-label','Flipper Tip');tip.innerHTML='<div class="flipper-tip-mark" aria-hidden="true">✦</div><div class="flipper-tip-copy"><span class="flipper-tip-label">FLIPPER TIP</span><p></p></div>';content.appendChild(tip)}
    if(tip.parentElement!==content)content.appendChild(tip)
    if(tip.dataset.view===view&&tip.dataset.text===text)return
    tip.dataset.view=view;tip.dataset.text=text;const p=tip.querySelector('p');if(p&&p.textContent!==text)p.textContent=text
  }

  function loadingTips(){return TIPS.analyse}
  function updateLoadingTip(force=false){
    const loading=document.querySelector('.direct-analysis-loading')
    if(!loading){if(loadingTimer){clearInterval(loadingTimer);loadingTimer=null}return}
    const copy=loading.querySelector('div:last-child')||loading;let tip=loading.querySelector('.loading-flipper-tip')
    if(!tip){tip=document.createElement('div');tip.className='loading-flipper-tip';tip.innerHTML='<strong>Flipper Tip</strong><span></span>';copy.appendChild(tip)}
    const text=loadingTips()[loadingTipIndex%loadingTips().length],span=tip.querySelector('span')
    if(force||tip.dataset.text!==text){tip.dataset.text=text;if(span)span.textContent=text}
    if(!loadingTimer)loadingTimer=setInterval(()=>{if(!document.querySelector('.direct-analysis-loading')){clearInterval(loadingTimer);loadingTimer=null;return}loadingTipIndex+=1;updateLoadingTip(true)},15000)
  }

  function refresh(){scheduled=false;mountPageTip();updateLoadingTip(false)}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)}

  const app=document.getElementById('app')
  if(app)new MutationObserver(records=>{
    const meaningful=records.some(r=>{
      const t=r.target instanceof Element?r.target:r.target.parentElement
      if(t?.closest?.('#flipperPageTip,.loading-flipper-tip'))return false
      return [...r.addedNodes,...r.removedNodes].some(n=>!(n instanceof Element)||!n.closest?.('#flipperPageTip,.loading-flipper-tip'))
    })
    if(meaningful)schedule()
  }).observe(app,{childList:true,subtree:true})
  mountPageTip();updateLoadingTip(false)
})()
