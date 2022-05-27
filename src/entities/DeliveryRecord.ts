import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
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
    expireAfterSeconds: 60 * 60 * 24 * 7
  }
})
@Index({
  properties: ['comment'],
  type: 'text'
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

  @Property({ nullable: true })
  deliveryId?: string

  constructor(data: {
    articleID: string,
    feedURL: string,
    channel: string,
    deliveryId: string
  }, delivered: boolean) {
    const { deliveryId, articleID, channel, feedURL } = data
    this.articleID = articleID
    this.feedURL = feedURL
    this.channel = channel
    this.delivered = delivered
    this.deliveryId = deliveryId
  }
}

export default DeliveryRecord
