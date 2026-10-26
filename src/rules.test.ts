import { describe, expect, it } from 'vitest'
import { assignmentBlocked, deskReports, identityMode, inboxNotifications, isPublicFeed, isReportOwner, officeCanRead, QUEUE_OFFICES, sosDeskStatus, staffVisibleReporterId } from './logic'
import { isGpsFix, isPreciseFix, locationSource, mapsPinHref, preferLiveFix, normalizePhone, readCloseLocation, sendDecision, shouldPushLiveFix, sosLiveOpen, sosMessage } from './lib/sos'
import type { Report, User } from './types'

function user(partial: Partial<User> & Pick<User, 'id' | 'role'>): User {
  return {
    name: partial.id,
    email: `${partial.id}@padma.edu`,
    unit: 'Campus',
    identifier: 'ID',
    verified: true,
    suspended: false,
    notifyInApp: true,
    notifyEmail: false,
    notifyPush: false,
    ...partial,
  }
}

function report(partial: Partial<Report> & Pick<Report, 'id' | 'category' | 'status'>): Report {
  return {
    title: 'A campus problem that needs a look',
    description: 'Enough detail for the desk to understand the place.',
    locationId: 'library',
    locationDetail: 'North door',
    photos: [],
    confidential: false,
    anonymous: false,
    priority: 'medium',
    reporterId: 'u-amina',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    dueAt: '2026-10-16T00:00:00.000Z',
    confirmations: [],
    infoRequested: false,
    blocksAccess: false,
    contactWindow: '',
    activities: [],
    ...partial,
  }
}

describe('report privacy', () => {
  it('keeps harassment, confidential, anonymous, and safety stories off the public feed', () => {
    expect(isPublicFeed(report({ id: '1', category: 'water', status: 'submitted' }))).toBe(true)
    expect(isPublicFeed(report({ id: '2', category: 'harassment', status: 'submitted' }))).toBe(false)
    expect(isPublicFeed(report({ id: '3', category: 'safety', status: 'submitted' }))).toBe(false)
    expect(isPublicFeed(report({ id: '4', category: 'water', status: 'submitted', confidential: true }))).toBe(false)
    expect(isPublicFeed(report({ id: '5', category: 'water', status: 'submitted', anonymous: true }))).toBe(false)
    expect(isPublicFeed(report({ id: '6', category: 'water', status: 'draft' }))).toBe(false)
  })

  it('assigns a confidential report only to security or student affairs', () => {
    const secret = { confidential: true, category: 'harassment' as const }
    expect(assignmentBlocked(secret, 'd-maint')).toBe(true)
    expect(assignmentBlocked(secret, 'd-clean')).toBe(true)
    expect(assignmentBlocked(secret, 'd-sec')).toBe(false)
    expect(assignmentBlocked(secret, 'd-affairs')).toBe(false)
  })

  it('opens the cleaning queue for assigned cleaning reports and keeps harassment with the restricted desks', () => {
    expect(QUEUE_OFFICES).toContain('d-clean')
    const cleaning = report({ id: 'c', category: 'cleanliness', status: 'assigned', departmentId: 'd-clean' })
    const misplaced = report({ id: 's', category: 'harassment', status: 'assigned', departmentId: 'd-clean', confidential: true })
    expect(officeCanRead('d-clean', cleaning)).toBe(true)
    expect(officeCanRead('d-clean', misplaced)).toBe(false)
    const waiting = report({ id: 'w', category: 'harassment', status: 'submitted', confidential: true })
    expect(deskReports(user({ id: 'u-sec', role: 'security' }), [waiting, cleaning]).map((item) => item.id)).toEqual(['w'])
    expect(deskReports(user({ id: 'u-aff', role: 'department', departmentId: 'd-affairs' }), [waiting]).map((item) => item.id)).toEqual(['w'])
  })
})

