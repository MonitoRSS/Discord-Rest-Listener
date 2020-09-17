import { Response } from 'node-fetch'
import PQueue from 'p-queue'
import { RawPayloadSchema, RawPayloadType } from '../schemas/RawPayload'
import ExtendableTimer from '../utils/ExtendableTimer'
import log from '../utils/log'
import Payload from '../utils/Payload'
import { executeFetch } from './DiscordRequests'
import RedisCache from './RedisCache'
let count = 0
const startTimer: ExtendableTimer = new ExtendableTimer(() => discordQueue.start())

/**
 * Parse and execute 10 payloads every 1 second.
 * This is fine as long as the queue is paused whenever a
 * global rate limit is hit
 */
const discordQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
})

discordQueue.on('active', () => {
  if (count === 0) {
    log.info('Queue is active')
  }
  count++
})

discordQueue.on('idle', () => {
  log.info('Queue finished all tasks')
  count = 0
})

/**
 * Parse a node-fetch non-200-status-code response for the
 * relevant error. This is usually the error Discord returns
 * from the API, otherwise it's a generic bad status code
 */
async function getBadResponseError (res: Response, payload: Payload) {
  const { article, feed } = payload
  try {
    const json = await res.json()
    return new Error(`Bad status code ${res.status} for article ${article._id}, feed ${feed._id} (${JSON.stringify(json)})`)
  } catch (err) {
    return new Error(`Bad status code (${res.status})`)
  }
}

/**
 * Enqueue a payload to be later parsed for the Discord API request
 * to be sent
 */
export async function enqueue (payload: Payload, redisCache: RedisCache) {
  try {
    await redisCache.enqueuePayload(payload)
    const res = await discordQueue.add(() => executeFetch(payload))
    await redisCache.completePayload(payload)
    if (res.ok) {
      return
    }
    const error = await getBadResponseError(res, payload)
    log.error(error.message)
  } catch (err) {
    // Network error, put it in the service backlog
    log.error(`Network error (${err.message})`)
  }
}

/**
 * Get all cached payloads from Redis and enqueue them. There
 * will be cached payloads if the service shuts down unexpectedly
 */
export async function enqueueOldPayloads (redisCache: RedisCache) {
  const payloads = await redisCache.getEnqueuedPayloads()
  for (let i = 0; i < payloads.length; ++i) {
    const payload = payloads[i]
    enqueue(payload, redisCache)
  }
}

/**
 * Check if a payload is formatted correctly
 */
export function validatePayload (rawPayload: RawPayloadType) {
  const result = RawPayloadSchema.safeParse(rawPayload)
  if (result.success) {
    return true
  } else {
    log.error(`Invalid rawPayload (${result.error.message})`, {
      rawPayload
    })
    return false
  }
}

/**
 * Blocks all pending API requests by a duration. If there
 * is already a block, it's reset with the time passed in
 */
export function delayQueueBy (time: number) {
  discordQueue.pause()
  startTimer.resetWith(time)
}
