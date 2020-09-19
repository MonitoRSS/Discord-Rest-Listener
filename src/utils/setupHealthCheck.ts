import express from 'express'
import config from './config'
import { URL } from 'url'
import log from './log'
import expressWinston from 'express-winston'
/**
 * Create a single HTTP API route /rest for a health check
 */
function setupHealthCheck () {
  const app = express()

  app.use(expressWinston.logger({
    winstonInstance: log
  }))

  app.get('/health', (req, res) => {
    res.status(200).end()
  })

  const address = new URL(config.bindingAddress)
  const port = Number(address.port) + 1
  app.listen(port)
  return port
}

export default setupHealthCheck
