import { Response } from "node-fetch"
import PayloadAnnounce from "../payloads/PayloadAnnounce"
import { RawPayloadType } from "../schemas/RawPayload"
import DiscordMessage from "../types/DiscordMessage"
import createPostActionPayloads from "./createPostActionPayloads"

jest.mock('../payloads/PayloadAnnounce')

describe('createPostActionPayloads', () => {
  it('returns an empty array if no post actions', async () => {
    const rawPayload = {
      postActions: []
    } as unknown as RawPayloadType
    const res = {
      json: jest.fn().mockResolvedValue({
        id: 'abc'
      } as DiscordMessage)
    } as unknown as Response
    const payloads = await createPostActionPayloads(rawPayload, res)
    expect(payloads).toEqual([])
  })
  it('creates announce payloads', async () => {
    const rawPayload = {
      postActions: [{
        type: 'announce'
      }]
    } as unknown as RawPayloadType
    const res = {
      json: jest.fn().mockResolvedValue({
        id: 'abc'
      } as DiscordMessage)
    } as unknown as Response
    const payloads = await createPostActionPayloads(rawPayload, res)
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toBeInstanceOf(PayloadAnnounce)
  })
  it('ignores invalid types', async () => {
    const rawPayload = {
      postActions: [{
        type: 'a'
      }, {
        type: 'b'
      }]
    } as unknown as RawPayloadType
    const res = {
      json: jest.fn().mockResolvedValue({
        id: 'abc'
      } as DiscordMessage)
    } as unknown as Response
    const payloads = await createPostActionPayloads(rawPayload, res)
    expect(payloads).toEqual([])
  })
})
