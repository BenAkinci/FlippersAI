(() => {
  if (window.__flippersScoutLoadingIndicator) return
  window.__flippersScoutLoadingIndicator = true

  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  let timer = null

  function ensureIndicator() {
    let indicator = $('#scoutLoadingIndicator')
    if (indicator) return indicator
    const head = $('.scout-page-head')
    if (!head) return null
    indicator = document.createElement('section')
    indicator.id = 'scoutLoadingIndicator'
    indicator.className = 'scout-loading-indicator'
    indicator.setAttribute('role', 'status')
    indicator.setAttribute('aria-live', 'polite')
    indicator.innerHTML = `
      <div class="scout-loading-spinner" aria-hidden="true"></div>
      <div class="scout-loading-copy">
        <strong>FlippersAI is working…</strong>
        <span>Preparing ratings.</span>
      </div>
      <div class="scout-loading-count">0/0</div>
      <div class="scout-loading-track"><i></i></div>`
    head.insertAdjacentElement('afterend', indicator)
    return indicator
  }

  function progressFromPage() {
    const insight = $('.scout-insight')
    const active = $$('.scout-candidate.curation-active')
    const scanning = insight?.classList.contains('scanning') || active.length > 0
    if (!scanning) return null

    const text = `${insight?.textContent || ''}`.replace(/\s+/g, ' ').trim()
    const ratio = text.match(/(\d+)\s*\/\s*(\d+)\s*finished/i)
    const totalFromTitle = text.match(/(?:Rating|Deep scanning)\s+(\d+)\s+listings?/i)
    const done = ratio ? Number(ratio[1]) : 0
    const total = ratio ? Number(ratio[2]) : (totalFromTitle ? Number(totalFromTitle[1]) : Math.max(active.length, 1))
    const deep = /deep scanning/i.test(text)
    return { done, total, deep }
  }

  function update() {
    const progress = progressFromPage()
    const existing = $('#scoutLoadingIndicator')
    if (!progress) {
      if (existing) existing.classList.remove('visible')
      document.body.classList.remove('scout-is-loading')
      return
    }

    const indicator = ensureIndicator()
    if (!indicator) return
    const pct = progress.total ? Math.max(4, Math.min(100, Math.round((progress.done / progress.total) * 100))) : 8
    const working = progress.deep ? 'Deep scanning your shortlist…' : 'Rating this batch…'
    const detail = progress.deep
      ? 'Checking the selected listings in more detail. Results will appear together when ready.'
      : 'FlippersAI is analysing the current listings together. Results will appear together when ready.'

    $('.scout-loading-copy strong', indicator).textContent = working
    $('.scout-loading-copy span', indicator).textContent = detail
    $('.scout-loading-count', indicator).textContent = `${progress.done}/${progress.total}`
    $('.scout-loading-track i', indicator).style.width = `${pct}%`
    indicator.classList.add('visible')
    document.body.classList.add('scout-is-loading')
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(update, 45)
  }

  new MutationObserver(mutations => {
    if (mutations.every(m => m.target.closest?.('#scoutLoadingIndicator'))) return
    schedule()
  }).observe(document.getElementById('app'), { childList: true, subtree: true, attributes: true, characterData: true })

  schedule()
})()
