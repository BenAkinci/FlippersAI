import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const api=read('api.js')
expect(manifest.version==='0.89.11','manifest must package v0.89.11')
for(const token of ['SCOUT_CACHE_TTL_MS = 1500','const scoutSelectCache = new Map()','const scoutSelectInflight = new Map()','if (pending) return pending','scoutSelectCache.set(key, { at: Date.now(), data })']) expect(api.includes(token),`Scout request dedupe/cache missing: ${token}`)
expect(api.includes("if (table === 'scout_candidates') invalidateScoutCache()"),'Scout candidate writes must invalidate cached reads')
expect((api.match(/if \(table === 'scout_candidates'\) invalidateScoutCache\(\)/g)||[]).length>=3,'insert/update/remove must invalidate Scout cache')
console.log('v0.89.11 Supabase egress hotfix contract passed')
