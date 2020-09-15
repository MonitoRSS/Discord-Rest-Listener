import log from './utils/log'
import { delayQueueBy, enqueue, validatePayload } from './services/Queue'
import { DiscordRESTHandler } from './services/DiscordRequests'
import setup from './utils/setup'

setup().then(async ({redisCache, sock}) => {
  // Handle incoming payloads
  for await (const [msg] of sock) {
    const data = JSON.parse(msg.toString())
    if (validatePayload(data)) {
      enqueue(data, redisCache)
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
