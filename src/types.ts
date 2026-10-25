export type Lang = 'en' | 'bn'
export type Role = 'student' | 'teacher' | 'staff' | 'department' | 'security' | 'admin'
export type Status =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'
  | 'reopened'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type CategoryId =
  | 'infrastructure'
  | 'lighting'
  | 'water'
  | 'cleanliness'
  | 'safety'
  | 'harassment'
  | 'classroom'
  | 'internet'
  | 'accessibility'
  | 'other'

export interface Category {
  id: CategoryId
  en: string
  bn: string
  hintEn: string
  hintBn: string
  sensitive: boolean
  slaHours: number
  suggestedDepartmentId: string
  active: boolean
}

export interface Department {
  id: string
  en: string
  bn: string
  lead: string
  email: string
  sensitive: boolean
}

export interface Place {
  id: string
  en: string
  bn: string
  short: string
  lat: number
  lng: number
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  departmentId?: string
  unit: string
  identifier: string
  verified: boolean
  suspended: boolean
  notifyInApp: boolean
  notifyEmail: boolean
  notifyPush: boolean
}

export interface Photo {
  name: string
  url?: string
}

export interface Activity {
  id: string
  at: string
  actor: string
  visibility: 'public' | 'internal'
  kind: 'system' | 'reply' | 'internal'
  message: string
}

export interface Report {
  id: string
  title: string
  description: string
  category: CategoryId
  subcategory?: string
  locationId: string
  locationDetail: string
  lat?: number
  lng?: number
  photos: Photo[]
  confidential: boolean
  anonymous: boolean
  status: Status
  priority: Priority
  departmentId?: string
  assignee?: string
  reporterId: string
  createdAt: string
  updatedAt: string
  dueAt: string
  resolvedAt?: string
  closedAt?: string
  confirmations: string[]
  rating?: number
  feedback?: string
  resolutionNote?: string
  resolutionPhoto?: Photo
  infoRequested: boolean
  rejectReason?: string
  blocksAccess: boolean
  contactWindow: string
  activities: Activity[]
}

export type NoticeKind = 'received' | 'assigned' | 'info' | 'resolved'

export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  href: string
  read: boolean
  createdAt: string
  kind?: NoticeKind
}

export interface Announcement {
  id: string
  title: string
  body: string
  kind: 'info' | 'maintenance' | 'safety'
  locationId?: string
  active: boolean
  createdAt: string
}

export interface LostItem {
  id: string
  title: string
  place: string
  detail: string
  kind: 'lost' | 'found'
  contact: string
  reporterId: string
  status: 'open' | 'resolved'
  createdAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  target: string
}

export interface EmergencyContact {
  id: string
  userId: string
  name: string
  phone: string
}

export type SosSmsStatus = 'pending' | 'sent' | 'partial' | 'skipped' | 'failed'

export type SosDeskStatus = 'sent' | 'seen' | 'solved'

export interface SosAlert {
  id: string
  userId: string
  senderName: string
  lat?: number
  lng?: number
  accuracyM?: number
  message: string
  contacts: { name: string; phone: string }[]
  smsStatus: SosSmsStatus
  smsDetail: string
  createdAt: string
  seenAt?: string
  resolvedAt?: string
}

export interface Prefs {
  lang: Lang
  textSize: 'default' | 'large'
  contrast: boolean
}

export interface AppState {
  users: User[]
  reports: Report[]
  /** Owner-only map of anonymous report id → profile id. Staff never receive these rows from RLS. */
  reportIdentities: Record<string, string>
  notifications: AppNotification[]
  announcements: Announcement[]
  lostFound: LostItem[]
  audit: AuditEntry[]
  emergencyContacts: EmergencyContact[]
  sosAlerts: SosAlert[]
  categories: Category[]
  departments: Department[]
  codes: Record<string, string>
  sessionUserId: string | null
  prefs: Prefs
}
