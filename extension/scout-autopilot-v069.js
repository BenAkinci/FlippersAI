(() => {
  if (window.__flippersScoutAutopilotV069) return
  window.__flippersScoutAutopilotV069 = true

  const MIN_SCORE = 65
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  let timer = null
  let firstSeenAt = 0
  let lastKickRated = -1
  let kickTimer = null

  function score(card) {
    const text = card.querySelector('.score-metric b')?.textContent || ''
    const n = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1])
    return Number.isFinite(n) ? n : null
  }

  function rec(card) {
    return String(card.querySelector('.scout-rec')?.textContent || '').trim().toLowerCase()
  }

  function rated(card) {
    return card.classList.contains('curation-rated') || card.classList.contains('curation-deep')
  }

  function failed(card) {
    return card.classList.contains('curation-failed')
  }

  function worthwhile(card) {
    if (!rated(card) || failed(card)) return false
    const s = score(card)
    const recommendation = rec(card)
    if (s == null || s < MIN_SCORE) return false
    if (recommendation === 'skip' || recommendation.includes('could not')) return false
    return true
  }

  function ensureLoader() {
    let el = $('#scoutLoadingIndicator')
    if (el) return el
    const head = $('.scout-page-head')
    if (!head) return null
    el = document.createElement('section')
    el.id = 'scoutLoadingIndicator'
    el.className = 'scout-loading-indicator'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.innerHTML = `
      <div class="scout-loading-spinner" aria-hidden="true"></div>
      <div class="scout-loading-copy"><strong>FlippersAI Scout is working…</strong><span>Preparing ratings.</span></div>
      <div class="scout-loading-count">0/0</div>
      <div class="scout-loading-track"><i></i></div>`
    head.insertAdjacentElement('afterend', el)
    return el
  }

  function updateLoader(found, finished, active, pending) {
    const el = ensureLoader()
    if (!el) return
    const working = found > 0 && pending > 0
    if (!working) {
      el.classList.remove('visible')
      document.body.classList.remove('scout-is-loading')
      return
    }
    const pct = Math.max(4, Math.min(98, Math.round(finished / Math.max(1, found) * 100)))
    $('.scout-loading-copy strong', el).textContent = 'Scanning and rating the marketplace…'
    $('.scout-loading-copy span', el).textContent = active
      ? `${finished}/${found} completed · ${active} being rated now. Only worthwhile leads will appear below.`
      : `${finished}/${found} completed · preparing the next quality-controlled batch.`
    $('.scout-loading-count', el).textContent = `${finished}/${found}`
    $('.scout-loading-track i', el).style.width = `${pct}%`
    el.classList.add('visible')
    document.body.classList.add('scout-is-loading')
  }

  function ensureEmpty(list, promising, working) {
    let empty = $('.scout-shortlist-empty', list)
    if (!empty) {
      empty = document.createElement('div')
      empty.className = 'scout-shortlist-empty'
      list.prepend(empty)
    }
    empty.hidden = promising > 0
    if (empty.hidden) return
    empty.innerHTML = working
      ? `<span class="scout-loading-spinner" aria-hidden="true"></span><div><strong>Hunting for promising listings…</strong><small>Everything is still being rated on the marketplace. Low-value results will stay off this shortlist.</small></div>`
      : `<div><strong>No worthwhile leads in this round</strong><small>The ratings remain on the marketplace page. Use Find next listings to keep hunting.</small></div>`
  }

  function rewriteSummary(cards, activeCount) {
    const found = cards.length
    const finishedCards = cards.filter(c => rated(c) || failed(c))
    const ratedCards = cards.filter(rated)
    const promisingCards = ratedCards.filter(worthwhile)
    const hidden = finishedCards.length - promisingCards.length
    const pending = found - finishedCards.length

    cards.forEach(card => {
      const show = worthwhile(card)
      card.dataset.v069Shortlist = show ? '1' : '0'
      card.classList.toggle('v069-shortlist-visible', show)
    })

    const box = $('.scout-summary')
    if (box) {
      const cells = [...box.children]
      if (cells[0]) cells[0].innerHTML = `<span>FOUND</span><strong>${found}</strong>`
      if (cells[1]) cells[1].innerHTML = `<span>RATED</span><strong>${ratedCards.length}</strong>`
      if (cells[2]) cells[2].innerHTML = `<span>SCANNING</span><strong>${activeCount}</strong>`
      if (cells[3]) cells[3].innerHTML = `<span>PROMISING</span><strong>${promisingCards.length}</strong>`
      if (cells[4]) cells[4].innerHTML = `<span>HIDDEN</span><strong>${hidden}</strong>`
    }

    const insight = $('.scout-insight')
    if (insight) {
      if (pending > 0) {
        insight.classList.add('scanning')
        insight.innerHTML = `<strong>Scanning all ${found} found listings…</strong><span>${finishedCards.length}/${found} complete${activeCount ? ` · ${activeCount} rating now` : ''}. FlippersAI automatically works through small batches and only surfaces good opportunities.</span>`
      } else {
        insight.classList.remove('scanning')
        insight.innerHTML = promisingCards.length
          ? `<strong>${promisingCards.length} promising opportunit${promisingCards.length === 1 ? 'y' : 'ies'} surfaced</strong><span>${hidden} low-value or unsuitable listing${hidden === 1 ? '' : 's'} hidden from this list. Their ratings remain on the marketplace page.</span>`
          : `<strong>No worthwhile leads in this round</strong><span>All ${ratedCards.length} listings were rated. Their on-page scores remain visible, but none met the shortlist threshold.</span>`
      }
    }

    const mode = $('.scout-quality-mode')
    if (mode) mode.innerHTML = `<div><span>SCOUT AUTOPILOT</span><strong>Rate everything · show only worthwhile leads</strong></div><small>FlippersAI analyses up to five listings in parallel, automatically continues through the found set, and keeps low-value ratings on the marketplace instead of cluttering this list.</small>`

    const list = $('.scout-list')
    if (list) ensureEmpty(list, promisingCards.length, pending > 0)

    const more = $('#scanMoreResults')
    if (more) {
      if (pending > 0) {
        more.textContent = 'Scanning automatically…'
        more.disabled = true
      } else {
        more.textContent = 'Find next listings ↓'
        more.disabled = false
      }
    }

    updateLoader(found, finishedCards.length, activeCount, pending)

    return { found, finished:finishedCards.length, rated:ratedCards.length, promising:promisingCards.length, hidden, pending }
  }

  function maybeKickNext(stats, activeCount) {
    const more = $('#scanMoreResults')
    if (!more || stats.pending <= 0 || activeCount > 0) return

    if (!firstSeenAt) firstSeenAt = Date.now()
    const initialFallback = stats.rated === 0 && Date.now() - firstSeenAt > 1200
    const nextBatchReady = stats.rated > 0 && stats.rated !== lastKickRated
    if (!initialFallback && !nextBatchReady) return

    if (kickTimer) return
    lastKickRated = stats.rated
    kickTimer = setTimeout(() => {
      kickTimer = null
      const current = $('#scanMoreResults')
      if (current && !current.disabled) current.click()
      else {
        const cards = $$('.scout-candidate')
        const active = cards.filter(c => c.classList.contains('curation-active')).length
        const pending = cards.filter(c => !rated(c) && !failed(c)).length
        if (current && active === 0 && pending > 0) {
          current.disabled = false
          current.click()
        }
      }
    }, 180)
  }

  function update() {
    const list = $('.scout-list')
    if (!list) {
      firstSeenAt = 0
      lastKickRated = -1
      $('#scoutLoadingIndicator')?.classList.remove('visible')
      return
    }
    const cards = $$('.scout-candidate', list)
    if (!cards.length) return
    if (!firstSeenAt) firstSeenAt = Date.now()
    const activeCount = cards.filter(c => c.classList.contains('curation-active')).length
    const stats = rewriteSummary(cards, activeCount)
    maybeKickNext(stats, activeCount)
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(update, 65)
  }

  new MutationObserver(mutations => {
    const meaningful = mutations.some(m => !m.target.closest?.('#scoutLoadingIndicator,.scout-shortlist-empty'))
    if (meaningful) schedule()
  }).observe(document.getElementById('app'), { childList:true, subtree:true, attributes:true, characterData:true })

  document.addEventListener('flippers:scout-rendered', () => {
    firstSeenAt = Date.now()
    lastKickRated = -1
    schedule()
  })

  schedule()
})()
