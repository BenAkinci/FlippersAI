import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after !== before) {
    fs.writeFileSync(path, after)
    console.log(`${path}: v0.89.11 egress hotfix applied`)
  } else {
    console.log(`${path}: v0.89.11 egress hotfix already applied`)
  }
}

update('extension/api.js', s => {
  for (const token of ['SCOUT_CACHE_TTL_MS','scoutSelectCache','scoutSelectInflight','invalidateScoutCache','if (pending) return pending']) {
    if (!s.includes(token)) throw new Error(`v0.89.11 missing Scout request guard: ${token}`)
  }
  return s
})

update('extension/manifest.json', s => {
  const m = JSON.parse(s)
  m.version = '0.89.11'
  m.description = 'FlippersAI Scout Supabase egress and duplicate-request hotfix.'
  return JSON.stringify(m, null, 2) + '\n'
})

update('package.json', s => {
  const p = JSON.parse(s)
  p.version = '0.89.11'
  return JSON.stringify(p, null, 2) + '\n'
})
