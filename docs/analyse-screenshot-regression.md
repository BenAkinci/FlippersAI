> **Status (v0.142.0, 2026-09-20):** the function files described here are now committed under `supabase/functions/listing-visual-extraction/` and are byte-identical to production (deployed v12 = this v11 merge + classified error messages, provider detail no longer returned to the browser). The browser-side pipeline this doc describes (`analyse-image-pipeline.mjs`, 3200px/1800 KiB budgets) was **not** adopted: v0.139 preprocessing and v0.140 chunk fallback replaced it and are live. Its stale-scan revision guard was ported in v0.142.0. The mocked regression scripts it mentions depend on that unadopted pipeline and are not in the repo.

# Analyse screenshot fix: verified production baseline and local merge

## Verified deployment (read-only Supabase connector)

- Project: WhatTheFlip (`msmpigerejpxepkylkxz`), active/healthy.
- Function: `listing-visual-extraction`.
- Function ID: `6440ac8c-1238-43e4-9f73-5e31915d8361`.
- Current deployed version at inspection: **10**, `verify_jwt: true`.
- Bundle SHA-256: `3e2a0ff359716246b284284ed25d947680a6b63cc4873dcaa9e477f5b5a73fa6`.
- Downloaded files: `index.ts`, `image-validation.js`, `identity-policy-v134.js`.
- Exact source and metadata are retained in
  `scripts/fixtures/listing-visual-extraction-production-v10.json` for differential tests.
- The CLI is unavailable on PATH; no CLI login or linked-project metadata was
  found. The Supabase connector successfully authenticated and retrieved the
  deployed source. Connector access does not establish CLI authentication.

The repository's HEAD function was stale. Earlier descriptions of six-image
truncation and missing server resilience describe HEAD, **not production**.
The first local screenshot patch would have removed production-critical features
and must not be deployed. The local function now uses deployed v10 as its base.

## Production safety comparison

| Behaviour | Deployed v10 | Earlier local patch | Corrected local merge |
|---|---|---|---|
| Image types | JPEG/JPG, PNG, WebP | Same MIME prefixes | Same accepted types |
| Image validation | Strict padded base64 plus matching magic bytes | Base64 only; no magic bytes | Production grammar and magic bytes retained; linear regex structure |
| Count | 1–10, rejects invalid input | 1–10 | Unchanged |
| Size allowance | 8 MiB per data URL; 24 MiB combined | Entire request restricted to 4 MiB | Production image limits retained; new 26 MiB streamed request bound allows JSON overhead |
| Batching | Pairs, concurrent `Promise.allSettled` | One model call | Production batching retained |
| Model behaviour | gpt-5-mini, minimal reasoning, auto detail, 22s request deadline | No minimal reasoning, high detail, 50s | Production settings retained |
| Fallback | Individual low-detail requests, concurrent `allSettled` | Browser only | Production fallback retained for transient failures |
| Permanent errors | A permanent initial failure discards successful sibling batches | Whole-request failure | Successful sibling batches preserved; permanent failures not automatically retried |
| Merge | Confidence-ranked price, longest text, array union, evidence conflicts clear identity | No server merge | Production merge and identity policy retained; source order stable across fallback |
| Partial results | Successful scans returned; partial indicates initial batch failure | None server-side | Same response fields; additive successful/failed image indices identify unresolved images |
| HTTP | 200 + ok:false/retryable for scan failures; 400 invalid images; 503 missing key; OPTIONS/405 | Provider errors mapped to non-2xx statuses | Production HTTP contract retained; invalid JSON/oversized streams are controlled 400 validation errors |
| Fidelity | Strict evidence schema, verbatim model/colour support, official-label rules, secondary-item evidence | Simplified prompt/schema | Production schema, prompt and identity policy retained verbatim |
| Auth | Gateway verify_jwt true | Not recorded locally | Explicit true in supabase/config.toml; no auth bypass |

Intentional improvements relative to v10: successful data survives a permanent
sibling failure; fallback results merge in original screenshot order rather than
after later successful batches; quota/billing failures are not repeatedly retried;
partial metadata identifies unresolved images; and invalid JSON / extreme request
bodies fail predictably. `partial` retains its v10 meaning (an initial batch
failed), even when every image eventually succeeds. `failed_image_indices: []`
lets the new browser recognise full recovery.

The new whole-body limit rejects requests whose JSON/other metadata exceeds
26 MiB even if the images alone would fit. Normal callers supply only images
and short platform/URL hints. No accepted production image allowance is reduced.

## Browser compatibility and screenshot preparation

- Selection, paste and drop enter the structured form's shared evidence queue.
- Keep originals attached; decode before uploading. Small supported originals
  retain their resolution. Larger images start with a 3200-pixel edge and JPEG
  qualities 0.92/0.85/0.78 before reducing dimensions down to 2000 pixels.
- Each prepared image is at most 1800 KiB before base64 expansion. Browser
  requests are capped at 4 MiB and three images. These client budgets are not
  imposed on other production callers.
- A failed request is isolated into individual requests. Successful and partial
  extractions fill immediately; unresolved files remain available for retry.
- Production v10 partial responses without indices preserve available fields
  but conservatively leave that request's images retryable. New responses permit
  retry of only the identified failures.
- Browser merge now retains production price precedence, longer descriptions,
  identity evidence and conflict handling across separate HTTP requests.
- The fidelity wrapper understands production evidence objects, preserving exact
  titles, supported models and official colour displays. Dual-size handling
  remains. Legacy DOM heuristics cannot overwrite production identity decisions.
- Revision checks prevent old scans filling a reset/new form. User edits remain
  protected, and technical failures display a retry state rather than a verdict.

## Tests and deployment readiness

`node scripts/analyse-image-regression.mjs` includes
`analyse-production-regression.mjs`: differential schema/prompt/identity checks,
MIME/signature/base64/count/size tests, concurrent batching, fallback, mixed
permanent/success results, transient HTTP contracts, quota handling, deterministic
merge, partial retry, frontend evidence compatibility and JWT configuration.
Tests execute the handler with a mocked model and do not spend model credits.
They require Node 22.13+ for TypeScript stripping.

No deployment or commit has been performed. CLI/Deno bundling and live OCR are
not verified by the Node mocks. The existing `npm run validate` mutates unrelated
extension files, so use direct tests and syntax/contracts during this review.

After explicit deployment approval and authenticated CLI setup, the proposed
command from the repository root is:

```sh
supabase functions deploy listing-visual-extraction --project-ref msmpigerejpxepkylkxz
```

The config keeps verify_jwt=true. Never add --no-verify-jwt. Before deploying,
recheck the current deployed version to avoid overwriting a newer production
change. Package all three function files, not index.ts alone.
