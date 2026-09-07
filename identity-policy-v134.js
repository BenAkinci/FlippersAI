/* Shared by the browser and screenshot backend. Evidence is mandatory, never confidence alone. */
(() => {
  const text = v => typeof v === 'string' ? v.trim() : ''
  const norm = v => text(v).toLowerCase().replace(/\s+/g, ' ')
  const contains = (quote, value) => {
    const q = norm(quote), v = norm(value)
    const at = q.indexOf(v)
    return !!v && at >= 0 && !/[a-z0-9]/i.test(q[at - 1] || '') && !/[a-z0-9]/i.test(q[at + v.length] || '')
  }
  function supported(value, evidence, official = false) {
    if (!text(value) || !evidence || evidence.unambiguous !== true) return false
    // This scanner has no research tool: a URL or claimed verification is not proof.
    if (!(official ? ['official_label'] : ['listing_text', 'product_label', 'official_label']).includes(evidence.source)) return false
    return contains(evidence.quote, value)
  }
  function reconcile(x) {
    // Extras must be separately evidenced secondary items, never the product itself.
    const extras = Array.isArray(x.included_item_evidence) ? x.included_item_evidence : []
    x.included_items = (Array.isArray(x.included_items) ? x.included_items : []).filter(item =>
      extras.some(e => text(e.item) === text(item) && e.is_secondary === true &&
        ['listing_text', 'photo'].includes(e.source) && text(e.evidence)) &&
      !/\b(?:not included|not supplied|no box|both shoes|pair of .*?(?:shoes|sneakers|trainers))\b/i.test(item)
    )
    const model = text(x.model)
    const ambiguous = /\b(?:unknown|unidentified|possibly|probably|likely|style|inspired|similar|logo on|looks like|could be)\b/i
    x.model = supported(model, x.model_evidence) && !ambiguous.test(model) ? model : ''
    const colour = text(x.colour)
    const name = text(x.official_colourway)
    const official = text(x.official_colour_string)
    if (supported(name, x.colour_evidence, true) && supported(official, x.colour_evidence, true)) {
      x.colour = `'${name}' — ${official}`
    } else {
      x.colour = supported(colour, x.colour_evidence) ? colour : ''
      x.official_colourway = ''
      x.official_colour_string = ''
    }
    x.missing_important_fields = [...new Set([...(x.missing_important_fields || []).filter(f => !['model', 'colour'].includes(f)), ...(!x.model ? ['model'] : []), ...(!x.colour ? ['colour'] : [])])]
    return x
  }
  globalThis.FlippersIdentityPolicy = { reconcile, supported }
})()
