import { RESTHandler } from '@synzen/discord-rest'
import config from '../utils/config'
import log from '../utils/log'
import Payload from '../utils/Payload'
const handler = new RESTHandler()

handler.on('globalRateLimit', (apiRequest, durationMs) => {
  log.warn(`Global rate limit hit for ${apiRequest.toString()} (retry after ${durationMs}ms)`)
})

handler.on('rateLimit', (apiRequest, durationMs) => {
  log.warn(`Rate limit hit for ${apiRequest.toString()} (retry after ${durationMs})ms`)
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
