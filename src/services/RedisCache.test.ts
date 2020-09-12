import RedisCache from './RedisCache'
import {promisify} from 'util'
import { EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'
import config from '../utils/config'

jest.useFakeTimers()

describe('RedisCache', () => {
  const cache = new RedisCache(config.redis, config.redisPrefix)
  const payload: EnqueuePayloadType = {
    article: {
      _id: 'articleid1'
    },
    feed: {
      channel: 'channelid',
      _id: 'feedid',
      url: 'feedurl'
    },
    api: {
      method: 'a',
      url: 'b',
    }
  }
  const payloadJSON = JSON.stringify(payload)
  const payloadKey = cache.getPayloadElementKey(payload)
  const lindex = promisify(cache.client.lindex).bind(cache.client)
  const hget = promisify(cache.client.hget).bind(cache.client)
  beforeAll(() => {
    return new Promise((resolve) => {
      cache.once('ready', resolve)
    })
  })
  afterEach(async () => {
    await new Promise((resolve, reject) => {
      cache.client.multi()
        .del(cache.payloadHashKey)
        .del(cache.payloadQueueKey)
        .del(cache.payloadProcessingQueueKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  })
  describe('enqueuePayload', () => {
    it('works', async () => {
      await cache.enqueuePayload(payload)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(payloadKey)
      await expect(lindex(cache.payloadProcessingQueueKey, 0)).resolves
        .toEqual(payloadKey)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(JSON.stringify(payload))
    })
  })
  describe('dequeuePayload', () => {
    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, payloadKey)
          .rpush(cache.payloadProcessingQueueKey, payloadKey)
          .exec((err) => err ? reject(err) : resolve())
      })
    })
    it('returns the dequeued item', async () => {
      const dequeued = await cache.dequeuePayload()
      expect(JSON.stringify(dequeued)).toEqual(payloadJSON)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(payloadJSON)
      await expect(cache.dequeuePayload()).resolves
        .toEqual(null)
    })
    it('does not delete the hash', async () => {
      const dequeued = await cache.dequeuePayload()
      expect(JSON.stringify(dequeued)).toEqual(payloadJSON)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(payloadJSON)
    })
    it('only dequeues from the processing queue', async () => {
      const dequeued = await cache.dequeuePayload()
      expect(JSON.stringify(dequeued)).toEqual(payloadJSON)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(payloadKey)
      await expect(lindex(cache.payloadProcessingQueueKey, 0)).resolves
        .toEqual(null)
    })
  })
  describe('completePayload', async () => {
    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, payloadKey)
          .exec((err) => err ? reject(err) : resolve())
      })
    })
    it('removes the hash and queue item', async () => {
      await cache.completePayload(payload)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(null)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(null)
    })
  })
})
