import { describe, expect, it } from 'vitest'
import { jpegHasApp1, jpegWithoutMetadata, scrubbedPhotoName } from './stripImageMeta'

/** Minimal JPEG: SOI + APP1 (fake EXIF) + SOF0 + SOS + a few scan bytes + EOI. */
function jpegWithApp1(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe1, 0x00, 0x10, // APP1, length 16 (includes these 2 length bytes)
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 8 pad bytes → 14 data bytes
    0xff, 0xc0, 0x00, 0x0b, // SOF0, length 11
    0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, // SOS, length 8
    0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x00, 0x7f, 0x00, // fake entropy
    0xff, 0xd9, // EOI
  ])
}

describe('stripImageMeta helpers', () => {
  it('removes APP1 EXIF/GPS from a JPEG while keeping SOI and image markers', () => {
    const input = jpegWithApp1()
    expect(jpegHasApp1(input)).toBe(true)

    const cleaned = jpegWithoutMetadata(input)
    expect(cleaned[0]).toBe(0xff)
    expect(cleaned[1]).toBe(0xd8)
    expect(jpegHasApp1(cleaned)).toBe(false)
    expect([...cleaned]).toContain(0xc0)
    expect(cleaned[cleaned.length - 2]).toBe(0xff)
    expect(cleaned[cleaned.length - 1]).toBe(0xd9)
  })

  it('leaves a JPEG without APP segments free of APP1', () => {
    const plain = jpegWithoutMetadata(
      Uint8Array.from([
        0xff, 0xd8,
        0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
        0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
        0x11, 0x22,
        0xff, 0xd9,
      ]),
    )
    expect(jpegHasApp1(plain)).toBe(false)
    expect(plain[0]).toBe(0xff)
    expect(plain[1]).toBe(0xd8)
  })

  it('scrubs photo file names to a safe extension for the export mime', () => {
    expect(scrubbedPhotoName('Gate South!!.JPG', 'image/jpeg')).toBe('Gate_South.jpg')
    expect(scrubbedPhotoName('shot.png', 'image/png')).toBe('shot.png')
    expect(scrubbedPhotoName('x.webp', 'image/webp')).toBe('x.webp')
  })
})
