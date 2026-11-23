const { Core } = require('@adobe/aio-sdk')
const { createContext, exportOrdersByIds, runIncrementalSync } = require('../lib/exporter')

const MAX_IDS = 50

async function main (params) {
  const logger = Core.Logger('export-orders', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('Action invoked')

    const isSync = params.mode === 'sync'
    const ids = params.orderIds
    if (!isSync && !(Array.isArray(ids) && ids.length > 0)) {
      return { statusCode: 400, body: { error: 'Missing required params: provide orderIds (non-empty array) or mode: "sync"' } }
    }
    if (!isSync && ids.length > MAX_IDS) {
      return { statusCode: 400, body: { error: `Too many orderIds: max ${MAX_IDS} per request` } }
    }
    if (!isSync && ids.some(id => !/^\d+$/.test(String(id)))) {
      return { statusCode: 400, body: { error: 'Invalid orderIds: each must be a numeric Commerce order entity id' } }
    }

    const ctx = await createContext(params, logger)
    const summary = isSync
      ? await runIncrementalSync(ctx, { maxOrders: 100, trigger: 'manual' })
      : await exportOrdersByIds(ctx, ids.map(String), { force: params.force === true })

    logger.info(`Export done: ${summary.exported} exported, ${summary.skipped} skipped, ${summary.failed} failed`)
    return { statusCode: 200, body: summary }
  } catch (error) {
    logger.error('Action failed:', error.message)
    return { statusCode: 500, body: { error: error.message } }
  }
}

exports.main = main
