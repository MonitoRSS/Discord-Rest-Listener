import { Pull } from 'zeromq'
import config from './utils/config'
import log from './utils/log'
import { delayQueueBy, enqueue, enqueueOldPayloads, validatePayload } from './services/Queue'
import RedisCache from './services/RedisCache'
import { DiscordRESTHandler } from './services/DiscordRequests'

const redisCache = new RedisCache(config.redis, config.redisPrefix)

async function createConsumer () {
  const sock = new Pull()
  await sock.connect(config.bindingAddress)
  return sock
}

async function connectToRedis () {
  return new Promise((resolve) => {
    redisCache.on('ready', resolve)
  })
}

log.info('Connecting to Redis')

// Connect to redis
connectToRedis().then(() => {
  log.info('Redis connection established')
  // Handle old payloads
  return enqueueOldPayloads(redisCache)
}).then(() => {
  // Start accepting new payloads
  return createConsumer()
}).then(async (sock) => {
  // Handle incoming payloads
  log.info(`Worker connected to ${config.bindingAddress}`)
  for await (const [msg] of sock) {
    const data = JSON.parse(msg.toString())
    if (validatePayload(data)) {
      enqueue(data, redisCache)
    }
  }
})
.catch((err) => {
  log.error(err)
})

// Delay the payload queue whenever a global rate limit is hit
DiscordRESTHandler.on('globalRateLimit', (_, blockedDurationMs) => {
  // Delay the queue by 2x the blocked duration from discord for safety
  delayQueueBy(blockedDurationMs * 2)
})
