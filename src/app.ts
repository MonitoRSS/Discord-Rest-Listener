import log, { logDatadog } from './utils/log'
import setup from './utils/setup'
import { MikroORM } from '@mikro-orm/core'
import { GLOBAL_BLOCK_TYPE, RESTConsumer } from '@synzen/discord-rest'
import config from './utils/config'
import DeliveryRecord from './entities/DeliveryRecord'
import GeneralStat from './entities/GeneralStat'

type ArticleMeta = {
  articleID: string
  feedURL: string
  channel: string
}

const recordArticleSuccess = async (orm: MikroORM, deliveryId: string, articleMeta: ArticleMeta) => {
  const record = new DeliveryRecord({
    ...articleMeta,
    deliveryId,
  }, true)
  await orm.em.nativeInsert(record)
  await GeneralStat.increaseNumericStat(orm, GeneralStat.keys.ARTICLES_SENT)
}

const recordArticleFailure = async (orm: MikroORM, deliveryId: string, articleMeta: ArticleMeta, errorMessage: string) => {
  const record = new DeliveryRecord({
    ...articleMeta,
    deliveryId,
  }, false)
  record.comment = errorMessage
  await orm.em.nativeInsert(record)
}

setup().then(async (initializedData) => {
  const { orm } = initializedData
  const consumer = new RESTConsumer(config.rabbitmqUri, {
    authHeader: `Bot ${config.token}`,
    clientId: config.discordClientId,
  }, {
    maxRequestsPerSecond: config.maxRequestsPerSecond || 25,
    invalidRequestsThreshold: 1000,
  })

  try {
    consumer.on('err', (err) => {
      const errorMessage = `Consumer error: ${err.message}`
      log.error(errorMessage)
      logDatadog('error', errorMessage, {
        stack: err.stack
      })
    })

    consumer.on('jobCompleted', async (job, result, jobMetadata) => {
      log.debug('Job completed', result)
      logDatadog('info', `Article delivered`, {
        route: job.route,
        ...(jobMetadata.startTimestamp && { duration: jobMetadata.endTimestamp - jobMetadata.startTimestamp }),
        ...(job.meta?.feedURL && { feedURL: job.meta?.feedURL }),
      })
      // This was a feed article
      if (!job.meta?.articleID) {
        return
      }
      await recordArticleSuccess(orm, job.id, job.meta as ArticleMeta)
      if (!result.status.toString().startsWith('2')) {
        await recordArticleFailure(orm, job.id, job.meta as ArticleMeta, `Bad status code (${result.status}) | ${JSON.stringify(result.body)}`)
      }
    })

    consumer.on('jobError', async (error, job) => {
      log.error(`Job ${job.id} error: ${error.message}`)
      if (!job.meta?.articleID) {
        return
      }
      await recordArticleFailure(orm, job.id, job.meta as ArticleMeta, `Job error: ${error.message}`)
    })

    /**
     * Log all the important events that might affect this service's performance
     */
    consumer.on('globalBlock', (blockType, durationMs) => {
      if (blockType === GLOBAL_BLOCK_TYPE.GLOBAL_RATE_LIMIT) {
      const errorMessage = `Global rate limit hit (retry after ${durationMs}ms)`
      
        logDatadog('warn', errorMessage, {
          durationMs
        })
        log.warn(errorMessage)
      } else if (blockType === GLOBAL_BLOCK_TYPE.CLOUDFLARE_RATE_LIMIT) {
        const errorMessage = `Cloudflare rate limit hit (retry after ${durationMs}ms)`

        logDatadog('warn', errorMessage, {
          durationMs
        })
        log.warn(errorMessage)
      } else if (blockType === GLOBAL_BLOCK_TYPE.INVALID_REQUEST) {
        const errorMessage = `Invalid requests threshold reached, delaying all requests by ${durationMs}ms`

        logDatadog('warn', errorMessage, {
          durationMs
        })
        log.warn(errorMessage)
      }
    })

    await consumer.initialize()

    log.info('Ready')
  } catch (err) {
    log.error(err)
  }
})

