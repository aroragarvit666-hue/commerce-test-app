const { Core, State } = require('@adobe/aio-sdk')
const { getStatus, getStatuses } = require('../lib/exporter')

async function main (params) {
  const logger = Core.Logger('export-status', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('Action invoked')
    const state = await State.init()
    const status = await getStatus(state)
    return {
      statusCode: 200,
      body: {
        ...status,
        config: {
          erpConfigured: Boolean(params.ERP_BASE_URL),
          erpEndpoint: params.ERP_BASE_URL ? `${params.ERP_BASE_URL.replace(/\/$/, '')}${params.ERP_ORDERS_PATH || '/orders'}` : null,
          commerceConfigured: Boolean(params.COMMERCE_SANDBOX_ADMIN_URL),
          orderStatuses: getStatuses(params),
          scheduleMinutes: 15
        }
      }
    }
  } catch (error) {
    logger.error('Action failed:', error.message)
    return { statusCode: 500, body: { error: error.message } }
  }
}

exports.main = main
