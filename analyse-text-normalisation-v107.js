(() => {
  // Only normalize names/casing we know with high confidence. Unknown terms are left unchanged
  // rather than being guessed into the wrong official spelling.
  const CANONICAL_TERMS = [
    ['facebook marketplace', 'Facebook Marketplace'],
    ['new balance', 'New Balance'],
    ['air force 1', 'Air Force 1'],
    ['air jordan', 'Air Jordan'],
    ['air max', 'Air Max'],
    ['playstation', 'PlayStation'],
    ['nintendo switch', 'Nintendo Switch'],
    ['apple watch', 'Apple Watch'],
    ['macbook pro', 'MacBook Pro'],
    ['macbook air', 'MacBook Air'],
    ['on running', 'On Running'],
    ['arc’teryx', 'Arc’teryx'],
    ["arc'teryx", "Arc'teryx"],
    ['the north face', 'The North Face'],
    ['dr. martens', 'Dr. Martens'],
    ['dr martens', 'Dr. Martens'],
    ['ralph lauren', 'Ralph Lauren'],
    ['tommy hilfiger', 'Tommy Hilfiger'],
    ['calvin klein', 'Calvin Klein'],
    ['under armour', 'Under Armour'],
    ['lululemon', 'lululemon'],
    ['stockx', 'StockX'],
    ['ebay', 'eBay'],
    ['iphone', 'iPhone'],
    ['ipad', 'iPad'],
    ['imac', 'iMac'],
    ['macbook', 'MacBook'],
    ['airpods', 'AirPods'],
    ['yeezy', 'Yeezy'],
    ['yzy', 'YZY'],
    ['sndr', 'SNDR'],
    ['tn', 'TN'],
    ['dunk', 'Dunk'],
    ['dunks', 'Dunks'],
    ['jordan', 'Jordan'],
    ['nike', 'Nike'],
    ['adidas', 'adidas'],
    ['asics', 'ASICS'],
    ['reebok', 'Reebok'],
    ['puma', 'PUMA'],
    ['salomon', 'Salomon'],
    ['converse', 'Converse'],
    ['vans', 'Vans'],
    ['supreme', 'Supreme'],
    ['stussy', 'Stüssy'],
    ['carhartt', 'Carhartt'],
    ['patagonia', 'Patagonia'],
    ['samsung', 'Samsung'],
    ['xbox', 'Xbox'],
    ['depop', 'Depop'],
    ['vinted', 'Vinted'],
    ['gumtree', 'Gumtree'],
    ['goat', 'GOAT'],
    ['ps5', 'PS5'],
    ['ps4', 'PS4'],
    ['oled', 'OLED'],
    ['led', 'LED'],
    ['usb-c', 'USB-C'],
    ['usb c', 'USB-C'],
    ['nfc', 'NFC'],
    ['gps', 'GPS']
  ].sort((a, b) => b[0].length - a[0].length)

  const TARGET_FIELDS = new Set(['title', 'brand', 'model', 'colour', 'condition'])

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function replaceCanonicalTerms(value) {
    let result = String(value || '')
    for (const [raw, canonical] of CANONICAL_TERMS) {
      const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(raw)})(?=$|[^A-Za-z0-9])`, 'gi')
      result = result.replace(pattern, (_, prefix) => `${prefix}${canonical}`)
    }
    return result
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/[ \t]+/g, ' ').trim()
  }

  function normalizeKnownText(input) {
    const original = String(input?.value || '')
    if (!original.trim()) return
    const normalized = replaceCanonicalTerms(normalizeWhitespace(original))
    if (normalized !== original) {
      if (!input.dataset.rawBeforeNormalization) input.dataset.rawBeforeNormalization = original
      input.value = normalized
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function bind(form) {
    if (!form || form.dataset.textNormalization === 'v107') return
    form.dataset.textNormalization = 'v107'

    form.addEventListener('blur', event => {
      const input = event.target
      if (!(input instanceof HTMLInputElement)) return
      if (!TARGET_FIELDS.has(input.name)) return
      normalizeKnownText(input)
    }, true)
  }

  function enhance() {
    bind(document.getElementById('newDeal'))
  }

  let timer
  const app = document.getElementById('app')
  if (app) {
    new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(enhance, 40)
    }).observe(app, { childList: true, subtree: true })
  }

  enhance()
})()
