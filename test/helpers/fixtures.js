const baseParams = {
  LOG_LEVEL: 'error',
  COMMERCE_SANDBOX_ADMIN_URL: 'https://na1-sandbox.admin.commerce.adobe.com/TENANT1/admin/admin/dashboard/index/key/abc/',
  ERP_BASE_URL: 'https://erp.example.com/api',
  ERP_API_KEY: 'erp-key',
  ERP_RETRY_DELAY_MS: '1',
  ORDER_STATUSES: 'processing',
  __ims_oauth_s2s: { client_id: 'client-1', client_secret: 'secret', org_id: 'ORG1@AdobeOrg', scopes: ['commerce.accs'] }
}

function makeOrder (overrides = {}) {
  return {
    entity_id: 101,
    increment_id: '000000101',
    created_at: '2026-11-20 10:00:00',
    updated_at: '2026-11-20 10:05:00',
    status: 'processing',
    customer_email: 'jane@example.com',
    customer_firstname: 'Jane',
    customer_lastname: 'Doe',
    order_currency_code: 'USD',
    subtotal: 40,
    tax_amount: 3.2,
    shipping_amount: 5,
    discount_amount: 0,
    grand_total: 48.2,
    total_paid: 48.2,
    shipping_method: 'flatrate_flatrate',
    payment: { method: 'checkmo' },
    billing_address: {
      firstname: 'Jane', lastname: 'Doe', street: ['1 Main St'], city: 'Austin',
      region: 'Texas', postcode: '78701', country_id: 'US', telephone: '555-0100', email: 'jane@example.com'
    },
    extension_attributes: {
      shipping_assignments: [{ shipping: { method: 'flatrate_flatrate', address: { firstname: 'Jane', lastname: 'Doe', street: ['1 Main St'], city: 'Austin', postcode: '78701', country_id: 'US' } } }]
    },
    items: [
      { item_id: 1, sku: 'TSHIRT-M', name: 'T-Shirt', qty_ordered: 2, price: 20, row_total: 40, tax_amount: 3.2, discount_amount: 0 },
      { item_id: 2, parent_item_id: 1, sku: 'TSHIRT-M-child', name: 'T-Shirt child', qty_ordered: 2, price: 0, row_total: 0 }
    ],
    ...overrides
  }
}

function jsonResponse (status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, text: async () => text }
}

// Installs a fetch mock; handler(url, options) returns [status, body]
function mockFetch (handler) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const [status, body] = await handler(String(url), options)
    return jsonResponse(status, body)
  })
  return global.fetch
}

module.exports = { baseParams, makeOrder, mockFetch }
