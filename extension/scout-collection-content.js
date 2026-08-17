(() => {
  if (window.__flippersAiCollectionScannerLoaded) return
  window.__flippersAiCollectionScannerLoaded = true

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim()
  const text=el=>clean(el?.innerText||el?.textContent||'')
  const abs=href=>{try{return new URL(href,location.href).toString()}catch{return''}}
  const uniqBy=(rows,keyFn)=>{const seen=new Set();return rows.filter(row=>{const key=keyFn(row);if(!key||seen.has(key))return false;seen.add(key);return true})}

  function platform(){const h=location.hostname.toLowerCase();if(h.includes('facebook.com'))return'facebook';if(h.includes('ebay.com.au'))return'ebay';if(h.includes('gumtree.com.au'))return'gumtree';if(h.includes('depop.com'))return'depop';return'other'}
  function itemPattern(kind){if(kind==='facebook')return/\/marketplace\/item\/(\d+)/i;if(kind==='ebay')return/\/itm\/(?:[^/]+\/)?(\d+)/i;if(kind==='gumtree')return/\/s-ad\/[^/]+\/[^/]+\/(\d+)/i;if(kind==='depop')return/\/products\/([^/?#]+)/i;return/$a/}
  function isSingle(kind){return itemPattern(kind).test(location.href)}

  function queryText(kind){
    const selectors=kind==='facebook'?['input[placeholder*="Search Marketplace" i]','input[aria-label*="Search Marketplace" i]']:kind==='ebay'?['input[aria-label*="Search for anything" i]','input[type="search"]']:['input[placeholder*="search" i]','input[type="search"]']
    for(const s of selectors){const v=clean(document.querySelector(s)?.value);if(v)return v}
    const heading=[...document.querySelectorAll('h1,h2,[role="heading"]')].map(text).find(v=>v&&v.length<100&&!/^marketplace$/i.test(v))||''
    if(heading&&!/today'?s picks/i.test(heading))return heading
    const raw=clean(document.title);const m=raw.match(/\b\d+\s+results?\s+for\s+(.+?)(?:\s*[|–—-]\s*|$)/i);if(m?.[1])return clean(m[1]).slice(0,180)
    return''
  }

  function parsePrice(value){const m=clean(value).replace(/,/g,'').match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i);if(!m)return null;const n=Number(m[1]);return Number.isFinite(n)&&n>=0&&n<10000000?n:null}
  function inferRegion(value=''){const s=` ${clean(value).toUpperCase()} `;const rules=[['ACT',/\b(ACT|AUSTRALIAN CAPITAL TERRITORY)\b/],['NSW',/\b(NSW|NEW SOUTH WALES)\b/],['NT',/\b(NT|NORTHERN TERRITORY)\b/],['QLD',/\b(QLD|QUEENSLAND)\b/],['SA',/\b(SA|SOUTH AUSTRALIA)\b/],['TAS',/\b(TAS|TASMANIA)\b/],['VIC',/\b(VIC|VICTORIA)\b/],['WA',/\b(WA|WESTERN AUSTRALIA)\b/]];return rules.find(([,rx])=>rx.test(s))?.[0]||''}
  function inferCategory(title='',raw=''){const s=`${title} ${raw}`.toLowerCase();const rules=[['Phones',/\b(iphone|galaxy|pixel|smartphone|mobile phone|phone)\b/],['Audio',/\b(airpods?|earbuds?|headphones?|speaker|bose|sony xm|beats)\b/],['Sneakers',/\b(jordan|yeezy|air max|dunk|sneaker|shoe|adidas|nike|new balance)\b/],['Gaming',/\b(playstation|ps5|ps4|xbox|nintendo|switch|gaming console|steam deck)\b/],['Watches',/\b(rolex|omega|seiko|watch|apple watch|garmin)\b/],['Collectibles',/\b(pokemon|pokémon|trading card|tcg|sports card|coin|lego)\b/],['Computers',/\b(macbook|laptop|pc|computer|ipad|surface|monitor|gpu|graphics card)\b/],['Cameras',/\b(camera|canon|nikon|sony alpha|fujifilm|gopro|lens)\b/],['Fashion',/\b(handbag|bag|jacket|hoodie|shirt|dress|supreme|gucci|prada|louis vuitton)\b/],['Home & Appliances',/\b(fridge|washing machine|dryer|vacuum|dyson|coffee machine|furniture|sofa|television|\btv\b)\b/]];return rules.find(([,rx])=>rx.test(s))?.[0]||'Other'}

  function cardRoot(anchor,pattern){
    let node=anchor,best=anchor.parentElement||anchor
    for(let i=0;i<10&&node?.parentElement;i++){
      node=node.parentElement;const rect=node.getBoundingClientRect();const raw=text(node)
      const ids=[...node.querySelectorAll('a[href]')].map(a=>abs(a.getAttribute('href')||a.href||'')).map(h=>h.match(pattern)?.[1]).filter(Boolean)
      if(new Set(ids).size>1)break
      if(raw.length>=4&&raw.length<=1800&&rect.width>=80&&rect.height>=45)best=node
    }
    return best
  }
  function candidateTitle(anchor,card,priceText){
    const aria=clean(anchor.getAttribute('aria-label'));if(aria&&aria.length<=180&&!/^(marketplace|view item|sponsored)$/i.test(aria)&&parsePrice(aria)===null)return aria
    const title=clean(anchor.getAttribute('title'));if(title&&title.length<=180&&parsePrice(title)===null)return title
    const alt=clean(card.querySelector('img')?.alt);if(alt&&alt.length>=3&&alt.length<=180&&!/image may contain|no photo/i.test(alt))return alt
    const lines=String(card.innerText||'').split(/\n+/).map(clean).filter(Boolean);return lines.find(line=>line!==priceText&&parsePrice(line)===null&&!/^(sponsored|just listed|new listing|ships to you|delivery available|save|share)$/i.test(line)&&line.length>=3&&line.length<=180)||''
  }
  function candidateLocation(card,title){const lines=String(card.innerText||'').split(/\n+/).map(clean).filter(Boolean);const rows=lines.filter(line=>line!==title&&parsePrice(line)===null&&line.length<=120);return rows.find(line=>/\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b/i.test(line))||rows.find(line=>/\b\d{4}\b/.test(line))||''}
  function candidateFromAnchor(anchor,kind,pattern){
    const href=abs(anchor.getAttribute('href')||anchor.href||''),m=href.match(pattern);if(!m)return null
    const root=cardRoot(anchor,pattern),raw=text(root);if(!raw||raw.length<4)return null
    const price=parsePrice(raw),priceText=raw.match(/(?:A\$|AU\$|\$)\s*[0-9][0-9,.]*(?:\.\d{1,2})?/i)?.[0]||'',title=candidateTitle(anchor,root,priceText),locationText=candidateLocation(root,title)
    const images=[...root.querySelectorAll('img')].filter(img=>/^https?:/i.test(img.currentSrc||img.src||'')).sort((a,b)=>(b.width*b.height)-(a.width*a.height))
    return{listingId:m[1]||'',url:href,title,askingPrice:price,currency:'AUD',location:locationText,regionCode:inferRegion(`${locationText} ${raw}`),categoryLabel:inferCategory(title,raw),condition:'',sellerName:'',thumbnailUrl:images[0]?.currentSrc||images[0]?.src||'',rawText:raw.slice(0,2400),platform:kind}
  }

  function pageLooksLikeCollection(kind,count){
    if(isSingle(kind))return false
    const path=location.pathname,raw=clean(document.title)
    if(kind==='facebook'&&/^\/marketplace\/?$/i.test(path))return true
    if(kind==='facebook'&&/\/marketplace\/(search|category|you\/selling|you\/buying|groups|notifications)/i.test(path))return true
    if(/\b\d+\s+results?\s+for\b/i.test(raw))return true
    if(/[?&](q|query|keyword|search)=/i.test(location.search))return true
    return count>=1
  }

  function collectionScan(){
    const kind=platform(),pattern=itemPattern(kind)
    if(isSingle(kind))return{mode:'single',platform:kind,query:queryText(kind),candidates:[],pageUrl:location.href,pageTitle:clean(document.title)}
    const anchors=[...document.querySelectorAll('a[href]')].filter(a=>pattern.test(abs(a.getAttribute('href')||a.href||'')))
    const candidates=uniqBy(anchors.map(a=>candidateFromAnchor(a,kind,pattern)).filter(Boolean),r=>r.listingId||r.url).filter(r=>r.title||r.askingPrice!==null).slice(0,100)
    const regions=[...new Set(candidates.map(c=>c.regionCode).filter(Boolean))],categories=[...new Set(candidates.map(c=>c.categoryLabel).filter(Boolean))]
    const looks=pageLooksLikeCollection(kind,candidates.length)
    return{mode:looks?'collection':'single',collectionSignal:looks,platform:kind,query:queryText(kind),candidates,visibleCount:candidates.length,regions,categories,pageUrl:location.href,pageTitle:clean(document.title),capturedAt:new Date().toISOString()}
  }

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.type==='FLIPPERS_SCAN_COLLECTION'){try{sendResponse({ok:true,data:collectionScan()})}catch(error){sendResponse({ok:false,error:error.message||String(error)})}return}
    if(message?.type==='FLIPPERS_SCROLL_RESULTS'){
      window.scrollBy({top:Math.max(window.innerHeight*.85,650),behavior:'smooth'})
      setTimeout(()=>{try{sendResponse({ok:true,data:collectionScan()})}catch(error){sendResponse({ok:false,error:error.message||String(error)})}},750)
      return true
    }
  })
})()
