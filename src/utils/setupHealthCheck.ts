import express from 'express'
import config from './config'

/**
 * Create a single HTTP API route /rest for a health check
 */
function setupHealthCheck () {
  const app = express()

  app.get('/health', (req, res) => {
    res.status(200).end()
  })
  const bindingAddressParts = config.bindingAddress.split(':')
  const port = Number(bindingAddressParts[bindingAddressParts.length - 1]) + 1
  app.listen(port)
  return port
}

export default setupHealthCheck
