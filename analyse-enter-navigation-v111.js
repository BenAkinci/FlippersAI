(() => {
  function ensureStyles() {
    if (document.getElementById('analyseEnterNavigationStyles')) return
    const style = document.createElement('style')
    style.id = 'analyseEnterNavigationStyles'
    style.textContent = `
      #newDeal .analyse-enter-ready{
        outline:3px solid rgba(245,158,11,.35)!important;
        box-shadow:0 0 0 4px rgba(245,158,11,.12)!important;
        transform:translateY(-1px);
      }
    `
    document.head.appendChild(style)
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false
    if (el.hidden) return false
    if (el.closest('[hidden]')) return false
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return el.getClientRects().length > 0
  }

  function isNavigable(el) {
    if (!(el instanceof HTMLElement)) return false
    if (!isVisible(el)) return false
    if (el.matches(':disabled')) return false
    if (el instanceof HTMLInputElement) {
      if (['hidden','file','submit','button','reset','checkbox','radio'].includes(el.type)) return false
    }
    return el.matches('input, select, textarea')
  }

  function getFields(form) {
    return [...form.querySelectorAll('input, select, textarea')].filter(isNavigable)
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"], button:not([type])')
  }

  function clearReady(form) {
    getSubmitButton(form)?.classList.remove('analyse-enter-ready')
  }

  function focusSubmit(form) {
    const button = getSubmitButton(form)
    if (!button) return
    button.classList.add('analyse-enter-ready')
    button.focus({ preventScroll: true })
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function bind(form) {
    if (!form || form.dataset.enterNavigation === 'v111') return
    form.dataset.enterNavigation = 'v111'

    form.addEventListener('focusin', event => {
      const button = getSubmitButton(form)
      if (event.target !== button) clearReady(form)
    })

    form.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target
      const button = getSubmitButton(form)

      if (target === button) {
        event.preventDefault()
        button.classList.remove('analyse-enter-ready')
        form.requestSubmit(button)
        return
      }

      if (!isNavigable(target)) return

      // Plain Enter advances through the form. Shift+Enter remains available for a newline in textareas.
      if (target instanceof HTMLTextAreaElement && event.shiftKey) return

      event.preventDefault()
      event.stopPropagation()

      // Trigger blur-dependent cleanup/normalisation before moving on.
      target.blur()

      const fields = getFields(form)
      const index = fields.indexOf(target)
      const next = index >= 0 ? fields[index + 1] : null

      if (next) {
        next.focus({ preventScroll: true })
        next.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        focusSubmit(form)
      }
    }, true)
  }

  function enhance() {
    ensureStyles()
    bind(document.getElementById('newDeal'))
  }

  let timer
  const app = document.getElementById('app')
  if (app) {
    new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(enhance, 30)
    }).observe(app, { childList: true, subtree: true })
  }

  enhance()
})()
