jest.mock('@adobe/aio-sdk', () => require('./helpers/mockSdk'))
jest.mock('@adobe/aio-lib-core-auth', () => ({ generateAccessToken: jest.fn(async () => 'tok') }))
const sdk = require('@adobe/aio-sdk')
const { main } = require('../actions/export-orders/index.js')
const { baseParams, makeOrder, mockFetch } = require('./helpers/fixtures')

function commerceAndErp ({ erpStatus = 201 } = {}) {
  return mockFetch((url, opts) => {
    if (url.startsWith('https://erp.example.com')) return [erpStatus, erpStatus < 300 ? { id: 'SO-1' } : { message: 'Invalid SKU' }]
    if (url.includes('/comments')) return [200, true]
    if (url.includes('/V1/orders/101')) return [200, makeOrder()]
    if (url.includes('/V1/orders?')) return [200, { items: [makeOrder()], total_count: 1 }]
    return [404, { message: `unexpected ${opts.method} ${url}` }]
  })
}

describe('export-orders', () => {
  beforeEach(() => { jest.clearAllMocks(); sdk.__store.clear() })

  it('returns 400 when neither orderIds nor mode is given', async () => {
    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('Missing required params')
  })

  it('returns 400 on non-numeric ids', async () => {
    const res = await main({ ...baseParams, orderIds: ['abc'] })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('Invalid orderIds')
  })

  it('exports an order, records it and adds a Commerce comment', async () => {
    const fetch = commerceAndErp()
    const res = await main({ ...baseParams, orderIds: [101] })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ exported: 1, skipped: 0, failed: 0 })
    expect(JSON.parse(sdk.__store.get('order.101'))).toMatchObject({ status: 'exported', erpReference: 'SO-1' })

    const erpCall = fetch.mock.calls.find(([u]) => u.startsWith('https://erp.example.com'))
    expect(erpCall[0]).toBe('https://erp.example.com/api/orders')
    expect(erpCall[1].headers).toMatchObject({ Authorization: 'Bearer erp-key', 'Idempotency-Key': 'commerce-order-000000101' })
    expect(JSON.parse(erpCall[1].body).externalOrderId).toBe('000000101')
    expect(fetch.mock.calls.some(([u]) => u.includes('/V1/orders/101/comments'))).toBe(true)
  })

  it('skips already exported orders unless force is set', async () => {
    sdk.__store.set('order.101', JSON.stringify({ status: 'exported', erpReference: 'SO-0' }))
    commerceAndErp()
    const res = await main({ ...baseParams, orderIds: ['101'] })
    expect(res.body).toMatchObject({ exported: 0, skipped: 1 })

    const forced = await main({ ...baseParams, orderIds: ['101'], force: true })
    expect(forced.body).toMatchObject({ exported: 1, skipped: 0 })
  })

  it('records an ERP rejection as a failure', async () => {
    commerceAndErp({ erpStatus: 422 })
    const res = await main({ ...baseParams, orderIds: ['101'] })
    expect(res.statusCode).toBe(200)
    expect(res.body.failed).toBe(1)
    expect(res.body.results[0].error).toContain('Invalid SKU')
    expect(JSON.parse(sdk.__store.get('export.failures'))['101']).toMatchObject({ incrementId: '000000101', attempts: 1 })
  })

  it('runs an incremental sync with mode: sync', async () => {
    commerceAndErp()
    const res = await main({ ...baseParams, mode: 'sync', SYNC_START_DATE: '2026-11-01T00:00:00Z' })
    expect(res.statusCode).toBe(200)
    expect(res.body.lastRun).toMatchObject({ trigger: 'manual', exported: 1, cursorTo: '2026-11-20 10:05:00' })
    expect(JSON.parse(sdk.__store.get('sync.cursor'))).toBe('2026-11-20 10:05:00')
  })

  it('returns 500 when State is unavailable', async () => {
    sdk.State.init.mockRejectedValueOnce(new Error('State unavailable'))
    const res = await main({ ...baseParams, orderIds: ['101'] })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('State unavailable')
  })
})
