import { describe, expect, it } from 'vitest'
import { assignmentBlocked, deskReports, inboxNotifications, isPublicFeed, officeCanRead, QUEUE_OFFICES } from './logic'
import { isPreciseFix, preferLiveFix, normalizePhone, sendDecision, sosMessage } from './lib/sos'
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

describe('sos notifications', () => {
  const notes = [
    { userId: 'u-amina', title: 'SOS help request', body: 'help' },
    { userId: 'u-amina', title: 'Your report has been received.', body: 'report' },
    { userId: 'u-sec', title: 'SOS help request', body: 'help' },
    { userId: 'u-admin', title: 'SOS help request', body: 'help' },
  ]

  it('keeps an SOS bell notice on the admin account only', () => {
    expect(inboxNotifications(user({ id: 'u-amina', role: 'student' }), notes).map((item) => item.title)).toEqual(['Your report has been received.'])
    expect(inboxNotifications(user({ id: 'u-sec', role: 'security' }), notes)).toEqual([])
    expect(inboxNotifications(user({ id: 'u-admin', role: 'admin' }), notes).map((item) => item.title)).toEqual(['SOS help request'])
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
    expect(sosMessage('Amina Rahman', moved)).toContain('https://maps.google.com/?q=23.811102,90.413204')
    expect(sosMessage('Amina Rahman', null)).toContain('Location was not available.')
  })

  it('sends a GPS or Wi-Fi fix and never a city or IP pin', () => {
    const precise = { lat: 23.8103, lng: 90.4125, accuracy: 18, at: 2_000 }
    const wifi = { lat: 24.724182, lng: 89.315582, accuracy: 90, at: 2_000 }
    const neighbourhood = { lat: 24.071, lng: 90.219, accuracy: 500, at: 2_000 }
    const city = { lat: 23.7942, lng: 90.4097, accuracy: 8_000, at: 1_000 }
    const ip = { lat: 24.7399, lng: 88.2099, accuracy: 50_000, at: 1_000 }
    expect(isPreciseFix(precise)).toBe(true)
    expect(isPreciseFix(wifi)).toBe(true)
    expect(isPreciseFix(neighbourhood)).toBe(true)
    expect(isPreciseFix(city)).toBe(false)
    expect(sendDecision(precise, 0, false)).toBe('send')
    expect(sendDecision(wifi, 0, false)).toBe('send')
    expect(sendDecision(neighbourhood, 0, false)).toBe('send')
    expect(sendDecision(city, 4_000, false)).toBe('wait')
    expect(sendDecision(city, 25_000, false)).toBe('blocked')
    expect(sendDecision(ip, 25_000, false)).toBe('blocked')
    expect(sendDecision(null, 1_000, true)).toBe('wait')
    expect(sendDecision(null, 8_000, true)).toBe('blocked')
    expect(preferLiveFix(city, wifi)).toEqual(wifi)
    expect(preferLiveFix(wifi, precise)).toEqual(precise)
    expect(preferLiveFix(precise, ip)).toEqual(precise)
  })
})
