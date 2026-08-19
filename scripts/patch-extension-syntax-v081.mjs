import fs from 'node:fs'

const files = {
  orchestrator: 'extension/scout-orchestrator-v080.js',
  workspace: 'extension/scout-workspace-v071.js'
}

function patchFile(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after === before) {
    console.log(`${path}: already patched or no matching broken block found`)
    return
  }
  fs.writeFileSync(path, after)
  console.log(`${path}: syntax patch applied`)
}

patchFile(files.orchestrator, source => {
  const replacement = `function updateLoader(rows=[],message=''){
  const el=$('#v080Loading');if(!el)return
  const rr=roundRows(rows),ratedRows=rr.filter(rated),failedRows=rr.filter(failed)
  const working=O.active.size,total=rr.length,processed=ratedRows.length+failedRows.length,remaining=Math.max(0,total-processed)
  const strong=$('.scout-loading-copy strong',el),copy=$('.scout-loading-copy span',el),detail=$('.v080-live-detail',el),count=$('.scout-loading-count',el),track=$('.scout-loading-track i',el)
  el.classList.remove('paused','stopped','error')
  const currentBatch=Math.min(Math.max(1,O.batchNo||Math.floor(processed/MAX_BATCH)+1),Math.max(1,Math.ceil(total/MAX_BATCH)))
  const batchCount=Math.max(1,Math.ceil(total/MAX_BATCH))
  if(O.stopped){
    el.classList.add('visible','stopped')
    if(strong)strong.textContent='Scout stopped'
    if(copy)copy.textContent=\`${'${ratedRows.length}'}/${'${total}'} rated. No further scanning will run.\`
  }else if(O.paused){
    el.classList.add('visible','paused')
    if(strong)strong.textContent='Scout paused'
    if(copy)copy.textContent=\`${'${ratedRows.length}'}/${'${total}'} rated. Progress is saved.\`
  }else if(working||remaining){
    el.classList.add('visible')
    if(strong)strong.textContent='FlippersAI Scout is working…'
    if(copy)copy.textContent=message||\`${'${working}'} working now · ${'${ratedRows.length}'}/${'${total}'} rated · results appear one-by-one.\`
    const elapsed=O.batchStartedAt?Date.now()-O.batchStartedAt:0
    const estimate=estimatedSeconds(rr)
    let detailText=''
    if(failedRows.length){
      const suffix=estimate?\`${'${fmtTime(estimate)}'} remaining\`:(elapsed>12000?'Taking longer than expected — still working':'')
      detailText=\`${'${failedRows.length}'} scan issue${'${failedRows.length===1?\'\':\'s\'}'}${'${suffix?` · ${suffix}`:\'\'}'}\`
    }else if(estimate){
      detailText=\`Estimated ${'${fmtTime(estimate)}'} remaining\`
    }else if(elapsed>12000){
      detailText='Taking longer than expected — still waiting for the first results…'
    }
    if(detail)detail.textContent=detailText
  }else if(failedRows.length){
    el.classList.add('visible','error')
    if(strong)strong.textContent='Scout finished with scan errors'
    if(copy)copy.textContent=\`${'${ratedRows.length}'}/${'${total}'} rated · ${'${failedRows.length}'} could not be rated. Restart current scan to retry them.\`
    if(detail)detail.textContent='The failed listings were not counted as rated or filtered out.'
  }else if(O.enrichWorkers||O.enrichQueue.length){
    el.classList.add('visible')
    if(strong)strong.textContent='Ratings complete · checking promising leads…'
    if(copy)copy.textContent=\`${'${ratedRows.length}'}/${'${total}'} rated. Seller, condition, photos and authenticity checks continue in the background.\`
  }else{
    el.classList.remove('visible')
    if(detail)detail.textContent=''
  }
  if(count)count.textContent=total?\`Batch ${'${currentBatch}'}/${'${batchCount}'}\`:'Batch 1'
  if(track)track.style.width=\`${'${total?Math.round(processed/total*100):0}'}%\`
}`
  return source.replace(/function updateLoader\(rows=\[\],message=''\)\{[\s\S]*?\nfunction renderLive/, `${replacement}\nfunction renderLive`)
})

patchFile(files.workspace, source => {
  const replacement = `function savedCard(c){
  const a=c.analysis||{}
  const r=c.recommendation||a.recommendation||''
  const s=Math.round(Number(a.overall_score??c.score??0))
  const cat=c.category_label||c.raw_capture?.category_label||a.category||'Other'
  const evidence=a.resale_evidence_count!=null?\`${'${a.resale_evidence_count}'} sold comp${'${Number(a.resale_evidence_count)===1?\'\':\'s\'}'}\`:''
  const authLabel=({likely_genuine:'Likely genuine',uncertain:'Uncertain',high_risk:'High risk',likely_counterfeit:'Likely counterfeit',not_applicable:'N/A'})[a.authenticity_status]||'Not assessed'
  const scoreHtml=rated(c)?\`<span class="v068-score ${'${recClass(r)}'}">${'${s}'}/100</span>\`:''
  const intelHtml=a.community_confidence==null?'':\`<span>Intel confidence <b>${'${pct(a.community_confidence)}'}</b></span>\`
  const evidenceHtml=evidence?\`<span>Evidence <b>${'${esc(evidence)}'}</b></span>\`:''
  const metricsHtml=rated(c)
    ?\`<div class="v068-saved-metrics"><span>${'${esc(recLabel(r))}'}</span><span>Resale <b>${'${a.resale_mid==null?\'Unverified\':money(a.resale_mid)}'}</b></span><span>Profit <b>${'${a.expected_profit==null?\'Unverified\':money(a.expected_profit)}'}</b></span><span>ROI <b>${'${a.expected_roi_percent==null?\'Unverified\':pct(a.expected_roi_percent)}'}</b></span><span>Success potential <b>${'${Math.round(Number(a.success_potential||0))}'}/100</b></span>${'${intelHtml}'}<span>Authenticity <b>${'${esc(authLabel)}'}</b></span>${'${evidenceHtml}'}</div>\`
    :'<div class="v068-saved-metrics"><span>Saved for deeper analysis</span></div>'
  const dealButton=deep(c)?\`<button class="button secondary small" data-start-deal="${'${esc(c.id)}'}">${'${c.opportunity_id?\'Open deal\':\'Start deal\'}'}</button>\`:''
  return \`<article class="v068-saved-card" data-saved-candidate="${'${esc(c.id)}'}"><div class="v068-saved-main"><div class="v068-saved-title"><strong>${'${esc(c.title||a.identified_name||\'Untitled listing\')}'}</strong>${'${scoreHtml}'}</div><div class="v068-saved-meta">${'${esc(platformLabel(c.source_url))}'} · ${'${money(c.asking_price)}'}${'${c.location?` · ${esc(c.location)}`:\'\'}'} · ${'${esc(cat)}'}</div>${'${metricsHtml}'}</div><div class="v068-saved-actions"><button class="button primary small" data-analyse-candidate="${'${esc(c.id)}'}">${'${deep(c)?\'Reanalyse\':\'Analyse\'}'}</button>${'${dealButton}'}<button class="button soft small" data-open-saved="${'${esc(c.id)}'}">Open</button><button class="button soft small" data-unsave-candidate="${'${esc(c.id)}'}">Remove</button></div></article>\`
}`
  return source.replace(/function savedCard\(c\)\{[\s\S]*?\nasync function renderAnalyse/, `${replacement}\nasync function renderAnalyse`)
})
