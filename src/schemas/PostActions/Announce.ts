import * as z from 'zod'
import { PostActionBase } from './Base'

export const PostActionAnnounce = PostActionBase.extend({
  type: z.enum(['announce'])
})

export type PostActionAnnounceType = z.infer<typeof PostActionAnnounce>
