import { MikroORM } from "@mikro-orm/core"
import { Pull } from "zeromq"
import DeliveryRecord from "../entities/DeliveryRecord"
import { enqueueOldPayloads } from "../services/Queue"
import RedisCache from "../services/RedisCache"
import config from "./config"
import log from "./log"

async function createConsumer () {
  const sock = new Pull()
  await sock.connect(config.bindingAddress)
  return sock
}

async function connectToRedis (): Promise<RedisCache> {
  const redisCache = new RedisCache(config.redis, config.redisPrefix)
  if (redisCache.client.connected) {
    return redisCache
  }
  return new Promise((resolve) => {
    redisCache.on('ready', () => resolve(redisCache))
  })
}

async function setup () {
  log.info('Connecting to Mongo')
  const orm = await MikroORM.init({
    entities: [DeliveryRecord],
    type: 'mongo',
    clientUrl: config.databaseURI
  })
  log.info('Connected to Mongo, connecting to Redis')
  // Connect to redis
  const redisCache = await connectToRedis() 
  log.info('Redis connected, enqueuing old payloads')
  // Handle old payloads
  await enqueueOldPayloads(redisCache, orm)
  // Start accepting new payloads
  const sock = await createConsumer()
  log.info(`Worker connected to ${config.bindingAddress}`)
  return {
    orm,
    sock,
    redisCache
  }
}

export default setup
