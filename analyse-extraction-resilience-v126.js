(() => {
  if (window.__flippersExtractionResilience126) return
  window.__flippersExtractionResilience126 = true

  const originalFetch = window.fetch.bind(window)
  const isExtraction = input => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '')
    return /\/functions\/v1\/listing-visual-extraction(?:\?|$)/.test(url)
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

  async function responseNeedsRetry(response) {
    if (!response?.ok) return true
    try {
      const data = await response.clone().json()
      return data?.ok === false && data?.retryable === true
    } catch {
      return false
    }
  }

  window.fetch = async function(input, init) {
    if (!isExtraction(input)) return originalFetch(input, init)

    const makeInput = () => input instanceof Request ? input.clone() : input
    let lastResponse = null
    let lastError = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await originalFetch(makeInput(), init)
        lastResponse = response
        if (!(await responseNeedsRetry(response))) return response
      } catch (error) {
        lastError = error
      }
      if (attempt < 2) await wait(250 * (attempt + 1))
    }

    if (lastResponse) return lastResponse
    throw lastError || new Error('Screenshot extraction temporarily unavailable')
  }
})()
