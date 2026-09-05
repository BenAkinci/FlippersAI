import fs from 'node:fs'

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const js=read('analyse-structured-form-v104.js')
const index=read('index.html')
const expect=(value,message)=>{if(!value)throw new Error(message)}

// Cache-busting versions change as Analyse evolves. Validate that the required
// assets are loaded, not that they retain one obsolete query-string version.
expect(/analyse-structured-form-v104\.js\?v=[^"']+/.test(index),'structured Analyse form script must load on website')
expect(/analyse-discount-sync-v1041\.js\?v=[^"']+/.test(index),'discount sync must load on website')
expect(index.includes('analyse-manual-drop-v102.js'),'drag/drop handler must load on website')
expect(index.includes('analyse-manual-paste-v103.js'),'paste-photo handler must load on website')
expect(js.includes('Select marketplace'),'marketplace must start blank instead of defaulting to Facebook')
expect(js.includes('Original price'),'Analyse must support pre-discount/original price')
expect(js.includes('discounted'),'Analyse must support sale/discount state')
expect(js.includes('name="model"'),'model must have its own field')
expect(js.includes('name="colour"'),'colour must have its own field')
expect(js.includes('name="size"'),'size must have its own field')
expect(js.includes('name="size_system"'),'size system backing field must exist for structured analysis')
expect(js.includes('USD')&&js.includes('GBP')&&js.includes('AUD'),'structured currency backing must support AUD/USD/GBP')
expect(js.includes('Seller description')&&js.includes('Extra information'),'description and extra information must be separate')
expect(js.includes("supabase.functions.invoke('listing-visual-extraction'"),'screenshots must automatically prefill visible listing fields')
expect(js.includes("supabase.functions.invoke('analyse-listing-v2'"),'Analyse must call the analysis engine directly')
expect(!js.includes("from('opportunities').insert"),'direct Analyse must not create an Opportunity before a decision')

console.log('structured Analyse website contract passed')
