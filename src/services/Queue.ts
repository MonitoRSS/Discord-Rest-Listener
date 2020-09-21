import { MikroORM } from '@mikro-orm/core'
import { Response } from 'node-fetch'
import PQueue from 'p-queue'
import { RawPayloadSchema, RawPayloadType } from '../schemas/RawPayload'
import config from '../utils/config'
import ExtendableTimer from '../utils/ExtendableTimer'
import log from '../utils/log'
import Payload from '../utils/Payload'
import { executeFetch } from './DiscordRequests'
import RedisCache from './RedisCache'
let count = 0
let maxCount = 0
const startTimer: ExtendableTimer = new ExtendableTimer(() => {
  log.info('Restarting queue')
  discordQueue.start()
})

/**
 * Parse and execute 10 payloads every 1 second.
 * This is fine as long as the queue is paused whenever a
 * global rate limit is hit
 */
export const discordQueue = new PQueue({
  interval: 1000,
  intervalCap: 15
})

discordQueue.on('active', () => {
  if (count === 0) {
    log.info('Queue is active')
  }
  count++
  maxCount = Math.max(maxCount, count)
})

discordQueue.on('idle', () => {
  log.info(`Queue finished all tasks (max length reached: ${maxCount})`)
  maxCount = 0
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
export async function enqueue (payload: Payload, redisCache: RedisCache, orm: MikroORM) {
  await redisCache.enqueuePayload(payload)
  let res: Response
  // Only handle fetch errors here. Other errors should be handled in calling function.
  try {
    res = await discordQueue.add(() => executeFetch(payload))
  } catch (err) {
    const errorMessage = `Fetch error (${err.message})`
    log.error(errorMessage, {
      payload
    })
    await payload.recordFailure(orm, errorMessage)
    return
  } finally {
    await redisCache.completePayload(payload)
  }
  
  if (res.ok) {
    await payload.recordSuccess(orm)
    return
  }
  const error = await getBadResponseError(res, payload)
  await payload.recordFailure(orm, error.message)
  log.warn(`Failed to send payload (${error.message})`, {
    payload
  })
}

/**
 * Get all cached payloads from Redis and enqueue them. There
 * will be cached payloads if the service shuts down unexpectedly
 */
export async function enqueueOldPayloads (redisCache: RedisCache, orm: MikroORM) {
  const payloads = await redisCache.getEnqueuedPayloads()
  log.info(`Enqueuing ${payloads.length} previously stored payloads`)
  for (let i = 0; i < payloads.length; ++i) {
    const payload = payloads[i]
    enqueue(payload, redisCache, orm)
  }
}

/**
 * Check if a payload is formatted correctly
 */
export function validatePayload (rawPayload: RawPayloadType) {
  const result = RawPayloadSchema.safeParse(rawPayload)
  if (result.success) {
    return rawPayload.token === config.token
  } else {
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
