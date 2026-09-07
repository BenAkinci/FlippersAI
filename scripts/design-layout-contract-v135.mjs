import fs from 'node:fs'

const index=fs.readFileSync('index.html','utf8')
const css=fs.readFileSync('design-layout-guard-v135.css','utf8')
const form=fs.readFileSync('analyse-structured-form-v104.js','utf8')

const must=(ok,msg)=>{if(!ok)throw new Error(`Design layout contract failed: ${msg}`)}

must(index.includes('design-layout-guard-v135.css?v=0.135.0'),'layout guard stylesheet is not loaded')
must(css.includes('min-width:0'),'grid/flex children need min-width overflow protection')
must(css.includes('overflow-wrap:anywhere'),'long text needs wrapping protection')
must(css.includes('.manual-upload'),'Analyse upload zone needs responsive guardrails')
must(css.includes('.direct-analysis-result-head'),'Analyse result header needs alignment guardrails')
must(css.includes('@media(max-width:640px)'),'mobile layout guardrail is missing')
must(form.includes('field-grid-4'),'expected Analyse form grid missing')
must(form.includes('manual-upload'),'expected Analyse upload component missing')

console.log('Design layout contract v135 passed')
