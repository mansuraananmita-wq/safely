export const VOICE_MAX_SECONDS = 60
export const VIDEO_MAX_SECONDS = 30
export const VOICE_MAX_BYTES = 10 * 1024 * 1024
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024

const voiceMimes = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'])
const videoMimes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

export function voiceExtension(mime: string): string | null {
  switch (mime) {
    case 'audio/webm':
      return 'webm'
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a'
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/aac':
      return 'aac'
    default:
      return null
  }
}

export function videoExtension(mime: string): string | null {
  switch (mime) {
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    case 'video/quicktime':
      return 'mov'
    default:
      return null
  }
}

export function mediaProblem(kind: 'voice' | 'video', mime: string, bytes: number, seconds: number): string | null {
  if (kind === 'voice') {
    if (!voiceMimes.has(mime)) return 'Use a WebM, M4A, MP3, or AAC voice note.'
    if (bytes > VOICE_MAX_BYTES) return 'Voice notes must be 10 MB or smaller.'
    if (seconds <= 0 || seconds > VOICE_MAX_SECONDS) return 'Voice notes must be 60 seconds or shorter.'
    return null
  }
  if (!videoMimes.has(mime)) return 'Use an MP4, WebM, or MOV video.'
  if (bytes > VIDEO_MAX_BYTES) return 'Videos must be 20 MB or smaller.'
  if (seconds <= 0 || seconds > VIDEO_MAX_SECONDS) return 'Videos must be 30 seconds or shorter.'
  return null
}

/** Drop an ID3v2 tag when the recording is an MP3. WebM from MediaRecorder has no ID3. */
export function stripAudioId3(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return bytes
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
  const start = Math.min(bytes.length, 10 + size)
  return bytes.subarray(start)
}
