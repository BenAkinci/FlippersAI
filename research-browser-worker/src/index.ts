import puppeteer from '@cloudflare/puppeteer'

interface Env {
  BROWSER: Fetcher
}

type SessionStartBody = {
  url?: string
}

const ALLOWED_ORIGINS = new Set([
  'https://whattheflip-adz.pages.dev',
  'http://localhost:8788',
  'http://localhost:5173'
])

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://whattheflip-adz.pages.dev'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  }
}

function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(request)
    }
  })
}

function safeTargetUrl(raw: string) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http/https URLs are allowed')
  const host = url.hostname.toLowerCase()
  const blocked = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
  if (blocked) throw new Error('Local/private URLs are not allowed')
  return url.toString()
}

async function sessionIdForActiveConnection(env: Env) {
  const sessions = await puppeteer.sessions(env.BROWSER)
  const active = sessions
    .filter((session) => Boolean(session.connectionId))
    .sort((a, b) => (b.connectionStartTime || b.startTime || 0) - (a.connectionStartTime || a.startTime || 0))
  return active[0]?.sessionId || null
}

async function startSession(request: Request, env: Env) {
  let body: SessionStartBody
  try {
    body = await request.json<SessionStartBody>()
  } catch {
    return json(request, { error: 'Invalid JSON body' }, 400)
  }

  if (!body.url) return json(request, { error: 'url is required' }, 400)

  let targetUrl: string
  try {
    targetUrl = safeTargetUrl(body.url)
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Invalid URL' }, 400)
  }

  const startedAt = Date.now()
  const browser = await puppeteer.launch(env.BROWSER, { keep_alive: 600000 })
  const page = await browser.newPage()

  await page.setViewport({ width: 1440, height: 1000 })
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36')

  let navigationError: string | null = null
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error)
  }

  const cdp = await page.createCDPSession()
  const { devtoolsFrontendUrl } = await cdp.send('Cloudflare.getLiveView', {
    mode: 'tab',
    expiresInMs: 600000
  })

  const currentUrl = page.url()
  const title = await page.title().catch(() => '')
  const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 12000)).catch(() => '')
  const sessionId = await sessionIdForActiveConnection(env)

  // Leave the browser alive for the human/research session. Disconnect this Worker
  // connection so another request can reconnect to the same Browser Run session.
  browser.disconnect()

  return json(request, {
    ok: true,
    session_id: sessionId,
    live_view_url: devtoolsFrontendUrl,
    requested_url: targetUrl,
    current_url: currentUrl,
    title,
    text_excerpt: text,
    navigation_error: navigationError,
    elapsed_ms: Date.now() - startedAt,
    keep_alive_ms: 600000
  })
}

async function sessionStatus(request: Request, env: Env) {
  const sessions = await puppeteer.sessions(env.BROWSER)
  return json(request, {
    ok: true,
    sessions: sessions.map((session) => ({
      session_id: session.sessionId,
      connected: Boolean(session.connectionId),
      start_time: session.startTime,
      connection_start_time: session.connectionStartTime || null
    }))
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, {
        ok: true,
        service: 'flippersai-research-browser',
        browser_run: true,
        version: 'rb1'
      })
    }

    if (request.method === 'GET' && url.pathname === '/sessions') {
      return sessionStatus(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/session/start') {
      try {
        return await startSession(request, env)
      } catch (error) {
        return json(request, {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }, 500)
      }
    }

    return json(request, { error: 'Not found' }, 404)
  }
} satisfies ExportedHandler<Env>
