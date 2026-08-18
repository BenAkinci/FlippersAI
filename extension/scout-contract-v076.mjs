import fs from 'node:fs'

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const orchestrator = read('./scout-orchestrator-v076.js')
const side = read('./sidepanel.html')
const workspace = read('./workspace.html')
const manifest = JSON.parse(read('./manifest.json'))

function expect(value, message) {
  if (!value) throw new Error(message)
}

const [major, minor] = String(manifest.version || '0.0.0').split('.').map(Number)
expect(major > 0 || minor >= 76, 'manifest must be v0.76.0 or newer')
expect(orchestrator.includes('const MAX_BATCH=5'), 'Scout must use exactly five listings per quick batch')
expect(!orchestrator.includes('PARALLEL_BATCHES'), 'Scout must not run multiple quick batches in parallel')
expect(orchestrator.includes("id=\"v076Stop\""), 'Stop control missing')
expect(orchestrator.includes("id=\"v076Pause\""), 'Pause/Resume control missing')
expect(orchestrator.includes("id=\"v076Restart\""), 'Restart current scan control missing')
expect(orchestrator.includes("id=\"v076New\""), 'Start new scan control missing')
expect(orchestrator.includes('O.stopped=true'), 'Stop must be a terminal stopped state, not just pause')
expect(orchestrator.includes('O.paused=true'), 'Pause state missing')
expect(orchestrator.includes('stored?.sessionId'), 'Scout rows must load from the persisted session rather than only visible DOM cards')
expect(orchestrator.includes('sourceAlive'), 'Restart must be based on the original marketplace tab remaining open')
expect(orchestrator.includes('newCollection'), 'New-scan availability must detect a new marketplace collection')
expect(orchestrator.includes('O.enrichWorkers<1'), 'Background enrichment must stay lightweight')
expect(side.includes('scout-orchestrator-v076.js') && workspace.includes('scout-orchestrator-v076.js'), 'v0.76 orchestrator must load in both extension surfaces')
expect(!side.includes('scout-orchestrator-v075.js') && !workspace.includes('scout-orchestrator-v075.js'), 'old v0.75 orchestrator must not remain active')
expect(side.includes('scout-v076.css') && workspace.includes('scout-v076.css'), 'v0.76 styles must load')

console.log('v0.76 Scout contract passed')
