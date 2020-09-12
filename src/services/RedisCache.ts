import redis from 'redis'
import { EventEmitter } from 'events'
import { EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'
import { promisify } from 'util'

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

  getPayloadElementKey (payload: EnqueuePayloadType) {
    const { feed, article } = payload
    return `${this.prefix}${feed.channel}_${article._id}`
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer.
   */
  async enqueuePayload (payload: EnqueuePayloadType) {
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
  async dequeuePayload () {
    const lpop = promisify(this.client.lpop).bind(this.client)
    const dequeuedDataKey = await lpop(this.payloadProcessingQueueKey)
    if (!dequeuedDataKey) {
      return null
    }
    const payloadData = await new Promise<string|null>((resolve, reject) => {
      this.client.multi()
        .hget(this.payloadHashKey, dequeuedDataKey)
        .exec((err, results) => err ? reject(err) : resolve(results[0]))
    })
    if (!payloadData) {
      return null
    }
    return JSON.parse(payloadData)
  }

  /**
   * Complete a payload and purge its data from Redis.
   * This is called after a payload has finished processing.
   */
  async completePayload (payload: EnqueuePayloadType) {
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
