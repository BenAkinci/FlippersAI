import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`./${name}`,import.meta.url),'utf8')
const must=(ok,message)=>{if(!ok)throw new Error(`Scout v0.75 contract failed: ${message}`)}

const side=read('sidepanel.html')
const workspace=read('workspace.html')
const orchestrator=read('scout-orchestrator-v075.js')
const css=read('scout-v075.css')
const manifest=JSON.parse(read('manifest.json'))

must(manifest.version==='0.75.0','manifest version')
must(side.includes('scout-orchestrator-v075.js')&&workspace.includes('scout-orchestrator-v075.js'),'v0.75 orchestrator loaded')
must(!side.includes('scout-orchestrator-v074.js')&&!workspace.includes('scout-orchestrator-v074.js'),'old orchestrator removed from active pages')
must(orchestrator.includes('const MAX_BATCH=5'),'exact five-listing batch size')
must(!orchestrator.includes('PARALLEL_BATCHES'),'no parallel multi-batch waves')
must(orchestrator.includes("waiting.slice(0,MAX_BATCH)"),'one batch at a time')
must(orchestrator.includes("['FOUND',rr.length],['RATED',ratedRows.length],['WORKING',working],['SHORTLIST',short.length],['FILTERED OUT',filtered.length]"),'live summary counters')
must(orchestrator.includes('v075-shortlist-visible'),'progressive shortlist class')
must(orchestrator.includes('Results appear after every 5'),'progressive user feedback')
must(css.includes('.scout-candidate.v075-shortlist-visible{display:grid!important'),'quick shortlist visible immediately')
must(orchestrator.includes("id=\"v075Pause\"")&&orchestrator.includes("id=\"v075Restart\"")&&orchestrator.includes("id=\"v075New\""),'working scan controls preserved')
console.log('Scout v0.75 contract OK')
