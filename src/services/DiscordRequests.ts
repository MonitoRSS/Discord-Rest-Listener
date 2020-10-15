import { RESTHandler } from '@synzen/discord-rest'
import config from '../utils/config'
import log from '../utils/log'
import Payload from '../utils/Payload'
const handler = new RESTHandler({
  globalBlockDurationMultiple: 2
})
let count = 0
let maxCount = 0

/**
 * Log all the important events that might affect this service's performance
 */
handler.on('globalRateLimit', (apiRequest, durationMs) => {
  log.warn(`Global rate limit hit for ${apiRequest.toString()} (retry after ${durationMs}ms)`)
})

handler.on('rateLimit', (apiRequest, durationMs) => {
  log.warn(`Rate limit hit for ${apiRequest.toString()} (retry after ${durationMs})ms`)
})

handler.on('invalidRequestsThreshold', (threshold) => {
  log.warn(`${threshold} invalid requests reached, delaying all requests by 10 minutes`)
})

handler.on('longLivedRequest', (longLivedRequest) => {
  const { request } = longLivedRequest
  const finished = longLivedRequest.hasFinishedRequest()
  const bucketUnblockTime = longLivedRequest.getBucketUnblockTime()
  log.warn(`Detected long-lived request ${request.toString()}. Finished: ${finished}, bucket unblock time: ${bucketUnblockTime}`)
})

/**
 * Events used to track some stats
 */
handler.on('active', () => {
  if (count === 0) {
    log.info('Queue is active')
  }
  count++
  maxCount = Math.max(maxCount, count)
})

handler.on('idle', () => {
  log.info(`Queue finished all tasks (max length reached: ${maxCount})`)
  maxCount = 0
  count = 0
})


/**
 * Executes the Discord API request using payload details
 */
export function executeFetch(payload: Payload) {
  const { method, body, url } = payload.api
  return handler.fetch(url, {
    method,
    headers: {
      Authorization: `Bot ${config.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export const DiscordRESTHandler = handler
