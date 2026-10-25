import type { Session } from '@supabase/supabase-js'
import { buildSeed } from '../data'
import { supabase } from './supabase'
import type { Activity, Announcement, AppNotification, AppState, AuditEntry, Category, Department, EmergencyContact, LostItem, Photo, Report, SosAlert, User } from '../types'

let signedIn: User | null = null
let pullError: string | null = null

export function takePullError(): string | null {
  const value = pullError
  pullError = null
  return value
}

export function rememberUser(user: User | null) {
  signedIn = user
}

export function consumeSignedIn(): User | null {
  const user = signedIn
  signedIn = null
  return user
}

function userFrom(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as User['role'],
    departmentId: row.department_id ? String(row.department_id) : undefined,
    unit: String(row.unit ?? ''),
    identifier: String(row.identifier ?? ''),
    verified: Boolean(row.verified),
    suspended: Boolean(row.suspended),
    notifyInApp: Boolean(row.notify_in_app),
    notifyEmail: Boolean(row.notify_email),
    notifyPush: Boolean(row.notify_push),
  }
}

function categoryFrom(row: Record<string, unknown>): Category {
  return {
    id: row.id as Category['id'],
    en: String(row.en),
    bn: String(row.bn),
    hintEn: String(row.hint_en),
    hintBn: String(row.hint_bn),
    sensitive: Boolean(row.sensitive),
    slaHours: Number(row.sla_hours),
    suggestedDepartmentId: String(row.suggested_department_id ?? ''),
    active: Boolean(row.active),
  }
}

function departmentFrom(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    en: String(row.en),
    bn: String(row.bn),
    lead: String(row.lead),
    email: String(row.email),
    sensitive: Boolean(row.sensitive),
  }
}

function activityFrom(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id),
    at: String(row.at),
    actor: String(row.actor),
    visibility: row.visibility as Activity['visibility'],
    kind: row.kind as Activity['kind'],
    message: String(row.message),
  }
}

function reportFrom(row: Record<string, unknown>, activities: Activity[], confirmations: string[]): Report {
  const photos = Array.isArray(row.photos) ? (row.photos as Photo[]) : []
  const resolution = row.resolution_photo && typeof row.resolution_photo === 'object' ? (row.resolution_photo as Photo) : undefined
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    category: row.category as Report['category'],
    subcategory: row.subcategory ? String(row.subcategory) : '',
    locationId: String(row.location_id),
    locationDetail: String(row.location_detail ?? ''),
    lat: typeof row.lat === 'number' ? row.lat : undefined,
    lng: typeof row.lng === 'number' ? row.lng : undefined,
    photos,
    confidential: Boolean(row.confidential),
    anonymous: Boolean(row.anonymous),
    status: row.status as Report['status'],
    priority: row.priority as Report['priority'],
    departmentId: row.department_id ? String(row.department_id) : undefined,
    assignee: row.assignee ? String(row.assignee) : undefined,
    reporterId: row.reporter_id ? String(row.reporter_id) : '',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    dueAt: String(row.due_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    confirmations,
    rating: typeof row.rating === 'number' ? row.rating : undefined,
    feedback: row.feedback ? String(row.feedback) : undefined,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : undefined,
    resolutionPhoto: resolution,
    infoRequested: Boolean(row.info_requested),
    rejectReason: row.reject_reason ? String(row.reject_reason) : undefined,
    blocksAccess: Boolean(row.blocks_access),
    contactWindow: String(row.contact_window ?? ''),
    activities,
  }
}

function reportRow(report: Report) {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    subcategory: report.subcategory || null,
    location_id: report.locationId,
    location_detail: report.locationDetail,
    lat: report.lat ?? null,
    lng: report.lng ?? null,
    photos: report.photos,
    confidential: report.confidential,
    anonymous: report.anonymous,
    status: report.status,
    priority: report.priority,
    department_id: report.departmentId ?? null,
    assignee: report.assignee ?? null,
    reporter_id: report.anonymous ? null : (report.reporterId || null),
    created_at: report.createdAt,
    updated_at: report.updatedAt,
    due_at: report.dueAt,
    resolved_at: report.resolvedAt ?? null,
    closed_at: report.closedAt ?? null,
    rating: report.rating ?? null,
    feedback: report.feedback ?? null,
    resolution_note: report.resolutionNote ?? null,
    resolution_photo: report.resolutionPhoto ?? null,
    info_requested: report.infoRequested,
    reject_reason: report.rejectReason ?? null,
    blocks_access: report.blocksAccess,
    contact_window: report.contactWindow,
  }
}

