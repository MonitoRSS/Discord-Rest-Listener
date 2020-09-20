import log from './utils/log'
import { delayQueueBy, enqueue, validatePayload } from './services/Queue'
import { DiscordRESTHandler } from './services/DiscordRequests'
import setup from './utils/setup'
import Payload from './utils/Payload'

let tenMinCount = 0
setInterval(() => {
  log.info(`Number of payloads in the last 10 minutes: ${tenMinCount}`)
  tenMinCount = 0
}, 1000 * 60 * 10)

setup().then(async ({redisCache, sock, orm}) => {
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
  const delayDuration = blockedDurationMs * 2
  log.info(`Delaying queue by ${delayDuration}`)
  // Delay the queue by 2x the blocked duration from discord for safety
  delayQueueBy(delayDuration)
})
