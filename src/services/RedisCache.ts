import redis from 'redis'
import { EventEmitter } from 'events'
import { promisify } from 'util'
import log from '../utils/log'
import Payload from '../utils/Payload'

class RedisCache extends EventEmitter {
  client: redis.RedisClient
  prefix: string
  constructor (uri: string, prefix: string) {
    super()
    this.prefix = prefix
    this.client = redis.createClient(uri)
    this.client.once('ready', () => {
      this.emit('ready')
    })
    this.client.on('error', (err) => {
      log.error(err)
    })
  }

  get payloadHashKey () {
    return `${this.prefix}payload_data`
  }

  get payloadQueueKey () {
    return `${this.prefix}payload_queue`
  }

  getPayloadElementKey (payload: Payload) {
    const { feed, article } = payload
    return `${this.prefix}${feed.channel}_${article._id}`
  }

  /**
   * Get all payloads that are still enqueud
   */
  async getEnqueuedPayloads () {
    const lrange = promisify(this.client.lrange).bind(this.client)
    const keys = await lrange(this.payloadQueueKey, 0, -1)
    const multi = this.client.multi()
    // Reverse order since 0 to -1 is reversed
    for (let i = keys.length - 1; i >= 0; --i) {
      const key = keys[i]
      multi.hget(this.payloadHashKey, key)
    }
    return new Promise<Payload[]>((resolve, reject) => {
      multi.exec((err, payloadStrings: string[]) => {
        if (err) {
          reject(err)
          return
        }
        const parsedPayloads = payloadStrings
          .map(str => new Payload(JSON.parse(str)))
        resolve(parsedPayloads)
      })
    })
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer.
   */
  async enqueuePayload (payload: Payload) {
    const dataKey = this.getPayloadElementKey(payload)
    const data = JSON.stringify(payload.toJSON())
    await new Promise((resolve, reject) => {
      this.client.multi()
        .hset(this.payloadHashKey, dataKey, data)
        .rpush(this.payloadQueueKey, dataKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  }

  /**
   * Get the number of pending payloads that are waiting to
   * be processed
   */
  async getQueueLength () {
    const llen = promisify(this.client.llen).bind(this.client)
    return llen(this.payloadQueueKey)
  }

  /**
   * Complete a payload and purge its data from Redis.
   * This is called after a payload has finished processing.
   */
  async completePayload (payload: Payload) {
    const dataKey = this.getPayloadElementKey(payload)
    await new Promise<string|null>((resolve, reject) => {
      this.client.multi()
        .hdel(this.payloadHashKey, dataKey)
        .lrem(this.payloadQueueKey, 1, dataKey)
        .exec((err, results) => err ? reject(err) : resolve(results[0]))
    })
  }
}

export default RedisCache
