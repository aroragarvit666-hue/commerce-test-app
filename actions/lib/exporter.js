// Shared export core used by the manual (export-orders) and scheduled (scheduled-export) actions.
const { State } = require('@adobe/aio-sdk')
const { getCommerceAuth, searchOrders, getOrder, addOrderComment } = require('./commerce')
const { sendOrderToErp } = require('./erp')
const { mapOrder } = require('./mapper')

// aio-lib-state keys allow [a-zA-Z0-9-_.] only; max TTL is 365 days
const TTL = 365 * 24 * 60 * 60
const KEYS = {
  cursor: 'sync.cursor',
  lastRun: 'sync.lastrun',
  stats: 'export.stats',
  failures: 'export.failures',
  order: entityId => `order.${entityId}`
}
const MAX_FAILURES = 200
const PAGE_SIZE = 50

async function getJson (state, key, fallback = null) {
  const res = await state.get(key)
  if (!res || res.value == null) return fallback
  try { return JSON.parse(res.value) } catch (_) { return fallback }
}

function putJson (state, key, value) {
  return state.put(key, JSON.stringify(value), { ttl: TTL })
}

function getStatuses (params) {
  return (params.ORDER_STATUSES || 'processing').split(',').map(s => s.trim()).filter(Boolean)
}

// ISO / Date -> Commerce "YYYY-MM-DD HH:mm:ss" (UTC)
function toCommerceDate (d) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19)
}

function initialCursor (params) {
  if (params.SYNC_START_DATE && !isNaN(Date.parse(params.SYNC_START_DATE))) return toCommerceDate(params.SYNC_START_DATE)
  return toCommerceDate(Date.now() - 24 * 60 * 60 * 1000)
}

async function getOrderRecord (state, entityId) {
  return getJson(state, KEYS.order(entityId))
}

async function updateFailures (state, entityId, failure) {
  const failures = await getJson(state, KEYS.failures, {})
  if (failure) {
    failures[entityId] = failure
    const ids = Object.keys(failures)
    if (ids.length > MAX_FAILURES) {
      ids.sort((a, b) => failures[a].at.localeCompare(failures[b].at))
      ids.slice(0, ids.length - MAX_FAILURES).forEach(id => delete failures[id])
    }
  } else if (failures[entityId]) {
    delete failures[entityId]
  } else {
    return
  }
  await putJson(state, KEYS.failures, failures)
}

async function bumpStats (state, field) {
  const stats = await getJson(state, KEYS.stats, { exported: 0, failedAttempts: 0 })
  stats[field] = (stats[field] || 0) + 1
  await putJson(state, KEYS.stats, stats)
}

// Exports one order. Never throws for ERP failures — returns a result object instead.
async function exportOrder (ctx, order, { force = false } = {}) {
  const { params, token, state, logger } = ctx
  const entityId = String(order.entity_id)
  const incrementId = order.increment_id

  const existing = await getOrderRecord(state, entityId)
  if (existing?.status === 'exported' && !force) {
    return { entityId, incrementId, result: 'skipped', reason: 'already exported' }
  }

  const attempts = (existing?.attempts || 0) + 1
  try {
    const payload = mapOrder(order)
    const { erpReference } = await sendOrderToErp(params, payload)
    const record = { status: 'exported', incrementId, erpReference, exportedAt: new Date().toISOString(), attempts }
    await putJson(state, KEYS.order(entityId), record)
    await updateFailures(state, entityId, null)
    await bumpStats(state, 'exported')

    try {
      await addOrderComment(params, token, entityId, `Exported to ERP${erpReference ? ` (ref ${erpReference})` : ''}`)
    } catch (e) {
      // The export itself succeeded; a failed comment must not mark it as failed
      logger.warn(`Order ${incrementId}: exported but could not add comment: ${e.message}`)
    }

    logger.info(`Order ${incrementId} exported (ERP ref: ${erpReference || 'n/a'})`)
    return { entityId, incrementId, result: 'exported', erpReference }
  } catch (e) {
    const at = new Date().toISOString()
    logger.error(`Order ${incrementId} export failed: ${e.message}`)
    await putJson(state, KEYS.order(entityId), { status: 'failed', incrementId, error: e.message, failedAt: at, attempts })
    await updateFailures(state, entityId, { incrementId, error: e.message, at, attempts })
    await bumpStats(state, 'failedAttempts')
    return { entityId, incrementId, result: 'failed', error: e.message }
  }
}

