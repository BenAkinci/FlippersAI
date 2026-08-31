# FlippersAI Stage 2 — Analyse Contract

Status: LOCKED FOR STAGE 2 IMPLEMENTATION

## Product promise

A user can paste a resale listing URL and FlippersAI does the research required to make a decision. The user should not need to manually re-enter information already available on the listing or research comparable sales before Analyse can work.

Core flow:

`paste/upload -> acquire listing -> extract facts/images -> identify exact item -> research market -> analyse authenticity/condition -> calculate economics -> BUY / NEGOTIATE / VERIFY FIRST / SKIP -> executable next action`

## Required listing acquisition

For a URL-only analysis, FlippersAI must attempt to acquire and preserve provenance for:

- marketplace and listing ID
- listing URL
- exact seller asking price and currency
- seller username/name
- seller rating/review/sales indicators where publicly available
- title and description
- location
- listed condition
- size / variant / colour / model fields where available
- shipping/postage where available
- listing images
- listing age/date where available
- SKU/style/model identifiers where available

A field already available on the listing must not be treated as a seller-verification requirement merely because FlippersAI's first extraction attempt failed.

## Acquisition fallbacks

Marketplace adapters should attempt, in order where appropriate:

1. marketplace/public page structured data or embedded JSON
2. marketplace/public page HTML/meta extraction
3. legitimately accessible marketplace/public endpoints
4. rendered/browser capture where required and available
5. search-engine/web-research recovery of listing facts
6. user screenshots/pasted text only as the final fallback

Extraction failure is an engineering/fallback event, not automatically a VERIFY FIRST verdict.

## Image requirement

When listing images are publicly retrievable, Analyse must acquire them automatically and pass them to visual analysis. User upload is a fallback, not the normal URL workflow.

Visual analysis should assess visible condition and authenticity indicators, with confidence and explicit unresolved checks.

## Exact item identification

Identification should combine title, description, structured listing data, images, labels/SKU/style codes, variant, size and colourway. The listing title alone is not authoritative.

## Market research

After identification, Analyse must research current comparable evidence. Relevant sources vary by category and may include:

- same marketplace active/sold evidence
- eBay current and completed/sold evidence where accessible
- Facebook Marketplace / Gumtree where accessible
- GOAT / StockX for relevant products
- retailers such as Nike, Foot Locker, JD and equivalents
- resale/consignment stores such as PUSHAS and category-specific specialists
- other trustworthy resale databases

Evidence must record source/provenance. Comparable matching should prioritise:

`exact model + exact variant/colourway + similar size + similar condition + same region`

Then progressively loosen constraints only when necessary.

Every comparable must be classified as exact, strong, approximate or rejected. Wrong variants, bundles, parts-only listings, materially different condition and suspicious outliers must not be weighted as strong evidence.

## Valuation outputs

Analyse should attempt to return:

- seller ask
- expected resale
- resale range
- quick-sale value
- expected selling costs
- preparation costs
- expected net profit
- ROI
- break-even price
- recommended offer when relevant
- maximum recommended buy price
- expected sell-time range where evidence supports it
- valuation confidence
- evidence count and source summary

Financial calculations must be deterministic from acquired inputs and configured platform/cost assumptions, not free-form AI guesses.

## Authenticity

Analyse must inspect all available evidence automatically. It should never claim guaranteed authenticity from insufficient online evidence.

Allowed outcomes should communicate evidence and confidence, for example:

- likely genuine
- uncertain / verification required
- high risk
- likely counterfeit
- not applicable

VERIFY FIRST is valid when a specific missing seller-supplied fact/photo is genuinely required after automated research has been exhausted.

## Condition

Condition should combine seller-stated condition with visual evidence. It must distinguish seller claim from AI visual assessment and show confidence.

## Verdict rules

Every Analyse result must end with one of the core actions:

- BUY
- NEGOTIATE
- VERIFY FIRST
- SKIP

BUY/NEGOTIATE require sufficient listing identity, valuation and authenticity evidence.

VERIFY FIRST must mean: `FlippersAI completed the research it reasonably could, but a specific seller-supplied item is still needed.`

VERIFY FIRST must not mean: `FlippersAI failed to retrieve information that was already available on the listing.`

## Action workflow

Every verdict must have an executable next action.

BUY:
- show purchase/max-price guidance and move toward acquisition.

NEGOTIATE:
- show recommended offer, generated seller message and open-listing action.

VERIFY FIRST:
- show only the genuinely missing information
- generate a seller message
- copy message / open listing
- accept seller reply/screenshots/photos
- update the same opportunity and re-run Analyse

SKIP:
- show the concise reason and allow dismiss/archive/next listing.

## URL-only acceptance test

Stage 2 Analyse is not complete until a normal public marketplace URL can, wherever the source makes the data publicly available, populate the listing facts, market valuation, economics, condition/authenticity assessment, verdict and next action without requiring the user to manually research the listing first.

The current Depop Nike TN test listing is the baseline failure case for this stage.
