import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(process.argv[2] || 'public')
const port = Number(process.env.PORT || 4173)

if (!fs.existsSync(root)) {
  console.error(`Build output not found: ${root}. Run npm run build first.`)
  process.exit(1)
}

const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.ico':'image/x-icon', '.webmanifest':'application/manifest+json'
}

const server = http.createServer((req,res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0])
  const rel = raw === '/' ? '/index.html' : raw
  const candidate = path.resolve(root, `.${rel}`)
  if (!candidate.startsWith(root)) {
    res.writeHead(403); return res.end('Forbidden')
  }

  let file = candidate
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root,'index.html')

  try {
    const data = fs.readFileSync(file)
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(data)
  } catch {
    res.writeHead(404); res.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`FlippersAI local preview: http://127.0.0.1:${port}`)
  console.log('Press Ctrl+C to stop.')
})
