import { MikroORM } from '@mikro-orm/core'
import { Response } from 'node-fetch'
import { RawPayloadSchema, RawPayloadType } from '../schemas/RawPayload'
import config from '../utils/config'
import log from '../utils/log'
import PayloadInterface from '../types/PayloadInterface'
import { executeFetch } from './DiscordRequests'
import RedisCache from './RedisCache'

/**
 * Parse a node-fetch non-200-status-code response for the
 * relevant error. This is usually the error Discord returns
 * from the API, otherwise it's a generic bad status code
 */
async function getBadResponseError (res: Response, payload: PayloadInterface) {
  const { article, feed } = payload.data
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
export async function enqueue (payload: PayloadInterface, redisCache: RedisCache, orm: MikroORM, old = false) {
  if (!old) {
    await redisCache.enqueuePayload(payload)
  }
  let res: Response
  // Only handle fetch errors here. Other errors should be handled in calling function.
  try {
    res = await executeFetch(payload)
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
    return res
  }
  const error = await getBadResponseError(res, payload)
  await payload.recordFailure(orm, error.message)
  log.warn(`Failed to send payload (${error.message})`, {
    payload
  })
}

/**
 * Remove all payloads in the queue that are missing their associated JSON data
 */
export async function purgePayloads (redisCache: RedisCache) {
  const invalidsDeleted = await redisCache.purgeInvalidPayloadKeys()
  return invalidsDeleted
}

/**
 * Gets all the current payloads in the queue and enqueues them. This should NOT be run while
 * the REST Handler is active, otherwise duplicate payloads will be enqueued in memory
 */
export async function enqueueOldPayloads (redisCache: RedisCache, orm: MikroORM) {
  const payloads = await redisCache.getEnqueuedPayloads()
  for (let i = 0; i < payloads.length; ++i) {
    const payload = payloads[i]
    enqueue(payload, redisCache, orm, true)
  }
  return payloads.length
}

/**
 * Get all cached payloads from Redis and enqueue them. There
 * will be cached payloads if the service shuts down unexpectedly.
 */
export async function purgeAndEnqueueOldPayloads (redisCache: RedisCache, orm: MikroORM) {
  const invalidsDeleted = await purgePayloads(redisCache)
  log.info(`Deleted ${invalidsDeleted} invalid payloads`)
  const enqueued = await enqueueOldPayloads(redisCache, orm)
  log.info(`Enqueuing ${enqueued} previously stored payloads`)
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
