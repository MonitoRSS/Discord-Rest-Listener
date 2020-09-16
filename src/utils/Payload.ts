import { MikroORM } from "@mikro-orm/core";
import DeliveryRecord from "../entities/DeliveryRecord";
import { ApiMetaType } from "../schemas/ApiMeta";
import { ArticleMetaType } from "../schemas/ArticleMeta";
import { EnqueuePayloadType } from "../schemas/EnqueuePayloadSchema";
import { FeedMetaType } from "../schemas/FeedMeta";
import log from "./log";

class Payload {
  article: ArticleMetaType
  feed: FeedMetaType
  api: ApiMetaType
  constructor (data: EnqueuePayloadType) {
    this.article = data.article
    this.feed = data.feed
    this.api = data.api
  }

  /**
   * Record a payload's successful delivery/request to Discord
   */
  async recordSuccess(orm: MikroORM) {
    const { article, feed } = this
    const channel = feed.channel
    log.debug('Recording delivery record success')
    try {
      const record = new DeliveryRecord(this, true)
      await orm.em.getRepository(DeliveryRecord).persistAndFlush(record)
    } catch (err) {
      log.error(`Failed to record article ${article._id} delivery success in channel ${channel} in ArticleQueue (${err.message})`)
    }
  }
}

export default Payload
