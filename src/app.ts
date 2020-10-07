import log from './utils/log'
import { enqueue, validatePayload } from './services/Queue'
import setup from './utils/setup'
import Payload from './utils/Payload'
import RedisCache from './services/RedisCache'
import { MikroORM } from '@mikro-orm/core'
import { Pull } from 'zeromq'
let tenMinCount = 0

/**
 * Log the queue length and payloads received every 10 min
 */
function setupLogTimers (redisCache: RedisCache) {
  setInterval(() => {
    log.info(`Number of payloads in the last 10 minutes: ${tenMinCount}`)
    tenMinCount = 0
    redisCache.getQueueLength().then((len) => {
      log.info(`Current queue length: ${len}`)
    }).catch(err => {
      log.error(`Failed to get queue length on interval (${err.message})`)
    })
  }, 1000 * 60 * 10)
}


async function handleIncomingPayloads (orm: MikroORM, redisCache: RedisCache, sock: Pull) {
  for await (const [msg] of sock) {
    tenMinCount++
    const rawPayload = JSON.parse(msg.toString())
    // If it's an invalid payload, log and ignore
    if (!validatePayload(rawPayload)) {
      log.warn(`Invalid rawPayload received`, {
        rawPayload
      })
      continue
    }
    // Enqueue the payload
    const parsedPayload = new Payload(rawPayload)
    try {
      await enqueue(parsedPayload, redisCache, orm)
    } catch (err) {
      log.error(`Enqueue error (${err.message})`, {
        rawPayload
      })
    }
      
  }
}

setup().then((initializedData) => {
  const { orm, redisCache, sock } = initializedData
  setupLogTimers(redisCache)  
  // Handle incoming payloads
  handleIncomingPayloads(orm, redisCache, sock)
}).catch(err => {
  log.error(err)
})

