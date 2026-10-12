import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { buildSeed } from './data'
import type { Session } from '@supabase/supabase-js'
import { DEMO_PASSWORD, isRemote, supabase } from './lib/supabase'
import { consumeSignedIn, allocateReportId, pullCampus, pushDiff, rememberUser, takePullError } from './lib/sync'
import { allowedTransitions, assignmentBlocked, canView, isOpen, nextReportId, uid } from './logic'
import type {
  Activity,
  Announcement,
  AppNotification,
  AppState,
  AuditEntry,
  Category,
  Department,
  Lang,
  LostItem,
  NoticeKind,
  Photo,
  Priority,
  Report,
  Role,
  Status,
  User,
} from './types'

export const STORAGE_KEY = 'safely-preview-v1'
const PREFS_KEY = 'safely-prefs'

export { consumeSignedIn }

function readPrefs(): AppState['prefs'] | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState['prefs']
    if (parsed?.lang !== 'en' && parsed?.lang !== 'bn') return null
    return parsed
  } catch {
    return null
  }
}

function shell(): AppState {
  const seed = buildSeed()
  return {
    ...seed,
    users: [],
    reports: [],
    notifications: [],
    announcements: [],
    lostFound: [],
    audit: [],
    codes: {},
    sessionUserId: null,
    prefs: readPrefs() ?? seed.prefs,
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildSeed()
    const parsed = JSON.parse(raw) as { version?: number; state?: AppState }
    if (parsed.version !== 1 || !parsed.state?.reports || !parsed.state.users || !parsed.state.categories) return buildSeed()
    return withSampleNotices(parsed.state)
  } catch {
    return buildSeed()
  }
}

function withSampleNotices(state: AppState): AppState {
  const ids = ['n-sample-received', 'n-sample-assigned', 'n-sample-info', 'n-sample-resolved']
  const have = new Set(state.notifications.map((item) => item.id))
  if (ids.every((id) => have.has(id))) return state
  const missing = buildSeed().notifications.filter((item) => item.id.startsWith('n-sample-') && !have.has(item.id))
  if (!missing.length) return state
  const next = { ...state, notifications: [...missing, ...state.notifications] }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: next }))
  } catch {
    /* The in-memory copy still shows the notices if the saved preview is too large. */
  }
  return next
}

function persist(state: AppState) {
  const write = (value: AppState) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: value }))
  try {
    write(state)
  } catch {
    const slim: AppState = {
      ...state,
      reports: state.reports.map((report) => ({
        ...report,
        photos: report.photos.map((photo) => ({ name: photo.name })),
        resolutionPhoto: report.resolutionPhoto ? { name: report.resolutionPhoto.name } : undefined,
      })),
    }
    try {
      write(slim)
    } catch {
      /* Preview storage is full. */
    }
  }
}