function summarize (results) {
  return {
    exported: results.filter(r => r.result === 'exported').length,
    skipped: results.filter(r => r.result === 'skipped').length,
    failed: results.filter(r => r.result === 'failed').length,
    results
  }
}

// Manual export of specific Commerce order entity ids
async function exportOrdersByIds (ctx, entityIds, { force = false } = {}) {
  const results = []
  for (const id of entityIds) {
    let order
    try {
      order = await getOrder(ctx.params, ctx.token, id)
    } catch (e) {
      ctx.logger.error(`Could not load order ${id}: ${e.message}`)
      results.push({ entityId: String(id), result: 'failed', error: `Could not load order: ${e.message}` })
      continue
    }
    results.push(await exportOrder(ctx, order, { force }))
  }
  return summarize(results)
}

// Incremental sync: eligible orders updated since the cursor, then a retry pass over failures.
async function runIncrementalSync (ctx, { maxOrders = 200, trigger = 'schedule' } = {}) {
  const { params, token, state, logger } = ctx
  const startedAt = new Date().toISOString()
  const cursor = (await getJson(state, KEYS.cursor)) || initialCursor(params)
  const statuses = getStatuses(params)
  logger.info(`Sync from cursor ${cursor}, statuses: ${statuses.join(',')}`)

  const results = []
  let newCursor = cursor
  let page = 1
  let done = false
  while (!done && results.length < maxOrders) {
    const data = await searchOrders(params, token, {
      filterGroups: [
        // gteq + de-duplication avoids missing orders sharing the cursor's second
        [{ field: 'updated_at', value: cursor, conditionType: 'gteq' }],
        [{ field: 'status', value: statuses.join(','), conditionType: 'in' }]
      ],
      sortOrders: [{ field: 'updated_at', direction: 'ASC' }],
      pageSize: PAGE_SIZE,
      currentPage: page
    })
    const items = data.items || []
    for (const order of items) {
      if (results.length >= maxOrders) { done = true; break }
      results.push(await exportOrder(ctx, order))
      if (order.updated_at && order.updated_at > newCursor) newCursor = order.updated_at
    }
    if (items.length < PAGE_SIZE || page * PAGE_SIZE >= (data.total_count || 0)) done = true
    page++
  }

  // Retry earlier failures not already attempted in this run
  const attempted = new Set(results.map(r => r.entityId))
  const failures = await getJson(state, KEYS.failures, {})
  const retryIds = Object.keys(failures).filter(id => !attempted.has(id)).slice(0, 20)
  const retried = retryIds.length ? (await exportOrdersByIds(ctx, retryIds)).results : []

  await putJson(state, KEYS.cursor, newCursor)
  const summary = summarize([...results, ...retried])
  const lastRun = {
    trigger,
    startedAt,
    finishedAt: new Date().toISOString(),
    cursorFrom: cursor,
    cursorTo: newCursor,
    exported: summary.exported,
    skipped: summary.skipped,
    failed: summary.failed,
    retried: retried.length
  }
  await putJson(state, KEYS.lastRun, lastRun)
  return { ...summary, lastRun }
}

async function getStatus (state) {
  const [cursor, lastRun, stats, failures] = await Promise.all([
    getJson(state, KEYS.cursor),
    getJson(state, KEYS.lastRun),
    getJson(state, KEYS.stats, { exported: 0, failedAttempts: 0 }),
    getJson(state, KEYS.failures, {})
  ])
  const failureList = Object.entries(failures)
    .map(([entityId, f]) => ({ entityId, ...f }))
    .sort((a, b) => b.at.localeCompare(a.at))
  return { cursor, lastRun, stats, failures: failureList }
}

async function createContext (params, logger) {
  const [state, auth] = await Promise.all([State.init(), getCommerceAuth(params)])
  return { params: auth.params, token: auth.token, state, logger }
}

module.exports = {
  KEYS,
  toCommerceDate,
  getStatuses,
  getOrderRecord,
  exportOrder,
  exportOrdersByIds,
  runIncrementalSync,
  getStatus,
  createContext
}
