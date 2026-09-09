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
- **`scripts/`** — build-time patch, contract and local-development scripts.
- **`docs/`** and the top-level `*.md` files — product and architecture
  specs and the development runbook.

## Local development

Requires Node.js 22+ and Git.

```bash
cp .env.example .env       # local-only credentials; never commit .env
npm run doctor             # verify Node/Git/secret protection/tooling
npm run dev                # build then serve locally at http://127.0.0.1:4173
npm run validate           # full pre-push web + extension validation
```

Additional commands:

```bash
npm run build             # syntax-check + bundle the web app into public/
npm run check:extension   # syntax-check and run contract tests for the extension
npm run package:extension # check and zip extension/ into flippersai-extension.zip
```

## AI / continuity workflow

The repo is configured for Cursor via `.cursor/` and includes Cloudflare MCP
endpoints plus project coding rules. Keep OpenAI, Supabase service-role and
Cloudflare credentials only in local/provider secret stores, never in tracked
source files.

If ChatGPT Work/Codex quota is exhausted, continue in the local repo through
Cursor/terminal, use API-backed tooling where supported, run `npm run validate`,
push to GitHub, and let CI/deployment continue. See `DEVELOPMENT-RUNBOOK.md` for
the complete setup and fallback workflow.

## CI

Pushes and pull requests to `main` run the `Validate frontend` GitHub Actions
workflow (`.github/workflows/validate.yml`), which runs the existing web and
extension checks and packages the extension as a build artifact.
