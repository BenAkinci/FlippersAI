const homeIcons = {
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8 11h6M11 8v6"/></svg>',
  analyse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V5h16v14H4Z"/><path d="m7 15 3-4 3 2 4-6"/></svg>',
  continue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></svg>'
}

function findWhatsNextSection() {
  return [...document.querySelectorAll('.content > .section-block')].find(section =>
    section.querySelector('.eyebrow')?.textContent?.trim().toUpperCase() === "WHAT'S NEXT?"
  ) || null
}

function openIntel() {
  let tries = 0
  const attempt = () => {
    const button = document.querySelector('.community-nav')
    if (button) return button.click()
    if (++tries < 12) return setTimeout(attempt, 50)
    document.querySelector('[data-nav="analyse"]')?.click()
  }
  attempt()
}

function enhanceHomeStart() {
  const content = document.querySelector('.content')
  const head = content?.querySelector('.home-head')
  if (!content || !head || head.dataset.guidedStart === '1') return

  head.dataset.guidedStart = '1'
  content.classList.add('home-simplified')

  const oldTitle = head.querySelector('h1')?.textContent?.trim() || ''
  const greeting = oldTitle.startsWith('Welcome back') ? oldTitle : 'Welcome back'
  head.innerHTML = `
    <div class="home-start-heading">
      <span class="home-greeting"></span>
      <span class="eyebrow">START HERE</span>
      <h1>What do you want to do?</h1>
      <p>Choose one. FlippersAI will guide you through everything that comes next.</p>
    </div>`
  head.querySelector('.home-greeting').textContent = greeting

  const whatsNext = findWhatsNextSection()
  const workflow = content.querySelector('.home-workflow')
  const dealName = whatsNext?.querySelector('.section-heading h2')?.textContent?.trim() || 'your current flip'
  const stepName = workflow?.querySelector('.step-copy h3')?.textContent?.trim() || ''

  const start = document.createElement('section')
  start.className = 'home-start-section'
  start.id = 'homeStartChoices'
  start.innerHTML = `
    <div class="home-start-grid">
      <button class="home-start-card primary-start" id="homeFindFlip">
        <span class="home-start-icon">${homeIcons.find}</span>
        <span class="home-start-copy"><small>BEST PLACE TO START</small><strong>Find something to flip</strong><span>Browse live reseller intelligence and opportunities.</span></span>
        <span class="home-start-arrow">→</span>
      </button>
      <button class="home-start-card" id="homeAnalyseFound">
        <span class="home-start-icon">${homeIcons.analyse}</span>
        <span class="home-start-copy"><small>ALREADY FOUND SOMETHING?</small><strong>Analyse something I found</strong><span>Paste a listing and get a buy, negotiate or skip decision.</span></span>
        <span class="home-start-arrow">→</span>
      </button>
      <button class="home-start-card ${workflow ? '' : 'is-disabled'}" id="homeContinueFlip" ${workflow ? '' : 'disabled'}>
        <span class="home-start-icon">${homeIcons.continue}</span>
        <span class="home-start-copy"><small>${workflow ? 'ACTIVE FLIP' : 'NO ACTIVE FLIP'}</small><strong>Continue a flip</strong><span>${workflow ? `${dealName}${stepName ? ` · ${stepName}` : ''}` : 'Your next active flip will appear here automatically.'}</span></span>
        <span class="home-start-arrow">→</span>
      </button>
    </div>
    <div class="home-flow" aria-label="FlippersAI workflow">
      <span>Find</span><i>→</i><span>Analyse</span><i>→</i><span>Buy</span><i>→</i><span>Sell</span><i>→</i><span>Learn</span>
    </div>`
  head.insertAdjacentElement('afterend', start)

  if (whatsNext) {
    if (workflow) {
      whatsNext.classList.add('home-next-focused')
      start.insertAdjacentElement('afterend', whatsNext)
    } else {
      whatsNext.remove()
    }
  }

  const operation = document.createElement('details')
  operation.className = 'home-operation'
  operation.innerHTML = `
    <summary>
      <span><strong>Your business at a glance</strong><small>Finances, performance, recent inventory and Intel</small></span>
      <span class="home-operation-chevron">⌄</span>
    </summary>
    <div class="home-operation-body"></div>`
  const mount = operation.querySelector('.home-operation-body')

  const bankroll = content.querySelector('.bankroll-strip')
  if (bankroll) mount.appendChild(bankroll)

  const remainingSections = [...content.querySelectorAll(':scope > .section-block')]
    .filter(section => section !== start && section !== whatsNext && section.id !== 'communityTeaser')
  remainingSections.forEach(section => mount.appendChild(section))

  const after = workflow && whatsNext ? whatsNext : start
  after.insertAdjacentElement('afterend', operation)

  document.getElementById('homeFindFlip')?.addEventListener('click', openIntel)
  document.getElementById('homeAnalyseFound')?.addEventListener('click', () => document.querySelector('[data-nav="analyse"]')?.click())
  document.getElementById('homeContinueFlip')?.addEventListener('click', () => {
    if (!whatsNext) return
    whatsNext.scrollIntoView({ behavior:'smooth', block:'start' })
    whatsNext.classList.remove('home-next-pulse')
    requestAnimationFrame(() => whatsNext.classList.add('home-next-pulse'))
  })
}

let homeStartTimer
new MutationObserver(() => {
  clearTimeout(homeStartTimer)
  homeStartTimer = setTimeout(enhanceHomeStart, 25)
}).observe(document.getElementById('app'), { childList:true, subtree:true })

enhanceHomeStart()
