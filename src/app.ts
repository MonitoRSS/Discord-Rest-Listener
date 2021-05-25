import log from './utils/log'
import setup from './utils/setup'
import { MikroORM } from '@mikro-orm/core'
import { RESTConsumer, JobResponse } from '@synzen/discord-rest'
import config from './utils/config'
import DeliveryRecord from './entities/DeliveryRecord'
import GeneralStat from './entities/GeneralStat'

type ArticleMeta = {
  articleID: string
  feedURL: string
  channel: string
}

const recordArticleSuccess = async (orm: MikroORM, articleMeta: ArticleMeta) => {
  const record = new DeliveryRecord(articleMeta, true)
  await orm.em.nativeInsert(record)
  await GeneralStat.increaseNumericStat(orm, GeneralStat.keys.ARTICLES_SENT)
}

const recordArticleFailure = async (orm: MikroORM, articleMeta: ArticleMeta, errorMessage: string) => {
  const record = new DeliveryRecord(articleMeta, false)
  record.comment = errorMessage
  await orm.em.nativeInsert(record)
}

setup().then((initializedData) => {
  const { orm } = initializedData
  const producer = new RESTConsumer(config.redis, `Bot ${config.token}`, {
    // Normally 50, but other apps are also making requests so we stay conservative
    maxRequestsPerSecond: 20
  }, 9999)

  producer.queue.on('completed', async (job, result: JobResponse<Record<string, unknown>>) => {
    log.debug('Job completed', result)
    // This was a feed article
    if (!job.data.meta?.articleID) {
      return
    }
    await recordArticleSuccess(orm, job.data.meta)
    if (!result.status.toString().startsWith('2')) {
      await recordArticleFailure(orm, job.data.meta, `Bad status code (${result.status}) | ${JSON.stringify(result.body)}`)
    }
  })

  producer.queue.on('drained', async () => {
    log.debug('Queue drained')
  })

  producer.queue.on('failed', async (job, error) => {
    log.error(`Job failed: ${error.message}`)
    if (!job.data.meta?.articleID) {
      return
    }
    await recordArticleFailure(orm, job.data.meta, `Job failed: ${error.message}`)
  })

  /**
   * Log all the important events that might affect this service's performance
   */
  producer.handler.on('globalRateLimit', (apiRequest, durationMs) => {
    log.warn(`Global rate limit hit for ${apiRequest.toString()} (retry after ${durationMs}ms)`)
  })

  producer.handler.on('rateLimit', (apiRequest, durationMs) => {
    log.warn(`Rate limit hit for ${apiRequest.toString()} (retry after ${durationMs})ms`)
  })

  producer.handler.on('invalidRequestsThreshold', (threshold) => {
    log.warn(`${threshold} invalid requests reached, delaying all requests by 10 minutes`)
  })

  producer.handler.on('cloudflareRateLimit', (apiRequest, durationMs) => {
    log.warn(`Cloudflare rate limit hit for ${apiRequest.toString()} (retry after ${durationMs})ms`)
  })
  log.info('Ready')
}).catch(err => {
  log.error(err)
})

