import { RESTHandler } from '@synzen/discord-rest'
import { EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'
import config from '../utils/config'
import log from '../utils/log'
const handler = new RESTHandler()

handler.on('globalRateLimit', (apiRequest, durationMs) => {
  log.error(`Global rate limit hit for ${apiRequest.toString()} (retry after ${durationMs}ms)`)
})

handler.on('rateLimit', (apiRequest, durationMs) => {
  log.error(`Rate limit hit for ${apiRequest.toString()} (retry after ${durationMs})ms`)
})

export function executeFetch(payload: EnqueuePayloadType) {
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
