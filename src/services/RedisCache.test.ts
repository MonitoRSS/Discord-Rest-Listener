import RedisCache from './RedisCache'
import {promisify} from 'util'
import config from '../utils/config'
import RedisMock from 'redis-mock'
import PayloadMessage from '../payloads/PayloadMessage'

jest.useFakeTimers()

describe('RedisCache', () => {
  const cache = new RedisCache(config.redis, config.redisPrefix)
  cache.client = RedisMock.createClient()
  const payload = new PayloadMessage({
    token: 'abc',
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
        .exec((err) => err ? reject(err) : resolve())
    })
  })
  describe('getEnqueuedPayloadKeys', () => {
    it('works', async () => {
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .rpush(cache.payloadQueueKey, 'key1')
          .rpush(cache.payloadQueueKey, 'key2')
          .rpush(cache.payloadQueueKey, 'key3')
          .exec((err) => err ? reject(err) : resolve())
      })
      await expect(cache.getEnqueuedPayloadKeys())
        .resolves.toEqual(['key1', 'key2', 'key3'])
    })
  })
  describe('getInvalidPayloadKeys', () => {
    it('works', async () => {
      const invalidKey = 'invalidkey'
      const invalidKey2 = 'invalidkey2'
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, invalidKey)
          .rpush(cache.payloadQueueKey, payloadKey)
          .rpush(cache.payloadQueueKey, invalidKey2)
          .exec((err) => err ? reject(err) : resolve())
      })
      const invalidKeys = await cache.getInvalidPayloadKeys()
      expect(invalidKeys).toEqual([
        invalidKey,
        invalidKey2
      ])
    })
  })
  describe('purgeInvalidPayloadKeys', () => {
    it('works', async () => {
      const invalidKey = 'invalidkey'
      const invalidKey2 = 'invalidkey2'
      const lrange = promisify(cache.client.lrange).bind(cache.client)
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, invalidKey)
          .rpush(cache.payloadQueueKey, payloadKey)
          .rpush(cache.payloadQueueKey, invalidKey2)
          .exec((err) => err ? reject(err) : resolve())
      })
      await expect(lrange(cache.payloadQueueKey, 0, -1))
        .resolves.toHaveLength(3)
      await cache.purgeInvalidPayloadKeys()
      await expect(lrange(cache.payloadQueueKey, 0, -1))
        .resolves.toHaveLength(1)
      await expect(lindex(cache.payloadQueueKey, 0))
        .resolves.toEqual(payloadKey)
    })
    it('returns number of deleted elems', async () => {
      const invalidKey = 'invalidkey'
      const invalidKey2 = 'invalidkey2'
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, invalidKey)
          .rpush(cache.payloadQueueKey, payloadKey)
          .rpush(cache.payloadQueueKey, invalidKey2)
          .exec((err) => err ? reject(err) : resolve())
      })
      const invalidKeys = await cache.purgeInvalidPayloadKeys()
      expect(invalidKeys).toEqual(2)
    })
  })
  describe('getEnqueuedPayloads', () => {
    it('works', async () => {
      const payload2 = new PayloadMessage({
        ...payload.toJSON(),
        token: 'abc',
        article: {
          _id: 'articleid2'
        },
      })
      const payload2Key = cache.getPayloadElementKey(payload2)
      const payload2JSON = JSON.stringify(payload2.toJSON())
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, payloadKey)
          .hset(cache.payloadHashKey, payload2Key, payload2JSON)
          .rpush(cache.payloadQueueKey, payload2Key)
          .exec((err) => err ? reject(err) : resolve())
      })
      const payloads = await cache.getEnqueuedPayloads()
      expect(payloads.findIndex(({ data }) => data.article._id === payload.data.article._id))
        .toEqual(0)
      expect(payloads.findIndex(({data}) => data.article._id === payload2.data.article._id))
        .toEqual(1)
    })
    it('returns instances of payloads', async () => {
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, payloadKey)
          .exec((err) => err ? reject(err) : resolve())
      })
      const payloads = await cache.getEnqueuedPayloads()
      expect(payloads.find((thisPayload) => thisPayload.data.article._id === payload.data.article._id))
        .toBeInstanceOf(PayloadMessage)
    })
  })
  describe('enqueuePayload', () => {
    it('works', async () => {
      await cache.enqueuePayload(payload)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(payloadKey)
      await expect(hget(cache.payloadHashKey, payloadKey)).resolves
        .toEqual(JSON.stringify(payload))
    })
  })
  describe('getQueueLength', () => {
    it('works', async () => {
      await new Promise((resolve, reject) => {
        cache.client.rpush(cache.payloadQueueKey, '1', (err, res) => err 
          ? reject(err) : resolve(res))
      })
      await new Promise((resolve, reject) => {
        cache.client.rpush(cache.payloadQueueKey, '2', (err, res) => err 
          ? reject(err) : resolve(res))
      })
      await expect(cache.getQueueLength()).resolves.toEqual(2)
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
        // This should equal to null but redis-mock erroneously returns undefined
        // .toEqual(null)
        .toEqual(undefined)
      await expect(lindex(cache.payloadQueueKey, 0)).resolves
        .toEqual(null)
    })
  })
})
