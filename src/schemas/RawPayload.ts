import * as z from 'zod'
import { ApiMeta } from './ApiMeta'
import { ArticleMeta } from './ArticleMeta'
import { FeedMeta } from './FeedMeta'

export const RawPayloadSchema = z.object({
  token: z.string(),
  article: ArticleMeta,
  feed: FeedMeta,
  api: ApiMeta
})

export type RawPayloadType = z.infer<typeof RawPayloadSchema>
