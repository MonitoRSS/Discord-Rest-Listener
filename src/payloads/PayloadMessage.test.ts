import { MikroORM } from "@mikro-orm/core"
import DeliveryRecord from "../entities/DeliveryRecord"
import GeneralStat from "../entities/GeneralStat"
import PayloadMessage from "./PayloadMessage"
import testConfig from "../utils/testConfig"

jest.useFakeTimers()

describe('PayloadMessage', () => {
  let orm: MikroORM
  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [DeliveryRecord, GeneralStat],
      type: 'mongo',
      clientUrl: testConfig.databaseURI,
    })
  })
  beforeEach(async () => {
    await orm.em.getRepository(DeliveryRecord).nativeDelete({})
    await orm.em.getRepository(GeneralStat).nativeDelete({})
  })
  afterAll(async () => {
    await orm.close(true)
  })
  describe('recordSuccess', () => {
    it('works', async () => {
      const payload = new PayloadMessage({
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
        articleID: payload.data.article._id
      })
      expect(found).toBeDefined()
      expect(found).toEqual({
        articleID: payload.data.article._id,
        feedURL: payload.data.feed.url,
        channel: payload.data.feed.channel,
        delivered: true,
        addedAt: expect.any(Date),
        _id: expect.any(Object)
      })
    })
    it('adds 1 to general stats for articles sent', async () => {
      const payload = new PayloadMessage({
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
      const found = await orm.em.getRepository(GeneralStat).findOne({
        _id: GeneralStat.keys.ARTICLES_SENT
      })
      expect(found?.data).toEqual(1)
    })
  })
  describe('recordFailure', () => {
    it('works', async () => {
      const payload = new PayloadMessage({
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
        articleID: payload.data.article._id
      })
      expect(found).toBeDefined()
      expect(found).toEqual({
        articleID: payload.data.article._id,
        feedURL: payload.data.feed.url,
        channel: payload.data.feed.channel,
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
      const token = 'abc'
      const payload = new PayloadMessage({
        token,
        article,
        feed,
        api
      })
      payload.data.article = article
      payload.data.feed = feed
      payload.data.api = api
      expect(payload.toJSON()).toEqual({
        token,
        article,
        feed,
        api,
      })
    })
  })
})
