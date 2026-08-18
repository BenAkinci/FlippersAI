/* v0.76: protect in-progress website inputs from auth/refocus re-renders or page reloads. */
const DRAFT_KEY = 'flippers_web_drafts_v076'
const FOCUS_KEY = 'flippers_web_focus_v076'

function fieldKey(el) {
  const form = el.closest('form')
  const formKey = form?.id || form?.getAttribute('name') || form?.className || 'page'
  const field = el.name || el.id || el.getAttribute('aria-label') || el.placeholder || ''
  return `${location.pathname}|${formKey}|${field}`
}

function readDrafts() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {} } catch { return {} }
}
function writeDrafts(value) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value)) } catch {}
}
function eligible(el) {
  if (!el?.matches?.('input,textarea,select')) return false
  if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return false
  return Boolean(el.name || el.id || el.placeholder || el.getAttribute('aria-label'))
}
function valueFor(el) {
  if (el.type === 'checkbox' || el.type === 'radio') return { checked: el.checked }
  return { value: el.value }
}
function applyValue(el, saved) {
  if (!saved || !eligible(el)) return
  if (el.type === 'checkbox' || el.type === 'radio') el.checked = Boolean(saved.checked)
  else if (saved.value !== undefined && el.value !== saved.value) el.value = saved.value
}
function saveField(el) {
  if (!eligible(el)) return
  const drafts = readDrafts()
  drafts[fieldKey(el)] = { ...valueFor(el), at: Date.now() }
  writeDrafts(drafts)
  try {
    sessionStorage.setItem(FOCUS_KEY, JSON.stringify({
      key: fieldKey(el),
      start: typeof el.selectionStart === 'number' ? el.selectionStart : null,
      end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
      scrollY: window.scrollY
    }))
  } catch {}
}
function clearForm(form) {
  const drafts = readDrafts()
  form?.querySelectorAll?.('input,textarea,select').forEach(el => delete drafts[fieldKey(el)])
  writeDrafts(drafts)
}
function restoreDrafts() {
  const drafts = readDrafts()
  document.querySelectorAll('input,textarea,select').forEach(el => applyValue(el, drafts[fieldKey(el)]))
  let focus = null
  try { focus = JSON.parse(sessionStorage.getItem(FOCUS_KEY) || 'null') } catch {}
  if (!focus?.key) return
  const target = [...document.querySelectorAll('input,textarea,select')].find(el => fieldKey(el) === focus.key)
  if (!target || document.activeElement === target) return
  target.focus({ preventScroll: true })
  if (typeof target.setSelectionRange === 'function' && focus.start != null) {
    try { target.setSelectionRange(focus.start, focus.end ?? focus.start) } catch {}
  }
  if (Number.isFinite(focus.scrollY)) window.scrollTo({ top: focus.scrollY, behavior: 'instant' })
}

document.addEventListener('input', e => saveField(e.target), true)
document.addEventListener('change', e => saveField(e.target), true)
document.addEventListener('submit', e => clearForm(e.target), true)
window.addEventListener('pagehide', () => { if (eligible(document.activeElement)) saveField(document.activeElement) })
window.addEventListener('pageshow', () => setTimeout(restoreDrafts, 0))

let restoreTimer = 0
new MutationObserver(() => {
  clearTimeout(restoreTimer)
  restoreTimer = setTimeout(restoreDrafts, 35)
}).observe(document.getElementById('app'), { childList: true, subtree: true })

restoreDrafts()
