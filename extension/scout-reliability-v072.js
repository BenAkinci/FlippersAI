(() => {
  if (window.__flippersScoutReliabilityV072) return
  window.__flippersScoutReliabilityV072 = true

  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  let timer = null

  function makeButton(id, label, className) {
    const button = document.createElement('button')
    button.type = 'button'
    button.id = id
    button.className = className
    button.textContent = label
    button.dataset.v072Created = '1'
    return button
  }

  function ensureRunBar() {
    const head = $('.scout-page-head')
    if (!head) return

    let bar = $('#v072RunBar')
    if (!bar) {
      bar = document.createElement('section')
      bar.id = 'v072RunBar'
      bar.className = 'v072-run-bar'
      bar.setAttribute('aria-label', 'Scout controls')
      bar.innerHTML = '<div class="v072-run-copy"><span>SCAN CONTROLS</span><strong>Current Scout stays saved until you start a new scan.</strong></div><div class="v072-run-actions"></div>'
      const source = $('.scout-capture-source')
      ;(source || head).insertAdjacentElement('afterend', bar)
    }

    const actions = $('.v072-run-actions', bar)
    if (!actions) return

    let pause = $('#v071Pause')
    if (!pause) pause = makeButton('v071Pause', 'Stop scan', 'button secondary small')
    pause.textContent = pause.textContent?.trim() || 'Stop scan'

    let restart = $('#v071Restart')
    if (!restart) restart = makeButton('v071Restart', 'Restart this round', 'button soft small')
    restart.textContent = 'Restart this round'

    let fresh = $('#scoutRescan')
    if (!fresh) fresh = makeButton('scoutRescan', 'Start new scan', 'button soft small')
    fresh.textContent = 'Start new scan'

    ;[pause, restart, fresh].forEach(button => {
      if (button.parentElement !== actions) actions.appendChild(button)
    })
  }

  function ensureEmptyState() {
    const list = $('.scout-list')
    if (!list) return null
    let empty = $('#v072ShortlistEmpty')
    if (!empty) {
      empty = document.createElement('div')
      empty.id = 'v072ShortlistEmpty'
      empty.className = 'v072-shortlist-empty'
      empty.innerHTML = '<strong>Scanning in the background…</strong><span>Pending and poor listings stay off this page. A listing only appears here after FlippersAI has screened it, verified it and decided it is worth your attention.</span>'
      list.insertAdjacentElement('beforebegin', empty)
    }
    return empty
  }

  function syncCards() {
    const cards = $$('.scout-list .scout-candidate')
    if (!cards.length) return

    let visible = 0
    cards.forEach(card => {
      const good = card.classList.contains('v071-shortlist-visible')
      card.hidden = !good
      card.setAttribute('aria-hidden', good ? 'false' : 'true')
      if (good) visible += 1
    })

    const empty = ensureEmptyState()
    if (empty) {
      empty.hidden = visible > 0
      const insight = $('.scout-insight')
      const paused = /paused/i.test(insight?.textContent || '')
      const working = Boolean(insight?.classList.contains('scanning'))
      const strong = $('strong', empty)
      const copy = $('span', empty)
      if (paused) {
        if (strong) strong.textContent = 'Scout paused'
        if (copy) copy.textContent = 'Your progress is saved. Resume the scan whenever you are ready.'
      } else if (working) {
        if (strong) strong.textContent = 'Scanning in the background…'
        if (copy) copy.textContent = 'Nothing is shown until it passes the shortlist gate. Ratings still appear directly on the marketplace as each listing is screened.'
      } else {
        if (strong) strong.textContent = 'No worthwhile listings surfaced yet'
        if (copy) copy.textContent = 'FlippersAI is keeping low-quality results out of your shortlist. Find the next round when you want to keep scouting.'
      }
    }

    const selectAll = $('#scoutSelectAll')
    if (selectAll) {
      selectAll.disabled = visible === 0
      const label = selectAll.closest('.scout-select-all')?.querySelector('span')
      if (label) label.textContent = 'Select all shown'
    }
  }

  async function fallbackNewScan(button) {
    if (button.dataset.v072Created !== '1') return
    button.disabled = true
    try {
      await chrome.storage.local.remove(['flippers_active_scout_session_v068', 'flippers_scout_paused_v071'])
    } finally {
      location.reload()
    }
  }

  function sync() {
    ensureRunBar()
    syncCards()
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(sync, 60)
  }

  document.addEventListener('click', event => {
    const fresh = event.target.closest?.('#scoutRescan')
    if (fresh) fallbackNewScan(fresh).catch(() => {})
  }, true)

  new MutationObserver(mutations => {
    if (mutations.every(m => m.target.closest?.('#v072RunBar,#v072ShortlistEmpty'))) return
    schedule()
  }).observe(document.getElementById('app'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] })

  schedule()
})()
