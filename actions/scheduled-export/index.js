const { Core } = require('@adobe/aio-sdk')
const { createContext, runIncrementalSync } = require('../lib/exporter')

// Invoked every 15 minutes by the erp-export-schedule alarm rule
async function main (params) {
  const logger = Core.Logger('scheduled-export', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('Scheduled export started')
    const missing = ['COMMERCE_SANDBOX_ADMIN_URL', 'ERP_BASE_URL'].filter(p => !params[p])
    if (missing.length > 0) {
      return { statusCode: 400, body: { error: `Missing required params: ${missing.join(', ')}` } }
    }

    const ctx = await createContext(params, logger)
    const summary = await runIncrementalSync(ctx, { maxOrders: 200, trigger: 'schedule' })

    logger.info(`Scheduled export done: ${summary.exported} exported, ${summary.skipped} skipped, ${summary.failed} failed`)
    return { statusCode: 200, body: summary.lastRun }
  } catch (error) {
    logger.error('Action failed:', error.message)
    return { statusCode: 500, body: { error: error.message } }
  }
}

exports.main = main
