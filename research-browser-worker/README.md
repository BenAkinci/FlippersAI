# FlippersAI Research Browser Worker (RB-1)

This is the infrastructure spike for Stage 2B. It uses Cloudflare Browser Run to create a real Chromium session that FlippersAI can inspect while a user interacts with the same page through Cloudflare Live View.

## RB-1 acceptance test

1. Deploy this Worker with the `BROWSER` Browser Run binding.
2. `POST /session/start` with a marketplace listing URL.
3. Confirm the response contains `session_id`, `live_view_url`, `current_url`, `title`, and a rendered `text_excerpt`.
4. Open `live_view_url` and interact with the listing (scroll/click/navigate to seller profile).
5. Confirm the Browser Run session stays alive and appears in `GET /sessions`.
6. Reconnect/inspect the same session in RB-2 and feed observed page state into Analyse.

## Local/remote test

```bash
npm install
npm run dev
```

The Browser Run binding must use a real Cloudflare browser. The worker configuration uses the production Browser binding on deploy; for local development use Wrangler remote mode.

Example:

```bash
curl -X POST http://localhost:8787/session/start \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.depop.com/products/ja4ego4-nike-p-6000-mens-size-us-c5dd/"}'
```

## Safety / product rules

- Only `http` and `https` public URLs are accepted.
- The browser is a research/acquisition surface, not an automated purchasing bot.
- User login, MFA, CAPTCHA and sensitive account actions stay human-controlled through Live View/Human-in-the-Loop.
- The initial session is kept alive for up to 10 minutes of inactivity; later RB work will add explicit reconnect/heartbeat/close endpoints.
- Browser Run traffic is still identifiable as automated traffic. If a marketplace blocks the remote browser entirely, screenshot paste remains the last-resort acquisition path.
