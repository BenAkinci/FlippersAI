(() => {
  if (window.__flippersNavFreezeV137) return
  window.__flippersNavFreezeV137 = true

  const app = document.getElementById('app')
  if (!app) return

  let preservedTopbar = null
  let preservedMobileNav = null
  let pendingKey = null
  let restoring = false

  const allNav = root => [...(root || document).querySelectorAll('.desktop-nav-item,.mobile-nav-item,.community-nav,[data-web-v086]')]

  function keyForButton(button) {
    if (!button) return null
    if (button.matches('.community-nav')) return 'intel'
    if (button.dataset?.webV086) return button.dataset.webV086
    if (button.dataset?.nav) return button.dataset.nav
    return null
  }

  function setActive(key) {
    if (!key) return
    for (const el of allNav(document)) {
      const match = keyForButton(el) === key
      el.classList.toggle('active', match)
      if (match) el.setAttribute('aria-current', 'page')
      else el.removeAttribute('aria-current')
    }
  }

  function captureShell(key) {
    const topbar = document.querySelector('.topbar')
    if (!topbar) return
    preservedTopbar = topbar
    preservedMobileNav = document.querySelector('.mobile-nav')
    pendingKey = key
    setActive(key)
  }

  function restoreShell() {
    if (restoring || !preservedTopbar) return
    const liveTopbar = document.querySelector('.topbar')
    if (!liveTopbar || liveTopbar === preservedTopbar) {
      if (pendingKey) setActive(pendingKey)
      return
    }

    restoring = true
    try {
      liveTopbar.replaceWith(preservedTopbar)

      const liveMobile = document.querySelector('.mobile-nav')
      if (preservedMobileNav && liveMobile && liveMobile !== preservedMobileNav) {
        liveMobile.replaceWith(preservedMobileNav)
      }

      if (pendingKey) setActive(pendingKey)
    } finally {
      restoring = false
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.desktop-nav-item,.mobile-nav-item,.community-nav,[data-web-v086],[data-nav]')
    if (!button) return
    const key = keyForButton(button)
    if (!key) return
    captureShell(key)
  }, true)

  new MutationObserver(() => {
    if (!preservedTopbar) return
    restoreShell()
  }).observe(app, { childList:true, subtree:true })
})()
