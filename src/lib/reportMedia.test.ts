import { describe, expect, it } from 'vitest'
import { mediaProblem, stripAudioId3, VIDEO_MAX_BYTES, VOICE_MAX_BYTES } from './reportMedia'

describe('report media limits', () => {
  it('accepts a short voice note and rejects a long or huge one', () => {
    expect(mediaProblem('voice', 'audio/webm', 40_000, 12)).toBeNull()
    expect(mediaProblem('voice', 'audio/webm', 40_000, 61)).toMatch(/60 seconds/)
    expect(mediaProblem('voice', 'audio/webm', VOICE_MAX_BYTES + 1, 10)).toMatch(/10 MB/)
    expect(mediaProblem('voice', 'application/zip', 1000, 10)).toMatch(/voice note/)
  })

  it('accepts a short video and rejects one over 30 seconds or 20 MB', () => {
    expect(mediaProblem('video', 'video/mp4', 2_000_000, 20)).toBeNull()
    expect(mediaProblem('video', 'video/mp4', 2_000_000, 31)).toMatch(/30 seconds/)
    expect(mediaProblem('video', 'video/mp4', VIDEO_MAX_BYTES + 1, 10)).toMatch(/20 MB/)
  })

  it('strips an ID3v2 header from an audio file', () => {
    const header = new Uint8Array(10)
    header[0] = 0x49
    header[1] = 0x44
    header[2] = 0x33
    header[9] = 4
    const audio = new Uint8Array([1, 2, 3, 4])
    const tagged = new Uint8Array([...header, ...new Uint8Array(4), ...audio])
    expect(Array.from(stripAudioId3(tagged))).toEqual([1, 2, 3, 4])
    expect(Array.from(stripAudioId3(audio))).toEqual([1, 2, 3, 4])
  })
})