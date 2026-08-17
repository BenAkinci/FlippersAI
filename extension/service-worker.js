import { CONFIG } from './config.js'

const LAST_MARKETPLACE_TAB = 'flippers_last_marketplace_tab'
const RATING_HISTORY = 'flippers_rating_history_v067'
const RATING_ENABLED = 'flippers_marketplace_badges_enabled_v067'

function isMarketplaceUrl(url = '') {
  return /^https:\/\/([^/]+\.)?(facebook\.com|ebay\.com\.au|gumtree\.com\.au|depop\.com)\//i.test(url)
}

function marketplacePlatform(url = '') {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('facebook.com')) return 'facebook'
    if (host.includes('ebay.com.au')) return 'ebay'
    if (host.includes('gumtree.com.au')) return 'gumtree'
    if (host.includes('depop.com')) return 'depop'
  } catch {}
  return 'other'
}

function ratingKey(rating = {}) {
  const platform = marketplacePlatform(rating.url || '')
  if (rating.listingId) return `${platform}:id:${String(rating.listingId)}`
  try {
    const u = new URL(rating.url || '')
    return `${platform}:url:${u.origin}${u.pathname.replace(/\/$/, '')}`
  } catch {}
  if (rating.id) return `candidate:${String(rating.id)}`
  return ''
}

function sameStoredRating(saved = {}, target = {}) {
  if (target.id && saved.id && String(target.id) === String(saved.id)) return true
  if (target.listingId && saved.listingId && String(target.listingId) === String(saved.listingId)) return true
  try {
    const a = new URL(target.url || ''), b = new URL(saved.url || '')
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')
  } catch {}
  return false
}

async function ratingState() {
  const stored = await chrome.storage.local.get([RATING_HISTORY, RATING_ENABLED])
  return {
    history: stored[RATING_HISTORY] && typeof stored[RATING_HISTORY] === 'object' ? stored[RATING_HISTORY] : {},
    enabled: stored[RATING_ENABLED] !== false
  }
}

async function mergeRatingHistory(ratings = []) {
  const state = await ratingState()
  const history = { ...state.history }
  const now = new Date().toISOString()
  for (const incoming of ratings) {
    const key = ratingKey(incoming)
    if (!key) continue
    const score = Math.max(0, Math.min(100, Math.round(Number(incoming.score || 0))))
    const recommendation = incoming.recommendation || ''
    history[key] = {
      ...(history[key] || {}),
      ...incoming,
      score,
      recommendation,
      elite: score >= 95 && ['strong_buy', 'buy'].includes(recommendation),
      scannedAt: incoming.scannedAt || now,
      updatedAt: now
    }
  }
  await chrome.storage.local.set({ [RATING_HISTORY]: history })
  return history
}

async function removeRatingHistory(listings = []) {
  const state = await ratingState()
  const history = { ...state.history }
  for (const [key, saved] of Object.entries(history)) {
    if (listings.some(target => sameStoredRating(saved, target))) delete history[key]
  }
  await chrome.storage.local.set({ [RATING_HISTORY]: history })
  return history
}

async function rememberMarketplaceTab(tab) {
  if (tab?.id && isMarketplaceUrl(tab.url || '')) await chrome.storage.local.set({ [LAST_MARKETPLACE_TAB]: tab.id })
}

async function marketplaceTabOrNull() {
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
  return null
}

async function activeTab() {
  const tab = await marketplaceTabOrNull()
  if (tab) return tab
  throw new Error('Open a supported marketplace page first, then scan it with FlippersAI.')
}

async function sendToContent(tabId, message) {
  try { return await chrome.tabs.sendMessage(tabId, message) }
  catch { await chrome.scripting.executeScript({ target:{ tabId }, files:['content.js'] }); return chrome.tabs.sendMessage(tabId, message) }
}

async function sendCollection(tabId, message) {
  await chrome.scripting.executeScript({ target:{ tabId }, files:['scout-collection-content.js'] }).catch(() => {})
  return chrome.tabs.sendMessage(tabId, message)
}

async function sendOverlay(tabId, message) {
  await chrome.scripting.executeScript({ target:{ tabId }, files:['scout-rating-overlay.js'] }).catch(() => {})
  return chrome.tabs.sendMessage(tabId, message)
}

