import { Response } from "node-fetch"
import PayloadAnnounce from "../payloads/PayloadAnnounce"
import { PostActionBaseType } from "../schemas/PostActions/Base"
import { RawPayloadType } from "../schemas/RawPayload"
import DiscordMessage from "../types/DiscordMessage"
import PayloadInterface from "../types/PayloadInterface"


const createPostActionPayload = (postAction: PostActionBaseType, rawPayload: RawPayloadType, message: DiscordMessage) => {
  switch (postAction.type) {
    case 'announce':
      return new PayloadAnnounce(rawPayload, message)
    default:
      return null
  }
}

const createPostActionPayloads = async (rawPayload: RawPayloadType, response: Response) => {
  if (!rawPayload.postActions?.length) {
    return []
  }
  const json = await response.json()
  return rawPayload.postActions
    .map((postAction) => createPostActionPayload(postAction, rawPayload, json))
    .filter((item) => !!item) as PayloadInterface[]
}

export default createPostActionPayloads
