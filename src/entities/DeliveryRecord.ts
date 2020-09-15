import { Entity, Index, Property } from "@mikro-orm/core";
import Payload from "../utils/Payload";

@Entity()
@Index({
  properties: ['channel']
})
class DeliveryRecord {

  @Property()
  articleID: string;

  @Property()
  feedURL: string;

  @Property()
  channel: string;

  @Property()
  delivered: boolean;

  @Property({nullable: true})
  comment?: string;

  constructor(payload: Payload, delivered: boolean) {
    const { article, feed } = payload.data
    this.articleID = article._id
    this.feedURL = feed.url
    this.channel = feed.channel
    this.delivered = delivered
  }
}

export default DeliveryRecord
