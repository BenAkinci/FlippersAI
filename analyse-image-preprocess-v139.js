(() => {
  if (window.__flippersImagePreprocess139) return
  window.__flippersImagePreprocess139 = true

  const MAX_EDGE = 2200
  const TARGET_BYTES = 1_250_000
  const MAX_SAFE_ORIGINAL_BYTES = 5_500_000
  const SUPPORTED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
  let replaying = false
  let generation = 0

  const setStatus = (message, isError = false) => {
    const el = document.getElementById('manualDropStatus') || document.getElementById('autoExtractStatus')
    if (!el) return
    el.textContent = message
    if (el.id === 'autoExtractStatus') el.className = `auto-status${isError ? ' warn' : ''}`
    else el.style.color = isError ? '#b42318' : '#58717e'
  }

  const extensionless = name => String(name || 'listing-screenshot').replace(/\.[^.]+$/, '')

  async function decode(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file)
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw(ctx, w, h) { ctx.drawImage(bitmap, 0, 0, w, h) },
          close() { bitmap.close?.() }
        }
      } catch {}
    }

    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw(ctx, w, h) { ctx.drawImage(img, 0, 0, w, h) },
        close() { URL.revokeObjectURL(url) }
      })
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not decode ${file.name || 'image'}`)) }
      img.src = url
    })
  }

  const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Browser could not encode screenshot')), 'image/jpeg', quality)
  })

  async function optimize(file) {
    if (!SUPPORTED.has(String(file.type || '').toLowerCase())) {
      throw new Error(`${file.name || 'Image'} is not a supported JPEG, PNG or WebP image.`)
    }

    const source = await decode(file)
    try {
      const largest = Math.max(source.width, source.height)
      let scale = largest > MAX_EDGE ? MAX_EDGE / largest : 1
      let width = Math.max(1, Math.round(source.width * scale))
      let height = Math.max(1, Math.round(source.height * scale))

      // Even modest PNG screenshots are re-encoded. This keeps visible text clear
      // while avoiding huge base64 payloads from phone/retina screenshots.
      let canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      let ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('Browser image processing is unavailable')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      source.draw(ctx, width, height)

      let quality = 0.9
      let blob = await canvasBlob(canvas, quality)
      for (let attempt = 0; blob.size > TARGET_BYTES && attempt < 6; attempt++) {
        if (quality > 0.7) {
          quality -= 0.07
        } else {
          width = Math.max(900, Math.round(width * 0.86))
          height = Math.max(900, Math.round(height * 0.86))
          const next = document.createElement('canvas')
          next.width = width
          next.height = height
          const nextCtx = next.getContext('2d', { alpha: false })
          if (!nextCtx) break
          nextCtx.fillStyle = '#fff'
          nextCtx.fillRect(0, 0, width, height)
          nextCtx.drawImage(canvas, 0, 0, width, height)
          canvas.width = canvas.height = 1
          canvas = next
          ctx = nextCtx
          quality = 0.82
        }
        blob = await canvasBlob(canvas, quality)
      }

      if (!blob?.size) throw new Error('Screenshot optimisation returned an empty image')
      return new File([blob], `${extensionless(file.name)}-optimised.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now()
      })
    } finally {
      source.close?.()
    }
  }

  async function prepare(files) {
    const prepared = []
    const failures = []
    for (const file of files.slice(0, 10)) {
      try {
        prepared.push(await optimize(file))
      } catch (error) {
        if (SUPPORTED.has(String(file.type || '').toLowerCase()) && file.size <= MAX_SAFE_ORIGINAL_BYTES) {
          prepared.push(file)
          failures.push(`${file.name || 'One image'} could not be optimised, so the original was kept.`)
        } else {
          failures.push(error?.message || `Could not prepare ${file.name || 'image'}`)
        }
      }
    }
    return { prepared, failures }
  }

  document.addEventListener('change', async event => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.id !== 'manualEvidenceInput' || replaying) return
    const files = [...(input.files || [])]
    if (!files.length) return

    event.preventDefault()
    event.stopImmediatePropagation()
    const thisGeneration = ++generation
    setStatus(`Optimising ${files.length} screenshot${files.length === 1 ? '' : 's'} for reliable scanning…`)

    const { prepared, failures } = await prepare(files)
    if (thisGeneration !== generation) return
    if (!prepared.length) {
      setStatus(failures[0] || 'These screenshots could not be prepared. Try JPEG, PNG or WebP images.', true)
      return
    }

    const dt = new DataTransfer()
    prepared.forEach(file => dt.items.add(file))
    input.files = dt.files

    if (failures.length) setStatus(`${prepared.length} image${prepared.length === 1 ? '' : 's'} ready. ${failures.join(' ')}`, true)
    else setStatus(`${prepared.length} screenshot${prepared.length === 1 ? '' : 's'} optimised and ready to scan.`)

    replaying = true
    try { input.dispatchEvent(new Event('change', { bubbles: true })) }
    finally { replaying = false }
  }, true)
})()
