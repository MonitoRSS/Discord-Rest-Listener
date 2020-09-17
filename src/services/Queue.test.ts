import { MikroORM } from '@mikro-orm/core'
import Payload from '../utils/Payload'
import { discordQueue, enqueue } from './Queue'
import RedisCache from './RedisCache'

describe('Queue', () => {
  const payload = {
    recordSuccess: jest.fn(),
    recordFailure: jest.fn()
  }
  const redisCache = {
    enqueuePayload: jest.fn(),
    completePayload: jest.fn()
  }
  const orm = {}
  beforeEach(() => {
    jest.resetAllMocks()
    payload.recordFailure.mockReset()
    payload.recordSuccess.mockReset()
    redisCache.enqueuePayload.mockReset()
    redisCache.completePayload.mockReset()
  })
  describe('enqueue', () => {
    describe('redis', () => {
      it('enqueues and dequeues in redis on success', async () => {
        jest.spyOn(discordQueue, 'add')
          .mockResolvedValue({
            ok: true
          })
        await enqueue(
          payload as unknown as Payload,
          redisCache as unknown as RedisCache,
          orm as unknown as MikroORM
        )
        expect(redisCache.enqueuePayload)
          .toHaveBeenCalledWith(payload)
        expect(redisCache.completePayload)
          .toHaveBeenCalledWith(payload)
      })
      it('enqueues and dequeues in redis on network error', async () => {
        jest.spyOn(discordQueue, 'add')
          .mockRejectedValue(new Error('network err'))
        await enqueue(
          payload as unknown as Payload,
          redisCache as unknown as RedisCache,
          orm as unknown as MikroORM
        )
        expect(redisCache.enqueuePayload)
          .toHaveBeenCalledWith(payload)
        expect(redisCache.completePayload)
          .toHaveBeenCalledWith(payload)
      })
      it('enqueues and dequeues in redis on bad status code', async () => {
        jest.spyOn(discordQueue, 'add')
          .mockResolvedValue({
            ok: false,
            status: 400
          })
        await enqueue(
          payload as unknown as Payload,
          redisCache as unknown as RedisCache,
          orm as unknown as MikroORM
        )
        expect(redisCache.enqueuePayload)
          .toHaveBeenCalledWith(payload)
        expect(redisCache.completePayload)
          .toHaveBeenCalledWith(payload)
      })
    })
    describe('payload records', () => {
      it('records succ  esses', async () => {
        jest.spyOn(discordQueue, 'add')
        .mockResolvedValue({
          ok: true
        })
      await enqueue(
        payload as unknown as Payload,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordSuccess)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on bad status code', async () => {
        jest.spyOn(discordQueue, 'add')
        .mockResolvedValue({
          ok: false,
          status: 400
        })
      await enqueue(
        payload as unknown as Payload,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordFailure)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on bad status code', async () => {
        jest.spyOn(discordQueue, 'add')
        .mockResolvedValue({
          ok: false,
          status: 400
        })
      await enqueue(
        payload as unknown as Payload,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordFailure)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on network error', async () => {
      const timeoutError = new Error('timed out error')
      jest.spyOn(discordQueue, 'add')
        .mockRejectedValue(timeoutError)
      await enqueue(
        payload as unknown as Payload,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordFailure)
        .toHaveBeenCalledTimes(1)
      expect(payload.recordFailure)
        .toHaveBeenCalledWith(orm, expect.stringContaining(timeoutError.message))
      })
    })
  })
})
