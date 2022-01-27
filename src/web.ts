import Queue from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { createBullBoard } from '@bull-board/api'
import {
    REDIS_QUEUE_NAME
} from "@synzen/discord-rest"
import express from 'express'
import config from "./utils/config"

const queue = new Queue(REDIS_QUEUE_NAME, {
    redis: config.redis
})

const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [
    new BullAdapter(queue, { readOnlyMode: true }),
  ],
  serverAdapter:serverAdapter
})

const app = express()
serverAdapter.setBasePath('/')

app.use('/', serverAdapter.getRouter())

const port = config.httpPort

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})