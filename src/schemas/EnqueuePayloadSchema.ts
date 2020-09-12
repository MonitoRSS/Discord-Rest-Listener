import * as z from 'zod'

export const EnqueuePayloadSchema = z.object({
  article: z.object({
    _id: z.string()
  }).nonstrict(),
  feed: z.object({
    _id: z.string(),
    url: z.string(),
    channel: z.string()
  }).nonstrict(),
  api: z.object({
    url: z.string(),
    method: z.string(),
    body: z.any()
  })
})

export type EnqueuePayloadType = z.infer<typeof EnqueuePayloadSchema>
