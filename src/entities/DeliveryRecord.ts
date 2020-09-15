import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import Payload from "../utils/Payload";
import { ObjectId } from 'mongodb'

@Entity()
@Index({
  properties: ['channel']
})
class DeliveryRecord {

  @PrimaryKey()
  _id!: ObjectId;

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

  @Property()
  addedAt = new Date()

  constructor(payload: Payload, delivered: boolean) {
    const { article, feed } = payload.data
    this.articleID = article._id
    this.feedURL = feed.url
    this.channel = feed.channel
    this.delivered = delivered
  }
}

export default DeliveryRecord
