(() => {
  if (window.__flippersAnalyseWebsiteFallbackV093) return
  window.__flippersAnalyseWebsiteFallbackV093 = true

  const PROJECT_REF = 'msmpigerejpxepkylkxz'
  const BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`
  const APIKEY = 'sb_publishable_PtTF2JaOtkV86zDg_Vf-bw_Vg0nCSpZ'
  const clean = v => String(v || '').trim()

  function accessToken() {
    try {
      const keys = Object.keys(localStorage)
      const key = keys.find(k => k === `sb-${PROJECT_REF}-auth-token`) || keys.find(k => k.includes(PROJECT_REF) && k.includes('auth-token'))
      if (!key) return ''
      const value = JSON.parse(localStorage.getItem(key) || 'null')
      return value?.access_token || value?.currentSession?.access_token || ''
    } catch { return '' }
  }

  async function invoke(slug, body) {
    const token = accessToken()
    const r = await fetch(`${BASE}/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: APIKEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data?.error) throw new Error(data?.error || `HTTP ${r.status}`)
    return data
  }

  function toDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error || new Error('Could not read screenshot'))
      reader.readAsDataURL(file)
    })
  }

  function platformFromUrl(url = '') {
    const u = url.toLowerCase()
    if (u.includes('depop')) return 'depop'
    if (u.includes('facebook')) return 'facebook'
    if (u.includes('ebay')) return 'ebay'
    if (u.includes('gumtree')) return 'gumtree'
    return 'other'
  }

  function showScreenshotFallback(form) {
    document.querySelector('#directAnalysisResult')?.remove()
    const card = document.querySelector('.analyser-card')
    if (!card) return
    card.insertAdjacentHTML('afterend', `
      <section class="direct-analysis-result direct-analysis-error" id="directAnalysisResult">
        <strong>We couldn't read this listing automatically</strong>
        <p>This marketplace is blocking the listing details from the website. Instead of giving you another empty analysis, add screenshots of the listing and FlippersAI will read them for you.</p>
        <p><strong>Best screenshots:</strong> the main listing with price/title, the description/details, and the product photos. You do not need to type the information manually.</p>
        <div class="direct-analysis-actions"><button type="button" class="button primary" id="chooseListingScreenshots">Add listing screenshots</button></div>
      </section>`)
    document.querySelector('#chooseListingScreenshots')?.addEventListener('click', () => form.elements.images?.click())
  }

  function enrichFromVisual(form, x) {
    if (!x || typeof x !== 'object') return
    if (form.elements.title && !clean(form.elements.title.value) && clean(x.listing_title)) form.elements.title.value = clean(x.listing_title)
    if (form.elements.price && !clean(form.elements.price.value) && Number.isFinite(Number(x.asking_price)) && Number(x.asking_price_confidence) >= 0.90) form.elements.price.value = String(Number(x.asking_price))
    const details = [
      clean(x.description) ? `Description: ${clean(x.description)}` : '',
      clean(x.condition) ? `Seller-stated condition: ${clean(x.condition)}` : '',
      clean(x.size) ? `Size: ${clean(x.size)}` : '',
      clean(x.listing_location) ? `Location: ${clean(x.listing_location)}` : '',
      clean(x.seller_name) ? `Seller: ${clean(x.seller_name)}` : '',
      Array.isArray(x.visible_item_details) && x.visible_item_details.length ? `Visible listing details:\n- ${x.visible_item_details.map(clean).filter(Boolean).join('\n- ')}` : '',
      Array.isArray(x.authenticity_markers_visible) && x.authenticity_markers_visible.length ? `Visible authenticity markers:\n- ${x.authenticity_markers_visible.map(clean).filter(Boolean).join('\n- ')}` : ''
    ].filter(Boolean).join('\n\n')
    if (form.elements.text && details) {
      const existing = clean(form.elements.text.value)
      form.elements.text.value = existing ? `${existing}\n\n${details}` : details
    }
  }

  document.addEventListener('submit', async event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'newDeal') return
    if (form.dataset.websiteFallbackPass === '1') { delete form.dataset.websiteFallbackPass; return }

    const fd = new FormData(form)
    const url = clean(fd.get('url'))
    const files = [...(form.elements.images?.files || [])].slice(0, 6)
    if (!url) return

    event.preventDefault()
    event.stopImmediatePropagation()

    const button = form.querySelector('button[type="submit"],button:not([type])')
    const previous = button?.innerHTML
    if (button) { button.disabled = true; button.textContent = files.length ? 'Reading screenshots…' : 'Reading listing…' }

    try {
      if (files.length) {
        const images = []
        for (const file of files) images.push(await toDataUrl(file))
        const visual = await invoke('listing-visual-extraction', { listing_url: url, platform: platformFromUrl(url), images })
        enrichFromVisual(form, visual?.extraction)
      } else {
        const acquisition = await invoke('listing-acquisition', { listing_url: url })
        const facts = acquisition?.facts || {}
        const hasAsk = Number.isFinite(Number(facts.asking_price))
        const hasImages = Array.isArray(facts.image_urls) && facts.image_urls.length >= 2
        const hasSeller = Boolean(clean(facts.seller_name))
        const hasCondition = Boolean(clean(facts.condition))
        const hasDescription = clean(facts.description).length >= 40
        const hasStrongIdentity = clean(facts.listing_title).length >= 8
        const useful = hasAsk && hasStrongIdentity && (hasImages || hasSeller || hasCondition || hasDescription)
        if (!useful) { showScreenshotFallback(form); return }
      }

      form.dataset.websiteFallbackPass = '1'
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    } catch (error) {
      if (!files.length) showScreenshotFallback(form)
      else {
        document.querySelector('#directAnalysisResult')?.remove()
        const card = document.querySelector('.analyser-card')
        card?.insertAdjacentHTML('afterend', `<section class="direct-analysis-result direct-analysis-error" id="directAnalysisResult"><strong>Could not read those screenshots</strong><p>${clean(error?.message || error)}</p><p>Try screenshots that clearly show the listing title, price and details.</p></section>`)
      }
    } finally {
      if (button) { button.disabled = false; if (previous) button.innerHTML = previous }
    }
  }, true)
})()
