# FlippersAI Website Lifecycle v1

Status: LOCKED architecture baseline for website development.

## Product lifecycle

DISCOVER -> DECIDE -> ACQUIRE -> SELL -> COMPLETE

Operational states:
- discovered
- analysing
- verify
- ready
- negotiating
- bought
- preparing
- ready_to_list
- listed
- sale_agreed
- packed
- shipped
- delivered
- paid
- completed

Exit states:
- skipped
- expired
- returned
- written_off

## Organisation is not lifecycle

Shortlist and Saved are user-organisation attributes, not lifecycle states.

- Shortlist = promising Scout lead waiting for a decision.
- Saved = user deliberately wants to keep/track the opportunity.
- Analyse = action/tool that can apply to an opportunity at multiple stages.
- Deals = opportunity has entered active acquisition/pursuit.
- Inventory = begins only after purchase is recorded.

An opportunity can therefore be saved while it is analysing, verify, ready, negotiating, expired, etc.

## Canonical record rule

There is one canonical opportunity record for an engaged item. Data accumulates around that record rather than creating unrelated copies.

Scout candidate -> opportunity -> analysis/evidence -> flip workflow -> inventory item -> sale listing -> sale -> payment/transactions -> completed flip

`scout_candidates` are ingestion/discovery records. `opportunities` are the canonical website item records once an item is engaged by the user (save/analyse/deal) or promoted into the website workflow.

The existing `scout_candidates.opportunity_id` field is the bridge and must be populated when a candidate is promoted.

## 18-step guided workflow

1. Capture listing
2. Identify item
3. Authenticate
4. Assess condition
5. Establish resale value
6. Decide whether worth pursuing
7. Verify unresolved evidence
8. Contact seller
9. Negotiate
10. Inspect/final checks
11. Record purchase
12. Prepare item
13. Photograph item
14. Create sale listing
15. Manage listing/buyer
16. Record sale and fulfilment
17. Confirm payment
18. Complete flip and review performance

Teach/Assist/Fast controls presentation depth, not the underlying lifecycle.

## Page ownership

- Home: next actions + compact business overview.
- Intel: community/market intelligence; later priority.
- Shortlist: AI-qualified discovery queue.
- Saved: deliberate lead/watch workspace.
- Analyse: decision engine; not storage.
- Deals: active acquisition/negotiation only.
- Inventory: owned items through sale/payout.
- Finances: cash, cost basis, fees, realised profit, history.
- Learn: optional learning library + contextual guidance.

## Non-negotiable rules

1. Never ask the user to re-enter information already captured earlier in the lifecycle.
2. Listing image follows the item through Shortlist, Saved, Deals and Inventory where available.
3. Negative economics must be visibly negative; a loss-making listing cannot be presented as a strong buy merely because other sub-scores are high.
4. Verification requirements are structured checks, not walls of text.
5. Each item has one lifecycle owner/source of truth.
6. A completed/approved feature is regression-protected before later work ships.
7. Extension work is frozen until the website lifecycle is complete and stable.