describe('anonymous reporter identity', () => {
  it('hides reporter id from staff views and keeps ownership via identities', () => {
    const anon = report({ id: 'SF-A', category: 'harassment', status: 'submitted', anonymous: true, confidential: true, reporterId: '' })
    const identities = { 'SF-A': 'u-amina' }
    expect(staffVisibleReporterId(anon)).toBe('')
    expect(isReportOwner(user({ id: 'u-amina', role: 'student' }), anon, identities)).toBe(true)
    expect(isReportOwner(user({ id: 'u-admin', role: 'admin' }), anon, identities)).toBe(false)
    expect(identityMode(user({ id: 'u-admin', role: 'admin' }), anon, identities)).toBe('anonymous')
    expect(identityMode(user({ id: 'u-amina', role: 'student' }), anon, identities)).toBe('self-anonymous')
    expect(identityMode(user({ id: 'u-sec', role: 'security' }), anon, identities)).toBe('anonymous')
    expect(identityMode(user({ id: 'u-maint', role: 'department', departmentId: 'd-maint' }), anon, identities)).toBe('anonymous')
  })
})

describe('sos notifications', () => {
  const notes = [
    { userId: 'u-amina', title: 'SOS help request', body: 'help' },
    { userId: 'u-amina', title: 'Your report has been received.', body: 'report' },
    { userId: 'u-sec', title: 'SOS help request', body: 'help' },
    { userId: 'u-admin', title: 'SOS help request', body: 'help' },
  ]

  it('keeps an SOS bell notice on admin and security accounts', () => {
    expect(inboxNotifications(user({ id: 'u-amina', role: 'student' }), notes).map((item) => item.title)).toEqual(['Your report has been received.'])
    expect(inboxNotifications(user({ id: 'u-sec', role: 'security' }), notes).map((item) => item.title)).toEqual(['SOS help request'])
    expect(inboxNotifications(user({ id: 'u-admin', role: 'admin' }), notes).map((item) => item.title)).toEqual(['SOS help request'])
  })

  it('maps sender-facing SOS status from seen_at and resolved_at', () => {
    expect(sosDeskStatus({})).toBe('sent')
    expect(sosDeskStatus({ seenAt: '2026-10-26T00:00:00.000Z' })).toBe('seen')
    expect(sosDeskStatus({ seenAt: '2026-10-26T00:00:00.000Z', resolvedAt: '2026-10-26T01:00:00.000Z' })).toBe('solved')
  })
})

