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
  afterAll(async () => {
    await orm.close()
  })
  afterEach(async () => {
    await orm.em.getRepository(DeliveryRecord).nativeDelete({})
    jest.resetAllMocks()
  })
  describe('recordSuccess', () => {
    it('works', async () => {
      const payload = new Payload({
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
      console.log(typeof found?._id, found?._id)
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
})