async function restoreMarketplaceTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab?.id || !isMarketplaceUrl(tab.url || '')) return
    const state = await ratingState()
    await sendOverlay(tab.id, {
      type:'FLIPPERS_RATING_OVERLAY_V067',
      enabled:state.enabled,
      ratings:Object.values(state.history)
    })
  } catch {}
}

async function restoreAllMarketplaceTabs() {
  const patterns = ['https://*.facebook.com/*','https://*.ebay.com.au/*','https://*.gumtree.com.au/*','https://*.depop.com/*']
  const tabs = await chrome.tabs.query({ url:patterns }).catch(() => [])
  await Promise.allSettled((tabs || []).filter(t => t.id).map(t => restoreMarketplaceTab(t.id)))
}

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) } catch {}
  const state = await chrome.storage.local.get(RATING_ENABLED)
  if (state[RATING_ENABLED] === undefined) await chrome.storage.local.set({ [RATING_ENABLED]:true })
  restoreAllMarketplaceTabs().catch(() => {})
})
chrome.runtime.onStartup.addListener(async () => {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) } catch {}
  restoreAllMarketplaceTabs().catch(() => {})
})
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    await rememberMarketplaceTab(tab)
    if (isMarketplaceUrl(tab?.url || '')) setTimeout(() => restoreMarketplaceTab(tabId), 120)
  } catch {}
})
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') rememberMarketplaceTab(tab).catch(() => {})
  if (changeInfo.status === 'complete' && isMarketplaceUrl(tab?.url || '')) setTimeout(() => restoreMarketplaceTab(tabId), 160)
})

async function captureVisible(tab) {
  try {
    const current = await chrome.tabs.query({ active:true, windowId:tab.windowId })
    if (current?.[0]?.id !== tab.id) { await chrome.tabs.update(tab.id, { active:true }); await new Promise(r => setTimeout(r, 120)) }
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format:'jpeg', quality:86 })
  } catch { return null }
}

function bufferToDataUrl(buffer, mime='image/jpeg') { const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return`data:${mime};base64,${btoa(binary)}` }
async function fetchImageData(url) { try { const response=await fetch(url,{credentials:'include',cache:'force-cache'});if(!response.ok)return null;const type=response.headers.get('content-type')||'';if(!type.startsWith('image/'))return null;const blob=await response.blob();if(blob.size>4_500_000)return null;return bufferToDataUrl(await blob.arrayBuffer(),type) } catch { return null } }

async function deepScan() {
  const tab=await activeTab(),scan=await sendToContent(tab.id,{type:'FLIPPERS_SCAN_PAGE'});if(!scan?.ok)throw new Error(scan?.error||'Could not read this listing.')
  const screenshot=await captureVisible(tab),images=[]
  for(const url of (scan.data?.imageUrls||[]).slice(0,8)){if(images.length>=5)break;const data=await fetchImageData(url);if(data)images.push(data)}
  if(screenshot)images.push(screenshot)
  return{...scan.data,tabId:tab.id,windowId:tab.windowId,pageUrl:tab.url,pageTitle:tab.title,capturedAt:new Date().toISOString(),images:images.slice(0,6),visibleScreenshot:screenshot}
}

async function collectionScan(scroll=false, tabId=null) {
  const tab=tabId?await chrome.tabs.get(tabId):await activeTab();if(!tab?.id||!isMarketplaceUrl(tab.url||''))throw new Error('Return to a supported marketplace page first.')
  await rememberMarketplaceTab(tab)
  const type=scroll?'FLIPPERS_SCROLL_RESULTS_V066':'FLIPPERS_SCAN_COLLECTION_V066'
  const result=await sendCollection(tab.id,{type});if(!result?.ok)throw new Error(result?.error||'Could not read marketplace results.')
  return{...result.data,tabId:tab.id,pageUrl:tab.url,pageTitle:tab.title,platform:result.data?.platform||marketplacePlatform(tab.url)}
}

async function routeOverlay(message) {
  const enabled = message.enabled !== false
  await chrome.storage.local.set({ [RATING_ENABLED]:enabled })
  const history = message.ratings?.length ? await mergeRatingHistory(message.ratings) : (await ratingState()).history
  const tab = await marketplaceTabOrNull()
  if (tab?.id) await sendOverlay(tab.id, { type:'FLIPPERS_RATING_OVERLAY_V067', enabled, ratings:Object.values(history) }).catch(() => {})
  return { tabId:tab?.id || null, saved:Object.keys(history).length, enabled }
}

