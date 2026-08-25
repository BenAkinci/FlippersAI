# FlippersAI v0.91 ownership rules

The Scan view has one runtime state owner: `scout-controller-v090.js`.

Allowed Scan responsibilities:
- `scout-controller-v090.js`: session lifecycle, progress/loading copy, counters, completion state, information block, controls, scan-more flow.
- `scout-buckets-v088.js`: expandable Found/Rated/Working/Shortlist/Filtered listing panels only.
- `scout-page-overlay-sync.js`: synchronise completed ratings to marketplace pages.
- `workspace-tools-v086.js`: Shortlist/Saved/Analyse views only; no independent Scan summary injection.

Legacy Scan renderers removed from the runtime load path:
- `scout-smart-overview-v066.js`
- `scout-card-details.js`
- `scout-loader-state-v083.js`
- `scout-actions-v087.js`
- `scout-enrichment-state-v089.js`

Marketplace rating overlays preserve their listing identity through temporary marketplace React rerenders and only remove a badge when a connected card is clearly recycled to another listing.

Regression tests in `extension/v091-contract.mjs` enforce these rules.
