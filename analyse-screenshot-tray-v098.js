(() => {
  if (window.__flippersAnalyseScreenshotTrayV098) return
  window.__flippersAnalyseScreenshotTrayV098 = true

  const MAX_FILES = 6
  const previewUrls = new Map()

  function form() { return document.querySelector('form#newDeal') }
  function input(f = form()) { return f?.elements?.images || f?.querySelector('input[type="file"][accept*="image"]') }
  function files(i = input()) { return [...(i?.files || [])].filter(file => /^image\//i.test(file.type || '')).slice(0, MAX_FILES) }
  function key(file) { return `${file.name}|${file.size}|${file.lastModified}` }

  function surface(f = form()) {
    const i = input(f)
    if (!i) return null
    return i.closest('label, .upload-zone, .drop-zone, .analyser-upload, [data-upload-zone]') || i.parentElement
  }

  function setFiles(i, next) {
    if (!i) return
    const transfer = new DataTransfer()
    next.slice(0, MAX_FILES).forEach(file => transfer.items.add(file))
    i.files = transfer.files
    i.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function ensureStyles() {
    if (document.querySelector('#analyseScreenshotTrayV098Styles')) return
    const style = document.createElement('style')
    style.id = 'analyseScreenshotTrayV098Styles'
    style.textContent = `
      .analyse-shot-tray-v098{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;width:100%}
      .analyse-shot-v098{position:relative;min-width:0;border:1px solid rgba(148,163,184,.35);border-radius:10px;overflow:hidden;background:#fff;aspect-ratio:4/3}
      .analyse-shot-v098 img{display:block;width:100%;height:100%;object-fit:cover}
      .analyse-shot-remove-v098{position:absolute;top:6px;right:6px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(15,23,42,.82);color:white;font-size:18px;line-height:28px;text-align:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2)}
      .analyse-shot-remove-v098:hover{background:rgba(15,23,42,.96)}
      .analyse-shot-index-v098{position:absolute;left:6px;bottom:6px;padding:3px 7px;border-radius:999px;background:rgba(15,23,42,.72);color:white;font-size:11px;font-weight:700}
      .analyse-shot-empty-v098{display:none}
    `
    document.head.appendChild(style)
  }

  function ensureTray(f = form()) {
    const s = surface(f)
    if (!s) return null
    let tray = f.querySelector('#analyseScreenshotTrayV098')
    if (!tray) {
      tray = document.createElement('div')
      tray.id = 'analyseScreenshotTrayV098'
      tray.className = 'analyse-shot-tray-v098'
      tray.setAttribute('aria-live', 'polite')
      s.insertAdjacentElement('afterend', tray)
    }
    return tray
  }

  function cleanupUnused(currentKeys) {
    for (const [k, url] of previewUrls.entries()) {
      if (!currentKeys.has(k)) {
        URL.revokeObjectURL(url)
        previewUrls.delete(k)
      }
    }
  }

  function render() {
    ensureStyles()
    const f = form()
    const i = input(f)
    if (!f || !i) return
    const tray = ensureTray(f)
    if (!tray) return

    const current = files(i)
    const currentKeys = new Set(current.map(key))
    cleanupUnused(currentKeys)
    tray.innerHTML = ''
    tray.style.display = current.length ? 'grid' : 'none'

    current.forEach((file, index) => {
      const k = key(file)
      if (!previewUrls.has(k)) previewUrls.set(k, URL.createObjectURL(file))

      const card = document.createElement('div')
      card.className = 'analyse-shot-v098'

      const img = document.createElement('img')
      img.src = previewUrls.get(k)
      img.alt = `Listing screenshot ${index + 1}`

      const number = document.createElement('span')
      number.className = 'analyse-shot-index-v098'
      number.textContent = `${index + 1}`

      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'analyse-shot-remove-v098'
      remove.setAttribute('aria-label', `Remove screenshot ${index + 1}`)
      remove.title = 'Remove screenshot'
      remove.textContent = '×'
      remove.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        const remaining = files(i).filter(candidate => key(candidate) !== k)
        setFiles(i, remaining)
      })

      card.append(img, number, remove)
      tray.appendChild(card)
    })
  }

  function wire() {
    const f = form()
    const i = input(f)
    if (!f || !i || i.dataset.previewTrayV098 === '1') return
    i.dataset.previewTrayV098 = '1'
    i.addEventListener('change', render)
    render()
  }

  const observer = new MutationObserver(wire)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('beforeunload', () => {
    for (const url of previewUrls.values()) URL.revokeObjectURL(url)
    previewUrls.clear()
  })
  wire()
})()
