(() => {
  if (window.__flippersWebsiteResearchBridgeV095) return
  window.__flippersWebsiteResearchBridgeV095 = true

  const ORIGIN = location.origin
  const LATEST = 'flippers_research_latest_v095'
  const HISTORY = 'flippers_research_history_v095'

  function emit(type, payload = {}) {
    window.postMessage({ type, ...payload }, ORIGIN)
  }

  async function publishCurrent() {
    const stored = await chrome.storage.local.get([LATEST, HISTORY])
    emit('FLIPPERS_RESEARCH_STATE_V095', {
      latest: stored[LATEST] || null,
      history: Array.isArray(stored[HISTORY]) ? stored[HISTORY] : []
    })
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (!changes[LATEST] && !changes[HISTORY]) return
    publishCurrent().catch(() => {})
  })

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== ORIGIN) return
    if (event.data?.type === 'FLIPPERS_RESEARCH_CLEAR_V095') {
      chrome.storage.local.remove([LATEST, HISTORY]).then(() => publishCurrent()).catch(() => {})
    }
    if (event.data?.type === 'FLIPPERS_RESEARCH_SYNC_V095') publishCurrent().catch(() => {})
  })

  publishCurrent().catch(() => {})
})()
