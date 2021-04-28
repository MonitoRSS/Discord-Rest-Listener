import express from 'express'
import config from './config'
import log from './log'
import expressWinston from 'express-winston'

/**
 * Create a single HTTP API route /health for a health check
 */
function setupHealthCheck () {
  const app = express()

  app.use(expressWinston.logger({
    winstonInstance: log
  }))

  app.get('/health', (req, res) => {
    res.status(200).end()
  })

  app.listen(config.httpPort + 1)
  return config.httpPort
}

export default setupHealthCheck
