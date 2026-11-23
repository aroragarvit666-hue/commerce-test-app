jest.mock('@adobe/aio-sdk', () => require('./helpers/mockSdk'))
jest.mock('@adobe/aio-lib-core-auth', () => ({ generateAccessToken: jest.fn(async () => 'tok') }))
const sdk = require('@adobe/aio-sdk')
const { main } = require('../actions/scheduled-export/index.js')
const { baseParams, makeOrder, mockFetch } = require('./helpers/fixtures')

describe('scheduled-export', () => {
  beforeEach(() => { jest.clearAllMocks(); sdk.__store.clear() })

  it('returns 400 when configuration is missing', async () => {
    const res = await main({ ...baseParams, ERP_BASE_URL: '' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('ERP_BASE_URL')
  })

  it('exports new orders, retries previous failures and advances the cursor', async () => {
    sdk.__store.set('sync.cursor', JSON.stringify('2026-11-20 09:00:00'))
    sdk.__store.set('export.failures', JSON.stringify({ 55: { incrementId: '000000055', error: 'timeout', at: '2026-11-19T00:00:00Z', attempts: 1 } }))
    let erpCalls = 0
    const fetch = mockFetch(url => {
      if (url.startsWith('https://erp.example.com')) {
        erpCalls++
        // first attempt is a transient 503, then success — exercises the retry
        return erpCalls === 1 ? [503, { message: 'busy' }] : [201, { id: `SO-${erpCalls}` }]
      }
      if (url.includes('/comments')) return [200, true]
      if (url.includes('/V1/orders/55')) return [200, makeOrder({ entity_id: 55, increment_id: '000000055' })]
      if (url.includes('/V1/orders?')) return [200, { items: [makeOrder()], total_count: 1 }]
      return [404, { message: 'unexpected' }]
    })

    const res = await main({ ...baseParams })
    const searchUrl = fetch.mock.calls.map(([u]) => decodeURIComponent(u)).find(u => u.includes('/V1/orders?'))
    expect(searchUrl).toContain('[value]=2026-11-20 09:00:00')
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ trigger: 'schedule', exported: 2, failed: 0, retried: 1, cursorTo: '2026-11-20 10:05:00' })
    expect(JSON.parse(sdk.__store.get('export.failures'))).toEqual({})
    expect(JSON.parse(sdk.__store.get('export.stats')).exported).toBe(2)
  })

  it('returns 500 when Commerce search fails', async () => {
    mockFetch(() => [401, { message: 'Unauthorized' }])
    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Unauthorized')
  })
})
