(() => {
  if (window.__flippersSmartScoutWeb) return
  window.__flippersSmartScoutWeb = true
  const $ = (s, root=document) => root.querySelector(s)
  const $$ = (s, root=document) => [...root.querySelectorAll(s)]
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  const money = v => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(v))
  let regionFilter='ALL', categoryFilter='ALL'

  const parsePrice = value => {
    const m=String(value||'').replace(/,/g,'').match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i)
    const n=m?Number(m[1]):NaN
    return Number.isFinite(n)?n:null
  }
  const inferRegion = value => {
    const s=` ${String(value||'').toUpperCase()} `
    const rules=[['ACT',/\b(ACT|AUSTRALIAN CAPITAL TERRITORY)\b/],['NSW',/\b(NSW|NEW SOUTH WALES)\b/],['NT',/\b(NT|NORTHERN TERRITORY)\b/],['QLD',/\b(QLD|QUEENSLAND)\b/],['SA',/\b(SA|SOUTH AUSTRALIA)\b/],['TAS',/\b(TAS|TASMANIA)\b/],['VIC',/\b(VIC|VICTORIA)\b/],['WA',/\b(WA|WESTERN AUSTRALIA)\b/]]
    return rules.find(([,r])=>r.test(s))?.[0]||'Unknown'
  }
  const inferCategory = value => {
    const s=String(value||'').toLowerCase()
    const rules=[['Phones',/\b(iphone|galaxy|pixel|smartphone|mobile phone|phone)\b/],['Audio',/\b(airpods?|earbuds?|headphones?|speaker|bose|sony xm|beats)\b/],['Sneakers',/\b(jordan|yeezy|air max|dunk|sneaker|shoe|adidas|nike|new balance)\b/],['Gaming',/\b(playstation|ps5|ps4|xbox|nintendo|switch|gaming console|steam deck)\b/],['Watches',/\b(rolex|omega|seiko|watch|apple watch|garmin)\b/],['Collectibles',/\b(pokemon|pokémon|trading card|tcg|sports card|coin|lego)\b/],['Computers',/\b(macbook|laptop|pc|computer|ipad|surface|monitor|gpu|graphics card)\b/],['Cameras',/\b(camera|canon|nikon|sony alpha|fujifilm|gopro|lens)\b/],['Fashion',/\b(handbag|bag|jacket|hoodie|shirt|dress|supreme|gucci|prada|louis vuitton)\b/],['Home & Appliances',/\b(fridge|washing machine|dryer|vacuum|dyson|coffee machine|furniture|sofa)\b/]]
    return rules.find(([,r])=>r.test(s))?.[0]||'Other'
  }
  const countBy=(rows,key)=>{
    const m=new Map();rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+1));return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
  }
  function inspect(){
    return $$('.scout-web-card').map(card=>{
      const title=$('.scout-web-title strong',card)?.textContent?.trim()||'Untitled listing'
      const meta=$('.scout-web-main>p',card)?.textContent?.trim()||''
      const row={card,title,meta,price:parsePrice(meta),region:inferRegion(meta),category:inferCategory(title)}
      card.dataset.smartRegion=row.region;card.dataset.smartCategory=row.category
      return row
    })
  }
  function render(){
    const shell=$('.scout-web-shell'),grid=$('.scout-web-grid'),head=$('.scout-web-head')
    if(!shell||!grid||!head)return
    const rows=inspect();if(!rows.length)return
    rows.forEach(r=>r.card.hidden=!((regionFilter==='ALL'||r.region===regionFilter)&&(categoryFilter==='ALL'||r.category===categoryFilter)))
    const prices=rows.map(r=>r.price).filter(Number.isFinite),avg=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:null
    const min=prices.length?Math.min(...prices):null,max=prices.length?Math.max(...prices):null
    const regions=countBy(rows.filter(r=>r.region!=='Unknown'),'region'),cats=countBy(rows,'category')
    const query=$('h1',head)?.textContent?.trim()||'marketplace results'
    const bullets=[`${rows.length} listings detected for ${query}.`,avg==null?'No reliable asking prices are visible yet.':`Average visible asking price is ${money(avg)}${min!==max?`, ranging from ${money(min)} to ${money(max)}`:''}.`,regions.length?`Listings span ${regions.map(([x])=>x).join(', ')}.`:'No broad state or territory could be read reliably yet.',cats.length>1?`Mixed products detected across ${cats.map(([x])=>x).join(', ')}. They are being kept separate by category.`:`Results appear to be in the ${cats[0]?.[0]||'Other'} category.`]
    let box=$('#smartScoutWebOverview')
    if(!box){box=document.createElement('section');box.id='smartScoutWebOverview';box.className='smart-scout-web-overview';head.insertAdjacentElement('afterend',box)}
    const chip=(label,val,active,type,count)=>`<button type="button" class="smart-web-chip ${active?'active':''}" data-${type}="${esc(val)}">${esc(label)}${count!=null?` <span>${count}</span>`:''}</button>`
    box.innerHTML=`<div class="smart-web-metrics"><div><span>LISTINGS DETECTED</span><strong>${rows.length}</strong></div><div><span>AVERAGE PRICE</span><strong>${avg==null?'Not available':money(avg)}</strong></div><div><span>AREAS</span><strong>${regions.length?esc(regions.map(([x])=>x).join(', ')):'Not detected'}</strong></div><div><span>CATEGORIES</span><strong>${cats.length===1?esc(cats[0][0]):`${cats.length} detected`}</strong></div></div><div class="smart-web-summary"><span>SCANNED SUMMARY</span><ul>${bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>${regions.length?`<div class="smart-web-filter"><span>AREA</span><div>${chip('All','ALL',regionFilter==='ALL','region',rows.length)}${regions.map(([x,n])=>chip(x,x,regionFilter===x,'region',n)).join('')}</div></div>`:''}${cats.length>1?`<div class="smart-web-filter"><span>CATEGORY</span><div>${chip('All','ALL',categoryFilter==='ALL','category',rows.length)}${cats.map(([x,n])=>chip(x,x,categoryFilter===x,'category',n)).join('')}</div></div>`:''}`
    $$('[data-region]',box).forEach(b=>b.onclick=()=>{regionFilter=b.dataset.region;render()})
    $$('[data-category]',box).forEach(b=>b.onclick=()=>{categoryFilter=b.dataset.category;render()})
  }
  let t
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(render,60)}).observe(document.body,{childList:true,subtree:true})
  render()
})()
