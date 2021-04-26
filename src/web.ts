import Queue from 'bull';
import { BullAdapter, setQueues, router } from 'bull-board'
import {
    REDIS_QUEUE_NAME
} from "@synzen/discord-rest"
import express from 'express'
import config from "./utils/config"
const app = express()

const queue = new Queue(REDIS_QUEUE_NAME, {
    redis: config.redis
})

app.use(router)

setQueues([
  new BullAdapter(queue)
])

const port = config.httpPort

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})