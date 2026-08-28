export const FLIP_LIFECYCLE_V1 = Object.freeze({
  prePurchase: Object.freeze(['watching','analysing','verify','ready','negotiating']),
  owned: Object.freeze(['bought','preparing','ready_to_list','listed','sale_agreed','packed','shipped','delivered','sold']),
  exits: Object.freeze(['skipped','expired','returned','written_off']),
  workflow: Object.freeze(['active','paused','completed','abandoned']),
  guidance: Object.freeze(['teach','assist','fast'])
})

export const ORGANISATION_V1 = Object.freeze({
  shortlist: 'is_shortlisted',
  saved: 'is_saved'
})

export function isActiveDeal(opportunity, workflow = null) {
  if (!opportunity) return false
  if (opportunity.status === 'negotiating') return true
  return Boolean(workflow && ['active','paused'].includes(workflow.status) && !workflow.inventory_item_id)
}

export function isInventoryStage(item) {
  return Boolean(item && FLIP_LIFECYCLE_V1.owned.includes(item.status))
}

export function opportunityOrganisation(opportunity) {
  return {
    shortlisted: Boolean(opportunity?.is_shortlisted),
    saved: Boolean(opportunity?.is_saved)
  }
}

export function economicsState(analysis = {}) {
  const profit = Number(analysis.expected_profit)
  const roi = Number(analysis.expected_roi_percent)
  if ((Number.isFinite(profit) && profit <= 0) || (Number.isFinite(roi) && roi <= 0)) return 'loss'
  return 'positive_or_unknown'
}

export const WEBSITE_LIFECYCLE_VERSION = '1.0.0'
