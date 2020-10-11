import { MikroORM } from "@mikro-orm/core";
import DeliveryRecord from "../entities/DeliveryRecord";
import GeneralStat from "../entities/GeneralStat";
import { RawPayloadType } from "../schemas/RawPayload";
import log from "../utils/log";
import PayloadInterface from "../types/PayloadInterface";

class PayloadMessage implements PayloadInterface {
  data: RawPayloadType

  constructor (data: RawPayloadType) {
    this.data = data
  }

  async recordSuccess (orm: MikroORM, message?: string) {
    log.debug('Recording delivery record success')
    const record = new DeliveryRecord(this.toJSON(), true)
    if (message) {
      record.comment = message
    }
    try {
      await orm.em.nativeInsert(record)
      await GeneralStat.increaseNumericStat(orm, GeneralStat.keys.ARTICLES_SENT)
    } catch (err) {
      log.error(`Failed to record article delivery success(${err.message})`, {
        record
      })
    }
  }

  async recordFailure(orm: MikroORM, message: string) {
    log.debug('Recording delivery record failure')
    const record = new DeliveryRecord(this.toJSON(), false)
    record.comment = message
    try {
      await orm.em.nativeInsert(record)
    } catch (err) {
      log.error(`Failed to record article delivery failure (${err.message})`, {
        record
      })
    }
  }

  toJSON () {
    return this.data
  }
}

export default PayloadMessage