describe('sos live location', () => {
  it('rejects emergency numbers and keeps a Bangladesh mobile', () => {
    expect(normalizePhone('999')).toBeNull()
    expect(normalizePhone('01711111111')).toBe('+8801711111111')
  })

  it('keeps a fresh precise fix and does not fall back to an older coarse point', () => {
    const coarse = { lat: 24.071081, lng: 90.219355, accuracy: 500, at: 1_000 }
    const live = { lat: 23.810331, lng: 90.412521, accuracy: 8, at: 2_000 }
    const moved = { lat: 23.811102, lng: 90.413204, accuracy: 14, at: 3_000 }
    const coarseAgain = { lat: 24.071081, lng: 90.219355, accuracy: 500, at: 4_000 }
    expect(preferLiveFix(coarse, live)).toEqual(live)
    expect(preferLiveFix(live, moved)).toEqual(moved)
    expect(preferLiveFix(moved, coarseAgain)).toEqual(moved)
    expect(sosMessage('Amina Rahman', moved)).toContain('q=23.811102,90.413204')
    expect(sosMessage('Amina Rahman', null)).toContain('Location was not available.')
  })

  it('sends a GPS fix, asks to confirm Wi-Fi, and never sends a city or IP pin', () => {
    const precise = { lat: 23.8103, lng: 90.4125, accuracy: 18, at: 2_000 }
    const wifi = { lat: 24.724182, lng: 89.315582, accuracy: 90, at: 2_000 }
    const neighbourhood = { lat: 24.071, lng: 90.219, accuracy: 500, at: 2_000 }
    const city = { lat: 23.7942, lng: 90.4097, accuracy: 8_000, at: 1_000 }
    const ip = { lat: 24.7399, lng: 88.2099, accuracy: 50_000, at: 1_000 }
    expect(isPreciseFix(precise)).toBe(true)
    expect(isPreciseFix(wifi)).toBe(true)
    expect(isPreciseFix(neighbourhood)).toBe(false)
    expect(isPreciseFix(city)).toBe(false)
    expect(sendDecision({ ...precise, altitudeAccuracy: 4 }, 0, false)).toBe('send')
    expect(sendDecision({ ...precise, altitude: 12 }, 0, false)).toBe('confirm')
    expect(sendDecision(precise, 0, false)).toBe('confirm')
    expect(sendDecision(wifi, 0, false)).toBe('confirm')
    expect(locationSource({ lat: 24.071387, lng: 90.216199, accuracy: 62, at: 1, altitude: 8 })).toBe('wifi')
    expect(isGpsFix({ lat: 24.0615424, lng: 90.2201434, accuracy: 8, at: 1, altitudeAccuracy: 4 })).toBe(true)
    expect(sendDecision(neighbourhood, 0, false)).toBe('wait')
    expect(sendDecision(neighbourhood, 25_000, false)).toBe('blocked')
    expect(sendDecision(city, 4_000, false)).toBe('wait')
    expect(sendDecision(city, 25_000, false)).toBe('blocked')
    expect(sendDecision(ip, 25_000, false)).toBe('blocked')
    expect(sendDecision(null, 1_000, true)).toBe('wait')
    expect(sendDecision(null, 8_000, true)).toBe('blocked')
    expect(preferLiveFix(city, wifi)).toEqual(wifi)
    expect(preferLiveFix(wifi, precise)).toEqual(precise)
    expect(preferLiveFix(precise, ip)).toEqual(precise)
    expect(mapsPinHref(23.810331, 90.412521)).toContain('q=23.810331,90.412521')
    expect(mapsPinHref(23.810331, 90.412521)).toContain('ll=23.810331,90.412521')
  })

  it('readCloseLocation keeps a sync GPS callback and does not throw', async () => {
    const geo = {
      getCurrentPosition(ok: (position: GeolocationPosition) => void) {
        ok({
          coords: { latitude: 24.0615424, longitude: 90.2201434, accuracy: 8, altitude: 14, altitudeAccuracy: 4, heading: null, speed: 0 },
          timestamp: 1,
        } as GeolocationPosition)
      },
      watchPosition() { return 1 },
      clearWatch() {},
    }
    const previous = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: geo } })
    const got = await new Promise<{ lat: number; accuracy: number } | string>((resolve) => {
      readCloseLocation((fix) => resolve({ lat: fix.lat, accuracy: fix.accuracy }), (reason) => resolve(reason), 1_000)
    })
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previous })
    expect(got).toEqual({ lat: 24.0615424, accuracy: 8 })
  })

  it('pushes a walk of similar GPS accuracy and rejects a city-wide later guess', () => {
    const sent = { lat: 23.810331, lng: 90.412521, accuracy: 12, at: 1_000 }
    const walked = { lat: 23.810800, lng: 90.412900, accuracy: 18, at: 8_000 }
    const jitter = { lat: 23.810332, lng: 90.412522, accuracy: 14, at: 2_000 }
    const city = { lat: 23.7942, lng: 90.4097, accuracy: 8_000, at: 9_000 }
    expect(shouldPushLiveFix(sent, walked)).toBe(true)
    expect(shouldPushLiveFix(sent, jitter)).toBe(false)
    expect(shouldPushLiveFix(sent, city)).toBe(false)
    const gps = { lat: 24.0615424, lng: 90.2201434, accuracy: 8, at: 1_000, altitudeAccuracy: 4 }
    const hallWifi = { lat: 24.071387, lng: 90.216199, accuracy: 62, at: 8_000 }
    expect(shouldPushLiveFix(gps, hallWifi)).toBe(false)
    expect(sosLiveOpen(new Date(Date.now() - 30_000).toISOString())).toBe(true)
    expect(sosLiveOpen(new Date(Date.now() - 4 * 60_000).toISOString())).toBe(false)
  })
})
