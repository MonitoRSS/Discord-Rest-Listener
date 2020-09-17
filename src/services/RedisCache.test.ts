import RedisCache from './RedisCache'
import {promisify} from 'util'
import config from '../utils/config'
import Payload from '../utils/Payload'

jest.useFakeTimers()

describe('RedisCache', () => {
  const cache = new RedisCache(config.redis, config.redisPrefix)
  const payload = new Payload({
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
  })
  const payloadJSON = JSON.stringify(payload)
  const payloadKey = cache.getPayloadElementKey(payload)
  const lindex = promisify(cache.client.lindex).bind(cache.client)
  const hget = promisify(cache.client.hget).bind(cache.client)
  beforeAll(() => {
    return new Promise((resolve) => {
      cache.once('ready', resolve)
    })
  })
  afterAll(async () => {
    await new Promise((resolve, reject) => {
      cache.client.quit((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
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
      const dequeued = await cache.dequeuePayloads(1)
      expect(dequeued.length).toEqual(1)
      expect(JSON.stringify(dequeued[0])).toEqual(payloadJSON)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(payloadJSON)
      await expect(cache.dequeuePayloads()).resolves
        .toEqual([])
    })
    it('does not delete the hash', async () => {
      const dequeued = await cache.dequeuePayloads(1)
      expect(JSON.stringify(dequeued[0])).toEqual(payloadJSON)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(payloadJSON)
    })
    it('only dequeues from the processing queue', async () => {
      await cache.dequeuePayloads(1)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(payloadKey)
      await expect(lindex(cache.payloadProcessingQueueKey, 0)).resolves
        .toEqual(null)
    })
    it('works with dequeuing multiple items', async () => {
      const payload2 = new Payload({
        ...payload,
        article: {
          _id: 'payloadarticle2'
        },
        feed: {
          ...payload.feed,
          channel: 'payloadchannel2',
        }
      })
      const payload2Key = cache.getPayloadElementKey(payload2)
      const payload2JSON = JSON.stringify(payload2)
      const payload3 = new Payload({
        ...payload,
        article: {
          _id: 'payloadarticle3'
        },
        feed: {
          ...payload.feed,
          channel: 'payloadchannel3',
        }
      })
      const payload3Key = cache.getPayloadElementKey(payload3)
      const payload3JSON = JSON.stringify(payload3)
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payload2Key, payload2JSON)
          .rpush(cache.payloadQueueKey, payload2Key)
          .rpush(cache.payloadProcessingQueueKey, payload2Key)
          .exec((err) => err ? reject(err) : resolve())
      })
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payload3Key, payload3JSON)
          .rpush(cache.payloadQueueKey, payload3Key)
          .rpush(cache.payloadProcessingQueueKey, payload3Key)
          .exec((err) => err ? reject(err) : resolve())
      })
      const dequeued = await cache.dequeuePayloads(3)
      expect(dequeued.length).toEqual(3)
      expect(JSON.stringify(dequeued[0])).toEqual(payloadJSON)
      expect(JSON.stringify(dequeued[1])).toEqual(payload2JSON)
      expect(JSON.stringify(dequeued[2])).toEqual(payload3JSON)
      await expect(cache.dequeuePayloads()).resolves
        .toEqual([])
    })
  })
  describe('completePayload', () => {
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
