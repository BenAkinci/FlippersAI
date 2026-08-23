import { CONFIG } from './config.js'

const SESSION_KEY = 'flippersai_session_v1'
const SCOUT_CACHE_TTL_MS = 1500
const scoutSelectCache = new Map()
const scoutSelectInflight = new Map()

function qs(params = {}) {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    out.set(key, String(value))
  }
  return out.toString()
}

function scoutCacheKey(table, query = '') {
  return table === 'scout_candidates' ? `${table}?${query}` : null
}

function invalidateScoutCache() {
  scoutSelectCache.clear()
  scoutSelectInflight.clear()
}

async function storageGet(key) {
  const data = await chrome.storage.local.get(key)
  return data[key] ?? null
}

async function storageSet(key, value) {
  if (value === null || value === undefined) return chrome.storage.local.remove(key)
  return chrome.storage.local.set({ [key]: value })
}

function normalizeSession(raw) {
  if (!raw) return null
  if (raw.currentSession) raw = raw.currentSession
  if (raw.session) raw = raw.session
  if (Array.isArray(raw) && raw.length) raw = raw[0]
  if (!raw?.access_token) return null
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || null,
    expires_at: raw.expires_at || (raw.expires_in ? Math.floor(Date.now() / 1000) + Number(raw.expires_in) : null),
    token_type: raw.token_type || 'bearer',
    user: raw.user || null
  }
}

async function saveSession(raw) {
  const session = normalizeSession(raw)
  await storageSet(SESSION_KEY, session)
  return session
}

async function getSession() {
  return normalizeSession(await storageGet(SESSION_KEY))
}

async function clearSession() {
  await storageSet(SESSION_KEY, null)
}

async function refreshSession(force = false) {
  let session = await getSession()
  if (!session) return null
  const expiry = Number(session.expires_at || 0)
  if (!force && expiry && expiry > Math.floor(Date.now() / 1000) + 90) return session
  if (!session.refresh_token) return session

  const response = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  })
  if (!response.ok) {
    await clearSession()
    throw new Error('Your FlippersAI session expired. Connect the extension again.')
  }
  session = await response.json()
  return saveSession(session)
}

