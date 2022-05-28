import log, { logDatadog } from './utils/log'
import setup from './utils/setup'
import { MikroORM } from '@mikro-orm/core'
import { GLOBAL_BLOCK_TYPE, RESTConsumer } from '@synzen/discord-rest'
import config from './utils/config'
import DeliveryRecord from './entities/DeliveryRecord'
import GeneralStat from './entities/GeneralStat'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

interface ArticleMeta {
  articleID: string
  feedURL: string
  channel: string
}

interface JobMeta {
  id: string
  duration: number
}

const recordArticleSuccess = async (orm: MikroORM, jobMeta: JobMeta, articleMeta: ArticleMeta) => {
  const record = new DeliveryRecord({
    ...articleMeta,
    deliveryId: jobMeta.id,
    executionTimeSeconds: jobMeta.duration
  }, true)
  await orm.em.nativeInsert(record)
  await GeneralStat.increaseNumericStat(orm, GeneralStat.keys.ARTICLES_SENT)
}

const recordArticleFailure = async (orm: MikroORM, jobMeta: JobMeta, articleMeta: ArticleMeta, errorMessage: string) => {
  const record = new DeliveryRecord({
    ...articleMeta,
    deliveryId: jobMeta.id,
    executionTimeSeconds: jobMeta.duration
  }, false)
  record.comment = errorMessage
  await orm.em.nativeInsert(record)
}

setup().then(async (initializedData) => {
  const { orm } = initializedData
  const consumer = new RESTConsumer(config.rabbitmqUri, {
    authHeader: `Bot ${config.token}`,
    clientId: config.discordClientId,
    checkIsDuplicate: async (deliveryId) => {
      const count = await orm.em.count(DeliveryRecord, {
        deliveryId,
      })

      return count > 0
    }
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

    consumer.on('jobCompleted', async (job, result) => {
      log.debug('Job completed', result)
      const jobDuration = dayjs().utc().unix() - job.startTimestamp

      logDatadog('info', `Article delivered`, {
        route: job.route,
        duration: jobDuration,
        ...(job.meta?.feedURL && { feedURL: job.meta?.feedURL }),
      })

      if (!job.meta?.articleID) {
        return
      }

      await recordArticleSuccess(orm, {
        id: job.id,
        duration: jobDuration,
      }, job.meta as ArticleMeta)

      if (!result.status.toString().startsWith('2')) {
        await recordArticleFailure(orm, {
          id: job.id,
          duration: jobDuration,
        }, job.meta as ArticleMeta, `Bad status code (${result.status}) | ${JSON.stringify(result.body)}`)
      }
    })

    consumer.on('jobError', async (error, job) => {
      log.error(`Job ${job.id} error: ${error.message}`)
      const jobDuration = dayjs().utc().unix() - job.startTimestamp

      if (!job.meta?.articleID) {
        return
      }
      await recordArticleFailure(orm, {
        id: job.id,
        duration: jobDuration
      }, job.meta as ArticleMeta, `Job error: ${error.message}`)
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

