import fs from 'node:fs'

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const js=read('analyse-direct-web-v078.js')
const index=read('index.html')
const pkg=JSON.parse(read('package.json'))
const expect=(value,message)=>{if(!value)throw new Error(message)}

expect(pkg.version==='0.78.0','package must be v0.78.0')
expect(index.includes('analyse-direct-web-v078.js?v=0.78.0'),'direct Analyse script must load on website')
expect(index.includes('analyse-direct-web-v078.css?v=0.78.0'),'direct Analyse styles must load on website')
expect(js.includes("form.id!=='newDeal'"),'direct Analyse must intercept the Analyse form')
expect(js.includes('event.stopImmediatePropagation()'),'old create-deal submit handler must be blocked')
expect(js.includes("supabase.functions.invoke('analyse-listing-v2'"),'Analyse must call the listing analysis engine directly')
expect(js.includes('Analyse listing'),'primary CTA must say Analyse listing')
expect(js.includes("sessionStorage.setItem(SESSION_KEY"),'analysis result must persist when moving around the website tab')
expect(!js.includes("from('opportunities').insert"),'direct Analyse must not create an Opportunity/Deal')
expect(!js.includes("state.view = 'home'"),'direct Analyse must not redirect to Home/Scout workflow')
expect(js.includes('mountResult(payload)'),'analysis must render in the Analyse tab')

console.log('v0.78 direct Analyse website contract passed')
