import { MikroORM } from "@mikro-orm/core"
// import { Pull } from "zeromq"
import DeliveryRecord from "../entities/DeliveryRecord"
import GeneralStat from "../entities/GeneralStat"
// import { purgeAndEnqueueOldPayloads } from "../services/Queue"
// import RedisCache from "../services/RedisCache"
import config from "./config"
import log from "./log"
import setupHealthCheck from "./setupHealthCheck"


async function setup () {
  log.info('Connecting to Mongo')
  const orm = await MikroORM.init({
    entities: [DeliveryRecord, GeneralStat],
    type: 'mongo',
    clientUrl: config.databaseURI,
    ensureIndexes: true
  })
  log.info('Connected to Mongo')
  const healthCheckPort = await setupHealthCheck()
  log.info(`Health check set up at HTTP port ${healthCheckPort}`)
  return {
    orm,
  }
}

export default setup
