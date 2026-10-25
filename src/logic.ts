import type { CategoryId, Lang, Priority, Report, Role, Status, User } from './types'

export function uid(prefix = ''): string {
  const body = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12) ?? Math.random().toString(36).slice(2, 14)
  return prefix + body
}

export function hoursBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000
}

export function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

export function isOpen(status: Status): boolean {
  return (
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'assigned' ||
    status === 'in_progress' ||
    status === 'reopened'
  )
}

export function isOverdue(report: Report, now = Date.now()): boolean {
  if (!isOpen(report.status)) return false
  return new Date(report.dueAt).getTime() < now
}

export function isUnassigned(report: Report): boolean {
  return isOpen(report.status) && !report.departmentId
}

export function resolvedThisMonth(report: Report, now = new Date()): boolean {
  if (!report.resolvedAt) return false
  const date = new Date(report.resolvedAt)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function isPublicFeed(report: Report): boolean {
  if (report.confidential || report.anonymous) return false
  if (report.category === 'harassment' || report.category === 'safety') return false
  if (report.status === 'draft' || report.status === 'rejected') return false
  return true
}

export function isMapPin(report: Report): boolean {
  return isPublicFeed(report) && isOpen(report.status)
}

export function isStudentAffairs(user: Pick<User, 'role' | 'departmentId'>): boolean {
  return user.role === 'department' && user.departmentId === 'd-affairs'
}

export function isRestrictedDesk(user: Pick<User, 'role' | 'departmentId'> | null): boolean {
  return !!user && (user.role === 'security' || isStudentAffairs(user))
}

export function restrictedVisible(user: User, report: Report): boolean {
  if (report.status === 'draft') return false
  const sensitive = report.confidential || report.category === 'harassment'
  const waiting = !report.departmentId
  if (user.role === 'security') {
    if (report.departmentId === 'd-sec') return true
    return waiting && (sensitive || report.category === 'safety')
  }
  if (isStudentAffairs(user)) {
    if (report.departmentId === 'd-affairs') return true
    return waiting && sensitive
  }
  return false
}

export function canView(user: User, report: Report): boolean {
  if (report.status === 'draft') return report.reporterId === user.id
  if (report.reporterId && report.reporterId === user.id) return true
  if (user.role === 'admin') return true
  if (user.role === 'security' || isStudentAffairs(user)) return restrictedVisible(user, report)
  if (user.role === 'department') {
    if (report.departmentId !== user.departmentId) return false
    if (report.category === 'harassment' || report.confidential) return false
    return true
  }
  return isPublicFeed(report)
}

export function deskReports(user: User, reports: Report[]): Report[] {
  if (user.role === 'admin') return reports.filter((r) => r.status !== 'draft')
  if (user.role === 'security' || isStudentAffairs(user)) return reports.filter((r) => restrictedVisible(user, r))
  if (user.role === 'department') {
    return reports.filter((r) => r.status !== 'draft' && r.departmentId === user.departmentId && canView(user, r))
  }
  return []
}

export function assignmentBlocked(report: Pick<Report, 'confidential' | 'category'>, departmentId: string): boolean {
  const sensitive = report.confidential || report.category === 'harassment'
  if (!sensitive) return false
  return departmentId !== 'd-sec' && departmentId !== 'd-affairs'
}

export const QUEUE_OFFICES = ['d-maint', 'd-elec', 'd-water', 'd-clean', 'd-it', 'd-sec', 'd-affairs'] as const

export function officeCanRead(departmentId: string, report: Report): boolean {
  if (report.status === 'draft' || report.departmentId !== departmentId) return false
  if (assignmentBlocked(report, departmentId)) return false
  return true
}

export function assignedAt(report: Report): string | undefined {
  const hit = [...report.activities]
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
    .find((item) => item.message.toLowerCase().includes('assigned'))
  if (hit) return hit.at
  return report.departmentId ? report.createdAt : undefined
}

export type IdentityMode = 'anonymous' | 'self-anonymous' | 'restricted' | 'named' | 'role-only'

export function identityMode(user: User, report: Report): IdentityMode {
  if (report.anonymous) return report.reporterId === user.id ? 'self-anonymous' : 'anonymous'
  if (report.reporterId === user.id) return 'named'
  const safetyOfficer = user.role === 'admin' || user.role === 'security' || user.departmentId === 'd-affairs'
  if (report.confidential && !safetyOfficer) return 'restricted'
  const assignedOfficer = user.role === 'department' && user.departmentId === report.departmentId
  if (user.role === 'admin' || user.role === 'security' || assignedOfficer) return 'named'
  return 'role-only'
}

export function homePath(role: Role): string {
  if (role === 'student' || role === 'teacher' || role === 'staff') return '/app'
  if (role === 'admin') return '/admin'
  return '/admin/queues'
}

export function isMember(role: Role): boolean {
  return role === 'student' || role === 'teacher' || role === 'staff'
}

export function inboxNotifications<T extends { userId: string; title: string }>(user: { id: string; role: Role } | null | undefined, items: T[]): T[] {
  if (!user) return []
  return items.filter((item) => item.userId === user.id && (item.title !== 'SOS help request' || user.role === 'admin' || user.role === 'security'))
}

export function sosDeskStatus(alert: { seenAt?: string; resolvedAt?: string }): 'sent' | 'seen' | 'solved' {
  if (alert.resolvedAt) return 'solved'
  if (alert.seenAt) return 'seen'
  return 'sent'
}

const STATUS_LABELS: Record<Status, [string, string]> = {
  draft: ['Draft', 'খসড়া'],
  submitted: ['Submitted', 'জমা হয়েছে'],
  under_review: ['Under review', 'পর্যালোচনাধীন'],
  assigned: ['Assigned', 'বরাদ্দ হয়েছে'],
  in_progress: ['In progress', 'কাজ চলছে'],
  resolved: ['Resolved', 'সমাধান হয়েছে'],
  closed: ['Closed', 'বন্ধ'],
  rejected: ['Rejected', 'প্রত্যাখ্যাত'],
  reopened: ['Reopened', 'পুনরায় খোলা'],
}

const PRIORITY_LABELS: Record<Priority, [string, string]> = {
  low: ['Can wait', 'অপেক্ষা করা যায়'],
  medium: ['Schedule it', 'সময় করে করা দরকার'],
  high: ['Blocks daily use', 'দৈনন্দিন ব্যবহার আটকেছে'],
  urgent: ['Safety risk now', 'এখনই নিরাপত্তা ঝুঁকি'],
}

const ROLE_LABELS: Record<Role, [string, string]> = {
  student: ['Student', 'শিক্ষার্থী'],
  teacher: ['Teacher', 'শিক্ষক'],
  staff: ['Staff', 'কর্মকর্তা'],
  department: ['Department', 'বিভাগ'],
  security: ['Security', 'নিরাপত্তা'],
  admin: ['Admin', 'প্রশাসন'],
}

function pair(lang: Lang, labels: [string, string]): string {
  return lang === 'bn' ? labels[1] : labels[0]
}

export function statusLabel(status: Status, lang: Lang): string {
  return pair(lang, STATUS_LABELS[status])
}

export function priorityLabel(priority: Priority, lang: Lang): string {
  return pair(lang, PRIORITY_LABELS[priority])
}

export function roleLabel(role: Role, lang: Lang): string {
  return pair(lang, ROLE_LABELS[role])
}

export function allowedTransitions(user: User, report: Report): Status[] {
  if (
    report.reporterId === user.id &&
    isMember(user.role) &&
    (report.status === 'resolved' || report.status === 'closed')
  ) {
    return ['reopened']
  }
  if (isMember(user.role)) {
    return report.status === 'draft' && report.reporterId === user.id ? ['submitted'] : []
  }
  const map: Record<Status, Status[]> = {
    draft: [],
    submitted: ['under_review', 'rejected'],
    under_review: ['assigned', 'rejected'],
    assigned: ['in_progress', 'rejected'],
    in_progress: ['resolved'],
    resolved: ['closed', 'reopened'],
    closed: ['reopened'],
    rejected: [],
    reopened: ['under_review', 'assigned', 'in_progress'],
  }
  let options = map[report.status]
  if (user.role === 'department') {
    if (!canView(user, report)) return []
    options = options.filter((status) => status === 'in_progress' || status === 'resolved')
  }
  if (user.role === 'security') {
    if (!report.departmentId || !restrictedVisible(user, report)) return []
    options = options.filter((status) => status === 'in_progress' || status === 'resolved')
  }
  return options
}

export function firstResponseHours(report: Report): number | null {
  const pub = report.activities
    .filter((item) => item.visibility === 'public')
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
  if (pub.length < 2) return null
  return Math.max(0, hoursBetween(report.createdAt, pub[1].at))
}

export function awaitingFirstResponse(report: Report): boolean {
  if (!isOpen(report.status)) return false
  return report.activities.filter((item) => item.visibility === 'public').length < 2
}

export function timeAgo(iso: string, lang: Lang): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (hours < 1) return lang === 'bn' ? 'এইমাত্র' : 'Just now'
  if (hours < 24) {
    const n = Math.max(1, Math.floor(hours))
    return lang === 'bn' ? `${n} ঘণ্টা আগে` : `${n}h ago`
  }
  const days = Math.floor(hours / 24)
  return lang === 'bn' ? `${days} দিন আগে` : `${days}d ago`
}

