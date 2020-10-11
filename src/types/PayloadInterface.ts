import { MikroORM } from "@mikro-orm/core";
import { RawPayloadType } from "../schemas/RawPayload";

interface PayloadInterface {
  data: RawPayloadType

  recordSuccess: (orm: MikroORM, message?: string) => Promise<void>
  recordFailure: (orm: MikroORM, message: string) => Promise<void>

  toJSON: () => RawPayloadType
}

export default PayloadInterface
