import { MikroORM } from "@mikro-orm/core"
import DeliveryRecord from "../entities/DeliveryRecord"
import Feed from "../entities/Feed"
import GeneralStat from "../entities/GeneralStat"
import Profile from "../entities/Profile"
import config from "./config"
import log from "./log"


async function setup () {
  log.info('Connecting to Mongo')
  const orm = await MikroORM.init({
    entities: [DeliveryRecord, GeneralStat, Feed, Profile],
    type: 'mongo',
    clientUrl: config.databaseURI,
    ensureIndexes: true
  })
  log.info('Connected to Mongo')
  return {
    orm,
  }
}

export default setup
