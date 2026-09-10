import fs from 'node:fs'

const index = fs.readFileSync('index.html', 'utf8')
const preprocess = fs.readFileSync('analyse-image-preprocess-v139.js', 'utf8')
const form = fs.readFileSync('analyse-structured-form-v104.js', 'utf8')
const pkg = fs.readFileSync('package.json', 'utf8')

const must = (condition, message) => {
  if (!condition) throw new Error(`Analyse image preprocess contract failed: ${message}`)
}

must(index.includes('analyse-image-preprocess-v139.js?v=0.139.0'), 'v139 preprocessor is not loaded by index.html')
must(index.indexOf('analyse-image-preprocess-v139.js') < index.indexOf('analyse-structured-form-v104.js'), 'preprocessor must load before structured Analyse form')
must(preprocess.includes('MAX_EDGE = 2200'), 'maximum screenshot dimension guard missing')
must(preprocess.includes('TARGET_BYTES = 1_250_000'), 'per-image payload target missing')
must(preprocess.includes("'image/jpeg'"), 'JPEG screenshot re-encoding missing')
must(preprocess.includes("event.stopImmediatePropagation()"), 'raw file change must be intercepted before Analyse captures files')
must(preprocess.includes("input.dispatchEvent(new Event('change'"), 'optimised files are not replayed into the existing Analyse flow')
must(form.includes("evidenceFiles.push(f)"), 'existing evidence collection contract changed unexpectedly')
must(pkg.includes('analyse-image-preprocess-v139.js'), 'v139 file is not included in build/package scripts')

console.log('Analyse image preprocess contract v139 passed')
