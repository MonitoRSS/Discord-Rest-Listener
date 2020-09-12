import RedisCache from './RedisCache'
import {promisify} from 'util'
import { EnqueuePayloadType } from '../schemas/EnqueuePayloadSchema'

describe('RedisCache', () => {
  const cache = new RedisCache()
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
        .del(RedisCache.payloadHashKey)
        .del(RedisCache.payloadQueueKey)
        .exec((err) => err ? reject(err) : resolve())
    })
  })
  describe('enqueuePayload', () => {
    it('works', async () => {
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
      await cache.enqueuePayload(payload)

      const storedKey = `${RedisCache.prefix}${payload.feed.channel}_${payload.article._id}`
      await expect(lindex(RedisCache.payloadQueueKey, 0)).resolves
        .toEqual(storedKey)
      await expect(hget(RedisCache.payloadHashKey, storedKey)).resolves
        .toEqual(JSON.stringify(payload))
    })
  })
  describe('dequeuePayload', () => {
    it('works', async () => {
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
      const storedKey = `${RedisCache.prefix}${payload.feed.channel}_${payload.article._id}`
      await new Promise((resolve, reject) => {
        cache.client.multi()
          .hset(RedisCache.payloadHashKey, storedKey, JSON.stringify(payload))
          .rpush(RedisCache.payloadQueueKey, storedKey)
          .exec((err) => err ? reject(err) : resolve())
      })
      const dequeued = await cache.dequeuePayload()
      expect(dequeued).not.toEqual(null)
      expect(JSON.stringify(dequeued)).toEqual(JSON.stringify(payload))
      await expect(lindex(RedisCache.payloadQueueKey, 0)).resolves
        .toEqual(null)
      await expect(hget(RedisCache.payloadHashKey, storedKey)).resolves
        .toEqual(null)
      await expect(cache.dequeuePayload()).resolves
        .toEqual(null)
    })
  })
})
