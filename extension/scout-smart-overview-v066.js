(() => {
  if (window.__flippersSmartScoutOverviewV066) return
  window.__flippersSmartScoutOverviewV066 = true

  const $=(s,r=document)=>r.querySelector(s)
  const $$=(s,r=document)=>[...r.querySelectorAll(s)]
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  let regionFilter='ALL',categoryFilter='ALL',timer=null

  function inferRegion(value=''){
    const s=` ${String(value).toUpperCase()} `
    const rules=[['ACT',/\b(ACT|AUSTRALIAN CAPITAL TERRITORY)\b/],['NSW',/\b(NSW|NEW SOUTH WALES)\b/],['NT',/\b(NT|NORTHERN TERRITORY)\b/],['QLD',/\b(QLD|QUEENSLAND)\b/],['SA',/\b(SA|SOUTH AUSTRALIA)\b/],['TAS',/\b(TAS|TASMANIA)\b/],['VIC',/\b(VIC|VICTORIA)\b/],['WA',/\b(WA|WESTERN AUSTRALIA)\b/]]
    return rules.find(([,rx])=>rx.test(s))?.[0]||'Unknown'
  }
  function inferCategory(value=''){
    const s=String(value).toLowerCase();const rules=[['Phones',/\b(iphone|galaxy|pixel|smartphone|mobile phone|phone)\b/],['Audio',/\b(airpods?|earbuds?|headphones?|speaker|bose|sony xm|beats)\b/],['Sneakers',/\b(jordan|yeezy|air max|dunk|sneaker|shoe|adidas|nike|new balance)\b/],['Gaming',/\b(playstation|ps5|ps4|xbox|nintendo|switch|gaming console|steam deck)\b/],['Watches',/\b(rolex|omega|seiko|watch|apple watch|garmin)\b/],['Collectibles',/\b(pokemon|pokémon|trading card|tcg|sports card|coin|lego)\b/],['Computers',/\b(macbook|laptop|pc|computer|ipad|surface|monitor|gpu|graphics card)\b/],['Cameras',/\b(camera|canon|nikon|sony alpha|fujifilm|gopro|lens)\b/],['Fashion',/\b(handbag|bag|jacket|hoodie|shirt|dress|supreme|gucci|prada|louis vuitton)\b/],['Home & Appliances',/\b(fridge|washing machine|dryer|vacuum|dyson|coffee machine|furniture|sofa|tv|television)\b/]]
    return rules.find(([,rx])=>rx.test(s))?.[0]||'Other'
  }
  function rows(){return $$('.scout-candidate').map(card=>{const title=$('.scout-candidate-title-row strong',card)?.textContent?.trim()||'';const meta=$('.scout-meta',card)?.textContent?.trim()||'';const region=card.dataset.smartRegion||inferRegion(meta);const category=card.dataset.smartCategory||inferCategory(title);card.dataset.smartRegion=region;card.dataset.smartCategory=category;return{card,title,region,category}})}
  function counts(list,key){const m=new Map();list.forEach(r=>m.set(r[key],(m.get(r[key])||0)+1));return[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))}
  function match(r){return(regionFilter==='ALL'||r.region===regionFilter)&&(categoryFilter==='ALL'||r.category===categoryFilter)}
  function chip(label,value,active,type,count){return`<button type="button" class="smart-filter-chip ${active?'active':''}" data-smart-${type}="${esc(value)}">${esc(label)}<span>${count}</span></button>`}
  function source(){return $('.scout-capture-source div:first-child strong')?.textContent?.trim()||'Marketplace'}

  function render(){
    const list=$('.scout-list'),head=$('.scout-page-head');if(!list||!head)return
    const all=rows();if(!all.length)return
    all.forEach(r=>r.card.classList.toggle('smart-scout-hidden',!match(r)))
    const regions=counts(all.filter(r=>r.region!=='Unknown'),'region'),categories=counts(all,'category'),visible=all.filter(match)
    const regionNames=regions.map(([x])=>x),categoryNames=categories.map(([x])=>x)
    const bullets=[]
    bullets.push(`${all.length} listings captured from ${source()}.`)
    if(regionNames.length)bullets.push(`Areas: ${regionNames.join(', ')}. Filter to the states or territories you actually want.`)
    if(categoryNames.length>1)bullets.push(`Mixed categories detected: ${categoryNames.join(', ')}. Each category stays separate while you shortlist.`)
    else bullets.push(`Listings currently fall into ${categoryNames[0]||'Other'}.`)

    let box=$('#smartScoutOverview');if(!box){box=document.createElement('section');box.id='smartScoutOverview';box.className='smart-scout-overview';head.insertAdjacentElement('afterend',box)}
    box.innerHTML=`<div class="smart-overview-grid">
      <div><span>SOURCE</span><strong>${esc(source())}</strong></div>
      <div><span>LISTINGS SCANNED</span><strong>${all.length}</strong></div>
      <div><span>AREAS</span><strong>${regionNames.length?esc(regionNames.join(', ')):'Not detected'}</strong></div>
      <div><span>CATEGORIES</span><strong>${categoryNames.length===1?esc(categoryNames[0]):`${categoryNames.length} detected`}</strong></div>
    </div>
    <div class="smart-scout-description"><span>QUICK SUMMARY</span><ul>${bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    ${regions.length?`<div class="smart-filter-row"><span>AREA</span><div>${chip('All','ALL',regionFilter==='ALL','region',all.length)}${regions.map(([n,c])=>chip(n,n,regionFilter===n,'region',c)).join('')}</div></div>`:''}
    <div class="smart-filter-row"><span>CATEGORY</span><div>${chip('All','ALL',categoryFilter==='ALL','category',all.length)}${categories.map(([n,c])=>chip(n,n,categoryFilter===n,'category',c)).join('')}</div></div>
    <div class="smart-filter-actions"><span>${visible.length} listing${visible.length===1?'':'s'} shown</span><button type="button" id="smartSelectVisible">Select shown only</button><button type="button" id="smartClearFilters">Clear filters</button></div>`
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest?.('#smartScoutOverview'))return
    const region=event.target.closest?.('[data-smart-region]');if(region){event.preventDefault();regionFilter=region.dataset.smartRegion||'ALL';render();return}
    const cat=event.target.closest?.('[data-smart-category]');if(cat){event.preventDefault();categoryFilter=cat.dataset.smartCategory||'ALL';render();return}
    if(event.target.closest?.('#smartClearFilters')){event.preventDefault();regionFilter='ALL';categoryFilter='ALL';render();return}
    if(event.target.closest?.('#smartSelectVisible')){event.preventDefault();const ids=rows().filter(match).map(r=>r.card.dataset.candidate).filter(Boolean);document.dispatchEvent(new CustomEvent('flippers:bulk-select',{detail:{ids}}))}
  },true)

  new MutationObserver(ms=>{if(!ms.some(m=>!m.target.closest?.('#smartScoutOverview')))return;clearTimeout(timer);timer=setTimeout(render,90)}).observe(document.getElementById('app'),{childList:true,subtree:true})
  render()
})()
