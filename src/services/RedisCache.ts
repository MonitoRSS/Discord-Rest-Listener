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

  get payloadProcessingQueueKey () {
    return `${this.prefix}payload_processing_queue`
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
      multi.exec((err, data) => err ? reject(err) : resolve(data))
    })
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer.
   */
  async enqueuePayload (payload: Payload) {
    const data = JSON.stringify(payload)
    const dataKey = this.getPayloadElementKey(payload)
    await new Promise((resolve, reject) => {
      this.client.multi()
        .hset(this.payloadHashKey, dataKey, data)
        .rpush(this.payloadQueueKey, dataKey)
        .rpush(this.payloadProcessingQueueKey, dataKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  }

  /**
   * Dequeue and return a payload from the processing queue.
   * Don't delete the hash until the payload is completed
   */
  async dequeuePayloads (count = 1) {
    // Get payload keys
    const poppedPayloadKeys = await new Promise<string[]>((resolve, reject) => {
      const popMulti = this.client.multi()
      for (let i = 0; i < count; ++i) {
        popMulti.lpop(this.payloadProcessingQueueKey)
      }
      popMulti.exec((err, results) => err ? reject(err) : resolve(results))
    })
    const filteredKeys = poppedPayloadKeys.filter((key) => key)
    // Get the data associated with each payload key
    const payloadData = await new Promise<string[]>((resolve, reject) => {
      const multi = this.client.multi()
      for (let i = 0; i < filteredKeys.length; ++i) {
        multi.hget(this.payloadHashKey, filteredKeys[i])
      }
      multi.exec((err, results) => err ? reject(err) : resolve(results))
    })
    // Convert the data to JSON
    const filteredPaylods = payloadData
      .filter((str) => str)
      .map((data) => JSON.parse(data))
    return filteredPaylods
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
