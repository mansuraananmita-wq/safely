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

export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  href: string
  read: boolean
  createdAt: string
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

export interface Prefs {
  lang: Lang
  textSize: 'default' | 'large'
  contrast: boolean
}

export interface AppState {
  users: User[]
  reports: Report[]
  notifications: AppNotification[]
  announcements: Announcement[]
  lostFound: LostItem[]
  audit: AuditEntry[]
  categories: Category[]
  departments: Department[]
  codes: Record<string, string>
  sessionUserId: string | null
  prefs: Prefs
}
