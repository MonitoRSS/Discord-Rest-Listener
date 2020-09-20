import { MikroORM } from "@mikro-orm/core"
import DeliveryRecord from "../entities/DeliveryRecord"
import Payload from "./Payload"
import testConfig from "./testConfig"

jest.useFakeTimers()

describe('Payload', () => {
  let orm: MikroORM
  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [DeliveryRecord],
      type: 'mongo',
      clientUrl: testConfig.databaseURI,
    })
  })
  beforeEach(async () => {
    await orm.em.getRepository(DeliveryRecord).nativeDelete({})
  })
  afterAll(async () => {
    await orm.close(true)
  })
  describe('recordSuccess', () => {
    it('works', async () => {
      const payload = new Payload({
        token: 'abc',
        article: {
          _id: 'articleid'
        },
        feed: {
          channel: 'channelid',
          _id: 'feedid',
          url: 'feedurl'
        },
        api: {
          method: 'apimethod',
          url: 'apiurl'
        }
      })
      await payload.recordSuccess(orm)
      const found = await orm.em.getRepository(DeliveryRecord).findOne({
        articleID: payload.article._id
      })
      expect(found).toBeDefined()
      expect(found).toEqual({
        articleID: payload.article._id,
        feedURL: payload.feed.url,
        channel: payload.feed.channel,
        delivered: true,
        addedAt: expect.any(Date),
        _id: expect.any(Object)
      })
    })
  })
  describe('recordFailure', () => {
    it('works', async () => {
      const payload = new Payload({
        token: 'abc',
        article: {
          _id: 'articleid'
        },
        feed: {
          channel: 'channelid',
          _id: 'feedid',
          url: 'feedurl'
        },
        api: {
          method: 'apimethod',
          url: 'apiurl'
        }
      })
      const errorMessage = 'record failure error message'
      await payload.recordFailure(orm, errorMessage)
      const found = await orm.em.getRepository(DeliveryRecord).findOne({
        articleID: payload.article._id
      })
      expect(found).toBeDefined()
      expect(found).toEqual({
        articleID: payload.article._id,
        feedURL: payload.feed.url,
        channel: payload.feed.channel,
        delivered: false,
        addedAt: expect.any(Date),
        _id: expect.any(Object),
        comment: errorMessage
      })
    })
  })
  describe('toJSON', () => {
    it('works', () => {
      const article = {
        _id: 'articleid'
      }
      const feed = {
        channel: 'channelid',
        _id: 'feedid',
        url: 'feedurl'
      }
      const api = {
        method: 'apimethod',
        url: 'apiurl'
      }
      const payload = new Payload({
        token: 'abc',
        article,
        feed,
        api
      })
      payload.article = article
      payload.feed = feed
      payload.api = api
      expect(payload.toJSON()).toEqual({
        article,
        feed,
        api
      })
    })
  })
})
