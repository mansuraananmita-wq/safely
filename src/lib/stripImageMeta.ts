/** Remove JPEG APP1 (EXIF/GPS) and other APP marker segments that can hold metadata. */
export function jpegWithoutMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input
  const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])]
  let i = 2
  while (i < input.length) {
    if (input[i] !== 0xff) {
      parts.push(input.subarray(i))
      break
    }
    let marker = input[i + 1]
    while (marker === 0xff && i + 1 < input.length) {
      i += 1
      marker = input[i + 1]
    }
    if (marker === undefined) break
    // Standalone markers with no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      parts.push(new Uint8Array([0xff, marker]))
      i += 2
      if (marker === 0xd9) {
        parts.push(input.subarray(i))
        break
      }
      continue
    }
    if (i + 3 >= input.length) break
    const size = (input[i + 2] << 8) | input[i + 3]
    if (size < 2 || i + 2 + size > input.length) break
    const next = i + 2 + size
    // Drop APP0–APP15 (0xE0–0xEF): EXIF, GPS, XMP, ICC, Adobe, etc.
    const dropApp = marker >= 0xe0 && marker <= 0xef
    // Drop COM (0xFE) comments.
    const dropCom = marker === 0xfe
    if (!dropApp && !dropCom) {
      parts.push(input.subarray(i, next))
    }
    i = next
    if (marker === 0xda) {
      // Entropy-coded scan: copy the rest.
      parts.push(input.subarray(i))
      break
    }
  }
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function jpegHasApp1(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false
  let i = 2
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return false
    const marker = bytes[i + 1]
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2
      if (marker === 0xd9) return false
      continue
    }
    const size = (bytes[i + 2] << 8) | bytes[i + 3]
    if (size < 2 || i + 2 + size > bytes.length) return false
    if (marker === 0xe1) return true
    if (marker === 0xda) return false
    i += 2 + size
  }
  return false
}

export function scrubbedPhotoName(original: string, mime: string): string {
  const base =
    original
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || 'photo'
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return `${base}.${ext}`
}

function exportMime(type: string): string {
  if (type === 'image/png') return 'image/png'
  if (type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('unreadable'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Strip EXIF/GPS and other embedded metadata by redrawing through a canvas and re-encoding.
 * The optional device map pin on the report form is separate and is never taken from the image.
 */
export async function stripImageMeta(file: File): Promise<{ name: string; url: string }> {
  const mime = exportMime(file.type || 'image/jpeg')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, bitmap.width)
    canvas.height = Math.max(1, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error('export'))),
        mime,
        mime === 'image/jpeg' ? 0.92 : undefined,
      )
    })
    const exported = new Uint8Array(await blob.arrayBuffer())
    const bytes = mime === 'image/jpeg' ? jpegWithoutMetadata(exported) : exported
    const cleaned = new Blob([bytes.buffer as ArrayBuffer], { type: mime })
    return { name: scrubbedPhotoName(file.name, mime), url: await blobToDataUrl(cleaned) }
  } finally {
    bitmap.close()
  }
}
