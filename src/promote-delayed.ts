/* eslint-disable @typescript-eslint/ban-ts-comment */
import log from './utils/log'
import setup from './utils/setup'
import { RESTProducer } from '@synzen/discord-rest'
import config from './utils/config'

const stages = process.env.STAGES?.split(',') || ['delayed']
const count = Number(process.env.COUNT || 100)

setup(false).then(async () => {
  const producer = new RESTProducer(config.redis)
  log.info('Ready')
  const jobs = await producer['queue'].getJobs(stages, 0, count);
  console.log(`Found ${jobs.length}`)
  // @ts-ignore
  const results = await Promise.allSettled(jobs.map(async (job) => job.promote()))
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

