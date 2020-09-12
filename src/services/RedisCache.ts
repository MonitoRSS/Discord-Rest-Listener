import redis from 'redis'
import config from '../utils/config'
import { EventEmitter } from 'events'
import { EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'
import { promisify } from 'util'

class RedisCache extends EventEmitter {
  client: redis.RedisClient
  static prefix = config.redisPrefix

  constructor () {
    super()
    this.client = redis.createClient(config.redis)
    this.client.once('ready', () => {
      this.emit('ready')
    })
  }

  static get payloadHashKey () {
    return `${this.prefix}payload_data`
  }

  static get payloadQueueKey () {
    return `${this.prefix}payload_queue`
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer
   */
  async enqueuePayload (payload: EnqueuePayloadType) {
    const { article, feed } = payload
    const data = JSON.stringify(payload)
    const dataKey = `${RedisCache.prefix}${feed.channel}_${article._id}`
    await new Promise((resolve, reject) => {
      this.client.multi()
        .hset(RedisCache.payloadHashKey, dataKey, data)
        .rpush(RedisCache.payloadQueueKey, dataKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  }

  /**
   * Dequeue and return a payload
   */
  async dequeuePayload () {
    const lpop = promisify(this.client.lpop).bind(this.client)
    const dequeuedDataKey = await lpop(RedisCache.payloadQueueKey)
    if (!dequeuedDataKey) {
      return null
    }
    const payloadData = await new Promise<string|null>((resolve, reject) => {
      this.client.multi()
        .hget(RedisCache.payloadHashKey, dequeuedDataKey)
        .hdel(RedisCache.payloadHashKey, dequeuedDataKey)
        .exec((err, results) => err ? reject(err) : resolve(results[0]))
    })
    if (!payloadData) {
      return null
    }
    return JSON.parse(payloadData)
  }
}

export default RedisCache
