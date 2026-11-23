jest.mock('@adobe/aio-lib-core-auth', () => ({ generateAccessToken: jest.fn(async () => ({ access_token: 'tok' })) }))
const { deriveApiBase, buildSearchCriteria, getCommerceAuth, commerceFetch } = require('../actions/lib/commerce')
const { baseParams, mockFetch } = require('./helpers/fixtures')

describe('commerce lib', () => {
  it('derives the REST base from the admin URL', () => {
    expect(deriveApiBase(baseParams.COMMERCE_SANDBOX_ADMIN_URL)).toBe('https://na1-sandbox.api.commerce.adobe.com/TENANT1')
  })

  it('builds flattened searchCriteria', () => {
    const qs = decodeURIComponent(buildSearchCriteria({
      filterGroups: [[{ field: 'status', value: 'processing,complete', conditionType: 'in' }]],
      sortOrders: [{ field: 'updated_at', direction: 'ASC' }],
      pageSize: 10,
      currentPage: 2
    }))
    expect(qs).toContain('searchCriteria[filterGroups][0][filters][0][field]=status')
    expect(qs).toContain('searchCriteria[filterGroups][0][filters][0][conditionType]=in')
    expect(qs).toContain('searchCriteria[sortOrders][0][direction]=ASC')
    expect(qs).toContain('searchCriteria[pageSize]=10')
    expect(qs).toContain('searchCriteria[currentPage]=2')
  })

  it('uses the shared S2S credential when no dedicated one is set', async () => {
    const auth = await getCommerceAuth(baseParams)
    expect(auth.token).toBe('tok')
    expect(auth.params.__commerce_client_id).toBe('client-1')
    expect(auth.params.__commerce_org_id).toBe('ORG1@AdobeOrg')
  })

  it('fails loudly on a non-JSON (admin HTML) response', async () => {
    mockFetch(() => [200, '<html>login</html>'])
    await expect(commerceFetch(baseParams, 'tok', 'GET', '/orders')).rejects.toThrow('non-JSON')
  })
})
