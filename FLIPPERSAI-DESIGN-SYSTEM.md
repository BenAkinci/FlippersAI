# FlippersAI Design System

This document is the engineering source of truth for the FlippersAI product design system while Figma is being established. Figma should mirror this specification rather than inventing a parallel system.

## Product principle

FlippersAI should make reselling feel simple, guided and trustworthy without looking childish or over-explained. The interface should prioritise the answer, the evidence supporting it and the next executable action.

If there is nothing useful to say, say nothing. If a decision requires explanation, show the explanation progressively rather than flooding the initial view.

## Information hierarchy

1. Primary task or question.
2. Current item/listing evidence.
3. Decision-critical outputs.
4. Confidence and provenance.
5. Executable next action.
6. Supporting detail in expandable or secondary areas.

## Core visual principles

- Clean, modern, neutral product UI.
- High contrast and strong scanability.
- Dense enough for experienced resellers, but guided enough for beginners.
- No duplicated controls.
- No decorative controls without real behaviour.
- No walls of explanatory text where structure can communicate the same thing.
- Stable layouts: loading, extraction and result insertion should not unexpectedly move the user's viewport.
- Responsive by design, not as an afterthought.

## Foundation tokens

### Colour roles

Use semantic roles rather than hard-coding one-off colours throughout the app.

- `surface`: primary card/panel background.
- `canvas`: app background.
- `text-primary`: primary readable text.
- `text-secondary`: supporting text.
- `border`: dividers and input boundaries.
- `accent`: interactive emphasis.
- `success`: positive state / BUY.
- `warning`: caution / NEGOTIATE / VERIFY FIRST where appropriate.
- `danger`: destructive / SKIP / high-risk state.
- `info`: neutral system information.

The existing brand palette should remain the starting point until an approved Figma palette replaces it.

### Typography

Use a simple sans-serif system with clear hierarchy.

- Display: major page-level result or screen title.
- Heading: primary section title.
- Section: card/area title.
- Body: default reading text.
- Label: concise field labels and metadata.
- Numeric emphasis: prices, ROI, profit, max buy and score.

Do not overuse bold. Bold is reserved for decisions, labels, critical numbers and strong hierarchy.

### Spacing

Use a consistent 4/8 based spacing system. Prefer 8, 12, 16, 24, 32 and 48px intervals.

### Radii

Use one small radius for inputs/chips and one medium radius for cards/panels. Avoid different radii on every component.

### Shadows

Use borders as the default separation mechanism. Shadows are subtle and reserved for elevated/temporary layers.

## Core components

The canonical component library must include:

- Primary button.
- Secondary button.
- Tertiary/text button.
- Destructive action.
- Icon button.
- Text input.
- Smart price input.
- Smart size input.
- Textarea.
- Select/autocomplete.
- Upload/drop zone.
- Image evidence tile.
- Seller/profile card.
- Evidence row.
- Metric card.
- Verdict card.
- Confidence indicator.
- Provenance/source indicator.
- Warning/error state.
- Empty state.
- Inline loading state.
- Long-running progress state.
- Modal/drawer where genuinely necessary.
- Navigation shell.
- Step/progress component for the flip lifecycle.

Every visible component must have a real state/behaviour. Decorative pseudo-controls are not permitted.

## Analyse canonical screen

### Input area

The user should be able to:

- drag/drop listing screenshots;
- paste listing screenshots;
- manually edit extracted fields;
- optionally add a listing URL as reference;
- submit without needing to type information already visible in evidence.

### Listing facts

Explicit seller/listing text outranks visual inference for seller-stated facts.

#### Model

The Model field is a strict identity field.

Populate it only when the exact product model is supported by seller/listing text, visible SKU/style/product code, label/box evidence, or an authoritative product match.

Never populate Model with:

- visual descriptions;
- logo placement;
- silhouette descriptions;
- generic product type;
- colour description;
- `Tuned-style`, `style shoe`, `laurel logo on side`, or similar guesses.

If exact model identity cannot be established, Model remains blank/unknown.

#### Colour / colourway

When an exact product match has a verified official named colourway, display:

`Official colourway name — official manufacturer colour string`

Example structure only: `Infrared — Red/Black/White/Grey`.

Do not invent official colourway names from visible colours.

If no official colourway is verified, preserve explicit seller colour wording when available. Otherwise leave the field unknown rather than visually guessing.

#### Size

Multiple sizing systems are alternate representations, not automatically conflicts. Prefer US as canonical when available while showing verified alternates, e.g. `US 11 / UK 10`.

#### Condition

Preserve seller wording when explicitly stated. Do not silently normalise `barely worn` into `like new`.

### Result hierarchy

The initial result should answer:

**Is this worth buying to resell?**

Then show, in order:

1. Verdict: BUY / NEGOTIATE / VERIFY FIRST / SKIP.
2. Expected resale and range.
3. Expected profit.
4. ROI.
5. Max buy / recommended offer.
6. Confidence and evidence quality.
7. Immediate executable next action.
8. Expandable evidence, comps, calculations, condition/authenticity reasoning and assumptions.

If authenticity is uncertain but market evidence exists, show conditional economics (`if genuine`) while blocking BUY. Only high-risk / likely counterfeit outcomes should fully suppress economics.

## Long-running analysis state

The user should never stare at a static screen wondering whether Analyse is working.

The progress surface should show real backend/frontend states such as:

- Reading evidence.
- Extracting listing facts.
- Identifying exact item.
- Researching sold comps.
- Checking active market.
- Estimating fees/shipping/prep.
- Calculating economics.
- Producing decision.

Only show a step as complete when the system actually completes it. Where duration is uncertain, do not show fake percentages.

## Buying / procurement design principles

The next major workflow after Analyse is:

`Analyse → Verify if needed → Negotiate if needed → Arrange transaction → Inspect → Buy → Record`

The user should always know exactly what to do next. Seller communication, negotiation, inspection and purchase recording should be generated from the item-specific analysis rather than generic templates.

## Responsive behaviour

Desktop may show evidence/input and analysis context side-by-side where useful. Mobile should preserve the same hierarchy in a single column with sticky or clearly reachable primary actions.

No feature should disappear on mobile unless it is truly nonessential. Do not hide important evidence or economics merely to simplify layout.

## Figma relationship

Figma should contain four initial pages:

1. `01 Foundations`
2. `02 Components`
3. `03 Product Screens`
4. `04 Flows`

Once Figma write access is available, these rules should be represented there as variables, reusable components and canonical screens. Engineering changes should then be checked against the approved Figma design rather than creating new one-off UI patterns.
