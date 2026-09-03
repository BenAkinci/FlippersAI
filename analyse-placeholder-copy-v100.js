(() => {
  if (window.__flippersAnalysePlaceholderCopyV100) return
  window.__flippersAnalysePlaceholderCopyV100 = true

  function apply() {
    const form = document.querySelector('form#newDeal')
    if (!form) return
    if (form.elements.title) form.elements.title.placeholder = 'Optional — FlippersAI can identify this from the listing/screenshots'
    if (form.elements.price) form.elements.price.placeholder = 'Optional — FlippersAI can read this from the listing/screenshots'
  }

  const observer = new MutationObserver(apply)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  apply()
})()
