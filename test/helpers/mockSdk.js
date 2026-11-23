// In-memory stand-ins for @adobe/aio-sdk Core.Logger and State
const store = new Map()

const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }

const stateClient = {
  get: jest.fn(async key => (store.has(key) ? { value: store.get(key), expiration: null } : undefined)),
  put: jest.fn(async (key, value) => { store.set(key, value); return key }),
  delete: jest.fn(async key => store.delete(key))
}

module.exports = {
  Core: { Logger: jest.fn(() => logger) },
  State: { init: jest.fn(async () => stateClient) },
  __store: store,
  __logger: logger,
  __stateClient: stateClient
}
