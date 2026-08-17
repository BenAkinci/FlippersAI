(() => {
  if (window.__flippersSmartScoutOverview) return
  window.__flippersSmartScoutOverview = true

  const $ = (s, root = document) => root.querySelector(s)
  const $$ = (s, root = document) => [...root.querySelectorAll(s)]
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  const money = v => new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', maximumFractionDigits:0 }).format(Number(v))

  let regionFilter = 'ALL'
  let categoryFilter = 'ALL'
  let renderTimer = null

  function parsePrice(value = '') {
    const match = String(value).replace(/,/g, '').match(/(?:A\$|AU\$|\$)\s*([0-9]+(?:\.\d{1,2})?)/i)
    const n = match ? Number(match[1]) : NaN
    return Number.isFinite(n) ? n : null
  }

  function inferRegion(value = '') {
    const s = ` ${String(value).toUpperCase()} `
    const rules = [
      ['ACT', /\b(ACT|AUSTRALIAN CAPITAL TERRITORY)\b/], ['NSW', /\b(NSW|NEW SOUTH WALES)\b/],
      ['NT', /\b(NT|NORTHERN TERRITORY)\b/], ['QLD', /\b(QLD|QUEENSLAND)\b/],
      ['SA', /\b(SA|SOUTH AUSTRALIA)\b/], ['TAS', /\b(TAS|TASMANIA)\b/],
      ['VIC', /\b(VIC|VICTORIA)\b/], ['WA', /\b(WA|WESTERN AUSTRALIA)\b/]
    ]
    return rules.find(([,rx]) => rx.test(s))?.[0] || 'Unknown'
  }

  function inferCategory(value = '') {
    const s = String(value).toLowerCase()
    const rules = [
      ['Phones', /\b(iphone|galaxy|pixel|smartphone|mobile phone|phone)\b/],
      ['Audio', /\b(airpods?|earbuds?|headphones?|speaker|bose|sony xm|beats)\b/],
      ['Sneakers', /\b(jordan|yeezy|air max|dunk|sneaker|shoe|adidas|nike|new balance)\b/],
      ['Gaming', /\b(playstation|ps5|ps4|xbox|nintendo|switch|gaming console|steam deck)\b/],
      ['Watches', /\b(rolex|omega|seiko|watch|apple watch|garmin)\b/],
      ['Collectibles', /\b(pokemon|pokémon|trading card|tcg|sports card|coin|lego)\b/],
      ['Computers', /\b(macbook|laptop|pc|computer|ipad|surface|monitor|gpu|graphics card)\b/],
      ['Cameras', /\b(camera|canon|nikon|sony alpha|fujifilm|gopro|lens)\b/],
      ['Fashion', /\b(handbag|bag|jacket|hoodie|shirt|dress|supreme|gucci|prada|louis vuitton)\b/],
      ['Home & Appliances', /\b(fridge|washing machine|dryer|vacuum|dyson|coffee machine|furniture|sofa)\b/]
    ]
    return rules.find(([,rx]) => rx.test(s))?.[0] || 'Other'
  }

  function inspectCards() {
    return $$('.scout-candidate').map(card => {
      const title = $('.scout-candidate-title-row strong', card)?.textContent?.trim() || 'Untitled listing'
      const meta = $('.scout-meta', card)?.textContent?.trim() || ''
      const price = parsePrice(meta)
      const region = card.dataset.smartRegion || inferRegion(meta)
      const category = card.dataset.smartCategory || inferCategory(title)
      card.dataset.smartRegion = region
      card.dataset.smartCategory = category
      return { card, title, meta, price, region, category }
    })
  }

  function counts(rows, key) {
    const map = new Map()
    rows.forEach(row => map.set(row[key], (map.get(row[key]) || 0) + 1))
    return [...map.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }

  function matches(row) {
    const showRegion = regionFilter === 'ALL' || row.region === regionFilter
    const showCategory = categoryFilter === 'ALL' || row.category === categoryFilter
    return showRegion && showCategory
  }

  function filterRows(rows) {
    rows.forEach(row => row.card.classList.toggle('smart-scout-hidden', !matches(row)))
  }

  function chip(label, value, active, type, count) {
    return `<button type="button" class="smart-filter-chip ${active ? 'active' : ''}" data-smart-${type}="${esc(value)}">${esc(label)}${count != null ? `<span>${count}</span>` : ''}</button>`
  }

  function renderOverview() {
    const list = $('.scout-list')
    const head = $('.scout-page-head')
    if (!list || !head) return

    const rows = inspectCards()
    if (!rows.length) return
    filterRows(rows)

    const prices = rows.map(r => r.price).filter(v => Number.isFinite(v))
    const average = prices.length ? prices.reduce((a,b) => a+b, 0) / prices.length : null
    const min = prices.length ? Math.min(...prices) : null
    const max = prices.length ? Math.max(...prices) : null
    const regions = counts(rows.filter(r => r.region !== 'Unknown'), 'region')
    const categories = counts(rows, 'category')
    const knownRegions = regions.map(([v]) => v)
    const visibleRows = rows.filter(matches)
    const query = $('h1', head)?.textContent?.trim() || 'marketplace results'

    const bullets = []
    bullets.push(`${rows.length} listing${rows.length === 1 ? '' : 's'} are in the current Scout pool for ${query}.`)
    if (average != null) bullets.push(`Average asking price is ${money(average)}${min !== max ? `, ranging from ${money(min)} to ${money(max)}` : ''}.`)
    else bullets.push('No reliable asking prices are visible yet; FlippersAI will use the full listing page while rating each candidate.')
    if (knownRegions.length) bullets.push(`Listings are spread across ${knownRegions.join(', ')}. Use the area filter to focus on the states or territories you want.`)
    else bullets.push('No broad Australian state or territory could be read reliably from this batch yet.')
    if (categories.length > 1) bullets.push(`Mixed products detected across ${categories.map(([name]) => name).join(', ')}. They remain separated so unrelated products are never blended into one analysis.`)
    else bullets.push(`The current batch appears to be in the ${categories[0]?.[0] || 'Other'} category.`)

    let overview = $('#smartScoutOverview')
    if (!overview) {
      overview = document.createElement('section')
      overview.id = 'smartScoutOverview'
      overview.className = 'smart-scout-overview'
      head.insertAdjacentElement('afterend', overview)
    }

    overview.innerHTML = `
      <div class="smart-overview-grid">
        <div><span>LISTINGS DETECTED</span><strong>${rows.length}</strong></div>
        <div><span>AVERAGE PRICE</span><strong>${average == null ? 'Not available' : money(average)}</strong><small>${prices.length}/${rows.length} priced</small></div>
        <div><span>AREAS</span><strong>${knownRegions.length ? esc(knownRegions.join(', ')) : 'Not detected'}</strong></div>
        <div><span>CATEGORIES</span><strong>${categories.length === 1 ? esc(categories[0][0]) : `${categories.length} detected`}</strong></div>
      </div>
      <div class="smart-scout-description">
        <span>SCANNED SUMMARY</span>
        <ul>${bullets.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      ${regions.length ? `<div class="smart-filter-row"><span>AREA</span><div>${chip('All','ALL',regionFilter==='ALL','region',rows.length)}${regions.map(([name,count]) => chip(name,name,regionFilter===name,'region',count)).join('')}</div></div>` : ''}
      ${categories.length > 1 ? `<div class="smart-filter-row"><span>CATEGORY</span><div>${chip('All','ALL',categoryFilter==='ALL','category',rows.length)}${categories.map(([name,count]) => chip(name,name,categoryFilter===name,'category',count)).join('')}</div></div>` : ''}
      <div class="smart-filter-actions"><span>${visibleRows.length} listing${visibleRows.length === 1 ? '' : 's'} shown</span><button type="button" id="smartSelectVisible">Select shown only</button><button type="button" id="smartClearFilters">Clear filters</button></div>`
  }

  document.addEventListener('click', event => {
    const overview = event.target.closest?.('#smartScoutOverview')
    if (!overview) return

    const region = event.target.closest?.('[data-smart-region]')
    if (region) {
      event.preventDefault()
      regionFilter = region.dataset.smartRegion || 'ALL'
      renderOverview()
      return
    }

    const category = event.target.closest?.('[data-smart-category]')
    if (category) {
      event.preventDefault()
      categoryFilter = category.dataset.smartCategory || 'ALL'
      renderOverview()
      return
    }

    if (event.target.closest?.('#smartClearFilters')) {
      event.preventDefault()
      regionFilter = 'ALL'
      categoryFilter = 'ALL'
      renderOverview()
      return
    }

    if (event.target.closest?.('#smartSelectVisible')) {
      event.preventDefault()
      const ids = inspectCards().filter(matches).map(row => row.card.dataset.candidate).filter(Boolean)
      document.dispatchEvent(new CustomEvent('flippers:bulk-select', { detail:{ ids } }))
    }
  }, true)

  new MutationObserver(mutations => {
    const meaningful = mutations.some(mutation => !mutation.target.closest?.('#smartScoutOverview'))
    if (!meaningful) return
    clearTimeout(renderTimer)
    renderTimer = setTimeout(renderOverview, 80)
  }).observe(document.getElementById('app'), { childList:true, subtree:true })

  renderOverview()
})()
