import * as z from 'zod'

export const ConfigSchema = z.object({
  token: z.string(),
  databaseURI: z.string(),
  httpPort: z.number(),
  redis: z.string(),
  redisPrefix: z.string(),
  concurrencyLimit: z.number(),
  maxRequestsPerSecond: z.number(),
  datadog: z.object({
    apiKey: z.string(),
    host: z.string(),
    service: z.string(),
  }).optional(),
})

export type ConfigType = z.infer<typeof ConfigSchema>
