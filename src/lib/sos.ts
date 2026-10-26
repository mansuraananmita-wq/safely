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
    const next = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      at: position.timestamp || Date.now(),
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
    (fix) => finish(() => onFix(fix)),
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

export function sendDecision(fix: LiveFix | null, waitedMs: number, denied: boolean): 'wait' | 'send' | 'blocked' {
  if (isPreciseFix(fix)) return 'send'
  if (denied && waitedMs >= 8_000) return 'blocked'
  if (waitedMs >= 25_000) return 'blocked'
  return 'wait'
}
