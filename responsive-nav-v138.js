(() => {
  if (window.__flippersResponsiveNavV138) return
  window.__flippersResponsiveNavV138 = true

  const app = document.getElementById('app')
  if (!app) return

  const icons = {
    shortlist:'<svg class="nav-v138-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4V4Z"/></svg>',
    saved:'<svg class="nav-v138-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>'
  }

  let timer = null

  function keyFor(button){
    if (!button) return null
    if (button.matches('.community-nav')) return 'intel'
    return button.dataset?.webV086 || button.dataset?.nav || null
  }

  function labelFor(button){
    return button.querySelector('span:last-child')?.textContent?.trim() || button.textContent?.trim() || ''
  }

  function ensureCustomIcon(button){
    const key = keyFor(button)
    if (!icons[key]) return
    if (button.querySelector('.ico,.nav-v138-icon')) return
    button.insertAdjacentHTML('afterbegin', icons[key])
  }

  function normalizeMobileNav(){
    const nav = document.querySelector('.mobile-nav')
    const topbar = document.querySelector('.topbar')
    if (!nav || !topbar) return

    if (nav.previousElementSibling !== topbar) topbar.insertAdjacentElement('afterend', nav)

    nav.setAttribute('aria-label','Primary navigation')
    nav.setAttribute('role','navigation')

    const buttons = [...nav.querySelectorAll('.mobile-nav-item,.community-nav,[data-web-v086]')]
    for (const button of buttons){
      if (!button.classList.contains('mobile-nav-item')) button.classList.add('mobile-nav-item')
      ensureCustomIcon(button)
      const key = keyFor(button)
      const label = labelFor(button)
      if (key) button.dataset.navKey = key
      if (label) button.setAttribute('aria-label', label)
      button.type = 'button'
    }

    const active = buttons.find(button => button.classList.contains('active'))
    if (active) active.setAttribute('aria-current','page')
    for (const button of buttons) if (button !== active) button.removeAttribute('aria-current')
  }

  function run(){
    if (window.matchMedia('(max-width: 860px)').matches) normalizeMobileNav()
  }

  new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(run, 24)
  }).observe(app,{childList:true,subtree:true})

  window.addEventListener('resize', () => {
    clearTimeout(timer)
    timer = setTimeout(run, 80)
  }, {passive:true})

  run()
})()
