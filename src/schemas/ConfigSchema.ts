import * as z from 'zod'

export const ConfigSchema = z.object({
  token: z.string(),
  databaseURI: z.string(),
  httpPort: z.number(),
  redis: z.string(),
  redisPrefix: z.string()
})

export type ConfigType = z.infer<typeof ConfigSchema>
