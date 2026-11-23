// Generic REST client for the ERP backend. Retries transient failures (network, 429, 5xx).

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function isRetryable (status) {
  return status === 429 || status >= 500
}

async function sendOrderToErp (params, payload, { retries = 3, baseDelayMs = 500 } = {}) {
  if (!params.ERP_BASE_URL) throw new Error('ERP_BASE_URL is not configured')
  const url = `${params.ERP_BASE_URL.replace(/\/$/, '')}${params.ERP_ORDERS_PATH || '/orders'}`

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1))
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(params.ERP_API_KEY ? { Authorization: `Bearer ${params.ERP_API_KEY}` } : {}),
          // Lets the ERP de-duplicate if the same order is sent twice
          'Idempotency-Key': `commerce-order-${payload.externalOrderId}`
        },
        body: JSON.stringify(payload)
      })
    } catch (e) {
      lastError = new Error(`ERP request failed: ${e.message}`)
      continue
    }

    const text = await res.text()
    let data = {}
    try { data = text ? JSON.parse(text) : {} } catch (_) { data = { raw: text } }

    if (res.ok) {
      return {
        status: res.status,
        erpReference: data.id || data.orderId || data.documentNumber || data.reference || null
      }
    }

    lastError = new Error(`ERP rejected order ${payload.externalOrderId} (${res.status}): ${data.message || data.error || text.slice(0, 200)}`)
    lastError.statusCode = res.status
    if (!isRetryable(res.status)) break
  }
  throw lastError
}

module.exports = { sendOrderToErp }
