import log from './utils/log'
import { delayQueueBy, enqueue, validatePayload } from './services/Queue'
import { DiscordRESTHandler } from './services/DiscordRequests'
import setup from './utils/setup'
import Payload from './utils/Payload'

setup().then(async ({redisCache, sock, orm}) => {
  // Handle incoming payloads
  for await (const [msg] of sock) {
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
  delayQueueBy(blockedDurationMs * 2)
})
