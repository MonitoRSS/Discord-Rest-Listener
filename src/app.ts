import log from './utils/log'
import { delayQueueBy, enqueue, validatePayload } from './services/Queue'
import { DiscordRESTHandler } from './services/DiscordRequests'
import setup from './utils/setup'
import Payload from './utils/Payload'
let tenMinInvalidRequests = 0
let tenMinCount = 0

setup().then(async ({redisCache, sock, orm}) => {
  // Log the queue length and payloads received every 10 min
  setInterval(() => {
    log.info(`Number of payloads in the last 10 minutes: ${tenMinCount}`)
    tenMinInvalidRequests = 0
    tenMinCount = 0
    redisCache.getQueueLength().then((len) => {
      log.info(`Current queue length: ${len}`)
    }).catch(err => {
      log.warn(`Failed to get queue length on interval (${err.message})`)
    })
  }, 1000 * 60 * 10)

  // Handle incoming payloads
  for await (const [msg] of sock) {
    tenMinCount++
    const rawPayload = JSON.parse(msg.toString())
    if (validatePayload(rawPayload)) {
      const parsedPayload = new Payload(rawPayload)
      enqueue(parsedPayload, redisCache, orm)
        .catch((err) => {
          log.error(`Enqueue error (${err.message})`, {
            rawPayload
          })
        })
    } else {
      log.error(`Invalid rawPayload received`, {
        rawPayload
      })
    }
  }
}).catch(err => {
  log.error(err)
})

// Delay the payload queue whenever a global rate limit is hit
DiscordRESTHandler.on('globalRateLimit', (_, blockedDurationMs) => {
  // Delay the queue by 2x the blocked duration from discord for safety
  const delayDuration = blockedDurationMs * 2
  delayQueueBy(delayDuration)
})

DiscordRESTHandler.on('invalidRequest', () => {
  if (tenMinInvalidRequests++ >= 5000) {
    log.info(`${tenMinInvalidRequests} invalid requests reached`)
    // Halfway to a temporary ban - delay everything by 10 minutes
    delayQueueBy(1000 * 60 * 10)
  }
})
