import * as z from 'zod'
import { ApiMeta } from './ApiMeta'
import { ArticleMeta } from './ArticleMeta'
import { FeedMeta } from './FeedMeta'

export const EnqueuePayloadSchema = z.object({
  article: ArticleMeta,
  feed: FeedMeta,
  api: ApiMeta
})

export type EnqueuePayloadType = z.infer<typeof EnqueuePayloadSchema>