async function rows(table: string, query?: { column: string; value: string }) {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' }
  let request = supabase.from(table).select('*')
  if (query) request = request.eq(query.column, query.value)
  const { data, error } = await request
  if (error) {
    if (!pullError) pullError = error.message
    return { data: [], error: error.message }
  }
  return { data: (data ?? []) as Record<string, unknown>[], error: null }
}

export async function allocateReportId(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('next_report_id')
  if (error || typeof data !== 'string') return null
  return data
}

export async function pullCampus(session: Session | null): Promise<AppState> {
  const fallback = buildSeed()
  const empty: AppState = {
    ...fallback,
    users: [],
    reports: [],
    reportIdentities: {},
    notifications: [],
    announcements: [],
    lostFound: [],
    audit: [],
    emergencyContacts: [],
    sosAlerts: [],
    codes: {},
    sessionUserId: null,
  }
  if (!supabase) return empty

  const [categories, departments, announcements] = await Promise.all([
    rows('categories'),
    rows('departments'),
    rows('announcements'),
  ])

  empty.categories = categories.data.length ? categories.data.map(categoryFrom) : fallback.categories
  empty.departments = departments.data.length ? departments.data.map(departmentFrom) : fallback.departments
  empty.announcements = announcements.data.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    kind: row.kind as Announcement['kind'],
    locationId: row.location_id ? String(row.location_id) : undefined,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  }))

  if (!session) {
    const { data, error } = await supabase.from('public_reports').select('*')
    if (error && !pullError) pullError = error.message
    if (!error && data) {
      empty.reports = (data as Record<string, unknown>[]).map((row) => reportFrom(row, Array.isArray(row.activities) ? (row.activities as Record<string, unknown>[]).map(activityFrom) : [], []))
    }
    return empty
  }

  const [profiles, reports, activities, confirmations, notifications, lost, audit, contacts, alerts, identities] = await Promise.all([
    rows('profiles'),
    rows('reports'),
    rows('report_activities'),
    rows('report_confirmations'),
    rows('notifications'),
    rows('lost_found'),
    rows('audit_log'),
    rows('emergency_contacts'),
    rows('sos_alerts'),
    rows('report_identities'),
  ])

  empty.users = profiles.data.map(userFrom)
  const byReport = new Map<string, Activity[]>()
  for (const row of activities.data) {
    const id = String(row.report_id)
    const list = byReport.get(id) ?? []
    list.push(activityFrom(row))
    byReport.set(id, list)
  }
  const confirms = new Map<string, string[]>()
  for (const row of confirmations.data) {
    const id = String(row.report_id)
    const list = confirms.get(id) ?? []
    list.push(String(row.user_id))
    confirms.set(id, list)
  }
  const identityMap: Record<string, string> = {}
  for (const row of identities.data) {
    identityMap[String(row.report_id)] = String(row.user_id)
  }
  empty.reportIdentities = identityMap
  const email = session.user.email?.toLowerCase()
  const sessionUserId = empty.users.find((user) => user.email.toLowerCase() === email)?.id ?? null
  empty.sessionUserId = sessionUserId
  empty.reports = reports.data.map((row) => {
    const report = reportFrom(row, (byReport.get(String(row.id)) ?? []).sort((a, b) => +new Date(a.at) - +new Date(b.at)), confirms.get(String(row.id)) ?? [])
    if (report.anonymous) {
      // Staff never get report_identities rows. Owners re-attach their own id for My reports.
      if (sessionUserId && identityMap[report.id] === sessionUserId) return { ...report, reporterId: sessionUserId }
      return { ...report, reporterId: '' }
    }
    return report
  })
  empty.notifications = notifications.data.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    body: String(row.body),
    href: String(row.href),
    read: Boolean(row.read),
    createdAt: String(row.created_at),
    kind: row.kind ? (row.kind as AppNotification['kind']) : undefined,
  }))
  empty.lostFound = lost.data.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    place: String(row.place),
    detail: String(row.detail ?? ''),
    kind: row.kind as LostItem['kind'],
    contact: String(row.contact),
    reporterId: String(row.reporter_id),
    status: row.status as LostItem['status'],
    createdAt: String(row.created_at),
  }))
  empty.audit = audit.data.map((row) => ({
    id: String(row.id),
    at: String(row.at),
    actor: String(row.actor),
    action: String(row.action),
    target: String(row.target),
  }))
  empty.emergencyContacts = contacts.data.map(contactFrom)
  empty.sosAlerts = alerts.data.map(sosFrom)
  return empty
}

