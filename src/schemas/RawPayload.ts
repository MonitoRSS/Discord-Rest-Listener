import * as z from 'zod'
import { ApiMeta } from './ApiMeta'
import { ArticleMeta } from './ArticleMeta'
import { FeedMeta } from './FeedMeta'
import { PostActionAnnounce } from './PostActions/Announce'

export const RawPayloadSchema = z.object({
  token: z.string(),
  article: ArticleMeta,
  feed: FeedMeta,
  api: ApiMeta,
  postActions: z.array(PostActionAnnounce).optional()
})

export type RawPayloadType = z.infer<typeof RawPayloadSchema>