async function authHeaders(extra = {}, allowAnon = false) {
  const session = allowAnon ? await getSession() : await refreshSession()
  const headers = {
    apikey: CONFIG.supabaseKey,
    ...extra
  }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

async function parseResponse(response) {
  const text = await response.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || data?.error || (typeof data === 'string' ? data : '') || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

async function request(url, options = {}, retry = true) {
  const response = await fetch(url, options)
  if (response.status === 401 && retry) {
    await refreshSession(true)
    const next = { ...options, headers: await authHeaders({ ...(options.headers || {}) }) }
    return request(url, next, false)
  }
  return parseResponse(response)
}

async function signIn(email, password) {
  const response = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await parseResponse(response)
  return saveSession(data)
}

async function importSession(raw) {
  const session = await saveSession(raw)
  if (!session) throw new Error('No active FlippersAI website session was found.')
  await getUser()
  return getSession()
}

async function signOut() {
  const session = await getSession()
  if (session?.access_token) {
    try {
      await fetch(`${CONFIG.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: await authHeaders()
      })
    } catch {}
  }
  invalidateScoutCache()
  await clearSession()
}

async function getUser() {
  const session = await refreshSession()
  if (!session) return null
  const data = await request(`${CONFIG.supabaseUrl}/auth/v1/user`, {
    headers: await authHeaders()
  })
  if (data && (!session.user || session.user.id !== data.id)) await saveSession({ ...session, user: data })
  return data
}

async function select(table, query = '') {
  const suffix = query ? `?${query}` : ''
  const key = scoutCacheKey(table, query)
  if (key) {
    const cached = scoutSelectCache.get(key)
    if (cached && Date.now() - cached.at < SCOUT_CACHE_TTL_MS) return cached.data
    const pending = scoutSelectInflight.get(key)
    if (pending) return pending
  }

  const promise = request(`${CONFIG.supabaseUrl}/rest/v1/${table}${suffix}`, {
    headers: await authHeaders({ Accept: 'application/json' })
  })

  if (!key) return promise
  scoutSelectInflight.set(key, promise)
  try {
    const data = await promise
    scoutSelectCache.set(key, { at: Date.now(), data })
    return data
  } finally {
    if (scoutSelectInflight.get(key) === promise) scoutSelectInflight.delete(key)
  }
}

async function insert(table, body, { single = false } = {}) {
  const data = await request(`${CONFIG.supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: await authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify(body)
  })
  if (table === 'scout_candidates') invalidateScoutCache()
  return single ? (Array.isArray(data) ? data[0] || null : data) : data
}

async function update(table, filters, body, { single = false } = {}) {
  const query = typeof filters === 'string' ? filters : qs(filters)
  const data = await request(`${CONFIG.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: await authHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify(body)
  })
  if (table === 'scout_candidates') invalidateScoutCache()
  return single ? (Array.isArray(data) ? data[0] || null : data) : data
}

async function remove(table, filters) {
  const query = typeof filters === 'string' ? filters : qs(filters)
  const data = await request(`${CONFIG.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: await authHeaders({ Prefer: 'return=representation' })
  })
  if (table === 'scout_candidates') invalidateScoutCache()
  return data
}

async function rpc(name, body = {}) {
  return request(`${CONFIG.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  })
}

async function invoke(name, body = null, method = 'POST') {
  const options = {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' })
  }
  if (body !== null && method !== 'GET') options.body = JSON.stringify(body)
  return request(`${CONFIG.supabaseUrl}/functions/v1/${name}`, options)
}

async function workflowState() {
  return invoke('workflow-state', null, 'GET')
}

async function uploadMedia(userId, opportunityId, blob, mediaType = 'listing_image', fileName = 'browser-capture.jpg') {
  const path = `${userId}/${opportunityId}/${crypto.randomUUID()}.jpg`
  await request(`${CONFIG.supabaseUrl}/storage/v1/object/${CONFIG.storageBucket}/${path}`, {
    method: 'POST',
    headers: await authHeaders({
      'Content-Type': blob.type || 'image/jpeg',
      'x-upsert': 'false'
    }),
    body: blob
  })
  try {
    await insert('opportunity_media', {
      user_id: userId,
      opportunity_id: opportunityId,
      storage_path: path,
      file_name: fileName,
      mime_type: blob.type || 'image/jpeg',
      size_bytes: blob.size,
      media_type: mediaType
    })
  } catch (error) {
    try {
      await request(`${CONFIG.supabaseUrl}/storage/v1/object/${CONFIG.storageBucket}/${path}`, {
        method: 'DELETE', headers: await authHeaders()
      })
    } catch {}
    throw error
  }
  return path
}

async function downloadMedia(path) {
  const response = await fetch(`${CONFIG.supabaseUrl}/storage/v1/object/authenticated/${CONFIG.storageBucket}/${path}`, {
    headers: await authHeaders()
  })
  if (!response.ok) throw new Error(`Could not load stored image (${response.status})`)
  return response.blob()
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function analysisImages(opportunityId, limit = CONFIG.maxAnalysisImages) {
  const media = await select('opportunity_media', `select=storage_path,media_type,created_at&opportunity_id=eq.${encodeURIComponent(opportunityId)}&order=created_at.desc&limit=${limit * 2}`)
  const chosen = [...(media || [])].sort((a, b) => {
    const ap = a.media_type === 'seller_reply_image' ? 0 : 1
    const bp = b.media_type === 'seller_reply_image' ? 0 : 1
    return ap - bp
  }).slice(0, limit)
  const images = []
  for (const item of chosen) {
    try { images.push(await blobToDataUrl(await downloadMedia(item.storage_path))) } catch {}
  }
  return images
}

export const api = {
  signIn,
  signOut,
  importSession,
  getSession,
  getUser,
  select,
  insert,
  update,
  remove,
  rpc,
  invoke,
  workflowState,
  uploadMedia,
  analysisImages,
  blobToDataUrl
}
