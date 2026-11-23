const { generateAccessToken } = require('@adobe/aio-lib-core-auth')

const COMMERCE_SCOPES = [
  'openid', 'AdobeID', 'email', 'profile', 'additional_info.roles',
  'additional_info.projectedProductContext', 'commerce.accs'
]

// Admin dashboard URL -> REST API base. Swap admin.->api., keep ONLY the tenant segment.
function deriveApiBase (adminUrl) {
  if (!adminUrl) throw new Error('COMMERCE_SANDBOX_ADMIN_URL is not configured')
  const u = new URL(adminUrl)
  const host = u.host.replace(/^([^.]+)\.admin\./, '$1.api.')
  const tenant = u.pathname.split('/').filter(Boolean)[0]
  if (!tenant) throw new Error('Could not extract tenant id from COMMERCE_SANDBOX_ADMIN_URL')
  return `https://${host}/${tenant}`
}

// One REST call. `path` starts at /V1 (e.g. '/categories', '/products?searchCriteria...').
// store -> the `Store` header ('all' | 'default' | a store-view code). NO /rest/<store>/ segment.
async function commerceFetch (params, token, method, path, body, store = 'all') {
  const url = `${deriveApiBase(params.COMMERCE_SANDBOX_ADMIN_URL)}/V1${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': params.__commerce_client_id,   // client id (see Auth below)
      'x-gw-ims-org-id': params.__commerce_org_id, // org id
      'Content-Type': 'application/json',
      Store: store
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch (_) {
    // Non-JSON body = wrong base URL (hit the admin page) — fail loudly, don't return empty.
    throw new Error(`Commerce ${method} ${path}: non-JSON response (${res.status}) — check deriveApiBase/base URL`)
  }
  if (!res.ok) {
    const err = new Error(data.message || `Commerce ${method} ${path} failed (${res.status})`)
    err.statusCode = res.status
    throw err
  }
  return data
}

// Resolves an access token and returns a params copy with __commerce_client_id / __commerce_org_id set.
// Prefers a dedicated Commerce credential; falls back to the shared include-ims-credentials one.
async function getCommerceAuth (params) {
  let token
  let clientId
  let orgId
  if (params.COMMERCE_CLIENT_ID && params.COMMERCE_CLIENT_SECRET) {
    token = await generateAccessToken({
      clientId: params.COMMERCE_CLIENT_ID,
      clientSecret: params.COMMERCE_CLIENT_SECRET,
      orgId: params.COMMERCE_ORG_ID,
      scopes: COMMERCE_SCOPES
    })
    clientId = params.COMMERCE_CLIENT_ID
    orgId = params.COMMERCE_ORG_ID
  } else if (params.__ims_oauth_s2s) {
    token = await generateAccessToken(params)
    clientId = params.__ims_oauth_s2s.client_id
    orgId = params.__ims_oauth_s2s.org_id
  } else {
    throw new Error('No Commerce credential: set COMMERCE_CLIENT_ID/SECRET or enable include-ims-credentials')
  }
  const accessToken = typeof token === 'string' ? token : token.access_token
  return {
    token: accessToken,
    params: { ...params, __commerce_client_id: clientId, __commerce_org_id: orgId }
  }
}

// Builds the flattened searchCriteria query string Magento expects.
// filterGroups: [[{ field, value, conditionType }]] — groups are AND-ed, filters within a group OR-ed.
function buildSearchCriteria ({ filterGroups = [], sortOrders = [], pageSize = 20, currentPage = 1 } = {}) {
  const parts = []
  const add = (k, v) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  filterGroups.forEach((group, g) => {
    group.forEach((f, i) => {
      const prefix = `searchCriteria[filterGroups][${g}][filters][${i}]`
      add(`${prefix}[field]`, f.field)
      add(`${prefix}[value]`, f.value)
      if (f.conditionType) add(`${prefix}[conditionType]`, f.conditionType)
    })
  })
  sortOrders.forEach((s, i) => {
    add(`searchCriteria[sortOrders][${i}][field]`, s.field)
    add(`searchCriteria[sortOrders][${i}][direction]`, s.direction || 'ASC')
  })
  add('searchCriteria[pageSize]', pageSize)
  add('searchCriteria[currentPage]', currentPage)
  return parts.join('&')
}

function searchOrders (params, token, criteria) {
  return commerceFetch(params, token, 'GET', `/orders?${buildSearchCriteria(criteria)}`, null, params.COMMERCE_STORE || 'all')
}

function getOrder (params, token, entityId) {
  return commerceFetch(params, token, 'GET', `/orders/${encodeURIComponent(entityId)}`, null, params.COMMERCE_STORE || 'all')
}

function addOrderComment (params, token, entityId, comment) {
  return commerceFetch(params, token, 'POST', `/orders/${encodeURIComponent(entityId)}/comments`, {
    statusHistory: { comment, is_customer_notified: 0, is_visible_on_front: 0, parent_id: Number(entityId) }
  }, params.COMMERCE_STORE || 'all')
}

module.exports = {
  COMMERCE_SCOPES,
  deriveApiBase,
  commerceFetch,
  getCommerceAuth,
  buildSearchCriteria,
  searchOrders,
  getOrder,
  addOrderComment
}
