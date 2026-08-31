# Stage 2B — FlippersAI Research Browser MVP

## Product intent

When direct listing acquisition is incomplete, FlippersAI should open a real remote browser session instead of immediately falling back to manual screenshots. The user browses the listing naturally while FlippersAI observes and progressively builds the opportunity analysis.

Fallback order:

1. Direct URL acquisition
2. FlippersAI Research Browser
3. Screenshot paste / drag-drop

## MVP user flow

1. User pastes listing URL in Analyse.
2. Direct acquisition runs first.
3. If required listing evidence is missing, Analyse offers `Open Research Browser`.
4. FlippersAI creates a Browser Run Chromium session at the listing URL.
5. The listing is shown through a Live View surface while a Live Analysis panel remains visible.
6. User can scroll, click photos, open seller profile/reviews/other relevant pages, go back/forward and sign in manually if necessary.
7. FlippersAI observes each relevant page state and merges evidence into one research packet.
8. Once identity/evidence is sufficient, market-comp research runs independently and deterministic economics are calculated.
9. Final verdict: BUY / NEGOTIATE / VERIFY FIRST / SKIP with executable next action.

## Evidence packet

Each captured page event should preserve:

- source URL
- page type (listing / seller / reviews / other)
- capture time
- visible title/text
- price/currency where visible
- condition/size/location/shipping where visible
- seller name/rating/sales/review counts where visible
- product photo references and visible authenticity markers
- provenance/confidence for every extracted fact

Facts should never silently overwrite stronger prior evidence. Conflicts must be surfaced.

## RB milestones

### RB-1 — infrastructure spike
Create a Browser Run session, navigate to the known Depop P-6000 listing, return a Live View URL plus rendered page state, keep the session reusable, and verify whether the marketplace is usable in Browser Run.

### RB-2 — session controller
Add reconnect, heartbeat, inspect-current-page, navigation event capture and close-session endpoints.

### RB-3 — Analyse UI
Replace the screenshot-only fallback card with `Open Research Browser`, render the remote browsing surface beside a progressive evidence panel, and retain screenshot fallback.

### RB-4 — progressive extraction
Classify page type and continuously extract listing/seller/product facts while the user browses.

### RB-5 — analysis handoff
Feed accumulated evidence into product identification, comp research, authenticity/condition assessment and deterministic economics.

## Non-goals for MVP

- automated purchase/checkout
- automated credential entry
- CAPTCHA bypass
- bypassing marketplace access controls
- extension dependency

## Acceptance rule

The Research Browser is only worth shipping if a user can reach and interact with the target marketplace listing and FlippersAI can read materially more evidence than direct server acquisition. If Browser Run itself is blocked by a marketplace, screenshots remain the supported fallback and we reassess an authenticated local-browser/extension architecture later.
