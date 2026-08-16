const params = new URLSearchParams(location.search)
const isFloating = params.get('floating') === '1'
const FLOAT_BOUNDS_KEY = 'flippers_floating_bounds'
const LAST_WORKFLOW_KEY = 'flippers_last_workflow'
const LAST_MARKETPLACE_TAB = 'flippers_last_marketplace_tab'
const RESUME_CONTEXT_KEY = 'flippers_resume_context'

const popoutIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="13" height="13" rx="2"/><path d="M13 4h7v7M20 4l-9 9"/></svg>`
const dockIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M7 9h4M7 13h4"/></svg>`

function clamp(value, min, max, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function currentView() {
  if (document.querySelector('.workflow-card')) return 'work'
  return document.querySelector('.ext-nav [data-view].active')?.dataset.view || params.get('view') || 'scan'
}

async function currentContext() {
  const stored = await chrome.storage.local.get(LAST_WORKFLOW_KEY)
  const view = currentView()
  return {
    view,
    workflowId: view === 'work' ? (params.get('workflow') || stored[LAST_WORKFLOW_KEY] || null) : null,
    opportunityId: params.get('opportunity') || null
  }
}

function rememberWorkflowFromClick(event) {
  const target = event.target.closest?.('[data-workflow]')
  const workflowId = target?.dataset?.workflow
  if (workflowId) chrome.storage.local.set({ [LAST_WORKFLOW_KEY]: workflowId }).catch(() => {})
}
document.addEventListener('click', rememberWorkflowFromClick, true)
if (params.get('workflow')) chrome.storage.local.set({ [LAST_WORKFLOW_KEY]: params.get('workflow') }).catch(() => {})

async function saveFloatingBounds() {
  if (!isFloating) return
  const bounds = {
    width: Math.round(window.outerWidth),
    height: Math.round(window.outerHeight),
    left: Math.round(window.screenX),
    top: Math.round(window.screenY)
  }
  await chrome.storage.local.set({ [FLOAT_BOUNDS_KEY]: bounds })
}

let boundsTimer
if (isFloating) {
  document.body.classList.add('flippers-floating')
  window.addEventListener('resize', () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => saveFloatingBounds().catch(() => {}), 180)
  })
  window.addEventListener('beforeunload', () => saveFloatingBounds().catch(() => {}))
}

async function floatWorkspace() {
  const context = await currentContext()
  const stored = await chrome.storage.local.get(FLOAT_BOUNDS_KEY)
  const previous = stored[FLOAT_BOUNDS_KEY] || {}
  const url = new URL(chrome.runtime.getURL('sidepanel.html'))
  url.searchParams.set('floating', '1')
  url.searchParams.set('view', context.view)
  if (context.workflowId) url.searchParams.set('workflow', context.workflowId)
  if (context.opportunityId) url.searchParams.set('opportunity', context.opportunityId)

  const createData = {
    url: url.toString(),
    type: 'popup',
    focused: true,
    width: clamp(previous.width, 420, 920, 560),
    height: clamp(previous.height, 520, 1100, 820)
  }
  if (Number.isFinite(Number(previous.left))) createData.left = Number(previous.left)
  if (Number.isFinite(Number(previous.top))) createData.top = Number(previous.top)

  const sourceWindow = await chrome.windows.getCurrent()
  await chrome.windows.create(createData)

  if (chrome.sidePanel?.close && sourceWindow?.id != null) {
    try { await chrome.sidePanel.close({ windowId: sourceWindow.id }) } catch {}
  }
}

async function dockWorkspace() {
  const context = await currentContext()
  await saveFloatingBounds().catch(() => {})
  await chrome.storage.local.set({ [RESUME_CONTEXT_KEY]: context })

  const stored = await chrome.storage.local.get(LAST_MARKETPLACE_TAB)
  const tabId = stored[LAST_MARKETPLACE_TAB]
  if (!tabId) throw new Error('Open a marketplace tab before docking FlippersAI.')

  const tab = await chrome.tabs.get(tabId)
  if (tab.windowId == null) throw new Error('Could not find the marketplace window.')
  await chrome.windows.update(tab.windowId, { focused: true })
  await chrome.tabs.update(tabId, { active: true })
  await chrome.sidePanel.open({ windowId: tab.windowId })
  window.close()
}

async function resumeSidePanel() {
  if (isFloating) return
  const stored = await chrome.storage.local.get(RESUME_CONTEXT_KEY)
  const context = stored[RESUME_CONTEXT_KEY]
  if (!context) return
  await chrome.storage.local.remove(RESUME_CONTEXT_KEY)

  let attempts = 0
  const resume = () => {
    attempts += 1
    if (context.workflowId) {
      const target = [...document.querySelectorAll('[data-workflow]')].find(el => el.dataset.workflow === context.workflowId)
      if (target) {
        target.click()
        return
      }
      const deals = document.querySelector('[data-view="deals"]')
      if (deals && !deals.classList.contains('active')) deals.click()
    } else if (context.view && ['scan','deals','inventory'].includes(context.view)) {
      const nav = document.querySelector(`[data-view="${context.view}"]`)
      if (nav) {
        nav.click()
        return
      }
    }
    if (attempts < 30) setTimeout(resume, 100)
  }
  resume()
}

function enhanceHeader() {
  document.querySelector('#compactToggle')?.remove()
  document.querySelector('#expandWorkspace')?.remove()

  const header = document.querySelector('.ext-top')
  if (!header) return
  if (document.querySelector('#floatWorkspace, #dockWorkspace')) return

  const button = document.createElement('button')
  button.className = 'top-icon primary-lite float-control'
  button.id = isFloating ? 'dockWorkspace' : 'floatWorkspace'
  button.type = 'button'
  button.title = isFloating ? 'Dock back to browser' : 'Float workspace'
  button.setAttribute('aria-label', button.title)
  button.innerHTML = isFloating ? dockIcon : popoutIcon
  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      if (isFloating) await dockWorkspace()
      else await floatWorkspace()
    } catch (error) {
      const message = document.createElement('div')
      message.className = 'toast'
      message.textContent = error?.message || 'Could not move FlippersAI.'
      document.body.appendChild(message)
      setTimeout(() => message.remove(), 2400)
      button.disabled = false
    }
  })

  const website = header.querySelector('#openWebsite')
  header.insertBefore(button, website || header.querySelector('#logout') || null)
}

let observerTimer
const observer = new MutationObserver(() => {
  clearTimeout(observerTimer)
  observerTimer = setTimeout(enhanceHeader, 20)
})
observer.observe(document.getElementById('app'), { childList: true, subtree: true })

enhanceHeader()
resumeSidePanel().catch(() => {})
