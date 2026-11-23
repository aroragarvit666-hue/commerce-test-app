import actions from '../config.json'

export const ACTION_NAMES = ['list-orders', 'export-orders', 'export-status']

export function getActionUrl(name) {
  return actions[name] || ''
}

export async function invokeAction(url, ims, body = {}) {
  if (!url) {
    // config.json is empty before deploy/preview — callers check this first
    return null
  }
  const headers = { 'Content-Type': 'application/json' }
  if (ims?.token) headers.Authorization = `Bearer ${ims.token}`
  if (ims?.org) headers['x-gw-ims-org-id'] = ims.org
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  let data = null
  try { data = await res.json() } catch (_) { /* non-JSON error body */ }
  if (!res.ok) throw new Error(data?.error ? `${data.error} (${res.status})` : `Action failed: ${res.status}`)
  return data
}

export function formatDate(value) {
  if (!value) return '—'
  // Commerce returns "YYYY-MM-DD HH:mm:ss" in UTC
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`)
  return isNaN(d) ? value : d.toLocaleString()
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch (_) {
    return `${amount} ${currency || ''}`
  }
}
