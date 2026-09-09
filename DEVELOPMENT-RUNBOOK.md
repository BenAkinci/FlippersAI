# FlippersAI Development Runbook

This repo is set up so development can continue even when one AI product quota is exhausted. The goal is continuity without migrating the product or paying for unnecessary services.

## Current stack

- ChatGPT: product/architecture/review and agentic work when available.
- Cursor (or VS Code): local repo workspace and direct file/terminal access.
- OpenAI API: pay-as-you-go overflow for supported local/API-backed workflows. Keep the key local only.
- GitHub: source of truth, history and CI.
- Supabase: database, auth and Edge Functions.
- Cloudflare Pages: frontend hosting/deployment.
- Cloudflare MCP: repo-level Cursor config is in `.cursor/mcp.json`.

## First local setup on a Mac

```bash
# 1. Install Node 22+, Git and Cursor if they are not already installed.
# 2. Clone/open the repo.
git clone https://github.com/BenAkinci/FlippersAI.git
cd FlippersAI

# 3. Create local environment file.
cp .env.example .env

# 4. Add your own local credentials to .env as needed.
#    Never commit .env.

# 5. Verify the machine/repo setup.
npm run doctor

# 6. Build and run a local preview.
npm run dev
```

Local preview defaults to `http://127.0.0.1:4173`.

## Secrets

Never paste or commit:

- `OPENAI_API_KEY`
- Supabase service-role keys
- Cloudflare API tokens
- any `.env` / `.dev.vars` file

The browser app may use publishable client credentials. Privileged credentials must stay in local environment variables, Supabase secrets or Cloudflare secret stores.

## Normal development loop

```bash
git pull --ff-only
npm run doctor
npm run dev
# make changes
npm run validate
git status
git diff
git add <files>
git commit -m "Describe the change"
git push
```

After pushing, wait for GitHub Actions to finish. Do not treat queued/in-progress as success.

## When ChatGPT Work/Codex quota is exhausted

Do not stop the project. Switch execution to the local repo:

1. Open FlippersAI in Cursor.
2. Give Cursor one narrowly scoped task at a time.
3. Ask it to inspect the relevant source before editing.
4. Use the repo rules in `.cursor/rules/flippersai.mdc`.
5. Use terminal commands locally for tests/builds.
6. If the chosen local AI workflow supports your own provider key, use `OPENAI_API_KEY` from the local environment rather than pasting it into chat.
7. Run `npm run validate` before every push.
8. Push to GitHub and let the existing CI/deployment flow continue.

This converts a hard subscription stop into a local/pay-as-you-go workflow.

## Cloudflare

The repo already includes Cloudflare MCP endpoints in `.cursor/mcp.json`. In Cursor, authorize the MCP connection when prompted. Keep the existing Pages deployment; do not add a Wrangler deployment config unless a future feature actually needs Workers/Pages Functions/local bindings.

Useful local Cloudflare workflow when Wrangler is needed later:

```bash
npx wrangler login
npx wrangler whoami
```

Prefer OAuth login over storing a long-lived API token locally.

## Supabase

The production project ref is documented in `.env.example`. For DB/function changes:

- inspect existing `supabase/migrations/` and `supabase/functions/` first;
- never invent schema without checking current migrations;
- keep production secrets in Supabase secret storage, not Git;
- use local CLI tooling only when the task actually needs it.

## Local commands

- `npm run doctor` — checks Node/Git, secret protection and Cursor/Cloudflare project config.
- `npm run build` — validates and bundles the frontend into `public/`.
- `npm run dev` — builds then serves `public/` locally without extra dependencies.
- `npm run check:extension` — validates extension code/contracts.
- `npm run package:extension` — validates and packages the extension.
- `npm run validate` — full local pre-push validation.

## Cost strategy

Use the least expensive execution path that keeps quality high:

1. included ChatGPT/Cursor allowance;
2. local tooling and existing provider/API usage;
3. pay-as-you-go API overflow;
4. add another paid AI provider only if actual usage proves a second provider is necessary.

Do not buy Business, Premium seats or another model subscription solely to avoid a quota until the local/API fallback has been tried.

## Troubleshooting

### `npm run doctor` says no `.env`

Run `cp .env.example .env`, then add only the credentials you actually need.

### Cursor cannot see Cloudflare MCP

- confirm `.cursor/mcp.json` exists;
- restart Cursor;
- approve the Cloudflare OAuth flow;
- verify the Cloudflare plugin/MCP is enabled in Cursor.

### Local preview is stale

Stop the server and run `npm run dev` again. The dev server uses `Cache-Control: no-store`.

### CI fails after local validation passes

Open the failed GitHub Actions job and inspect the exact failing step/log. Fix that failure rather than rerunning blindly.
