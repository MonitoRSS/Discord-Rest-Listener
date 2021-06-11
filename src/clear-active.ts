/* eslint-disable @typescript-eslint/ban-ts-comment */
import log from './utils/log'
import setup from './utils/setup'
import { RESTProducer } from '@synzen/discord-rest'
import config from './utils/config'

setup(false).then(async () => {
  const producer = new RESTProducer(config.redis)
  log.info('Ready')
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
  process.exit()
}).catch(err => {
  log.error(err)
})

