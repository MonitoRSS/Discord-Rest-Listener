import { Pull } from 'zeromq'
import config from './utils/config'
import log from './utils/log'
import { enqueue, validatePayload } from './services/Queue'
import RedisCache from './services/RedisCache'

const redisCache = new RedisCache()

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

connectToRedis().then(() => {
  log.info('Redis connection established')
  return createConsumer()
}).then(async (sock) => {
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
