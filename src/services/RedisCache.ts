import redis from 'redis'
import { EventEmitter } from 'events'
import { promisify } from 'util'
import log from '../utils/log'
import PayloadInterface from '../types/PayloadInterface'
import PayloadMessage from '../payloads/PayloadMessage'

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

  getPayloadElementKey (payload: PayloadInterface) {
    const { feed, article } = payload.data
    return `${this.prefix}${feed.channel}_${article._id}`
  }

  /**
   * Get the keys of every enqueued payloads
   */
  async getEnqueuedPayloadKeys () {
    const lrange = promisify(this.client.lrange).bind(this.client)
    const keys = await lrange(this.payloadQueueKey, 0, -1)
    // Reverse the order since lrange returns it reversed from 0 to -1
    return keys
  }

  /**
   * Get all payload keys whose JSON strings do not exist
   */
  async getInvalidPayloadKeys () {
    const keys = await this.getEnqueuedPayloadKeys()
    const multi = this.client.multi()
    // Reverse order since 0 to -1 is reversed
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      multi.hget(this.payloadHashKey, key)
    }
    return new Promise<string[]>((resolve, reject) => {
      const invalidKeys: string[] = []
      multi.exec((err, payloadStrings: string[]) => {
        if (err) {
          reject(err)
          return
        }
        for (let i = 0; i < payloadStrings.length; ++i) {
          // The order of the keys are in reverse
          const payloadKey = keys[i]
          const payloadJSONString = payloadStrings[i]
          if (!payloadJSONString) {
            invalidKeys.push(payloadKey)
          }
        }
        resolve(invalidKeys)
      })
    })
  }

  /**
   * Delete data associated with all invalid payload keys
   * @returns Number of deleted payloads
   */
  async purgeInvalidPayloadKeys () {
    const keys = await this.getInvalidPayloadKeys()
    const multi = this.client.multi()
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      multi
        .lrem(this.payloadQueueKey, 1, key)
        .hdel(this.payloadHashKey, key)
    }
    return new Promise((resolve, reject) => {
      multi.exec((err) => err ? reject(err) : resolve(keys.length))
    })
  }

  /**
   * Get all payloads that are still enqueud
   */
  async getEnqueuedPayloads () {
    const keys = await this.getEnqueuedPayloadKeys()
    const multi = this.client.multi()
    // Reverse order since 0 to -1 is reversed
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      multi.hget(this.payloadHashKey, key)
    }
    return new Promise<PayloadInterface[]>((resolve, reject) => {
      multi.exec((err, payloadStrings: string[]) => {
        if (err) {
          reject(err)
          return
        }
        const validPayloads = payloadStrings.filter(str => str)
        if (validPayloads.length !== payloadStrings.length) {
          const invalidCount = payloadStrings.length - validPayloads.length
          log.warn(`${invalidCount} invalid payload found while getting enqueued payloads`)
        }
        const parsedPayloads = validPayloads
          .map(str => new PayloadMessage(JSON.parse(str)))
        resolve(parsedPayloads)
      })
    })
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer.
   */
  async enqueuePayload (payload: PayloadInterface) {
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
  async completePayload (payload: PayloadInterface) {
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
