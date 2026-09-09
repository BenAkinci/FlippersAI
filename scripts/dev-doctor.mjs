import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const ok = msg => console.log(`✓ ${msg}`)
const warn = msg => console.log(`! ${msg}`)
const fail = msg => { console.error(`✗ ${msg}`); process.exitCode = 1 }

const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor >= 22) ok(`Node ${process.versions.node}`)
else fail(`Node 22+ recommended; found ${process.versions.node}`)

try {
  execFileSync('git', ['--version'], { stdio:'ignore' })
  ok('Git available')
} catch { fail('Git is not available') }

if (fs.existsSync('.env')) {
  ok('.env exists and is ignored by git')
} else {
  warn('No .env yet. Copy .env.example to .env before API-backed local work.')
}

if (fs.existsSync('.cursor/mcp.json')) ok('Cloudflare MCP config present')
else warn('Cloudflare MCP config missing')

if (fs.existsSync('.cursor/rules/flippersai.mdc')) ok('Cursor project rules present')
else warn('Cursor project rules missing')

try {
  execFileSync('git', ['check-ignore', '-q', '.env'])
  ok('.env is protected by .gitignore')
} catch { fail('.env is not ignored by git') }

for (const name of ['OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','CLOUDFLARE_API_TOKEN']) {
  let tracked = ''
  try {
    tracked = execFileSync('git', ['grep','-l',`${name}=`,'HEAD'], {
      encoding:'utf8', stdio:['ignore','pipe','ignore']
    }).trim()
  } catch {
    tracked = ''
  }
  if (tracked) warn(`${name} assignment appears in tracked files: ${tracked}`)
}

console.log('\nDoctor complete.')
