const { Core } = require('@adobe/aio-sdk')
const { searchOrders } = require('../lib/commerce')
const { createContext, getOrderRecord, getStatuses } = require('../lib/exporter')

async function main (params) {
  const logger = Core.Logger('list-orders', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('Action invoked')

    const page = params.page === undefined ? 1 : Number(params.page)
    const pageSize = params.pageSize === undefined ? 20 : Number(params.pageSize)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      return { statusCode: 400, body: { error: 'Invalid params: page must be >= 1 and pageSize between 1 and 50' } }
    }
    // 'eligible' (default) = ORDER_STATUSES only; 'all' = every status; otherwise a single status code
    const statusFilter = params.status || 'eligible'

    const ctx = await createContext(params, logger)
    const filterGroups = []
    if (statusFilter === 'eligible') {
      filterGroups.push([{ field: 'status', value: getStatuses(ctx.params).join(','), conditionType: 'in' }])
    } else if (statusFilter !== 'all') {
      filterGroups.push([{ field: 'status', value: statusFilter, conditionType: 'eq' }])
    }

    const data = await searchOrders(ctx.params, ctx.token, {
      filterGroups,
      sortOrders: [{ field: 'created_at', direction: 'DESC' }],
      pageSize,
      currentPage: page
    })

    const items = await Promise.all((data.items || []).map(async order => {
      const record = await getOrderRecord(ctx.state, order.entity_id)
      return {
        entityId: String(order.entity_id),
        incrementId: order.increment_id,
        createdAt: order.created_at,
        status: order.status,
        customerEmail: order.customer_email,
        customerName: [order.customer_firstname, order.customer_lastname].filter(Boolean).join(' ') ||
          [order.billing_address?.firstname, order.billing_address?.lastname].filter(Boolean).join(' '),
        grandTotal: Number(order.grand_total || 0),
        currency: order.order_currency_code,
        exportStatus: record?.status || 'pending',
        erpReference: record?.erpReference || null,
        exportedAt: record?.exportedAt || null,
        exportError: record?.status === 'failed' ? record.error : null
      }
    }))

    logger.info(`Returned ${items.length} orders`)
    return { statusCode: 200, body: { items, totalCount: data.total_count || 0, page, pageSize } }
  } catch (error) {
    logger.error('Action failed:', error.message)
    return { statusCode: error.statusCode === 401 || error.statusCode === 403 ? error.statusCode : 500, body: { error: error.message } }
  }
}

exports.main = main
