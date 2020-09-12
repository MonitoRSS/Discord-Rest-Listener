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

  get payloadQueueKey () {
    return `${this.prefix}payload_queue`
  }

  /**
   * Enqueue a payload within redis to be later dequeued
   * on a timer
   */
  async enqueuePayload (payload: EnqueuePayloadType) {
    const { article, feed } = payload
    const data = JSON.stringify(payload)
    const dataKey = `${this.prefix}${feed.channel}_${article._id}`
    await new Promise((resolve, reject) => {
      this.client.multi()
        .hset(this.payloadHashKey, dataKey, data)
        .rpush(this.payloadQueueKey, dataKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  }

  /**
   * Dequeue and return a payload
   */
  async dequeuePayload () {
    const lpop = promisify(this.client.lpop).bind(this.client)
    const dequeuedDataKey = await lpop(this.payloadQueueKey)
    if (!dequeuedDataKey) {
      return null
    }
    const payloadData = await new Promise<string|null>((resolve, reject) => {
      this.client.multi()
        .hget(this.payloadHashKey, dequeuedDataKey)
        .hdel(this.payloadHashKey, dequeuedDataKey)
        .exec((err, results) => err ? reject(err) : resolve(results[0]))
    })
    if (!payloadData) {
      return null
    }
    return JSON.parse(payloadData)
  }
}

export default RedisCache
