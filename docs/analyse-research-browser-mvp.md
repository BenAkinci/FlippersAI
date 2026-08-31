# Analyse Research Browser MVP

Status: locked Stage 2B implementation direction

## Product goal

When a marketplace URL cannot be reliably acquired by the normal website pipeline, FlippersAI should open the listing in a controlled research browser and let the user browse naturally while FlippersAI continuously captures and analyses relevant evidence.

The user should not have to manually research the item or type listing facts already visible in the browser.

## Fallback order

1. Automatic server acquisition
2. FlippersAI Research Browser
3. Screenshot paste / drag-drop fallback

The Research Browser is the preferred fallback before screenshots once it is production-ready.

## User experience

Paste listing URL -> FlippersAI attempts normal acquisition.

If acquisition is incomplete, show `Open Research Browser`.

Research Browser view:

- Left/main pane: live marketplace browser controlled by the user.
- Right/side pane: live FlippersAI analysis state.
- User can scroll, click links, open seller profiles, reviews, product photos, related listings, and navigate back/forward.
- FlippersAI captures evidence from each relevant page and merges it into the same opportunity analysis packet.
- Analysis updates progressively without requiring the user to submit each page manually.

Example evidence checklist:

- Listing title
- Asking price
- Seller name/profile
- Seller rating/reviews/sales signals
- Size/variant
- Condition
- Description
- Location/shipping
- Listing/product images
- SKU/style code/labels where visible
- Authenticity indicators
- Listing ID and marketplace

## Browser architecture

Do not use a normal marketplace iframe as the core implementation. Cross-origin protections and marketplace frame restrictions make that unreliable and prevent FlippersAI from reading the page.

Use a controlled remote Chromium session.

Preferred infrastructure: Cloudflare Browser Run because the website is already deployed on Cloudflare and Browser Run supports full browser sessions, CDP, Playwright/Puppeteer-compatible control, session reuse, and human intervention/live viewing.

The browser runtime must be abstracted behind a provider interface so another remote-browser provider can be substituted later without rewriting Analyse.

## Session model

Each Analyse research session belongs to one authenticated FlippersAI user and one opportunity/draft analysis.

Persist:

- session id
- opportunity/draft analysis id
- current URL
- navigation history metadata
- captured page evidence
- timestamps
- extraction provenance
- browser status

Browser sessions should be short-lived and explicitly closed when the user finishes, navigates away for long enough, or the session expires.

## Evidence capture loop

On meaningful navigation or page-state changes:

1. Read page URL/title.
2. Capture a DOM/accessibility snapshot and relevant rendered text.
3. Capture visible product images or targeted screenshots when useful.
4. Classify page type: listing, seller profile, seller reviews, product detail, other.
5. Extract structured facts with provenance.
6. Merge new facts into the opportunity research packet without overwriting stronger evidence with weaker evidence.
7. Trigger incremental analysis refresh.

Do not require OCR for normal browser text. Use DOM/accessibility data first; use vision for images and visually encoded information.

## Live analysis panel

The panel should show progress, not a static spinner.

Sections:

- Listing facts
- Seller checks
- Product identity
- Condition
- Authenticity
- Market research
- Economics
- Decision readiness

Each field can be `found`, `missing`, `conflicting`, or `needs verification`.

FlippersAI should tell the user what to inspect next when evidence is missing, e.g. `Open seller profile`, `Open product photos`, or `Find the tongue label photo`.

## Market valuation separation

The user's research browser is primarily for acquiring evidence about the specific opportunity.

The user should NOT be expected to browse eBay/StockX/GOAT/retail comps manually.

Once product identity is sufficiently strong, the backend market-research engine should independently retrieve and rank comps, then calculate:

- expected resale
- quick-sale resale
- fees/costs
- expected profit
- ROI
- max recommended buy
- valuation confidence

## Decision rules

BUY / NEGOTIATE cannot be issued without sufficient listing and valuation evidence.

VERIFY FIRST is only for genuine missing/uncertain seller evidence, not for FlippersAI's own acquisition failure.

Every verdict must include an executable next action.

## Security/privacy requirements

- Never expose Cloudflare/browser provider credentials to frontend code.
- Browser control must be brokered by authenticated backend endpoints.
- Do not persist marketplace passwords in FlippersAI.
- Treat session cookies/storage as sensitive ephemeral browser-session data.
- Isolate browser sessions by FlippersAI user.
- Close sessions promptly when finished.
- Record evidence provenance without logging secrets or authentication tokens.

## MVP acceptance test

Using the existing Nike P-6000 Depop test URL:

1. Paste URL into Analyse.
2. Normal acquisition fails or is incomplete.
3. User opens Research Browser.
4. Listing visibly loads in controlled browser.
5. User scrolls listing and opens seller profile.
6. FlippersAI automatically captures at least title, ask, seller, size/condition/description where present, and useful listing images.
7. Live Analyse panel visibly updates while browsing.
8. Product identity is passed to market research.
9. Analyse returns a source-backed resale estimate and deterministic profit/ROI/max-buy values when evidence is sufficient.
10. If authenticity evidence remains incomplete, verdict becomes VERIFY FIRST with a specific seller action rather than generic uncertainty.

## Implementation phases

### RB-1 Infrastructure spike
- Cloudflare Browser Run Worker
- create/close/reconnect session endpoints
- server-side session ownership
- navigate/read snapshot proof of concept

### RB-2 FlippersAI browser surface
- Research Browser panel
- navigation controls
- live session view/input transport
- URL/status display

### RB-3 Evidence pipeline
- navigation/page-change capture
- page classification
- structured extraction/provenance
- merge into analysis packet

### RB-4 Live Analyse integration
- progressive checklist/status
- suggested next browsing action
- incremental analysis refresh

### RB-5 Market research/economics
- independent comp retrieval
- comparable ranking
- deterministic economics

### RB-6 Hardening
- marketplace/login edge cases
- timeouts/reconnects
- privacy/session isolation
- usage/cost controls
- regression tests
