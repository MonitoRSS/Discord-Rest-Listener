import RedisCache from './RedisCache'
import {promisify} from 'util'
import config from '../utils/config'
import Payload from '../utils/Payload'
import RedisMock from 'redis-mock'

jest.useFakeTimers()

describe('RedisCache', () => {
  const cache = new RedisCache(config.redis, config.redisPrefix)
  cache.client = RedisMock.createClient()
  const payload = new Payload({
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
  describe('getEnqueuedPayloads', () => {
    it('works', async () => {
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(cache.payloadHashKey, payloadKey, payloadJSON)
          .rpush(cache.payloadQueueKey, payloadKey)
          .exec((err) => err ? reject(err) : resolve())
      })
      const payload2 = new Payload({
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
          .hset(cache.payloadHashKey, payload2Key, payload2JSON)
          .rpush(cache.payloadQueueKey, payload2Key)
          .exec((err) => err ? reject(err) : resolve())
      })
      const payloads = await cache.getEnqueuedPayloads()
      expect(payloads.length).toEqual(2)
      expect(payloads.find((thisPayload) => thisPayload.article._id === payload.article._id))
        .toBeInstanceOf(Payload)
      expect(payloads.find((thisPayload) => thisPayload.article._id === payload2.article._id))
        .toBeInstanceOf(Payload)
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
