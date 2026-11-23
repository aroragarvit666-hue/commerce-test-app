jest.mock('@adobe/aio-sdk', () => require('./helpers/mockSdk'))
jest.mock('@adobe/aio-lib-core-auth', () => ({ generateAccessToken: jest.fn(async () => 'tok') }))
const sdk = require('@adobe/aio-sdk')
const { main } = require('../actions/list-orders/index.js')
const { baseParams, makeOrder, mockFetch } = require('./helpers/fixtures')

describe('list-orders', () => {
  beforeEach(() => { jest.clearAllMocks(); sdk.__store.clear() })

  it('returns 400 on invalid paging params', async () => {
    const res = await main({ ...baseParams, pageSize: 500 })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('Invalid params')
  })

  it('returns 200 with orders merged with export status', async () => {
    sdk.__store.set('order.101', JSON.stringify({ status: 'exported', erpReference: 'SO-9', exportedAt: '2026-11-20T10:10:00Z' }))
    const fetch = mockFetch(() => [200, { items: [makeOrder(), makeOrder({ entity_id: 102, increment_id: '000000102' })], total_count: 2 }])

    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(200)
    expect(res.body.totalCount).toBe(2)
    expect(res.body.items[0]).toMatchObject({ entityId: '101', exportStatus: 'exported', erpReference: 'SO-9', customerName: 'Jane Doe' })
    expect(res.body.items[1]).toMatchObject({ entityId: '102', exportStatus: 'pending' })

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('https://na1-sandbox.api.commerce.adobe.com/TENANT1/V1/orders?')
    expect(opts.headers).toMatchObject({ Authorization: 'Bearer tok', 'x-api-key': 'client-1', Store: 'all' })
  })

  it('returns 500 when Commerce fails', async () => {
    mockFetch(() => [500, { message: 'Internal error' }])
    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal error')
  })
})