async function routeRatingRemove(listings = []) {
  const history = await removeRatingHistory(listings)
  const state = await ratingState()
  const tab = await marketplaceTabOrNull()
  if (tab?.id) await sendOverlay(tab.id, { type:'FLIPPERS_RATING_OVERLAY_V067', enabled:state.enabled, ratings:Object.values(history) }).catch(() => {})
  return { tabId:tab?.id || null, saved:Object.keys(history).length }
}

async function captureCurrentPage() { const tab=await activeTab(),screenshot=await captureVisible(tab);if(!screenshot)throw new Error('Chrome could not capture the marketplace tab.');return{dataUrl:screenshot,tabId:tab.id,url:tab.url} }

async function websiteSession(openWhenMissing=false) {
  const patterns=['https://whattheflip-adz.pages.dev/*','https://*.whattheflip-adz.pages.dev/*'];let tabs=[];for(const pattern of patterns)tabs.push(...await chrome.tabs.query({url:pattern}));const tab=tabs.find(t=>t.id)
  if(!tab){if(openWhenMissing)await chrome.tabs.create({url:CONFIG.websiteUrl});return{found:false}}
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(projectRef)=>{const keys=Object.keys(localStorage),preferred=keys.find(k=>k===`sb-${projectRef}-auth-token`)||keys.find(k=>k.includes(projectRef)&&k.includes('auth-token'))||keys.find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));if(!preferred)return null;try{return JSON.parse(localStorage.getItem(preferred))}catch{return null}},args:[CONFIG.projectRef]})
  return{found:Boolean(result?.result),session:result?.result||null,tabId:tab.id}
}

async function openWorkspace(payload={}) { const params=new URLSearchParams();if(payload.workflowId)params.set('workflow',payload.workflowId);if(payload.opportunityId)params.set('opportunity',payload.opportunityId);const suffix=params.toString()?`?${params}`:'';return chrome.tabs.create({url:chrome.runtime.getURL(`workspace.html${suffix}`)}) }
async function openWebsite(payload={}) { const url=new URL(CONFIG.websiteUrl);if(payload.workflowId)url.searchParams.set('workflow',payload.workflowId);if(payload.opportunityId)url.searchParams.set('opportunity',payload.opportunityId);return chrome.tabs.create({url:url.toString()}) }

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  const run=async()=>{
    switch(message?.type){
      case'FLIPPERS_SCAN_ACTIVE_TAB':return{ok:true,data:await deepScan()}
      case'FLIPPERS_SCAN_COLLECTION_ACTIVE':return{ok:true,data:await collectionScan(false)}
      case'FLIPPERS_SCROLL_COLLECTION':return{ok:true,data:await collectionScan(true,message.tabId||null)}
      case'FLIPPERS_GET_MARKETPLACE_TAB':{const tab=await activeTab();return{ok:true,data:{tabId:tab.id,windowId:tab.windowId,url:tab.url,title:tab.title,platform:marketplacePlatform(tab.url)}}}
      case'FLIPPERS_ROUTE_RATING_OVERLAY':return{ok:true,data:await routeOverlay({enabled:message.enabled!==false,ratings:message.ratings||[]})}
      case'FLIPPERS_ROUTE_RATING_REMOVE':return{ok:true,data:await routeRatingRemove(message.listings||[])}
      case'FLIPPERS_GET_RATING_STATE':{const state=await ratingState();return{ok:true,data:{enabled:state.enabled,ratings:Object.values(state.history)}}}
      case'FLIPPERS_CAPTURE_VISIBLE':return{ok:true,data:await captureCurrentPage()}
      case'FLIPPERS_IMPORT_WEBSITE_SESSION':return{ok:true,data:await websiteSession(Boolean(message.openWhenMissing))}
      case'FLIPPERS_OPEN_WORKSPACE':await openWorkspace(message);return{ok:true}
      case'FLIPPERS_OPEN_WEBSITE':await openWebsite(message);return{ok:true}
      case'FLIPPERS_OPEN_WEBSITE_SETTINGS':await chrome.tabs.create({url:CONFIG.websiteUrl});return{ok:true}
      default:return{ok:false,error:'Unknown extension request.'}
    }
  }
  run().then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message||String(error)}));return true
})
