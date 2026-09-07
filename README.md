# FlippersAI

FlippersAI is an AI reselling workspace that helps resellers decide whether a
listing is worth buying. It's made up of a web app and a companion Chrome
extension that analyse marketplace listings — pricing, condition,
authenticity and resale economics — and turn that analysis into a clear
BUY / NEGOTIATE / VERIFY FIRST / SKIP recommendation.

## Structure

- **Web app** — the root of the repo (`index.html`, `app.js`,
  `platform.js`, `community.js`, `styles.css`, etc.) is the FlippersAI
  website: Scout, Analyse, Shortlist and the buying/procurement workflow.
- **`extension/`** — the Chrome extension (Manifest V3) that brings the
  same Scout and Analyse tooling into supported marketplaces
  (Facebook Marketplace, eBay, Gumtree, Depop).
- **`supabase/`** — database migrations and edge functions backing both
  surfaces (`supabase/migrations`, `supabase/functions`).
- **`scripts/`** — build-time patch and contract scripts run by the npm
  scripts below.
- **`docs/`** and the top-level `*.md` files — product and architecture
  specs (design system, buying/procurement lifecycle, research browser,
  etc.) that document intent behind the current implementation.

## Development

Requires Node.js (CI runs on Node 22).

```bash
npm run build             # syntax-check + bundle the web app into public/
npm run check:extension   # syntax-check and run contract tests for the extension
npm run package:extension # check:extension, then zip extension/ into flippersai-extension.zip
```

Pushes and pull requests to `main` run the `Validate frontend` GitHub Actions
workflow (`.github/workflows/validate.yml`), which runs `npm run build`,
`npm run check:extension` and `npm run package:extension`, and uploads the
packaged extension as a build artifact.
