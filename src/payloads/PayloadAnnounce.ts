import { RawPayloadType } from "../schemas/RawPayload";
import DiscordMessage from "../types/DiscordMessage";
import PayloadInterface from "../types/PayloadInterface";

class PayloadAnnounce implements PayloadInterface {
  data: RawPayloadType

  constructor (data: RawPayloadType, messageResponse: DiscordMessage) {
    const { channel } = data.feed
    this.data = {
      ...data,
      api: {
        ...data.api,
        url: `https://discord.com/api/channels/${channel}/messages/${messageResponse.id}/crosspost`
      }
    }
  }

  async recordSuccess() {
    // Do not record any success
    return
  }

  async recordFailure () {
    // Do not record any failure
    return
  }

  toJSON() {
    return this.data
  }
}

export default PayloadAnnounce
