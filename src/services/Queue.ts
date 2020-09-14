import { Response } from 'node-fetch'
import PQueue from 'p-queue'
import { EnqueuePayloadSchema, EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'
import log from '../utils/log'
import { executeFetch } from './DiscordRequests'
import RedisCache from './RedisCache'
let count = 0

// Maximum of 10 requests every 1 second
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

async function getBadResponseError (res: Response, payload: EnqueuePayloadType) {
  const { article, feed } = payload
  try {
    const json = await res.json()
    return new Error(`Bad status code ${res.status} for article ${article._id}, feed ${feed._id} (${JSON.stringify(json)})`)
  } catch (err) {
    return new Error(`Bad status code (${res.status})`)
  }
}

export async function enqueue (payload: EnqueuePayloadType, redisCache: RedisCache) {
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

export async function enqueueOldPayloads (redisCache: RedisCache) {
  const payloads = await redisCache.getEnqueuedPayloads()
  for (let i = 0; i < payloads.length; ++i) {
    const payload = payloads[i]
    enqueue(payload, redisCache)
  }
}

export function validatePayload (payload: EnqueuePayloadType) {
  const result = EnqueuePayloadSchema.safeParse(payload)
  if (result.success) {
    return true
  } else {
    log.error(`Invalid payload\n${JSON.stringify(payload, null, 2)}\n${result.error.message}`)
    return false
  }
}