function contactFrom(row: Record<string, unknown>): EmergencyContact {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    phone: String(row.phone),
  }
}

function sosFrom(row: Record<string, unknown>): SosAlert {
  const contacts = Array.isArray(row.contacts) ? row.contacts as { name?: string; phone?: string }[] : []
  return {
    id: String(row.id),
    userId: String(row.user_id),
    senderName: String(row.sender_name),
    lat: typeof row.lat === 'number' ? row.lat : undefined,
    lng: typeof row.lng === 'number' ? row.lng : undefined,
    accuracyM: typeof row.accuracy_m === 'number' ? row.accuracy_m : undefined,
    message: String(row.message),
    contacts: contacts.filter((item) => item.phone).map((item) => ({ name: String(item.name ?? ''), phone: String(item.phone) })),
    smsStatus: (row.sms_status as SosAlert['smsStatus']) ?? 'pending',
    smsDetail: String(row.sms_detail ?? ''),
    createdAt: String(row.created_at),
    seenAt: row.seen_at ? String(row.seen_at) : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  }
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export async function pushDiff(prev: AppState, next: AppState): Promise<string | null> {
  if (!supabase || !next.sessionUserId) return null
  const errors: string[] = []
  const note = (error: { message: string } | null) => {
    if (error) errors.push(error.message)
  }

  const prevReports = new Map(prev.reports.map((report) => [report.id, report]))
  for (const report of next.reports) {
    const old = prevReports.get(report.id)
    if (old && same(old, report)) continue
    const saved = await supabase.from('reports').upsert(reportRow(report))
    note(saved.error)
    const known = new Set(old?.activities.map((item) => item.id) ?? [])
    const fresh = report.activities.filter((item) => !known.has(item.id))
    if (fresh.length) {
      const inserted = await supabase.from('report_activities').insert(fresh.map((item) => ({
        id: item.id,
        report_id: report.id,
        at: item.at,
        actor: item.actor,
        visibility: item.visibility,
        kind: item.kind,
        message: item.message,
      })))
      note(inserted.error)
    }
    const oldConfirms = new Set(old?.confirmations ?? [])
    const added = report.confirmations.filter((id) => !oldConfirms.has(id))
    if (added.length) {
      const inserted = await supabase.from('report_confirmations').insert(added.map((userId) => ({ report_id: report.id, user_id: userId })))
      note(inserted.error)
    }
  }
  for (const report of prev.reports) {
    if (next.reports.some((item) => item.id === report.id)) continue
    const removed = await supabase.from('reports').delete().eq('id', report.id)
    note(removed.error)
  }

  const prevNotes = new Map(prev.notifications.map((item) => [item.id, item]))
  const freshNotes = next.notifications.filter((item) => !prevNotes.has(item.id))
  if (freshNotes.length) {
    const inserted = await supabase.from('notifications').insert(freshNotes.map((item) => ({
      id: item.id,
      user_id: item.userId,
      title: item.title,
      body: item.body,
      href: item.href,
      read: item.read,
      created_at: item.createdAt,
      kind: item.kind ?? null,
    })))
    note(inserted.error)
  }
  for (const item of next.notifications) {
    const old = prevNotes.get(item.id)
    if (!old || old.read === item.read) continue
    const updated = await supabase.from('notifications').update({ read: item.read }).eq('id', item.id)
    note(updated.error)
  }

  const prevUsers = new Map(prev.users.map((user) => [user.id, user]))
  for (const user of next.users) {
    const old = prevUsers.get(user.id)
    if (!old || same(old, user)) continue
    const updated = await supabase.from('profiles').update({
      name: user.name,
      role: user.role,
      department_id: user.departmentId ?? null,
      unit: user.unit,
      identifier: user.identifier,
      suspended: user.suspended,
      notify_in_app: user.notifyInApp,
      notify_email: user.notifyEmail,
      notify_push: user.notifyPush,
    }).eq('id', user.id)
    note(updated.error)
  }

  const prevDepartments = new Map(prev.departments.map((item) => [item.id, item]))
  for (const item of next.departments) {
    const old = prevDepartments.get(item.id)
    if (!old || same(old, item)) continue
    const updated = await supabase.from('departments').update({ lead: item.lead, email: item.email }).eq('id', item.id)
    note(updated.error)
  }

  const prevCategories = new Map(prev.categories.map((item) => [item.id, item]))
  for (const item of next.categories) {
    const old = prevCategories.get(item.id)
    if (!old || same(old, item)) continue
    const updated = await supabase.from('categories').update({ active: item.active, sla_hours: item.slaHours }).eq('id', item.id)
    note(updated.error)
  }

  const prevAnnouncements = new Map(prev.announcements.map((item) => [item.id, item]))
  for (const item of next.announcements) {
    const old = prevAnnouncements.get(item.id)
    if (old && same(old, item)) continue
    if (!old) {
      const inserted = await supabase.from('announcements').insert({
        id: item.id,
        title: item.title,
        body: item.body,
        kind: item.kind,
        location_id: item.locationId ?? null,
        active: item.active,
        created_at: item.createdAt,
      })
      note(inserted.error)
    } else {
      const updated = await supabase.from('announcements').update({ active: item.active }).eq('id', item.id)
      note(updated.error)
    }
  }

  const prevLost = new Map(prev.lostFound.map((item) => [item.id, item]))
  for (const item of next.lostFound) {
    const old = prevLost.get(item.id)
    if (old && same(old, item)) continue
    if (!old) {
      const inserted = await supabase.from('lost_found').insert({
        id: item.id,
        title: item.title,
        place: item.place,
        detail: item.detail,
        kind: item.kind,
        contact: item.contact,
        reporter_id: item.reporterId,
        status: item.status,
        created_at: item.createdAt,
      })
      note(inserted.error)
    } else {
      const updated = await supabase.from('lost_found').update({ status: item.status }).eq('id', item.id)
      note(updated.error)
    }
  }

  const prevContacts = new Map((prev.emergencyContacts ?? []).map((item) => [item.id, item]))
  for (const item of next.emergencyContacts ?? []) {
    const old = prevContacts.get(item.id)
    if (old && same(old, item)) continue
    if (!old) {
      const inserted = await supabase.from('emergency_contacts').insert({
        id: item.id,
        user_id: item.userId,
        name: item.name,
        phone: item.phone,
      })
      note(inserted.error)
    } else {
      const updated = await supabase.from('emergency_contacts').update({ name: item.name, phone: item.phone }).eq('id', item.id)
      note(updated.error)
    }
  }
  for (const item of prev.emergencyContacts ?? []) {
    if ((next.emergencyContacts ?? []).some((nextItem) => nextItem.id === item.id)) continue
    const removed = await supabase.from('emergency_contacts').delete().eq('id', item.id)
    note(removed.error)
  }

  const prevAlerts = new Map((prev.sosAlerts ?? []).map((item) => [item.id, item]))
  for (const item of next.sosAlerts ?? []) {
    const old = prevAlerts.get(item.id)
    if (old && same(old, item)) continue
    if (!old) {
      const inserted = await supabase.from('sos_alerts').insert({
        id: item.id,
        user_id: item.userId,
        sender_name: item.senderName,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        accuracy_m: item.accuracyM ?? null,
        message: item.message,
        contacts: item.contacts,
        sms_status: item.smsStatus,
        sms_detail: item.smsDetail,
        created_at: item.createdAt,
      })
      note(inserted.error)
    } else {
      const patch: Record<string, unknown> = {}
      if (old.smsStatus !== item.smsStatus || old.smsDetail !== item.smsDetail) {
        patch.sms_status = item.smsStatus
        patch.sms_detail = item.smsDetail
      }
      if (old.lat !== item.lat || old.lng !== item.lng || old.accuracyM !== item.accuracyM || old.message !== item.message) {
        patch.lat = item.lat ?? null
        patch.lng = item.lng ?? null
        patch.accuracy_m = item.accuracyM ?? null
        patch.message = item.message
      }
      if ((old.seenAt ?? null) !== (item.seenAt ?? null)) patch.seen_at = item.seenAt ?? null
      if ((old.resolvedAt ?? null) !== (item.resolvedAt ?? null)) patch.resolved_at = item.resolvedAt ?? null
      if (Object.keys(patch).length) {
        const updated = await supabase.from('sos_alerts').update(patch).eq('id', item.id)
        note(updated.error)
      }
    }
  }

  const knownAudit = new Set(prev.audit.map((item) => item.id))
  const freshAudit = next.audit.filter((item) => !knownAudit.has(item.id))
  if (freshAudit.length) {
    const inserted = await supabase.from('audit_log').insert(freshAudit.map((item: AuditEntry) => ({
      id: item.id,
      at: item.at,
      actor: item.actor,
      action: item.action,
      target: item.target,
    })))
    note(inserted.error)
  }

  return errors[0] ?? null
}
