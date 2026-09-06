(() => {
  if (window.__flippersExtractionResilience127) return
  window.__flippersExtractionResilience127 = true

  const originalFetch = window.fetch.bind(window)
  const isExtraction = input => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '')
    return /\/functions\/v1\/listing-visual-extraction(?:\?|$)/.test(url)
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

  async function readPayload(response) {
    try { return await response.clone().json() } catch { return {} }
  }

  function classifyFailure(payload, status) {
    const raw = [payload?.error, payload?.detail, payload?.message].filter(Boolean).join(' ').trim()
    const text = raw.toLowerCase()
    if (/insufficient[_ -]?quota|quota exceeded|billing|credit balance|credits exhausted|payment required/.test(text) || status === 402) {
      return 'AI API credit/quota appears to be exhausted. Add API credit or restore billing, then FlippersAI can scan these screenshots.'
    }
    if (/rate limit|too many requests|429/.test(text) || status === 429) {
      return 'The AI scanner is temporarily rate-limited. FlippersAI retried automatically; please try again shortly.'
    }
    if (/timeout|timed out|deadline|abort/.test(text) || status === 504) {
      return 'The screenshot scanner timed out after automatic retries. Keep the screenshots attached and try again.'
    }
    if (/image|base64|payload|too large|request entity/.test(text) || status === 413) {
      return 'One or more screenshots could not be processed because the image payload was too large or invalid.'
    }
    if (/unauthori|forbidden|invalid api key|authentication|401|403/.test(text) || status === 401 || status === 403) {
      return 'The AI scanner authentication/configuration needs attention. The screenshots are still attached.'
    }
    return raw || `Screenshot scan failed after automatic retries${status ? ` (HTTP ${status})` : ''}.`
  }

  async function responseNeedsRetry(response) {
    if (!response?.ok) return true
    const data = await readPayload(response)
    return data?.ok === false && data?.retryable === true
  }

  async function diagnosticResponse(response) {
    const payload = await readPayload(response)
    const message = classifyFailure(payload, response?.status)
    const body = {
      ok: false,
      retryable: false,
      error: message,
      technical_detail: payload?.detail || payload?.error || '',
      diagnostic_id: payload?.diagnostic_id || null,
      original_status: response?.status || null
    }
    document.dispatchEvent(new CustomEvent('flippers:extraction-failed', { detail: body }))
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Flippers-Original-Status': String(response?.status || '') }
    })
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
      if (attempt < 2) await wait(300 * (attempt + 1))
    }

    if (lastResponse) return diagnosticResponse(lastResponse)
    const message = classifyFailure({ detail: lastError?.message || String(lastError || '') }, 0)
    document.dispatchEvent(new CustomEvent('flippers:extraction-failed', { detail: { ok:false, retryable:false, error:message, technical_detail:lastError?.message || String(lastError || '') } }))
    return new Response(JSON.stringify({ ok:false, retryable:false, error:message, technical_detail:lastError?.message || String(lastError || '') }), { status:200, headers:{'Content-Type':'application/json'} })
  }
})()
