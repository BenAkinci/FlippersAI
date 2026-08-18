(() => {
  if (window.__flippersMarketplaceTrustOverlayV079) return
  window.__flippersMarketplaceTrustOverlayV079 = true
  const HISTORY_KEY='flippers_rating_history_v067'
  const LABEL='flippersai-trust-label-v079'
  const HOST='flippersai-rating-host-v077'
  let ratings=[]; let timer=0
  const abs=href=>{try{return new URL(href,location.href).toString()}catch{return''}}
  const pathKey=url=>{try{const u=new URL(url,location.href);return `${u.hostname.toLowerCase().replace(/^www\./,'')}${u.pathname.replace(/\/+$/,'')||'/'}`}catch{return''}}
  const token=url=>{try{const u=new URL(url,location.href),p=u.pathname,h=u.hostname.toLowerCase();let m=null;if(h.includes('facebook.com'))m=p.match(/\/marketplace\/item\/(\d+)/i);else if(h.includes('ebay.com.au'))m=p.match(/\/itm\/(?:[^/]+\/)?(\d+)/i);else if(h.includes('depop.com'))m=p.match(/\/products\/([^/?#]+)/i);else if(h.includes('gumtree.com.au'))m=p.match(/\/(?:s-ad|web\/listing)\/(?:.*\/)?(\d+)(?:\/)?$/i)||p.match(/\/(\d{7,})(?:\/)?$/);return m?.[1]||''}catch{return''}}
  function ensureStyle(){if(document.getElementById('flippersai-trust-style-v079'))return;const s=document.createElement('style');s.id='flippersai-trust-style-v079';s.textContent=`.${LABEL}{position:absolute!important;z-index:2147483647!important;padding:5px 7px!important;border-radius:999px!important;font:900 9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.03em!important;color:#fff!important;pointer-events:none!important;box-shadow:0 4px 12px rgba(0,0,0,.22)!important;border:1px solid rgba(255,255,255,.8)!important;white-space:nowrap!important}.${LABEL}.danger{background:#a73730!important}.${LABEL}.warn{background:#a76000!important}`;document.documentElement.appendChild(s)}
  function match(root){const anchors=[...root.querySelectorAll('a[href]')];for(const a of anchors){const href=abs(a.getAttribute('href')||a.href||'');const pk=pathKey(href),id=token(href);const r=ratings.find(x=>pathKey(x.url||'')===pk||(id&&String(x.listingId||token(x.url||''))===String(id)));if(r)return r}return null}
  function labelFor(r){const s=String(r?.authenticityStatus||'');if(s==='likely_counterfeit')return{tone:'danger',text:'LIKELY COUNTERFEIT'};if(s==='high_risk')return{tone:'danger',text:'HIGH FAKE RISK'};if(s==='uncertain')return{tone:'warn',text:'VERIFY AUTHENTICITY'};return null}
  function apply(){ensureStyle();document.querySelectorAll(`.${LABEL}`).forEach(x=>x.remove());for(const root of document.querySelectorAll(`.${HOST}`)){const r=match(root),meta=labelFor(r);if(!meta)continue;const badge=root.querySelector('.flippersai-cover-score-v077');if(!badge)continue;const el=document.createElement('div');el.className=`${LABEL} ${meta.tone}`;el.textContent=meta.text;el.title='FlippersAI authenticity warning — verify before spending money';root.appendChild(el);el.style.top=`${Math.round(badge.offsetTop+badge.offsetHeight+4)}px`;el.style.left=`${Math.round(badge.offsetLeft)}px`}}
  async function load(){const x=await chrome.storage.local.get(HISTORY_KEY).catch(()=>({}));ratings=Array.isArray(x[HISTORY_KEY])?x[HISTORY_KEY]:[];apply()}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[HISTORY_KEY]){ratings=Array.isArray(changes[HISTORY_KEY].newValue)?changes[HISTORY_KEY].newValue:[];apply()}})
  chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='FLIPPERS_RATING_OVERLAY_V067'||msg?.type==='FLIPPERS_RATING_OVERLAY_V077'){if(Array.isArray(msg.ratings))ratings=msg.ratings;setTimeout(apply,20)}})
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,80)}).observe(document.documentElement,{childList:true,subtree:true})
  window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(apply,40)},{passive:true})
  load()
})()
