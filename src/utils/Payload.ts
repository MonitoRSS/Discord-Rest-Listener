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
    log.debug('Recording delivery record success')
    const record = new DeliveryRecord(this, true)
    try {
      await orm.em.getRepository(DeliveryRecord).persistAndFlush(record)
    } catch (err) {
      log.error(`Failed to record article delivery success(${err.message})`, {
        record
      })
    }
  }

  /**
   * Record a payload's failed delivery/request to Discord
   */
  async recordFailure (orm: MikroORM, message: string) {
    log.debug('Recording delivery record failure', {
    })
    const record = new DeliveryRecord(this, false)
    record.comment = message
    try {
      await orm.em.getRepository(DeliveryRecord).persistAndFlush(record)
    } catch (err) {
      log.error(`Failed to record article delivery failure (${err.message})`, {
        record
      })
    }
  }
}

export default Payload
