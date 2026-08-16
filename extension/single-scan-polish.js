const money = value => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? null : new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(Number(value))

function enhanceSingleScan() {
  const form = document.querySelector('#scanReview')
  if (!form || form.dataset.compactCapture === '1') return
  form.dataset.compactCapture = '1'

  const get = name => form.querySelector(`[name="${name}"]`)
  const title = get('title')?.value?.trim() || 'Listing detected'
  const price = money(get('price')?.value)
  const location = get('location')?.value?.trim() || ''
  const condition = get('condition')?.value?.trim() || ''
  const seller = get('seller')?.value?.trim() || ''
  const description = get('description')?.value?.trim() || ''

  const summary = document.createElement('section')
  summary.className = 'single-capture-summary'
  summary.innerHTML = `<span class="eyebrow">DETECTED LISTING</span><h2></h2><div class="single-capture-facts"></div>`
  summary.querySelector('h2').textContent = title
  const facts = summary.querySelector('.single-capture-facts')
  const values = [
    price ? ['ASK',price] : ['ASK','Not detected'],
    location ? ['LOCATION',location] : null,
    condition ? ['CONDITION',condition] : null,
    seller ? ['SELLER',seller] : null
  ].filter(Boolean)
  for (const [label,value] of values) {
    const item = document.createElement('div')
    item.innerHTML = `<span>${label}</span><strong></strong>`
    item.querySelector('strong').textContent = value
    facts.appendChild(item)
  }

  const labels = [...form.querySelectorAll(':scope > label')]
  const grids = [...form.querySelectorAll(':scope > .form-grid')]
  const correction = document.createElement('details')
  correction.className = 'single-capture-corrections'
  if (!price || title === 'Listing detected') correction.open = true
  correction.innerHTML = `<summary>Review or correct detected details</summary><div class="single-capture-fields"></div>`
  const fieldMount = correction.querySelector('.single-capture-fields')
  grids.forEach(grid => fieldMount.appendChild(grid))
  labels.forEach(label => fieldMount.appendChild(label))

  const descriptionInput = get('description')
  if (descriptionInput && !description) descriptionInput.placeholder = 'No listing description was detected. Add anything important only if needed.'

  const notice = form.querySelector('.notice.good')
  if (notice) {
    notice.classList.remove('good')
    notice.classList.add('single-capture-note')
    notice.textContent = 'Captured from the marketplace page in your signed-in browser. Correct anything only if FlippersAI detected it incorrectly.'
  }

  form.insertBefore(summary, form.firstChild)
  const row = form.querySelector('.button-row')
  form.insertBefore(correction, notice || row || null)
}

let timer
new MutationObserver(() => {
  clearTimeout(timer)
  timer = setTimeout(enhanceSingleScan, 30)
}).observe(document.getElementById('app'),{childList:true,subtree:true})

enhanceSingleScan()
