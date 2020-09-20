import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import Payload from "../utils/Payload";
import { ObjectId } from '@mikro-orm/mongodb'

@Entity({
  collection: 'delivery_records_service'
})
@Index({
  properties: ['channel']
})
@Index({
  properties: ['addedAt'],
  options: {
    expireAfterSeconds: 60 * 60 * 24 * 3
  }
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
    const { article, feed } = payload
    this.articleID = article._id
    this.feedURL = feed.url
    this.channel = feed.channel
    this.delivered = delivered
  }
}

export default DeliveryRecord
