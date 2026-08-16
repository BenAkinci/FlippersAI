import { CONFIG } from './config.js'

const LAST_MARKETPLACE_TAB = 'flippers_last_marketplace_tab'

function isMarketplaceUrl(url = '') {
  return /^https:\/\/([^/]+\.)?(facebook\.com|ebay\.com\.au|gumtree\.com\.au|depop\.com)\//i.test(url)
}

async function rememberMarketplaceTab(tab) {
  if (tab?.id && isMarketplaceUrl(tab.url || '')) await chrome.storage.local.set({ [LAST_MARKETPLACE_TAB]: tab.id })
}

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) } catch {}
})

chrome.runtime.onStartup.addListener(async () => {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) } catch {}
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { await rememberMarketplaceTab(await chrome.tabs.get(tabId)) } catch {}
})
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') rememberMarketplaceTab(tab).catch(() => {})
})

async function activeTab() {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (current?.id && isMarketplaceUrl(current.url || '')) {
    await rememberMarketplaceTab(current)
    return current
  }

  const stored = await chrome.storage.local.get(LAST_MARKETPLACE_TAB)
  if (stored[LAST_MARKETPLACE_TAB]) {
    try {
      const remembered = await chrome.tabs.get(stored[LAST_MARKETPLACE_TAB])
      if (remembered?.id && isMarketplaceUrl(remembered.url || '')) return remembered
    } catch {}
  }
  throw new Error('Open a supported marketplace listing first, then scan it with FlippersAI.')
}

async function sendToContent(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message)
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
    return chrome.tabs.sendMessage(tabId, message)
  }
}

async function captureVisible(tab) {
  try {
    const current = await chrome.tabs.query({ active:true, windowId:tab.windowId })
    if (current?.[0]?.id !== tab.id) {
      await chrome.tabs.update(tab.id, { active:true })
      await new Promise(r => setTimeout(r, 120))
    }
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 86 })
  } catch {
    return null
  }
}

function bufferToDataUrl(buffer, mime = 'image/jpeg') {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

async function fetchImageData(url) {
  try {
    const response = await fetch(url, { credentials: 'include', cache: 'force-cache' })
    if (!response.ok) return null
    const type = response.headers.get('content-type') || ''
    if (!type.startsWith('image/')) return null
    const blob = await response.blob()
    if (blob.size > 4_500_000) return null
    return bufferToDataUrl(await blob.arrayBuffer(), type)
  } catch {
    return null
  }
}

async function deepScan() {
  const tab = await activeTab()
  const scan = await sendToContent(tab.id, { type: 'FLIPPERS_SCAN_PAGE' })
  if (!scan?.ok) throw new Error(scan?.error || 'Could not read this listing.')

  const screenshot = await captureVisible(tab)
  const images = []
  for (const url of (scan.data?.imageUrls || []).slice(0, 8)) {
    if (images.length >= 5) break
    const data = await fetchImageData(url)
    if (data) images.push(data)
  }
  if (screenshot) images.push(screenshot)

  return {
    ...scan.data,
    tabId: tab.id,
    windowId: tab.windowId,
    pageUrl: tab.url,
    pageTitle: tab.title,
    capturedAt: new Date().toISOString(),
    images: images.slice(0, 6),
    visibleScreenshot: screenshot
  }
}

async function captureCurrentPage() {
  const tab = await activeTab()
  const screenshot = await captureVisible(tab)
  if (!screenshot) throw new Error('Chrome could not capture the marketplace tab.')
  return { dataUrl: screenshot, tabId: tab.id, url: tab.url }
}

async function websiteSession(openWhenMissing = false) {
  const patterns = [
    'https://whattheflip-adz.pages.dev/*',
    'https://*.whattheflip-adz.pages.dev/*'
  ]
  let tabs = []
  for (const pattern of patterns) tabs.push(...await chrome.tabs.query({ url: pattern }))
  const tab = tabs.find(t => t.id)
  if (!tab) {
    if (openWhenMissing) await chrome.tabs.create({ url: CONFIG.websiteUrl })
    return { found: false }
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (projectRef) => {
      const keys = Object.keys(localStorage)
      const preferred = keys.find(k => k === `sb-${projectRef}-auth-token`)
        || keys.find(k => k.includes(projectRef) && k.includes('auth-token'))
        || keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (!preferred) return null
      try { return JSON.parse(localStorage.getItem(preferred)) } catch { return null }
    },
    args: [CONFIG.projectRef]
  })
  return { found: Boolean(result?.result), session: result?.result || null, tabId: tab.id }
}

async function openWorkspace(payload = {}) {
  const params = new URLSearchParams()
  if (payload.workflowId) params.set('workflow', payload.workflowId)
  if (payload.opportunityId) params.set('opportunity', payload.opportunityId)
  const suffix = params.toString() ? `?${params}` : ''
  return chrome.tabs.create({ url: chrome.runtime.getURL(`workspace.html${suffix}`) })
}

async function openWebsite(payload = {}) {
  const url = new URL(CONFIG.websiteUrl)
  if (payload.workflowId) url.searchParams.set('workflow', payload.workflowId)
  if (payload.opportunityId) url.searchParams.set('opportunity', payload.opportunityId)
  return chrome.tabs.create({ url: url.toString() })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case 'FLIPPERS_SCAN_ACTIVE_TAB': return { ok: true, data: await deepScan() }
      case 'FLIPPERS_CAPTURE_VISIBLE': return { ok: true, data: await captureCurrentPage() }
      case 'FLIPPERS_IMPORT_WEBSITE_SESSION': return { ok: true, data: await websiteSession(Boolean(message.openWhenMissing)) }
      case 'FLIPPERS_OPEN_WORKSPACE': await openWorkspace(message); return { ok: true }
      case 'FLIPPERS_OPEN_WEBSITE': await openWebsite(message); return { ok: true }
      case 'FLIPPERS_OPEN_WEBSITE_SETTINGS': await chrome.tabs.create({ url: CONFIG.websiteUrl }); return { ok: true }
      default: return { ok: false, error: 'Unknown extension request.' }
    }
  }
  run().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message || String(error) }))
  return true
})
