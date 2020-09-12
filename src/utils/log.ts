import winston from 'winston'
import isProductionEnv from './isProductionEnv'

const timestampFormat = winston.format.timestamp()

const productionLog = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      format: winston.format.combine(
        timestampFormat,
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        timestampFormat,
        winston.format.json()
      )
    }),
    // new winston.transports.Console({
    //   level: 'info',
    //   format: winston.format.combine(
    //     winston.format.colorize(),
    //     timestampFormat,
    //     winston.format.simple(),
    //   )
    // }),
  ]
})

const devLog = winston.createLogger({
  transports: [
    new winston.transports.Console(),
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    timestampFormat,
    winston.format.simple(),
  )
})

const log = isProductionEnv ? productionLog : devLog

export default log
