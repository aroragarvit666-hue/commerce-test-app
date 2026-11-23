// Commerce order -> ERP sales order payload.
// This is the single place to adapt field names to your ERP's import schema.

function mapAddress (a) {
  if (!a) return null
  return {
    firstName: a.firstname,
    lastName: a.lastname,
    company: a.company || null,
    street: Array.isArray(a.street) ? a.street : [a.street].filter(Boolean),
    city: a.city,
    region: a.region || a.region_code || null,
    postcode: a.postcode,
    countryCode: a.country_id,
    phone: a.telephone || null,
    email: a.email || null
  }
}

function getShippingAddress (order) {
  const assignment = order.extension_attributes?.shipping_assignments?.[0]
  return assignment?.shipping?.address || null
}

function mapOrder (order) {
  if (!order || !order.increment_id) throw new Error('Cannot map order: missing increment_id')

  // Configurable/bundle products appear as parent + child rows; export only top-level rows.
  const lines = (order.items || [])
    .filter(item => !item.parent_item_id)
    .map((item, idx) => ({
      lineNumber: idx + 1,
      sku: item.sku,
      name: item.name,
      quantity: Number(item.qty_ordered || 0),
      unitPrice: Number(item.price || 0),
      discountAmount: Number(item.discount_amount || 0),
      taxAmount: Number(item.tax_amount || 0),
      rowTotal: Number(item.row_total || 0)
    }))

  return {
    externalOrderId: order.increment_id,
    sourceSystem: 'adobe-commerce',
    commerceEntityId: order.entity_id,
    orderDate: order.created_at,
    status: order.status,
    currency: order.order_currency_code || order.base_currency_code,
    customer: {
      id: order.customer_id || null,
      email: order.customer_email,
      firstName: order.customer_firstname || order.billing_address?.firstname || null,
      lastName: order.customer_lastname || order.billing_address?.lastname || null,
      isGuest: Boolean(order.customer_is_guest)
    },
    billingAddress: mapAddress(order.billing_address),
    shippingAddress: mapAddress(getShippingAddress(order)),
    shipping: {
      method: order.shipping_method || order.extension_attributes?.shipping_assignments?.[0]?.shipping?.method || null,
      description: order.shipping_description || null,
      amount: Number(order.shipping_amount || 0)
    },
    payment: {
      method: order.payment?.method || null,
      amountPaid: Number(order.total_paid || 0)
    },
    lines,
    totals: {
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount_amount || 0),
      tax: Number(order.tax_amount || 0),
      shipping: Number(order.shipping_amount || 0),
      grandTotal: Number(order.grand_total || 0)
    }
  }
}

module.exports = { mapOrder }