export function dueLabel(report: Report, lang: Lang): string {
  if (!isOpen(report.status)) return ''
  const hours = (new Date(report.dueAt).getTime() - Date.now()) / 3_600_000
  if (hours < 0) {
    const days = Math.max(1, Math.ceil(-hours / 24))
    return lang === 'bn' ? `${days} দিন অতিক্রান্ত` : `${days}d overdue`
  }
  if (hours < 48) {
    const left = Math.max(1, Math.ceil(hours))
    return lang === 'bn' ? `${left} ঘণ্টা বাকি` : `${left}h left`
  }
  const days = Math.ceil(hours / 24)
  return lang === 'bn' ? `${days} দিন বাকি` : `${days}d left`
}

export function formatWhen(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function nextReportId(reports: Report[]): string {
  const nums = reports.map((report) => Number(report.id.replace(/\D/g, ''))).filter((n) => !Number.isNaN(n))
  return `SF-${Math.max(10520, ...nums) + 1}`
}

export function toCsv(rows: string[][]): string {
  const esc = (value: string) => `"${value.replaceAll('"', '""')}"`
  return `\uFEFF${rows.map((row) => row.map((cell) => esc(cell)).join(',')).join('\n')}`
}

export function monthKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}`
}

export function sensitiveCategory(id: CategoryId): boolean {
  return id === 'harassment'
}
