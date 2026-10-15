export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s()-]/g, '')
  if (trimmed === '999' || trimmed === '112' || trimmed === '911') return null
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1)
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null
    return `+${digits}`
  }
  const digits = trimmed.replace(/\D/g, '')
  if (/^01[3-9]\d{8}$/.test(digits)) return `+88${digits}`
  if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`
  return null
}

export type LiveFix = { lat: number; lng: number; accuracy: number; at: number }

export function sosMessage(name: string, place: { lat: number; lng: number } | null): string {
  const where = place
    ? `https://maps.google.com/?q=${place.lat.toFixed(6)},${place.lng.toFixed(6)}`
    : 'Location was not available.'
  return `Safely SOS. ${name} needs help now. ${where} This does not call 999.`
}

export function preferLiveFix(previous: LiveFix | null, next: LiveFix): LiveFix {
  if (!previous) return next
  if (next.accuracy + 5 < previous.accuracy) return next
  if (next.at >= previous.at && next.accuracy <= previous.accuracy + 25) return next
  return previous
}

export function watchLiveLocation(onFix: (fix: LiveFix) => void, onDenied?: () => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onDenied?.()
    return () => {}
  }
  const take = (position: GeolocationPosition) => {
    onFix({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      at: position.timestamp || Date.now(),
    })
  }
  const denied = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) onDenied?.()
  }
  navigator.geolocation.getCurrentPosition(take, denied, { enableHighAccuracy: false, maximumAge: 120_000, timeout: 10_000 })
  const watch = navigator.geolocation.watchPosition(take, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 })
  return () => navigator.geolocation.clearWatch(watch)
}

export async function networkLocation(): Promise<LiveFix | null> {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json')
    if (!response.ok) return null
    const body = await response.json() as { latitude?: string; longitude?: string }
    const lat = Number(body.latitude)
    const lng = Number(body.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng, accuracy: 8_000, at: Date.now() }
  } catch {
    return null
  }
}

export function sendDecision(fix: LiveFix | null, waitedMs: number, denied: boolean): 'wait' | 'send' | 'blocked' {
  if (fix && fix.accuracy <= 1_000) return 'send'
  if (fix && waitedMs >= 4_000) return 'send'
  if (!fix && denied && waitedMs >= 6_000) return 'blocked'
  if (!fix && waitedMs >= 15_000) return 'blocked'
  return 'wait'
}
