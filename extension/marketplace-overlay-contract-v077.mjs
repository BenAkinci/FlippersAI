import fs from 'node:fs'

const overlay = fs.readFileSync(new URL('./scout-rating-overlay.js', import.meta.url), 'utf8')
const manifest = JSON.parse(fs.readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))

function requireText(text, label) {
  if (!overlay.includes(text)) throw new Error(`Marketplace overlay contract failed: ${label}`)
}

const [major,minor]=String(manifest.version||'0.0.0').split('.').map(Number)
if (!(major > 0 || minor >= 77)) throw new Error(`Expected manifest 0.77.0 or newer, got ${manifest.version}`)
if (!manifest.content_scripts?.some(group => group.js?.includes('scout-rating-overlay.js'))) throw new Error('Marketplace overlay must remain a marketplace content script')

requireText('__flippersMarketplaceRatingOverlayV077', 'v0.77 overlay runtime missing')
requireText('flippersai-cover-score-v077', 'cover score badge missing')
requireText('flippersai-rated-image-v077', 'listing cover image marker missing')
requireText('FLIPPERS_RATING_OVERLAY_V067', 'backwards-compatible Scout rating message missing')
requireText('chrome.storage.onChanged', 'persistent rating storage listener missing')
requireText("host.includes('facebook.com')", 'Facebook Marketplace matching missing')
requireText("host.includes('ebay.com.au')", 'eBay matching missing')
requireText("host.includes('depop.com')", 'Depop matching missing')
requireText("host.includes('gumtree.com.au')", 'Gumtree matching missing')
requireText('pathKey(rating.url', 'exact listing URL matching missing')
requireText('listingToken(href)', 'listing ID fallback matching missing')
requireText('bestImage(root, anchor)', 'listing cover targeting missing')
requireText('badge.innerHTML', 'visible score badge rendering missing')
requireText('loadStored().catch', 'restore-on-page-load missing')

console.log('Marketplace rating cover contract v0.77 passed')
