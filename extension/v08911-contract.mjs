import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`./${p}`,import.meta.url),'utf8')
const expect=(v,m)=>{if(!v)throw new Error(m)}
const manifest=JSON.parse(read('manifest.json'))
const api=read('api.js')
const parts=String(manifest.version||'').split('.').map(Number)
expect(parts[0]===0&&parts[1]===89&&parts[2]>=11,'manifest must package v0.89.11-compatible or newer')
const ttl=Number(api.match(/SCOUT_CACHE_TTL_MS\s*=\s*(\d+)/)?.[1]||0)
expect(ttl>=1500,'Scout request cache TTL must preserve or improve the v0.89.11 guard')
for(const token of ['const scoutSelectCache = new Map()','const scoutSelectInflight = new Map()','if (pending) return pending','scoutSelectCache.set(key, { at: Date.now(), data })']) expect(api.includes(token),`Scout request dedupe/cache missing: ${token}`)
expect(api.includes("if (table === 'scout_candidates') invalidateScoutCache()"),'Scout candidate writes must invalidate cached reads')
expect((api.match(/if \(table === 'scout_candidates'\) invalidateScoutCache\(\)/g)||[]).length>=3,'insert/update/remove must invalidate Scout cache')
console.log('v0.89.11 Supabase egress hotfix contract passed')
