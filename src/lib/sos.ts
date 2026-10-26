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

export type LiveFix = {
  lat: number
  lng: number
  accuracy: number
  at: number
  altitude?: number | null
  altitudeAccuracy?: number | null
  speed?: number | null
}

export type LocationSource = 'gps' | 'wifi' | 'coarse'

/** Wi-Fi/OS location often reports 20–80 m accuracy while sitting on a campus hall kilometres away. */
export function locationSource(fix: LiveFix | null): LocationSource {
  if (!isPreciseFix(fix)) return 'coarse'
  const measuredHeight = typeof fix.altitudeAccuracy === 'number' && Number.isFinite(fix.altitudeAccuracy) && fix.altitudeAccuracy > 0
  const moving = typeof fix.speed === 'number' && Number.isFinite(fix.speed) && fix.speed > 0.4
  if (measuredHeight || moving) return 'gps'
  return 'wifi'
}

export function isGpsFix(fix: LiveFix | null): boolean {
  return locationSource(fix) === 'gps'
}

/** Wider than this is a neighbourhood, city, or IP guess — not close enough to find someone. */
export const LIVE_MAX_M = 150

export function isPreciseFix(fix: LiveFix | null): fix is LiveFix {
  return !!fix && fix.accuracy > 0 && fix.accuracy <= LIVE_MAX_M
}

export function sosMessage(name: string, place: { lat: number; lng: number } | null): string {
  const where = place ? mapsPinHref(place.lat, place.lng) : 'Location was not available.'
  return `Safely SOS. ${name} needs help now. ${where} This does not call 999.`
}

export function preferLiveFix(previous: LiveFix | null, next: LiveFix): LiveFix | null {
  if (!isPreciseFix(next)) return isPreciseFix(previous) ? previous : null
  if (!isPreciseFix(previous)) return next
  if (locationSource(next) === 'gps' && locationSource(previous) !== 'gps') return next
  if (locationSource(previous) === 'gps' && locationSource(next) !== 'gps') return previous
  if (next.accuracy + 5 < previous.accuracy) return next
  if (next.at >= previous.at && next.accuracy <= previous.accuracy + 25) return next
  return previous
}

/** Keep pushing after send for as long as the database allows. */
export const LIVE_SHARE_MS = 3 * 60_000

/** Ignore GPS jitter smaller than a short walk. */
export const LIVE_MOVE_M = 15

/** Allow a later GPS reading that is a bit noisier than the last shared pin. */
export const LIVE_ACCURACY_SLACK_M = 80

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(hav)))
}

export function shouldPushLiveFix(sent: LiveFix | null, next: LiveFix): boolean {
  if (!isPreciseFix(next)) return false
  if (!isPreciseFix(sent)) return true
  if (locationSource(sent) === 'gps' && locationSource(next) !== 'gps') return false
  if (next.accuracy > sent.accuracy + LIVE_ACCURACY_SLACK_M) return false
  if (next.accuracy + 5 < sent.accuracy) return true
  return metersBetween(sent, next) >= LIVE_MOVE_M
}

export function sosLiveOpen(createdAt: string, now = Date.now()): boolean {
  const started = new Date(createdAt).getTime()
  if (!Number.isFinite(started)) return false
  return now - started < LIVE_SHARE_MS
}

const gpsOptions: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }

export function watchLiveLocation(onFix: (fix: LiveFix) => void, onDenied?: () => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onDenied?.()
    return () => {}
  }
  const take = (position: GeolocationPosition) => {
    const next: LiveFix = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      at: position.timestamp || Date.now(),
      altitude: Number.isFinite(position.coords.altitude ?? NaN) ? position.coords.altitude : null,
      altitudeAccuracy: Number.isFinite(position.coords.altitudeAccuracy ?? NaN) ? position.coords.altitudeAccuracy : null,
      speed: Number.isFinite(position.coords.speed ?? NaN) ? position.coords.speed : null,
    }
    if (!isPreciseFix(next)) return
    queueMicrotask(() => onFix(next))
  }
  const denied = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) queueMicrotask(() => onDenied?.())
  }
  navigator.geolocation.getCurrentPosition(take, denied, gpsOptions)
  const watch = navigator.geolocation.watchPosition(take, denied, gpsOptions)
  return () => navigator.geolocation.clearWatch(watch)
}

export function readCloseLocation(
  onFix: (fix: LiveFix) => void,
  onFail: (reason: 'denied' | 'weak' | 'missing') => void,
  waitMs = 15_000,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onFail('missing')
    return () => {}
  }
  let done = false
  let stopWatch = () => {}
  let timer = 0
  const finish = (next: () => void) => {
    if (done) return
    done = true
    clearTimeout(timer)
    stopWatch()
    next()
  }
  stopWatch = watchLiveLocation(
    (fix) => {
      if (!isGpsFix(fix)) return
      finish(() => onFix(fix))
    },
    () => finish(() => onFail('denied')),
  )
  timer = setTimeout(() => finish(() => onFail('weak')), waitMs) as unknown as number
  return () => finish(() => {})
}

export function mapsPinHref(lat: number, lng: number, zoom = 18): string {
  const q = `${lat.toFixed(6)},${lng.toFixed(6)}`
  return `https://www.google.com/maps?q=${q}&ll=${q}&z=${zoom}`
}

export function mapsDirectionsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
}

export function sendDecision(fix: LiveFix | null, waitedMs: number, denied: boolean): 'wait' | 'send' | 'confirm' | 'blocked' {
  if (isGpsFix(fix)) return 'send'
  if (isPreciseFix(fix)) return 'confirm'
  if (denied && waitedMs >= 8_000) return 'blocked'
  if (waitedMs >= 25_000) return 'blocked'
  return 'wait'
}

export async function nearbyPlaceName(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lon=${encodeURIComponent(String(lng))}&lat=${encodeURIComponent(String(lat))}`)
    if (!response.ok) return null
    const data = await response.json() as { features?: { properties?: Record<string, string | undefined> }[] }
    const props = data.features?.[0]?.properties
    if (!props) return null
    const parts = [props.name, props.street, props.city || props.district || props.county].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}
