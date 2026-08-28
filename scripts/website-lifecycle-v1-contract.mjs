import fs from 'node:fs'

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const expect = (v,m) => { if (!v) throw new Error(m) }

const lifecycle = read('website-lifecycle-v1.js')
const spec = read('WEBSITE-LIFECYCLE-V1.md')
const migration = read('supabase/migrations/20260828172000_website_lifecycle_v1_foundation.sql')

for (const token of [
  "shortlist: 'is_shortlisted'",
  "saved: 'is_saved'",
  "'negotiating'",
  "'bought'",
  "'ready_to_list'",
  "'listed'",
  "'sold'"
]) expect(lifecycle.includes(token), `lifecycle definition missing ${token}`)

expect(spec.includes('Shortlist and Saved are user-organisation attributes, not lifecycle states.'), 'spec must separate organisation from lifecycle')
expect(spec.includes('There is one canonical opportunity record for an engaged item.'), 'spec must preserve canonical item rule')
expect(migration.includes('promote_scout_candidate_to_opportunity'), 'migration must bridge Scout candidates to opportunities')
expect(migration.includes('opportunities_user_source_url_unique'), 'migration must protect canonical source URL identity')
expect(migration.includes('is_saved boolean not null default false'), 'migration must store Saved on opportunity')
expect(migration.includes('is_shortlisted boolean not null default false'), 'migration must store Shortlist on opportunity')

console.log('Website lifecycle v1 contract passed')
