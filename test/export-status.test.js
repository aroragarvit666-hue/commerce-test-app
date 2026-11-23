jest.mock('@adobe/aio-sdk', () => require('./helpers/mockSdk'))
const sdk = require('@adobe/aio-sdk')
const { main } = require('../actions/export-status/index.js')
const { baseParams } = require('./helpers/fixtures')

describe('export-status', () => {
  beforeEach(() => { jest.clearAllMocks(); sdk.__store.clear() })

  it('returns 200 with defaults when nothing has run yet', async () => {
    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ cursor: null, lastRun: null, stats: { exported: 0 }, failures: [] })
    expect(res.body.config).toMatchObject({ erpConfigured: true, erpEndpoint: 'https://erp.example.com/api/orders', orderStatuses: ['processing'] })
  })

  it('returns failures sorted newest first', async () => {
    sdk.__store.set('export.failures', JSON.stringify({
      1: { incrementId: 'A', error: 'x', at: '2026-11-20T10:00:00Z' },
      2: { incrementId: 'B', error: 'y', at: '2026-11-21T10:00:00Z' }
    }))
    const res = await main({ ...baseParams })
    expect(res.body.failures.map(f => f.incrementId)).toEqual(['B', 'A'])
  })

  it('reports missing ERP configuration (bad-input state)', async () => {
    const res = await main({ ...baseParams, ERP_BASE_URL: '' })
    expect(res.statusCode).toBe(200)
    expect(res.body.config).toMatchObject({ erpConfigured: false, erpEndpoint: null })
  })

  it('returns 500 when State fails', async () => {
    sdk.State.init.mockRejectedValueOnce(new Error('boom'))
    const res = await main({ ...baseParams })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('boom')
  })
})
