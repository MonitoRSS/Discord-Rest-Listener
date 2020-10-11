import { MikroORM } from '@mikro-orm/core'
import { enqueue } from './Queue'
import RedisCache from './RedisCache'
import * as DiscordRequests from './DiscordRequests'
import { Response } from 'node-fetch'
import PayloadInterface from '../types/PayloadInterface'

describe('Queue', () => {
  const payload = {
    data: {},
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
    it('returns the fetch response on success', async () => {
      const res = {
        ok: true
      } as Response
      jest.spyOn(DiscordRequests, 'executeFetch')
        .mockResolvedValue(res)
      const returned = await enqueue(
        payload as unknown as PayloadInterface,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(returned).toEqual(res)
    })
    describe('redis', () => {
      it('enqueues and dequeues in redis on success', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
          .mockResolvedValue({
            ok: true
          } as Response)
        await enqueue(
          payload as unknown as PayloadInterface,
          redisCache as unknown as RedisCache,
          orm as unknown as MikroORM
        )
        expect(redisCache.enqueuePayload)
          .toHaveBeenCalledWith(payload)
        expect(redisCache.completePayload)
          .toHaveBeenCalledWith(payload)
      })
      it('enqueues and dequeues in redis on network error', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
          .mockRejectedValue(new Error('network err'))
        await enqueue(
          payload as unknown as PayloadInterface,
          redisCache as unknown as RedisCache,
          orm as unknown as MikroORM
        )
        expect(redisCache.enqueuePayload)
          .toHaveBeenCalledWith(payload)
        expect(redisCache.completePayload)
          .toHaveBeenCalledWith(payload)
      })
      it('enqueues and dequeues in redis on bad status code', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
          .mockResolvedValue({
            ok: false,
            status: 400
          } as Response)
        await enqueue(
          payload as unknown as PayloadInterface,
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
      it('records successes', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
        .mockResolvedValue({
          ok: true
        } as Response)
      await enqueue(
        payload as unknown as PayloadInterface,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordSuccess)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on bad status code', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
        .mockResolvedValue({
          ok: false,
          status: 400
        } as Response)
      await enqueue(
        payload as unknown as PayloadInterface,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordFailure)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on bad status code', async () => {
        jest.spyOn(DiscordRequests, 'executeFetch')
        .mockResolvedValue({
          ok: false,
          status: 400
        } as Response)
      await enqueue(
        payload as unknown as PayloadInterface,
        redisCache as unknown as RedisCache,
        orm as unknown as MikroORM
      )
      expect(payload.recordFailure)
        .toHaveBeenCalledTimes(1)
      })
      it('records failures on network error', async () => {
      const timeoutError = new Error('timed out error')
      jest.spyOn(DiscordRequests, 'executeFetch')
        .mockRejectedValue(timeoutError)
      await enqueue(
        payload as unknown as PayloadInterface,
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
