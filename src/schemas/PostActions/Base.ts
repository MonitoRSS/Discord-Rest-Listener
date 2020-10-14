import * as z from 'zod'

export const PostActionBase = z.object({
  type: z.string()
})

export type PostActionBaseType = z.infer<typeof PostActionBase>
