import log from './utils/log'
import { enqueue, validatePayload } from './services/Queue'
import setup from './utils/setup'
import RedisCache from './services/RedisCache'
import { MikroORM } from '@mikro-orm/core'
import { Pull } from 'zeromq'
import PayloadMessage from './payloads/PayloadMessage'
import createPostActionPayloads from './utils/createPostActionPayloads'
import { RawPayloadType } from './schemas/RawPayload'
import { Response } from 'node-fetch'
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

async function handlePostActions (orm: MikroORM, redisCache: RedisCache, rawPayload: RawPayloadType, res: Response) {
  try {
    const payloads = await createPostActionPayloads(rawPayload, res)
    const results = await Promise.allSettled(payloads.map(p => enqueue(p, redisCache, orm)))
    results.forEach(result => {
      if (result.status === 'rejected') {
        log.error(`Failed to enqueue post action (${result.reason})`, {
          rawPayload,
        })
      }
    })
  } catch (err) {
    log.error(`Failed to create post action payloads (${err.message})`)
  }
}

async function handleIncomingPayloads (orm: MikroORM, redisCache: RedisCache, sock: Pull) {
  for await (const [msg] of sock) {
    tenMinCount++
    const rawPayload: RawPayloadType = JSON.parse(msg.toString())
    // If it's an invalid payload, log and ignore
    if (!validatePayload(rawPayload)) {
      log.warn(`Invalid rawPayload received`, {
        rawPayload
      })
      continue
    }
    // Enqueue the payload
    const parsedPayload = new PayloadMessage(rawPayload)
    enqueue(parsedPayload, redisCache, orm)
      .then((res) => {
        if (res) {
          handlePostActions(orm, redisCache, rawPayload, res)
        }
      })
      .catch((err) => {
        log.error(`Enqueue error (${err.message})`, {
          rawPayload
        })
      })
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

