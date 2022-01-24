/* eslint-disable @typescript-eslint/ban-ts-comment */
import log from './utils/log'
import setup from './utils/setup'
import { RESTProducer } from '@synzen/discord-rest'
import config from './utils/config'

const stages = process.env.STAGES?.split(',') || ['delayed', 'paused', 'active']
const count = Number(process.env.COUNT || 100)

setup(false).then(async () => {
  const producer = new RESTProducer(config.redis)
  log.info('Ready')
  const jobs = await producer['queue'].getJobs(stages, 0, count);
  console.log(`Found ${jobs.length}`)
  const mapOfCountsByFeedUrls = new Map()
  const mapOfCountsByChannels = new Map()
  // @ts-ignore
  for (let i = 0; i < jobs.length; ++i) {
    const job = jobs[i]
    const feedURL = job.data.meta?.feedURL
    const channel = job.data.meta?.channel


    if (feedURL) {
      if (!mapOfCountsByFeedUrls.has(feedURL)) {
        mapOfCountsByFeedUrls.set(feedURL, 0)
      }
      mapOfCountsByFeedUrls.set(feedURL, mapOfCountsByFeedUrls.get(feedURL) + 1)
    }

    if (channel) {
      if (!mapOfCountsByChannels.has(channel)) {
        mapOfCountsByChannels.set(channel, 0)
      }
      mapOfCountsByChannels.set(channel, mapOfCountsByChannels.get(channel) + 1)
    }
  }

  const mapOfCountsByFeedUrlsSorted = [...mapOfCountsByFeedUrls.entries()].sort((a, b) => b[1] - a[1])
  const mapOfCountsByChannelsSorted = [...mapOfCountsByChannels.entries()].sort((a, b) => b[1] - a[1])

  const topFeedUrls = mapOfCountsByFeedUrlsSorted.slice(0, 50)
  const topChannels = mapOfCountsByChannelsSorted.slice(0, 50)

  console.log('\n\nTop Feed URLs:', topFeedUrls)
  console.log('\n\nTop Channels:', topChannels)

  process.exit()
}).catch(err => {
  log.error(err)
})

