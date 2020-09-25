import log from './utils/log'
import { enqueue, validatePayload } from './services/Queue'
import setup from './utils/setup'
import Payload from './utils/Payload'
let tenMinCount = 0

setup().then(async ({redisCache, sock, orm}) => {
  // Log the queue length and payloads received every 10 min
  setInterval(() => {
    log.info(`Number of payloads in the last 10 minutes: ${tenMinCount}`)
    tenMinCount = 0
    redisCache.getQueueLength().then((len) => {
      log.info(`Current queue length: ${len}`)
    }).catch(err => {
      log.error(`Failed to get queue length on interval (${err.message})`)
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
      log.warn(`Invalid rawPayload received`, {
        rawPayload
      })
    }
  }
}).catch(err => {
  log.error(err)
})

