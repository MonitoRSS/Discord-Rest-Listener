import log from './utils/log'
import { delayQueueBy, enqueue, validatePayload } from './services/Queue'
import { DiscordRESTHandler } from './services/DiscordRequests'
import setup from './utils/setup'

setup().then(async ({redisCache, sock, orm}) => {
  // Handle incoming payloads
  for await (const [msg] of sock) {
    const payload = JSON.parse(msg.toString())
    if (validatePayload(payload)) {
      enqueue(payload, redisCache, orm)
        .catch((err) => {
          log.error(`Enqueue error (${err.message})`, {
            payload
          })
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
