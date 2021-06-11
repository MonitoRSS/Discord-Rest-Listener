/* eslint-disable @typescript-eslint/ban-ts-comment */
import log from './utils/log'
import setup from './utils/setup'
import { RESTProducer } from '@synzen/discord-rest'
import config from './utils/config'

setup().then(async () => {
  const producer = new RESTProducer(config.redis)

  // @ts-ignore
  const jobs = await producer.queue.getJobs(['active']);
  // @ts-ignore
  const results = await Promise.allSettled(jobs.map(async (job) => job.remove()))
  // @ts-ignore
  results.forEach((result) => {
      if (result.status === 'rejected') {
          console.log(result.reason)
      }
  })
  log.info('Ready')
}).catch(err => {
  log.error(err)
})

