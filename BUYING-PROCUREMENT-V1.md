# FlippersAI Buying / Procurement V1

## Goal

Turn a completed Analyse result into an executable path from opportunity to owned inventory without requiring the user to know how to verify, negotiate, inspect or document a purchase.

## Core lifecycle

`Analyse → Verify if needed → Negotiate if needed → Arrange transaction → Inspect → Buy → Record`

Pre-purchase states:

- `watching`
- `analysing`
- `verify`
- `ready`
- `negotiating`

Owned state:

- `bought`

Exit state:

- `skipped`

## Entry from Analyse

Every completed Analyse result must hand off one of four outcomes:

### BUY

The system has enough evidence and acceptable economics. Primary action: continue to purchase planning.

### NEGOTIATE

The item can work at a lower acquisition price. Show:

- opening offer;
- ideal buy price;
- hard maximum buy price;
- expected economics at each point;
- suggested seller message.

### VERIFY FIRST

Use only when FlippersAI has exhausted available research and needs information/evidence only the seller can provide. This is not a fallback for failed search or system errors.

Show:

- exactly what is missing;
- why it matters;
- exact seller message/request;
- upload/paste area for the reply or new evidence;
- automatic re-evaluation after reply/evidence.

### SKIP

Do not create fake procurement steps. Offer only:

- Save anyway;
- Find another opportunity.

## Persistent opportunity record

`Save for later` must persist the opportunity rather than just bookmark the page.

Persist at minimum:

- listing/source reference;
- listing screenshots/evidence;
- seller facts;
- identified product;
- analysis result;
- evidence quality/confidence;
- resale low/expected/high;
- expected profit;
- ROI;
- max buy;
- recommended offer;
- seller details;
- outstanding verification questions;
- current lifecycle state;
- latest next action;
- timestamps.

## Continue action

The `Continue` action should be dynamic. It should open the current next required step, not a generic workflow page.

Examples:

- verification outstanding → open Verify;
- seller counteroffer received → open Negotiate;
- price agreed → open Arrange transaction;
- meetup scheduled → open Inspect;
- purchase completed → open Record purchase.

## Verify step

### Inputs

Verification items are generated from the actual uncertainty in Analyse, such as:

- style/SKU code;
- label photo;
- sole/insole photo;
- serial/date code;
- measurements;
- included accessories;
- flaw close-up;
- proof of purchase where relevant;
- seller clarification.

### User action

FlippersAI writes the exact message. User can copy/send it externally.

### Reply handling

User can:

- paste seller reply text;
- upload screenshots;
- upload new item photos.

FlippersAI extracts the reply/evidence, resolves each verification item and re-runs the decision where material.

## Negotiate step

Show a simple negotiation envelope:

- `Opening offer`
- `Good buy / target`
- `Hard maximum`

The hard maximum must come from economics rather than arbitrary discount percentages.

For each seller counteroffer, FlippersAI should classify:

- accept;
- counter;
- hold;
- walk away.

Then generate the exact reply message.

Never recommend a price above hard maximum unless the underlying valuation/economics are explicitly recalculated first.

## Arrange transaction step

Cover only factors relevant to the listing and transaction type.

Potential items:

- pickup vs shipping;
- payment method;
- buyer protection;
- public meetup location;
- timing;
- shipping/tracking confirmation;
- what seller must bring/include;
- item-specific proof/evidence to keep.

The page should end with one clear next action.

## Inspect step

Generate an item-specific inspection checklist from the exact product and known risks.

Checklist groups may include:

- identity/model confirmation;
- authenticity markers;
- condition/flaws;
- function/test;
- completeness/accessories;
- size/measurements;
- seller/listing consistency.

Each line must be actionable. Avoid generic checklist filler.

Inspection outcomes:

- Pass — proceed to buy;
- Renegotiate — condition differs but item still works at a revised price;
- Walk away — material mismatch/risk.

## Record purchase step

The `I bought it` action must capture actual transaction facts:

- actual purchase price;
- acquisition shipping;
- payment/transaction fees if relevant;
- purchase date/time;
- seller;
- source marketplace;
- final condition;
- included items;
- newly discovered flaws;
- notes/evidence;
- total landed cost.

After save:

- lifecycle state becomes `bought`;
- item moves to Inventory;
- actual landed cost becomes the cost basis for future selling/profit calculations;
- original Analyse assumptions remain retained for comparison/learning.

## Data model intent

The existing `opportunities`, `analyses` and `flip_workflows` records should remain the canonical backbone where possible.

Procurement-specific state should reference the same canonical opportunity rather than create a duplicate listing/item record.

Suggested workflow steps:

4. `ask_seller`
5. `review_reply`
6. `negotiate`
7. `arrange_transaction`
8. `inspect`
9. `record_purchase`

Later stages can continue into preparation, listing, selling, fulfilment and closure.

## UX rules

- One primary next action per state.
- Do not show steps that are not required for the current item.
- Never make the user calculate negotiation boundaries manually.
- Never make the user determine what authenticity/condition evidence to request manually.
- Do not force seller contact if existing evidence is already sufficient.
- Preserve a visible audit trail of what changed between initial Analyse and final purchase.
- Allow experienced users to skip optional guidance without breaking the workflow.

## V1 acceptance criteria

A user with no reselling experience should be able to take a BUY, NEGOTIATE or VERIFY FIRST Analyse result and reach a correctly recorded purchase by following only the instructions and actions generated by FlippersAI.
