(() => {
  if (window.__flippersAnalyseScreenshotInputV094) return
  window.__flippersAnalyseScreenshotInputV094 = true

  const MAX_FILES = 6
  const clean = v => String(v || '').trim()

  function analyseForm() {
    return document.querySelector('form#newDeal')
  }

  function imageInput(form = analyseForm()) {
    return form?.elements?.images || form?.querySelector('input[type="file"][accept*="image"]')
  }

  function validImageFiles(files) {
    return [...(files || [])].filter(file => file && /^image\//i.test(file.type || '')).slice(0, MAX_FILES)
  }

  function mergeFiles(input, incoming) {
    if (!input || !incoming.length) return 0
    const transfer = new DataTransfer()
    const seen = new Set()
    const add = file => {
      const key = `${file.name}|${file.size}|${file.lastModified}`
      if (seen.has(key) || transfer.items.length >= MAX_FILES) return
      seen.add(key)
      transfer.items.add(file)
    }
    ;[...(input.files || [])].forEach(add)
    incoming.forEach(add)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    showAttachedState(input, transfer.files.length)
    return transfer.files.length
  }

  function uploaderSurface(form = analyseForm()) {
    const input = imageInput(form)
    if (!input) return null
    return input.closest('label, .upload-zone, .drop-zone, .analyser-upload, [data-upload-zone]') || input.parentElement
  }

  function showAttachedState(input, count) {
    const surface = uploaderSurface(input?.form || analyseForm())
    if (!surface) return
    let status = surface.querySelector('[data-flippers-upload-status]')
    if (!status) {
      status = document.createElement('div')
      status.dataset.flippersUploadStatus = '1'
      status.style.marginTop = '6px'
      status.style.fontSize = '12px'
      status.style.fontWeight = '600'
      surface.appendChild(status)
    }
    status.textContent = count ? `${count} screenshot${count === 1 ? '' : 's'} added — paste or drop more (max ${MAX_FILES})` : 'Click, paste, or drag screenshots here'
  }

  function enhanceSurface() {
    const form = analyseForm()
    const input = imageInput(form)
    const surface = uploaderSurface(form)
    if (!form || !input || !surface || surface.dataset.flippersDnD === '1') return
    surface.dataset.flippersDnD = '1'
    surface.style.cursor = 'pointer'
    surface.setAttribute('title', 'Click, paste, or drag screenshots here')
    showAttachedState(input, input.files?.length || 0)

    const prevent = event => { event.preventDefault(); event.stopPropagation() }
    ;['dragenter','dragover'].forEach(type => surface.addEventListener(type, event => {
      prevent(event)
      surface.dataset.dragActive = '1'
      surface.style.outline = '2px solid rgba(245,158,11,.55)'
      surface.style.outlineOffset = '2px'
    }))
    ;['dragleave','drop'].forEach(type => surface.addEventListener(type, event => {
      prevent(event)
      delete surface.dataset.dragActive
      surface.style.outline = ''
      surface.style.outlineOffset = ''
      if (type === 'drop') mergeFiles(input, validImageFiles(event.dataTransfer?.files))
    }))
  }

  document.addEventListener('paste', event => {
    const form = analyseForm()
    const input = imageInput(form)
    if (!form || !input) return
    const images = [...(event.clipboardData?.items || [])]
      .filter(item => item.kind === 'file' && /^image\//i.test(item.type || ''))
      .map(item => item.getAsFile())
      .filter(Boolean)
    if (!images.length) return
    event.preventDefault()
    mergeFiles(input, images)
  }, true)

  document.addEventListener('dragover', event => {
    const form = analyseForm()
    if (!form) return
    const types = [...(event.dataTransfer?.types || [])]
    if (types.includes('Files')) event.preventDefault()
  }, true)

  document.addEventListener('drop', event => {
    const form = analyseForm()
    const input = imageInput(form)
    if (!form || !input) return
    const images = validImageFiles(event.dataTransfer?.files)
    if (!images.length) return
    const surface = uploaderSurface(form)
    if (surface?.contains(event.target)) return
    event.preventDefault()
    mergeFiles(input, images)
  }, true)

  const observer = new MutationObserver(enhanceSurface)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('load', enhanceSurface)
  enhanceSurface()
})()
