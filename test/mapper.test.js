const { mapOrder } = require('../actions/lib/mapper')
const { makeOrder } = require('./helpers/fixtures')

describe('mapOrder', () => {
  it('maps header, addresses, totals and top-level lines only', () => {
    const payload = mapOrder(makeOrder())
    expect(payload.externalOrderId).toBe('000000101')
    expect(payload.customer).toEqual({ id: null, email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', isGuest: false })
    expect(payload.billingAddress.countryCode).toBe('US')
    expect(payload.shippingAddress.city).toBe('Austin')
    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0]).toMatchObject({ lineNumber: 1, sku: 'TSHIRT-M', quantity: 2, unitPrice: 20, rowTotal: 40 })
    expect(payload.totals).toEqual({ subtotal: 40, discount: 0, tax: 3.2, shipping: 5, grandTotal: 48.2 })
    expect(payload.payment.method).toBe('checkmo')
  })

  it('handles a missing shipping address (virtual orders)', () => {
    const payload = mapOrder(makeOrder({ extension_attributes: {} }))
    expect(payload.shippingAddress).toBeNull()
  })

  it('throws when increment_id is missing', () => {
    expect(() => mapOrder({})).toThrow('missing increment_id')
  })
})
