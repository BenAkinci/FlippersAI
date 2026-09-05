(() => {
  if (document.getElementById('analyseScrollStabilityStyles')) return

  const style = document.createElement('style')
  style.id = 'analyseScrollStabilityStyles'
  style.textContent = `
    html { scrollbar-gutter: stable; }

    /* The original Analyse helper is redundant now and was creating another
       bottom-of-page layout block beside the newer Flipper Tip. */
    .analyser-note { display: none !important; }

    /* Do not let Chrome re-anchor the viewport when Analyse enhancers update
       fields, helper states, loading content or result details. */
    main.content:has(#newDeal),
    main.content:has(#directAnalysisResult),
    main.content:has(.direct-analysis-loading),
    main.content:has(.analyser-card),
    main.content:has(#newDeal) .focused-card,
    main.content:has(#newDeal) #newDeal,
    main.content:has(#newDeal) #flipperPageTip,
    main.content:has(#directAnalysisResult) #directAnalysisResult,
    main.content:has(.direct-analysis-loading) .direct-analysis-loading {
      overflow-anchor: none;
    }

    /* Keep the bottom tip footprint stable so small text/layout changes cannot
       move the scroll boundary while the user is reading it. */
    main.content:has(#newDeal) #flipperPageTip,
    main.content:has(#directAnalysisResult) #flipperPageTip {
      min-height: 72px;
      box-sizing: border-box;
    }
  `
  document.head.appendChild(style)
})()
