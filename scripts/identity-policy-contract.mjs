import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
await import('../identity-policy-v134.js')
const {reconcile}=globalThis.FlippersIdentityPolicy
const evidence=(quote,source='listing_text')=>({quote,source,unambiguous:true})
assert.equal(reconcile({model:'laurel logo on side',model_evidence:evidence('laurel logo on side')}).model,'')
assert.equal(reconcile({model:'Air Max 90',extraction_confidence:1}).model,'')
assert.equal(reconcile({model:'Air Max 90',model_evidence:evidence('Nike Air Max 90 US 11')}).model,'Air Max 90')
assert.equal(reconcile({model:'Air Max 9',model_evidence:evidence('Nike Air Max 90')}).model,'')
assert.equal(reconcile({model:'Air Max 90',model_evidence:evidence('12345-001')}).model,'')
assert.equal(reconcile({colour:'Black',colour_evidence:evidence('Mint/grey')}).colour,'')
assert.equal(reconcile({colour:'Mint/grey',colour_evidence:evidence('Mint/grey colorway')}).colour,'Mint/grey')
const official={colour:'Red',official_colourway:'Infrared',official_colour_string:'Red/Black/White/Grey',colour_evidence:evidence('Infrared — Red/Black/White/Grey','official_label')}
assert.equal(reconcile(official).colour,"'Infrared' — Red/Black/White/Grey")
assert.equal(reconcile(official).colour,"'Infrared' — Red/Black/White/Grey")
assert.equal(reconcile({...official,colour:'Infrared',colour_evidence:evidence('Infrared')}).colour,'Infrared')
assert.equal(reconcile({model:'Shox',model_evidence:{...evidence('Nike Shox'),unambiguous:false}}).model,'')
const backend=fs.readFileSync('supabase/functions/listing-visual-extraction/index.ts','utf8')
const mergeCode=backend.slice(backend.indexOf('function merge('),backend.indexOf('Deno.serve(')).replace('parts:any[],failed:number','parts,failed').replace('const conflicts:string[]','const conflicts')
const context={identity:globalThis.FlippersIdentityPolicy,structuredClone,clean:v=>String(v??'').trim(),uniq:a=>[...new Set(a)],out:null}
vm.createContext(context);vm.runInContext(mergeCode,context)
const part=model=>reconcile({model,model_evidence:evidence(model),warnings:[]})
context.parts=[part('Air Max 90'),part('Air Max 95'),part('Air Max 90')]
vm.runInContext('out=merge(parts,0)',context);assert.equal(context.out.model,'')
context.parts=[part(''),part('Air Max 90')];vm.runInContext('out=merge(parts,0)',context);assert.equal(context.out.model,'Air Max 90')
assert.equal(fs.readFileSync('identity-policy-v134.js','utf8'),fs.readFileSync('supabase/functions/listing-visual-extraction/identity-policy-v134.js','utf8'))
const form=fs.readFileSync('analyse-structured-form-v104.js','utf8')
const setter=form.slice(form.indexOf('function setField('),form.indexOf('async function extractFromImages'))
const el={value:'My model',dataset:{userEdited:'true'},classList:{add(){}}}
const ui={$:()=>el};vm.createContext(ui);vm.runInContext(setter,ui)
vm.runInContext("setField('model','Air Max 90')",ui);assert.equal(el.value,'My model')
el.value='';vm.runInContext("setField('model','Air Max 90')",ui);assert.equal(el.value,'')
el.dataset={autoValue:'Old guess'};el.value='Old guess';vm.runInContext("setField('model','')",ui);assert.equal(el.value,'')
console.log('Identity evidence, conflicts, formatting, shared policy and manual-edit contracts passed')
