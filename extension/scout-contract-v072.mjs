import fs from 'node:fs'

const read = name => fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
const must = (ok, message) => { if (!ok) throw new Error(`Scout v0.72 contract failed: ${message}`) }

const side = read('sidepanel.html')
const workspace = read('workspace.html')
const reliability = read('scout-reliability-v072.js')
const css = read('scout-reliability-v072.css')
const engine = read('scout-engine-v071.js')
const manifest = JSON.parse(read('manifest.json'))

must(manifest.version === '0.72.0', 'manifest version')
must(side.includes('scout-reliability-v072.css') && side.includes('scout-reliability-v072.js'), 'side panel reliability layer')
must(workspace.includes('scout-reliability-v072.css') && workspace.includes('scout-reliability-v072.js'), 'workspace reliability layer')
must(reliability.includes("'v071Pause'") && reliability.includes("'v071Restart'") && reliability.includes("'scoutRescan'"), 'stop/restart/new-scan controls')
must(reliability.includes('card.hidden = !good'), 'hard-hide pending and filtered candidates')
must(css.includes('.scout-candidate:not(.v071-shortlist-visible){display:none!important}'), 'default hidden shortlist CSS')
must(engine.includes('finalWorthwhile'), 'verified shortlist gate')
must(engine.includes('data-v071-bulk="save"') && engine.includes('data-v071-bulk="analyse"') && engine.includes('data-v071-bulk="open"') && engine.includes('data-v071-bulk="remove"'), 'bulk shortlist actions')
must(engine.includes("metricButton('score'") && engine.includes("metricButton('profit'") && engine.includes("metricButton('resale'") && engine.includes("metricButton('roi'") && engine.includes("metricButton('success'"), 'explainable Scout metrics')
console.log('Scout v0.72 contract OK')