function pin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function nowIso(): string {
  return new Date().toISOString()
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

function activity(actor: string, visibility: Activity['visibility'], kind: Activity['kind'], message: string): Activity {
  return { id: uid('a'), at: nowIso(), actor, visibility, kind, message }
}

function withNotes(state: AppState, users: User[], title: string, body: string, href: string, kind?: NoticeKind): AppState {
  const notes: AppNotification[] = users
    .filter((user) => user.notifyInApp && !user.suspended)
    .map((user) => ({ id: uid('n'), userId: user.id, title, body, href, read: false, createdAt: nowIso(), kind }))
  return { ...state, notifications: [...notes, ...state.notifications].slice(0, 200) }
}

function withAudit(state: AppState, actor: string, action: string, target: string): AppState {
  const entry: AuditEntry = { id: uid('au'), at: nowIso(), actor, action, target }
  return { ...state, audit: [entry, ...state.audit].slice(0, 300) }
}

function deskAudience(state: AppState, report: Pick<Report, 'confidential' | 'category'>): User[] {
  if (report.confidential || report.category === 'harassment') {
    return state.users.filter((user) => user.role === 'admin' || user.role === 'security' || user.departmentId === 'd-affairs')
  }
  if (report.category === 'safety') return state.users.filter((user) => user.role === 'admin' || user.role === 'security')
  return state.users.filter((user) => user.role === 'admin')
}

function replaceReport(state: AppState, report: Report): AppState {
  const exists = state.reports.some((item) => item.id === report.id)
  return {
    ...state,
    reports: exists ? state.reports.map((item) => (item.id === report.id ? report : item)) : [report, ...state.reports],
  }
}

export type ReportInput = {
  id?: string
  title: string
  description: string
  category: Report['category']
  subcategory?: string
  locationId: string
  locationDetail: string
  lat?: number
  lng?: number
  photos: Photo[]
  confidential: boolean
  anonymous: boolean
  priority: Priority
  blocksAccess: boolean
  contactWindow: string
}

type Toast = { id: string; text: string }

type Api = {
  state: AppState
  currentUser: User | null
  lang: Lang
  tx: (en: string, bn: string) => string
  toasts: Toast[]
  toast: (text: string) => void
  remote: boolean
  ready: boolean
  login: (email: string, password: string) => Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null>
  loginDirect: (email: string) => Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null>
  logout: () => void
  register: (input: { name: string; email: string; role: Role; unit: string; identifier: string; password: string }) => Promise<'email' | 'exists' | 'role' | 'signed-in' | null>
  verify: (email: string, code: string) => boolean
  resend: (email: string) => void
  requestReset: (email: string) => Promise<boolean>
  completeReset: (email: string, code: string) => boolean
  setLang: (lang: Lang) => void
  setTextSize: (size: 'default' | 'large') => void
  setContrast: (on: boolean) => void
  saveDraft: (input: ReportInput) => Promise<string | null>
  submitReport: (input: ReportInput) => Promise<string | null>
  deleteDraft: (id: string) => void
  addComment: (reportId: string, body: string, visibility: 'public' | 'internal') => void
  setStatus: (reportId: string, status: Status, note: string, resolutionPhoto?: Photo) => boolean
  assign: (reportId: string, departmentId: string, assignee: string, priority: Priority) => boolean
  setPriority: (ids: string[], priority: Priority) => void
  requestInfo: (reportId: string, body: string) => void
  rate: (reportId: string, rating: number, feedback: string) => void
  reopen: (reportId: string, reason: string) => void
  confirm: (reportId: string) => void
  markRead: (id: string) => void
  markAllRead: () => void
  publishAnnouncement: (input: { title: string; body: string; kind: Announcement['kind']; locationId?: string }) => void
  setAnnouncementActive: (id: string, active: boolean) => void
  addLost: (input: { title: string; place: string; detail: string; kind: LostItem['kind']; contact: string }) => void
  setLostStatus: (id: string, status: LostItem['status']) => void
  updateUser: (id: string, patch: Partial<Pick<User, 'role' | 'suspended' | 'departmentId'>>) => void
  updateDepartment: (id: string, patch: Partial<Pick<Department, 'lead' | 'email'>>) => void
  updateCategory: (id: string, patch: Partial<Pick<Category, 'active' | 'slaHours'>>) => void
  extendDue: (reportId: string) => void
  updateProfile: (patch: Partial<Pick<User, 'name' | 'unit' | 'identifier' | 'notifyInApp' | 'notifyEmail' | 'notifyPush'>>) => Promise<string | null>
  changePassword: (password: string) => Promise<boolean>
  recordExport: () => void
  resetDemo: () => void
}

const Ctx = createContext<Api | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const remote = isRemote
  const [state, setState] = useState<AppState>(() => (remote ? shell() : load()))
  const [ready, setReady] = useState(!remote)
  const [dbError, setDbError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  const readyRef = useRef(!remote)
  const epoch = useRef(0)
  const writing = useRef(0)
  stateRef.current = state

  useEffect(() => {
    if (remote) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs))
      } catch {
        /* Preferences stay in memory for this tab. */
      }
      return
    }
    persist(state)
  }, [state, remote])

  useEffect(() => {
    document.documentElement.lang = state.prefs.lang === 'bn' ? 'bn' : 'en'
    document.documentElement.classList.toggle('text-large', state.prefs.textSize === 'large')
    document.documentElement.classList.toggle('contrast', state.prefs.contrast)
  }, [state.prefs])

  useEffect(() => {
    if (!remote || !supabase) return
    const client = supabase
    let alive = true
    const apply = (session: Session | null) => {
      const seen = epoch.current
      if (writing.current > 0) return
      void pullCampus(session).then((next) => {
        if (!alive || seen !== epoch.current || writing.current > 0) return
        next.prefs = stateRef.current.prefs
        readyRef.current = true
        setReady(true)
        setDbError(takePullError())
        stateRef.current = next
        setState(next)
      }).catch((error: unknown) => {
        if (!alive) return
        readyRef.current = true
        setReady(true)
        setDbError(error instanceof Error ? error.message : 'The campus database did not respond.')
      })
    }
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'TOKEN_REFRESHED') return
      window.setTimeout(() => apply(session), 0)
    })
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      void client.auth.getSession().then(({ data }) => apply(data.session))
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      alive = false
      subscription.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [remote])

  useEffect(() => {
    if (remote) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue) as { state?: AppState }
        if (parsed.state) setState(parsed.state)
      } catch {
        /* Ignore unreadable preview data from another tab. */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toast = (text: string) => {
    const id = uid('t')
    setToasts((prev) => [...prev, { id, text }].slice(-4))
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4200)
  }

  const say = (en: string, bn: string) => toast(stateRef.current.prefs.lang === 'bn' ? bn : en)

  const update = (fn: (current: AppState) => AppState): Promise<string | null> => {
    const prev = stateRef.current
    const next = fn(prev)
    epoch.current += 1
    stateRef.current = next
    setState(next)
    if (!(remote && readyRef.current && supabase)) return Promise.resolve(null)
    const seen = epoch.current
    writing.current += 1
    return pushDiff(prev, next).then((error) => {
      writing.current = Math.max(0, writing.current - 1)
      if (!error) return null
      if (epoch.current === seen) {
        stateRef.current = prev
        setState(prev)
      }
      const detail = error.length > 180 ? `${error.slice(0, 180)}…` : error
      toast(stateRef.current.prefs.lang === 'bn' ? `ক্যাম্পাস ডেটাবেস এই পরিবর্তন নেয়নি। ${detail}` : `The campus database rejected that change. ${detail}`)
      return error
    })
  }

  const userByEmail = (email: string) =>
    stateRef.current.users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase())

  const startSession = (email: string): 'unknown' | 'suspended' | 'unverified' | null => {
    const user = userByEmail(email)
    if (!user) return 'unknown'
    if (user.suspended) return 'suspended'
    if (!user.verified) return 'unverified'
    rememberUser(user)
    update((current) => ({ ...current, sessionUserId: user.id }))
    return null
  }

  const signInRemote = async (email: string, password: string): Promise<'unknown' | 'suspended' | 'unverified' | 'password' | null> => {
    if (!supabase) return 'unknown'
    const address = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: address, password })
    if (error || !data.session) return 'password'
    const next = await pullCampus(data.session)
    next.prefs = stateRef.current.prefs
    const user = next.users.find((item) => item.email.toLowerCase() === address)
    if (!user) {
      await supabase.auth.signOut()
      return 'unknown'
    }
    if (user.suspended) {
      await supabase.auth.signOut()
      return 'suspended'
    }
    rememberUser(user)
    readyRef.current = true
    epoch.current += 1
    stateRef.current = next
    setReady(true)
    setState(next)
    return null
  }

  const buildReport = (current: AppState, user: User, input: ReportInput, status: Status): Report => {
    const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
    const stamp = nowIso()
    const sla = current.categories.find((category) => category.id === input.category)?.slaHours ?? 72
    const confidential = input.category === 'harassment' ? true : input.confidential
    let priority = input.priority
    if ((input.category === 'harassment' || input.category === 'safety') && (priority === 'low' || priority === 'medium')) {
      priority = 'high'
    }
    return {
      confirmations: [],
      infoRequested: false,
      activities: [],
      resolutionNote: '',
      ...existing,
      id: existing?.id || input.id || nextReportId(current.reports),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      subcategory: input.subcategory || '',
      locationId: input.locationId,
      locationDetail: input.locationDetail.trim(),
      lat: input.lat,
      lng: input.lng,
      photos: input.photos.slice(0, 3),
      confidential,
      anonymous: input.anonymous,
      status,
      priority,
      reporterId: user.id,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      dueAt: status === 'draft' ? (existing?.dueAt ?? addHours(stamp, sla)) : addHours(stamp, sla),
      blocksAccess: input.blocksAccess,
      contactWindow: confidential && !input.anonymous ? input.contactWindow.trim() : '',
      departmentId: status === 'draft' ? undefined : existing?.departmentId,
      assignee: status === 'draft' ? undefined : existing?.assignee,
    }
  }

  const api: Api = {
    state,
    currentUser: state.users.find((user) => user.id === state.sessionUserId) ?? null,
    lang: state.prefs.lang,
    tx: (en, bn) => (state.prefs.lang === 'bn' ? bn : en),
    toasts,
    toast,
    remote,
    ready,
    login: async (email, password) => {
      if (password.trim().length < 8) return 'password'
      if (remote) return signInRemote(email, password)
      return startSession(email)
    },
    loginDirect: async (email) => {
      if (remote) return signInRemote(email, DEMO_PASSWORD)
      return startSession(email)
    },
    logout: () => {
      if (remote && supabase) {
        void supabase.auth.signOut()
        return
      }
      update((current) => ({ ...current, sessionUserId: null }))
    },
    register: async ({ name, email, role, unit, identifier, password }) => {
      const clean = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'email'
      if (role !== 'student' && role !== 'teacher' && role !== 'staff') return 'role'
      if (password.trim().length < 8) {
        say('Use at least 8 characters.', 'কমপক্ষে ৮ অক্ষর দিন।')
        return 'email'
      }
      if (remote && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: clean,
          password,
          options: { data: { name: name.trim(), role, unit: unit.trim(), identifier: identifier.trim() } },
        })
        if (error) {
          if (!error.message.toLowerCase().includes('already')) say(error.message, error.message)
          return 'exists'
        }
        if (data.session) {
          const next = await pullCampus(data.session)
          next.prefs = stateRef.current.prefs
          const user = next.users.find((item) => item.email.toLowerCase() === clean)
          if (user) rememberUser(user)
          readyRef.current = true
          epoch.current += 1
          stateRef.current = next
          setReady(true)
          setState(next)
          return 'signed-in'
        }
        return null
      }
      if (stateRef.current.users.some((user) => user.email === clean)) return 'exists'
      const user: User = {
        id: uid('u'),
        name: name.trim(),
        email: clean,
        role,
        unit: unit.trim(),
        identifier: identifier.trim(),
        verified: true,
        suspended: false,
        notifyInApp: true,
        notifyEmail: true,
        notifyPush: false,
      }
      rememberUser(user)
      update((current) => ({
        ...current,
        users: [...current.users, user],
        sessionUserId: user.id,
      }))
      return 'signed-in'
    },
    verify: (email, code) => {
      const key = `verify:${email.trim().toLowerCase()}`
      const expected = stateRef.current.codes[key]
      if (!expected || expected !== code.trim()) {
        say('That code does not match the demo inbox.', 'কোডটি ডেমো ইনবক্সের সাথে মেলেনি।')
        return false
      }
      update((current) => ({
        ...current,
        users: current.users.map((user) => (user.email === email.trim().toLowerCase() ? { ...user, verified: true } : user)),
        codes: { ...current.codes, [key]: '' },
      }))
      say('Email marked verified for this preview.', 'এই প্রিভিউতে ইমেইল যাচাই হয়েছে।')
      return true
    },
    resend: (email) => {
      const key = `verify:${email.trim().toLowerCase()}`
      update((current) => ({ ...current, codes: { ...current.codes, [key]: pin() } }))
    },
    requestReset: async (email) => {
      const address = email.trim().toLowerCase()
      if (remote && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(address)
        if (error) say('The reset email could not be sent.', 'রিসেট ইমেইল যায়নি।')
        else say('If that email has an account, a reset link is on its way.', 'এই ইমেইলে অ্যাকাউন্ট থাকলে রিসেট লিংক যাবে।')
        return !error
      }
      const user = userByEmail(address)
      if (!user) return false
      const key = `reset:${user.email}`
      update((current) => ({ ...current, codes: { ...current.codes, [key]: pin() } }))
      return true
    },
    completeReset: (email, code) => {
      const key = `reset:${email.trim().toLowerCase()}`
      if (stateRef.current.codes[key] !== code.trim()) {
        say('That reset code does not match.', 'রিসেট কোড মেলেনি।')
        return false
      }
      update((current) => ({ ...current, codes: { ...current.codes, [key]: '' } }))
      say('Password reset recorded. Sign in with any 8+ character password in this preview.', 'পাসওয়ার্ড রিসেট হয়েছে। এই প্রিভিউতে ৮ অক্ষরের যেকোনো পাসওয়ার্ডে ঢুকতে পারবেন।')
      return true
    },
    setLang: (lang) => update((current) => ({ ...current, prefs: { ...current.prefs, lang } })),
    setTextSize: (textSize) => update((current) => ({ ...current, prefs: { ...current.prefs, textSize } })),
    setContrast: (contrast) => update((current) => ({ ...current, prefs: { ...current.prefs, contrast } })),
    saveDraft: async (input) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user) return null
      if (!input.category || input.title.trim().length < 4) {
        say('Add a category and a short title before saving a draft.', 'খসড়া সেভ করতে বিভাগ ও ছোট একটি শিরোনাম দিন।')
        return null
      }
      const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
      if (existing && (existing.status !== 'draft' || existing.reporterId !== user.id)) return null
      const issued = input.id || !remote ? input : { ...input, id: (await allocateReportId()) ?? undefined }
      const report = buildReport(current, user, issued, 'draft')
      const error = await update((prev) => replaceReport(prev, buildReport(prev, user, { ...issued, id: report.id }, 'draft')))
      if (error) return null
      say(remote ? 'Draft saved to the campus database.' : 'Draft saved in this browser.', remote ? 'খসড়া ক্যাম্পাস ডেটাবেসে সেভ হয়েছে।' : 'খসড়া এই ব্রাউজারে সেভ হয়েছে।')
      return report.id
    },
    submitReport: async (input) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      if (!user) return null
      if (input.title.trim().length < 8 || input.description.trim().length < 20 || !input.locationId) {
        say('Add a title, a fuller description, and a campus place.', 'শিরোনাম, বিস্তারিত বিবরণ এবং ক্যাম্পাসের স্থান দিন।')
        return null
      }
      const existing = input.id ? current.reports.find((report) => report.id === input.id) : undefined
      if (existing && (existing.status !== 'draft' || existing.reporterId !== user.id)) return null
      const dayAgo = Date.now() - 86_400_000
      const recent = current.reports.filter(
        (report) => report.reporterId === user.id && report.status !== 'draft' && new Date(report.createdAt).getTime() > dayAgo,
      )
      if (recent.length >= 5) {
        say('One account can file five reports a day.', 'একটি অ্যাকাউন্ট থেকে দিনে পাঁচটি রিপোর্ট যায়।')
        return null
      }
      const issued = input.id || !remote ? input : { ...input, id: (await allocateReportId()) ?? undefined }
      const created = buildReport(current, user, issued, 'submitted')
      const submitted: Report = {
        ...created,
        activities: [...created.activities, activity('Safely', 'public', 'system', created.anonymous ? 'Anonymous report submitted.' : 'Report submitted.')],
      }
      const error = await update((prev) => {
        let next = replaceReport(prev, submitted)
        const audience = deskAudience(next, submitted).filter((item) => item.id !== user.id)
        const href = `/admin/reports/${submitted.id}`
        const title = submitted.confidential ? 'Confidential report submitted' : 'New campus report'
        const body = submitted.confidential ? `${submitted.id} is in the restricted queue.` : `${submitted.id}: ${submitted.title}`
        next = withNotes(next, audience, title, body, href)
        if (user.notifyInApp) {
          next = withNotes(next, [user], 'Your report has been received.', `${submitted.id} is with the campus desk.`, `/app/reports/${submitted.id}`, 'received')
        }
        return next
      })
      if (error) return null
      say(`Submitted ${submitted.id}.`, `${submitted.id} জমা হয়েছে।`)
      return submitted.id
    },
    deleteDraft: (id) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        reports: current.reports.filter((report) => !(report.id === id && report.status === 'draft' && report.reporterId === user?.id)),
      }))
      say('Draft deleted.', 'খসড়া মুছে ফেলা হয়েছে।')
    },
    addComment: (reportId, body, visibility) => {
      const text = body.trim()
      if (text.length < 2) return
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || !canView(user, report)) return
      const internal = visibility === 'internal'
      const nextReport: Report = {
        ...report,
        updatedAt: nowIso(),
        infoRequested: internal ? report.infoRequested : false,
        activities: [...report.activities, activity(user.name, internal ? 'internal' : 'public', internal ? 'internal' : 'reply', text)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        if (!internal && report.reporterId && report.reporterId !== user.id) {
          const reporter = next.users.find((item) => item.id === report.reporterId)
          if (reporter) next = withNotes(next, [reporter], 'New update on your report', `${report.id} has a new reply.`, `/app/reports/${report.id}`)
        }
        if (!internal && report.reporterId === user.id) {
          next = withNotes(
            next,
            deskAudience(next, report).filter((item) => item.id !== user.id),
            'Reporter replied',
            `${report.id} has a reply from the reporter.`,
            `/admin/reports/${report.id}`,
          )
        }
        return next
      })
    },
    setStatus: (reportId, status, note, resolutionPhoto) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report) return false
      if (!allowedTransitions(user, report).includes(status)) {
        say('That status change is not available for this account.', 'এই অ্যাকাউন্ট থেকে এই স্ট্যাটাস বদলানো যাবে না।')
        return false
      }
      if ((status === 'rejected' || status === 'resolved' || status === 'reopened') && note.trim().length < 8) {
        say('Add a short note so the next person knows why.', 'কেন বদলালেন, ছোট একটি নোট দিন।')
        return false
      }
      const stamp = nowIso()
      const nextReport: Report = {
        ...report,
        status,
        updatedAt: stamp,
        rejectReason: status === 'rejected' ? note.trim() : report.rejectReason,
        resolutionNote: status === 'resolved' ? note.trim() : report.resolutionNote,
        resolutionPhoto: status === 'resolved' && resolutionPhoto ? resolutionPhoto : report.resolutionPhoto,
        resolvedAt: status === 'resolved' ? stamp : report.resolvedAt,
        closedAt: status === 'closed' ? stamp : report.closedAt,
        infoRequested: false,
        activities: [
          ...report.activities,
          activity('Safely', 'public', 'system', note.trim() ? `Status set to ${status.replaceAll('_', ' ')}. ${note.trim()}` : `Status set to ${status.replaceAll('_', ' ')}.`),
        ],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, `Set status to ${status.replaceAll('_', ' ')}`, report.id)
        const reporter = next.users.find((item) => item.id === report.reporterId)
        if (reporter && reporter.id !== user.id) {
          const href = `/app/reports/${report.id}`
          if (status === 'resolved') {
            next = withNotes(next, [reporter], 'Your report has been resolved.', `${report.id} is marked resolved. You can rate the work.`, href, 'resolved')
          } else {
            next = withNotes(next, [reporter], 'Report status changed', `${report.id} is now ${status.replaceAll('_', ' ')}.`, href)
          }
        }
        return next
      })
      say('Status updated.', 'স্ট্যাটাস আপডেট হয়েছে।')
      return true
    },
    assign: (reportId, departmentId, assignee, priority) => {
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      const department = current.departments.find((item) => item.id === departmentId)
      if (!user || !report || !department) return false
      if (user.role !== 'admin') {
        say('Only the operations desk can assign a department.', 'বিভাগ বরাদ্দ করতে পারবে অপারেশন ডেস্ক।')
        return false
      }
      if (!isOpen(report.status)) {
        say('Reopen the report before assigning it.', 'বরাদ্দের আগে রিপোর্টটি আবার খুলুন।')
        return false
      }
      if (assignmentBlocked(report, departmentId)) {
        say('Confidential reports stay with Security or Student Affairs.', 'গোপন রিপোর্ট শুধু নিরাপত্তা বা শিক্ষার্থী বিষয়ক দপ্তরে যাবে।')
        return false
      }
      const status: Status = report.status === 'submitted' || report.status === 'under_review' || report.status === 'reopened' ? 'assigned' : report.status
      const lead = assignee.trim() || department.lead
      const nextReport: Report = {
        ...report,
        departmentId,
        assignee: lead,
        priority,
        status,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'system', `Assigned to ${department.en}. Priority: ${priority}.`)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, `Assigned report to ${department.en}`, report.id)
        const office = next.users.filter((item) => item.departmentId === departmentId && item.id !== user.id)
        next = withNotes(next, office, 'Report assigned to your office', `${report.id} is on the ${department.en} desk.`, `/admin/reports/${report.id}`)
        const reporter = next.users.find((item) => item.id === report.reporterId)
        if (reporter && reporter.id !== user.id) {
          next = withNotes(next, [reporter], 'Your report has been assigned.', `${report.id} went to ${department.en}.`, `/app/reports/${report.id}`, 'assigned')
        }
        return next
      })
      say('Department assigned.', 'বিভাগ বরাদ্দ হয়েছে।')
      return true
    },
    setPriority: (ids, priority) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return
      update((current) => {
        const reports = current.reports.map((report) => (ids.includes(report.id) && report.status !== 'draft' ? { ...report, priority, updatedAt: nowIso() } : report))
        return withAudit({ ...current, reports }, user.name, `Set priority to ${priority} on ${ids.length} reports`, ids.join(', '))
      })
      say('Priority updated.', 'অগ্রাধিকার আপডেট হয়েছে।')
    },
    requestInfo: (reportId, body) => {
      const text = body.trim()
      if (text.length < 8) {
        say('Write the question you need answered.', 'যে প্রশ্নটির উত্তর দরকার, তা লিখুন।')
        return
      }
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || user.role !== 'admin') return
      if (report.anonymous && !report.reporterId) {
        say('This anonymous report has no reply channel.', 'এই বেনামি রিপোর্টে উত্তর দেওয়ার পথ নেই।')
        return
      }
      const nextReport: Report = {
        ...report,
        infoRequested: true,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'reply', text)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        next = withAudit(next, user.name, 'Asked the reporter for more information', report.id)
        const reporter = next.users.find((item) => item.id === report.reporterId)
        if (reporter) next = withNotes(next, [reporter], 'More information is needed.', `${report.id} needs a reply.`, `/app/reports/${report.id}`, 'info')
        return next
      })
      say('Question sent to the reporter.', 'প্রশ্ন রিপোর্টকারীর কাছে গেছে।')
    },
    rate: (reportId, rating, feedback) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        reports: current.reports.map((report) =>
          report.id === reportId && report.reporterId === user?.id && (report.status === 'resolved' || report.status === 'closed')
            ? { ...report, rating, feedback: feedback.trim(), updatedAt: nowIso() }
            : report,
        ),
      }))
      say('Thanks. The rating is on the report.', 'ধন্যবাদ। রেটিং রিপোর্টে যোগ হয়েছে।')
    },
    reopen: (reportId, reason) => {
      const text = reason.trim()
      if (text.length < 8) {
        say('Say what is still wrong.', 'কী এখনও ঠিক হয়নি, তা লিখুন।')
        return
      }
      const current = stateRef.current
      const user = current.users.find((item) => item.id === current.sessionUserId)
      const report = current.reports.find((item) => item.id === reportId)
      if (!user || !report || report.reporterId !== user.id) return
      if (report.status !== 'resolved' && report.status !== 'closed') return
      const nextReport: Report = {
        ...report,
        status: 'reopened',
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'public', 'system', `Reopened: ${text}`)],
      }
      update((prev) => {
        let next = replaceReport(prev, nextReport)
        const office = next.users.filter((item) => item.role === 'admin' || (report.departmentId && item.departmentId === report.departmentId))
        next = withNotes(next, office, 'Report reopened', `${report.id} was reopened by the reporter.`, `/admin/reports/${report.id}`)
        return withAudit(next, user.name, 'Reopened report', report.id)
      })
      say('Reopen request sent.', 'পুনরায় খোলার অনুরোধ গেছে।')
    },
    confirm: (reportId) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      const report = stateRef.current.reports.find((item) => item.id === reportId)
      if (!report || report.reporterId === user.id || report.confirmations.includes(user.id)) return
      if (report.confidential || report.anonymous || report.category === 'harassment' || report.category === 'safety') return
      update((current) => ({
        ...current,
        reports: current.reports.map((item) =>
          item.id === reportId ? { ...item, confirmations: [...item.confirmations, user.id], updatedAt: nowIso() } : item,
        ),
      }))
      say('You are counted on this report.', 'আপনাকে এই রিপোর্টের সাথে যোগ করা হয়েছে।')
    },
    markRead: (id) =>
      update((current) => ({
        ...current,
        notifications: current.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
      })),
    markAllRead: () => {
      const userId = stateRef.current.sessionUserId
      update((current) => ({
        ...current,
        notifications: current.notifications.map((item) => (item.userId === userId ? { ...item, read: true } : item)),
      }))
    },
    publishAnnouncement: (input) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || (user.role !== 'admin' && user.role !== 'security')) return
      const item: Announcement = {
        id: uid('an'),
        title: input.title.trim(),
        body: input.body.trim(),
        kind: input.kind,
        locationId: input.locationId || undefined,
        active: true,
        createdAt: nowIso(),
      }
      if (item.title.length < 4 || item.body.length < 8) return
      update((current) => {
        const next = withAudit({ ...current, announcements: [item, ...current.announcements] }, user.name, 'Published a campus alert', item.id)
        return withNotes(next, next.users.filter((account) => account.id !== user.id), item.title, item.body, '/app/alerts')
      })
      say('Alert published.', 'সতর্কতা প্রকাশ হয়েছে।')
    },
    setAnnouncementActive: (id, active) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user || user.role !== 'admin') return
      update((current) => withAudit({
        ...current,
        announcements: current.announcements.map((item) => (item.id === id ? { ...item, active } : item)),
      }, user.name, active ? 'Restored a campus alert' : 'Hid a campus alert', id))
    },
    addLost: (input) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      if (input.title.trim().length < 3 || input.place.trim().length < 2) return
      const item: LostItem = {
        id: uid('lf'),
        title: input.title.trim(),
        place: input.place.trim(),
        detail: input.detail.trim(),
        kind: input.kind,
        contact: input.contact.trim() || user.name,
        reporterId: user.id,
        status: 'open',
        createdAt: nowIso(),
      }
      update((current) => ({ ...current, lostFound: [item, ...current.lostFound] }))
      say('Posted on lost and found.', 'হারানো ও পাওয়া তালিকায় যোগ হয়েছে।')
    },
    setLostStatus: (id, status) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      update((current) => ({
        ...current,
        lostFound: current.lostFound.map((item) =>
          item.id === id && (item.reporterId === user?.id || user?.role === 'admin') ? { ...item, status } : item,
        ),
      }))
    },
    updateUser: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin' || actor.id === id && patch.suspended) return
      update((current) => withAudit({
        ...current,
        users: current.users.map((user) => (user.id === id ? { ...user, ...patch } : user)),
      }, actor.name, patch.suspended ? 'Suspended an account' : 'Updated an account role', id))
      say('Account updated.', 'অ্যাকাউন্ট আপডেট হয়েছে।')
    },
    updateDepartment: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin') return
      update((current) => withAudit({
        ...current,
        departments: current.departments.map((department) => (department.id === id ? { ...department, ...patch } : department)),
      }, actor.name, 'Updated a department', id))
    },
    updateCategory: (id, patch) => {
      const actor = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!actor || actor.role !== 'admin') return
      update((current) => ({
        ...current,
        categories: current.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
      }))
    },
    extendDue: (reportId) => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      const report = stateRef.current.reports.find((item) => item.id === reportId)
      if (!user || !report || user.role !== 'admin' || !isOpen(report.status)) return
      const dueAt = addHours(report.dueAt, 24)
      const nextReport: Report = {
        ...report,
        dueAt,
        updatedAt: nowIso(),
        activities: [...report.activities, activity(user.name, 'internal', 'internal', 'Target time extended by 24 hours.')],
      }
      update((prev) => withAudit(replaceReport(prev, nextReport), user.name, 'Extended the target time by 24 hours', report.id))
      say('Target time extended by 24 hours.', 'লক্ষ্য সময় ২৪ ঘণ্টা বাড়ানো হয়েছে।')
    },
    updateProfile: (patch) => {
      const userId = stateRef.current.sessionUserId
      return update((current) => ({
        ...current,
        users: current.users.map((user) => {
          if (user.id !== userId) return user
          return {
            ...user,
            ...patch,
            name: patch.name !== undefined ? (patch.name.trim() || user.name) : user.name,
            unit: patch.unit !== undefined ? patch.unit.trim() : user.unit,
            identifier: patch.identifier !== undefined ? patch.identifier.trim() : user.identifier,
          }
        }),
      }))
    },
    changePassword: async (next) => {
      if (next.trim().length < 8) {
        say('Use at least 8 characters.', 'কমপক্ষে ৮ অক্ষর দিন।')
        return false
      }
      if (!remote || !supabase) {
        say('Choose a password when you create the account. This browser preview does not keep a separate password.', 'অ্যাকাউন্ট খোলার সময় পাসওয়ার্ড দিন। এই ব্রাউজার প্রিভিউ আলাদা পাসওয়ার্ড রাখে না।')
        return false
      }
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) {
        say(error.message, error.message)
        return false
      }
      say('Password updated.', 'পাসওয়ার্ড আপডেট হয়েছে।')
      return true
    },
    recordExport: () => {
      const user = stateRef.current.users.find((item) => item.id === stateRef.current.sessionUserId)
      if (!user) return
      update((current) => withAudit(current, user.name, 'Exported a report CSV', 'reports.csv'))
    },
    resetDemo: () => {
      if (remote && supabase) {
        void supabase.auth.getSession().then(async ({ data }) => {
          const next = await pullCampus(data.session)
          next.prefs = stateRef.current.prefs
          epoch.current += 1
          stateRef.current = next
          setState(next)
          say('Reloaded from the campus database.', 'ক্যাম্পাস ডেটাবেস থেকে আবার লোড হয়েছে।')
        })
        return
      }
      const fresh = buildSeed()
      setState(fresh)
      say('Preview data restored.', 'প্রিভিউ ডেটা ফিরিয়ে আনা হয়েছে।')
    },
  }

  return (
    <Ctx.Provider value={api}>
      {dbError ? <p className="bg-clay/10 px-4 py-2 text-sm text-clay">{dbError}</p> : null}
      {children}
      <div className="no-print fixed bottom-24 right-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2 md:bottom-4">
        {toasts.map((item) => (
          <button key={item.id} onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== item.id))} className="rounded-xl bg-ink px-4 py-3 text-left text-sm text-paper shadow-card">
            {item.text}
          </button>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useApp(): Api {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp must be used inside StoreProvider')
  return value
}
